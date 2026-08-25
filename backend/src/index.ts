import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env, setReasoningLive } from './env.js';
import { closeGraph, initGraph } from './graph/index.js';
import { verifyAnthropic } from './providers/anthropic.js';
import { seedGraph } from './seed/seed.js';
import { authRoutes } from './http/auth.routes.js';
import { workspaceRoutes } from './http/workspace.routes.js';
import { analyticsRoutes } from './http/analytics.routes.js';
import { connectionRoutes } from './http/connections.routes.js';
import { intelligenceRoutes } from './http/intelligence.routes.js';
import { libraryRoutes } from './http/library.routes.js';
import { exportRoutes } from './http/export.routes.js';
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

  // A key in .env is not the same as a key that works. Find out at boot.
  const reasoning = await verifyAnthropic();
  setReasoningLive(reasoning.state === 'live');
  app.log[reasoning.state === 'rejected' ? 'warn' : 'info'](`reasoning: ${reasoning.detail}`);

  await app.register(authRoutes);
  await app.register(workspaceRoutes);
  await app.register(analyticsRoutes);
  await app.register(connectionRoutes);
  await app.register(intelligenceRoutes);
  await app.register(libraryRoutes);
  await app.register(exportRoutes);
  await app.register(studioRoutes);
  await app.register(opsRoutes);

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: 'not_found', message: `No route for ${request.method} ${request.url}`, retryable: false },
    });
  });

  await app.listen({ port: env.port, host: env.host });
  app.log.info(`HELM API listening on ${env.apiUrl} — frontend origin ${env.siteUrl}`);
}

async function shutdown(signal: string) {
  app.log.info(`${signal} received, shutting down`);
  await app.close();
  await closeGraph();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
