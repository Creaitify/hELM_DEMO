import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env, setReasoningLive } from './env.js';
import { closeGraph, initGraph } from './graph/index.js';
import { verifyAnthropic } from './providers/anthropic.js';
import { seedGraph } from './seed/seed.js';
import { repairStoredFindings } from './seed/repair.js';
import { authRoutes } from './http/auth.routes.js';
import { workspaceRoutes } from './http/workspace.routes.js';
import { analyticsRoutes } from './http/analytics.routes.js';
import { connectionRoutes } from './http/connections.routes.js';
import { intelligenceRoutes } from './http/intelligence.routes.js';
import { libraryRoutes } from './http/library.routes.js';
import { exportRoutes } from './http/export.routes.js';
import { documentRoutes } from './http/documents.routes.js';
import { agentRoutes } from './http/agent.routes.js';
import { studioRoutes } from './http/studio.routes.js';
import { opsRoutes } from './http/ops.routes.js';

/**
 * The HELM API.
 *
 * The browser never calls this origin directly in production: the Next server
 * proxies same-origin /api paths here, so the session cookie belongs to the
 * public origin and provider tokens never leave the private network.
 */

const app = Fastify({
  logger: {
    level: env.isProduction ? 'info' : 'info',
    transport: env.isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } },
  },
  trustProxy: true,
});

async function main() {
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
    allowedHeaders: ['content-type', 'x-helm-csrf'],
  });

  await app.register(cookie, { secret: env.session.secret });

  await app.register(rateLimit, {
    max: 600,
    timeWindow: '1 minute',
    allowList: () => !env.isProduction,
  });

  await initGraph((message) => app.log.info(message));
  await seedGraph((message) => app.log.info(message));

  await app.register(authRoutes);
  await app.register(workspaceRoutes);
  await app.register(analyticsRoutes);
  await app.register(connectionRoutes);
  await app.register(intelligenceRoutes);
  await app.register(libraryRoutes);
  await app.register(exportRoutes);
  await app.register(documentRoutes);
  await app.register(agentRoutes);
  await app.register(studioRoutes);
  await app.register(opsRoutes);

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: 'not_found', message: `No route for ${request.method} ${request.url}`, retryable: false },
    });
  });

  await app.listen({ port: env.port, host: env.host });
  app.log.info(`HELM API listening on ${env.apiUrl} — frontend origin ${env.siteUrl}`);

  /*
   * Everything past this point is startup work that nothing needs answered
   * before the first request, so it runs after the port is open rather than
   * in front of it.
   *
   * The reasoning probe is the reason this matters. It is a live call to
   * Anthropic with no deadline: while it blocked `listen`, a slow or
   * unreachable provider meant the API never started at all, and the whole
   * product showed "API unreachable" for a fault in one optional capability.
   * Reasoning is assumed live until the probe says otherwise, which is the
   * same assumption every request already makes.
   */
  void (async () => {
    try {
      // Findings written before the analyst derived its own figures carry an
      // empty metric strip and, in some cases, an exposure whose low and high
      // are the same wrong number. Recomputing them is idempotent and means
      // nobody has to know a repair was ever needed.
      await repairStoredFindings((message) => app.log.info(message));

      // A key in .env is not the same as a key that works. Find out at boot.
      const reasoning = await verifyAnthropic();
      setReasoningLive(reasoning.state === 'live');
      app.log[reasoning.state === 'rejected' ? 'warn' : 'info'](`reasoning: ${reasoning.detail}`);
    } catch (error) {
      app.log.warn(`startup checks did not complete: ${String(error)}`);
    }
  })();
}

async function shutdown(signal: string) {
  app.log.info(`${signal} received, shutting down`);
  await app.close();
  await closeGraph();
  process.exit(0);
}

/*
 * The last line of defence.
 *
 * Node ends the process on an unhandled rejection. Without this, one missing
 * `.catch` on a background write is indistinguishable from `kill -9` — the API
 * disappears, every in-flight request with it, and the only evidence is the
 * process exiting. That is far too large a consequence for the mistake.
 *
 * A rejection is logged and survived: the request that caused it has already
 * failed, and killing every other connection does not help anybody. An
 * uncaught exception is different — it unwound the stack, so state may be
 * inconsistent — and the process exits after the log has had a chance to
 * flush, which is what a supervisor expects.
 */
process.on('unhandledRejection', (reason) => {
  app.log.error({ err: reason }, 'unhandled promise rejection — surviving');
});

process.on('uncaughtException', (error) => {
  app.log.fatal({ err: error }, 'uncaught exception — exiting');
  setTimeout(() => process.exit(1), 100).unref();
});

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
