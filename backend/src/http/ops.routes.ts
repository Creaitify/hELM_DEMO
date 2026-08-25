import type { FastifyInstance } from 'fastify';
import { capabilities, env, isPlatformAdmin } from '../env.js';
import { graph, graphStatus } from '../graph/index.js';
import * as repo from '../graph/repository.js';
import { fleetBus } from '../agents/bus.js';
import { fleetMode, fleetSnapshot } from '../agents/orchestrator.js';
import { anthropicHealth } from '../providers/anthropic.js';
import { notFound, requireSession, sendError } from './context.js';

/**
 * Operator console.
 *
 * A separately gated surface for platform operators: provider and model
 * health, the decision graph's shape, and cross-workspace run diagnostics.
 * Ops vocabulary never leaks into the product or the marketing site.
 *
 * Access is by PLATFORM_ADMIN_EMAILS, and a non-operator gets a not-found
 * rather than a forbidden — an ordinary member should not learn the console
 * exists from the shape of the refusal.
 */
export async function opsRoutes(app: FastifyInstance) {
  const requireOperator = (request: Parameters<typeof requireSession>[0]) => {
    const payload = requireSession(request);
    if (!isPlatformAdmin(payload.user.email)) {
      throw notFound('No route for that address.');
    }
    return payload;
  };

  app.get('/api/health', async () => {
    const status = graphStatus();
    return {
      ok: true,
      version: 1,
      graph: status,
      capabilities: capabilities(),
      fleet: fleetMode(),
      reasoning: anthropicHealth(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  });

  app.get('/api/ops/overview', async (request, reply) => {
    try {
      const payload = requireOperator(request);
      // An operator sees every workspace they hold membership in, plus the
      // platform-wide health that no ordinary member can read.
      const workspaces = await repo.listWorkspacesForUser(payload.user.id);

      const runs = (
        await Promise.all(workspaces.map((workspace) => repo.listRuns(workspace.id)))
      ).flat();
      const audit = (
        await Promise.all(workspaces.map((workspace) => repo.listAudit(workspace.id)))
      ).flat();
      const connections = (
        await Promise.all(workspaces.map((workspace) => repo.listConnections(workspace.id)))
      ).flat();

      const counts = await graph().counts();
      const fleet = await fleetSnapshot();

      return {
        graph: { ...graphStatus(), ...counts },
        capabilities: capabilities(),
        operator: { email: payload.user.email, adminCount: env.platform.adminEmails.length },
        providers: [
          {
            key: 'google_identity',
            label: 'Google identity',
            configured: Boolean(env.google.clientId && env.google.clientSecret),
          },
          {
            key: 'google_ads',
            label: 'Google Ads API',
            configured: capabilities().googleAds === 'live',
            note:
              capabilities().googleAds === 'mock'
                ? 'OAuth is live; reporting reads the sample portfolio.'
                : undefined,
          },
          { key: 'meta_ads', label: 'Meta Marketing API', configured: Boolean(env.meta.appId && env.meta.appSecret) },
          {
            key: 'anthropic',
            label: 'Anthropic',
            configured: anthropicHealth().state === 'live',
            note: anthropicHealth().state === 'live' ? undefined : anthropicHealth().detail,
          },
          {
            key: 'images',
            label: 'Image generation',
            configured: capabilities().imageGeneration !== 'studio-render',
          },
        ],
        workspaces: workspaces.map((workspace) => ({
          slug: workspace.slug,
          name: workspace.name,
          role: workspace.role,
          accounts: workspace.activeAccountCount,
        })),
        runs: runs
          .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
          .slice(0, 30)
          .map((run) => ({
            id: run.id,
            title: run.title,
            stage: run.stage,
            startedAt: run.startedAt,
            completedAt: run.completedAt ?? null,
            workspaceSlug: run.workspaceSlug ?? null,
          })),
        connections: connections.map((connection) => ({
          id: connection.id,
          provider: connection.provider,
          status: connection.status,
          live: Boolean(connection.live),
          lastSyncAt: connection.lastSyncAt,
        })),
        audit: audit.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 40),
        fleet,
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  /** Cross-workspace fleet feed for the operator console. */
  app.get('/api/ops/stream', async (request, reply) => {
    try {
      requireOperator(request);
      reply.raw.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });

      const unsubscribe = fleetBus.subscribeAll((event) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => reply.raw.write(': keep-alive\n\n'), 15000);

      request.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });

      return reply;
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
