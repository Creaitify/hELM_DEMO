import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import * as repo from '../graph/repository.js';
import { fleetBus } from '../agents/bus.js';
import {
  cancelRun,
  fleetMode,
  fleetSnapshot,
  isRunActive,
  liveRun,
  markRecommendationDecided,
  resumeAfterDecision,
  retryRun,
  startRun,
} from '../agents/orchestrator.js';
import { AGENTS, AGENT_ORDER, poweringTheFleet } from '../agents/registry.js';
import type { Decision, Recommendation } from '../domain/types.js';
import { invalid, notFound, requireCsrf, requireWorkspace, sendError } from './context.js';
import { resolveBasis } from './analytics.routes.js';
import { DEFAULT_SCOPE_ID, WINDOW_LABEL } from '../sample/constants.js';
import { INTENTS } from '../sample/intelligence.js';

/**
 * Intelligence.
 *
 * One canonical experience: an intent, the context it inherits, a durable run,
 * and a decision memo. The run streams its real stages — the fleet working
 * behind the scenes — rather than a fake percentage.
 */
export async function intelligenceRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>('/api/workspaces/:slug/intelligence', async (request, reply) => {
    try {
      const context = await requireWorkspace(request, request.params.slug, 'intelligence.read');
      const [runs, findings, campaigns] = await Promise.all([
        repo.listRuns(context.workspace.id),
        repo.listFindings(context.workspace.id),
        repo.listCampaigns(context.workspace.id),
      ]);

      return {
        runs,
        findings,
        campaigns,
        intents: INTENTS,
        canRun: context.can('intelligence.run'),
        canApprove: context.can('recommendations.approve'),
        fleet: {
          agents: AGENT_ORDER.map((key) => AGENTS[key]),
          powering: poweringTheFleet(),
          mode: fleetMode(),
        },
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get<{ Params: { slug: string; id: string } }>(
    '/api/workspaces/:slug/intelligence/:id',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'intelligence.read');
        // A working run's node states change faster than they are persisted,
        // so the in-memory copy wins while it exists.
        const stored = await repo.getRun(request.params.id);
        const run = liveRun(request.params.id) ?? stored;
        if (!run) throw notFound('That investigation no longer exists.');

        const findings = (await Promise.all(run.findingIds.map((id) => repo.getFinding(id)))).filter(
          (finding): finding is NonNullable<typeof finding> => Boolean(finding),
        );
        const recommendations = (
          await Promise.all(run.recommendationIds.map((id) => repo.getRecommendation(id)))
        ).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

        const evidenceIds = new Set(findings.flatMap((finding) => finding.evidenceIds));
        const evidence = (await Promise.all([...evidenceIds].map((id) => repo.getEvidence(id)))).filter(
          (entry): entry is NonNullable<typeof entry> => Boolean(entry),
        );

        return {
          run,
          findings,
          recommendations,
          evidence,
          decisions: await repo.listDecisions(run.id),
          invocations: await repo.listInvocations(run.id),
          artifact: run.artifactId ? await repo.getArtifact(run.artifactId) : null,
          accounts: await repo.listAccounts(context.workspace.id),
          live: isRunActive(run.id),
          canApprove: context.can('recommendations.approve'),
        };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /** Starts a run. Returns immediately; the fleet works behind the response. */
  app.post<{
    Params: { slug: string };
    Body: {
      intent?: string;
      question?: string;
      scopeId?: string;
      campaignIds?: string[];
      attachBrand?: boolean;
      generateCreative?: boolean;
    };
  }>('/api/workspaces/:slug/intelligence', async (request, reply) => {
    try {
      requireCsrf(request);
      const context = await requireWorkspace(request, request.params.slug, 'intelligence.run');

      const scopeId = request.body?.scopeId ?? DEFAULT_SCOPE_ID;
      const { snapshot, basis } = await resolveBasis(context.workspace.id, scopeId);

      const [accounts, campaigns, creatives] = await Promise.all([
        repo.listAccounts(context.workspace.id),
        repo.listCampaigns(context.workspace.id),
        repo.listCreatives(context.workspace.id),
      ]);

      const inScopeAccounts = accounts.filter((account) => snapshot.accountIds.includes(account.id));
      const inScopeCampaigns = campaigns.filter((campaign) => snapshot.accountIds.includes(campaign.accountId));

      const run = await startRun({
        workspaceId: context.workspace.id,
        workspaceSlug: context.workspace.slug,
        user: { id: context.user.id, name: context.user.name },
        intent: request.body?.intent ?? 'diagnose',
        question: request.body?.question,
        scopeId,
        scopeLabel: snapshot.label,
        rangeLabel: WINDOW_LABEL,
        currency: context.workspace.defaultCurrency,
        campaignIds: request.body?.campaignIds ?? [],
        attachBrand: request.body?.attachBrand ?? false,
        generateCreative: request.body?.generateCreative ?? false,
        accounts: inScopeAccounts,
        campaigns: inScopeCampaigns,
        creatives,
        basis,
      });

      return reply.status(202).send({ run });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { slug: string; id: string } }>(
    '/api/workspaces/:slug/intelligence/:id/cancel',
    async (request, reply) => {
      try {
        requireCsrf(request);
        await requireWorkspace(request, request.params.slug, 'intelligence.run');
        const cancelled = cancelRun(request.params.id);
        if (!cancelled) throw invalid('That run has already finished.');
        return { cancelled: true, run: await repo.getRun(request.params.id) };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /**
   * The live fleet feed for one run.
   *
   * Buffered events are replayed first, so a client that opens the stream
   * halfway through still sees the whole run before it follows live.
   */
  app.get<{ Params: { slug: string; id: string } }>(
    '/api/workspaces/:slug/intelligence/:id/stream',
    async (request, reply) => {
      try {
        await requireWorkspace(request, request.params.slug, 'intelligence.read');
        const runId = request.params.id;

        reply.raw.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        });

        const send = (event: unknown) => {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        for (const event of fleetBus.replay(runId)) send(event);

        const run = await repo.getRun(runId);
        if (run && !isRunActive(runId)) {
          send({ type: 'run.completed', runId, run, at: new Date().toISOString() });
        }

        const unsubscribe = fleetBus.subscribe(runId, send);
        const heartbeat = setInterval(() => reply.raw.write(': keep-alive\n\n'), 15000);

        request.raw.on('close', () => {
          clearInterval(heartbeat);
          unsubscribe();
        });

        return reply;
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /** The human decision. Nothing is applied to an ad account either way. */
  app.post<{
    Params: { slug: string; id: string; recommendationId: string };
    Body: { outcome?: Decision['outcome']; note?: string };
  }>(
    '/api/workspaces/:slug/intelligence/:id/recommendations/:recommendationId/decide',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'recommendations.approve');

        const outcome = request.body?.outcome;
        if (!outcome || !['approved', 'dismissed', 'revision_requested', 'saved'].includes(outcome)) {
          throw invalid('Choose approve, revise, save, or dismiss.', 'outcome');
        }

        const recommendation = await repo.getRecommendation(request.params.recommendationId);
        if (!recommendation) throw notFound('That recommendation no longer exists.');

        const status: Recommendation['status'] =
          outcome === 'approved'
            ? 'approved'
            : outcome === 'dismissed'
              ? 'dismissed'
              : outcome === 'revision_requested'
                ? 'revision_requested'
                : recommendation.status;

        await repo.upsertRecommendation({ ...recommendation, status });
        markRecommendationDecided(request.params.id, recommendation.id, status);

        const decision: Decision = {
          id: `dec_${randomUUID().slice(0, 8)}`,
          runId: request.params.id,
          recommendationId: recommendation.id,
          outcome,
          by: context.user.name,
          at: new Date().toISOString(),
          note: request.body?.note,
        };
        await repo.recordDecision(decision);
        await repo.recordAudit(context.workspace.id, {
          id: `aud_${randomUUID().slice(0, 8)}`,
          at: decision.at,
          actor: context.user.name,
          action: `${outcome.replace(/_/g, ' ')} a recommendation`,
          target: recommendation.action.slice(0, 80),
          context: `Run ${request.params.id}`,
        });

        void resumeAfterDecision(request.params.id);

        return { decision, recommendation: { ...recommendation, status } };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /** Re-runs the failed step without restarting the whole workflow. */
  app.post<{ Params: { slug: string; id: string } }>(
    '/api/workspaces/:slug/intelligence/:id/retry',
    async (request, reply) => {
      try {
        requireCsrf(request);
        await requireWorkspace(request, request.params.slug, 'intelligence.run');
        const retried = await retryRun(request.params.id);
        if (!retried) throw invalid('That run has no failed step to retry.');
        return { retried: true, run: await repo.getRun(request.params.id) };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { slug: string } }>('/api/workspaces/:slug/fleet', async (request, reply) => {
    try {
      const context = await requireWorkspace(request, request.params.slug, 'intelligence.read');
      return await fleetSnapshot(context.workspace.slug);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get<{ Params: { slug: string } }>('/api/workspaces/:slug/evidence', async (request, reply) => {
    try {
      await requireWorkspace(request, request.params.slug, 'intelligence.read');
      return { evidence: await repo.listEvidence() };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
