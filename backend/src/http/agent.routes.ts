import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import * as repo from '../graph/repository.js';
import type { Artifact, Finding, Recommendation } from '../domain/types.js';
import { startRun } from '../agents/orchestrator.js';
import {
  conciergeSystemPrompt,
  converse,
  type ConciergeAction,
  type ConciergeMessage,
  type ToolExecutor,
} from '../agents/concierge.js';
import { fold, roasOf, cpaOf } from '../domain/analytics.js';
import { invalid, requireCsrf, requireWorkspace, sendError, type WorkspaceContext } from './context.js';
import { deriveAnalytics, resolveBasis } from './analytics.routes.js';
import { memoMarkdown } from './export.routes.js';
import * as sample from '../sample/constants.js';

/**
 * The agent you talk to.
 *
 * Its tools are bound here rather than in the agent module because this is
 * where the composition already lives — the repository, the orchestrator and
 * the basis resolver. The agent module owns the conversation; this owns what
 * the conversation can reach.
 */

/** Trimmed so the model reads a summary rather than a database dump. */
function slim<T extends Record<string, unknown>>(rows: T[], limit: number): T[] {
  return rows.slice(0, limit);
}

function buildExecutor(context: WorkspaceContext): ToolExecutor {
  const workspaceId = context.workspace.id;
  const slug = context.workspace.slug;

  return async (name, input) => {
    switch (name) {
      case 'workspace_status': {
        const [accounts, connections, runs, findings] = await Promise.all([
          repo.listAccounts(workspaceId),
          repo.listConnections(workspaceId),
          repo.listRuns(workspaceId),
          repo.listFindings(workspaceId),
        ]);

        const active = runs.filter(
          (run) => run.stage !== 'complete' && run.stage !== 'failed' && run.stage !== 'cancelled',
        );

        return {
          result: {
            accounts: accounts.map((account) => ({
              name: account.name,
              provider: account.provider,
              currency: account.currency,
              health: account.health.state,
              note: account.health.message ?? null,
            })),
            connections: connections.map((connection) => ({
              provider: connection.provider,
              status: connection.status,
              live: Boolean(connection.live),
            })),
            investigationsInFlight: active.map((run) => ({
              id: run.id,
              title: run.title,
              stage: run.stage,
            })),
            decisionsWaiting: findings.filter((finding) => finding.severity === 'decision').length,
          },
        };
      }

      case 'performance_summary': {
        const { basis } = await resolveBasis(workspaceId, sample.DEFAULT_SCOPE_ID);
        const currency = basis.accountBasis[0]?.currency ?? context.workspace.defaultCurrency;
        const derived = await deriveAnalytics(workspaceId, basis, currency);

        if (!derived) {
          return {
            result: {
              measured: false,
              note: 'No measured rows for this window. Nothing can be stated about performance.',
            },
          };
        }

        const current = await repo.listMetricDays(workspaceId, {
          start: basis.startDateInclusive,
          end: basis.endDateInclusive,
          accountIds: basis.accountIds,
        });
        const totals = fold(current);

        return {
          result: {
            measured: true,
            window: `${basis.startDateInclusive} to ${basis.endDateInclusive}`,
            currency,
            spend: Math.round(totals.spend),
            attributedValue: totals.value === null ? null : Math.round(totals.value),
            conversions: totals.conversions,
            roas: roasOf(totals),
            cpa: cpaOf(totals),
            comparison: derived.scoreline.map((metric) => ({
              metric: metric.key,
              value: metric.value,
              previous: metric.previousValue,
              changeRatio: metric.deltaRatio,
            })),
            byPlatform: derived.channelContribution.map((channel) => ({
              platform: channel.label,
              spend: channel.spend,
              shareOfSpend: Number(channel.share.toFixed(3)),
            })),
            excluded: basis.exclusions,
          },
        };
      }

      case 'list_findings': {
        const findings = await repo.listFindings(workspaceId);
        const wanted = typeof input.severity === 'string' ? input.severity : null;
        const filtered = wanted ? findings.filter((finding) => finding.severity === wanted) : findings;

        // The same finding is restated by every run that still sees it.
        const seen = new Set<string>();
        const distinct = filtered.filter((finding) => {
          const key = finding.title.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        return {
          result: slim(
            distinct.map((finding: Finding) => ({
              id: finding.id,
              title: finding.title,
              observation: finding.observation,
              severity: finding.severity,
              confidence: finding.confidence,
              nextStep: finding.recommendedNextStep ?? null,
            })),
            8,
          ),
        };
      }

      case 'list_campaigns': {
        const campaigns = await repo.listCampaigns(workspaceId);
        return {
          result: slim(
            [...campaigns]
              .sort((a, b) => b.spend - a.spend)
              .map((campaign) => ({
                id: campaign.id,
                name: campaign.name,
                platform: campaign.provider,
                status: campaign.status,
                spend: campaign.spend,
                cpa: campaign.cpa,
                roas: campaign.roas,
                spendChangeRatio: campaign.deltaSpend,
                cpaChangeRatio: campaign.deltaCpa,
              })),
            12,
          ),
        };
      }

      case 'list_investigations': {
        const runs = await repo.listRuns(workspaceId);
        return {
          result: slim(
            runs.map((run) => ({
              id: run.id,
              title: run.title,
              stage: run.stage,
              findings: run.findingIds.length,
              canBeWrittenUp: run.stage === 'complete' || run.stage === 'waiting_for_approval',
            })),
            10,
          ),
        };
      }

      case 'start_investigation': {
        context.require('intelligence.run');

        const question = String(input.question ?? '').trim();
        if (!question) throw new Error('An investigation needs a question to answer.');

        const { snapshot, basis } = await resolveBasis(workspaceId, sample.DEFAULT_SCOPE_ID);
        const [accounts, campaigns, creatives] = await Promise.all([
          repo.listAccounts(workspaceId),
          repo.listCampaigns(workspaceId),
          repo.listCreatives(workspaceId),
        ]);

        const run = await startRun({
          workspaceId,
          workspaceSlug: slug,
          user: { id: context.user.id, name: context.user.name },
          intent: typeof input.intent === 'string' ? input.intent : 'diagnose',
          question,
          scopeId: snapshot.scopeId,
          scopeLabel: snapshot.label,
          rangeLabel: sample.WINDOW_LABEL,
          currency: context.workspace.defaultCurrency,
          campaignIds: [],
          attachBrand: true,
          generateCreative: false,
          accounts: accounts.filter((account) => snapshot.accountIds.includes(account.id)),
          campaigns: campaigns.filter((campaign) => snapshot.accountIds.includes(campaign.accountId)),
          creatives,
          basis,
        });

        const action: ConciergeAction = {
          tool: 'start_investigation',
          summary: `Started an investigation: ${run.title}`,
          href: `/w/${slug}/intelligence/${run.id}`,
        };

        return {
          result: {
            id: run.id,
            title: run.title,
            stage: run.stage,
            note: 'The fleet is working. It takes about a minute and lands on the Agent Fleet page.',
          },
          action,
        };
      }

      case 'write_memo': {
        context.require('library.create');

        const runId = String(input.runId ?? '').trim();
        const run = await repo.getRun(runId);
        if (!run) throw new Error('No such investigation.');

        const findings = (await Promise.all(run.findingIds.map((id) => repo.getFinding(id)))).filter(
          (entry): entry is Finding => Boolean(entry),
        );
        const recommendations = (
          await Promise.all(run.recommendationIds.map((id) => repo.getRecommendation(id)))
        ).filter((entry): entry is Recommendation => Boolean(entry));
        const decisions = await repo.listDecisions(run.id);
        const artifacts = (await repo.listArtifacts(workspaceId)).filter(
          (artifact) => artifact.linkedRunId === run.id,
        );

        const markdown = memoMarkdown({
          run,
          findings,
          recommendations,
          decisions,
          artifacts,
          workspaceName: context.workspace.name,
        });

        const document: Artifact = {
          id: `art_doc_${randomUUID().slice(0, 8)}`,
          title: `Decision memo — ${run.title}`,
          type: 'decision_memo',
          mode: 'reports',
          updatedAt: new Date().toISOString(),
          createdBy: `${context.user.name} · via HELM`,
          status: 'draft',
          summary: run.summary.slice(0, 240),
          linkedRunId: run.id,
          tags: [run.scopeLabel, `${findings.length} findings`],
          format: 'Markdown',
          content: markdown,
        };

        await repo.upsertArtifact(workspaceId, document);
        await repo.recordAudit(workspaceId, {
          id: `aud_${randomUUID().slice(0, 8)}`,
          at: document.updatedAt,
          actor: context.user.name,
          action: 'wrote a document through the agent',
          target: document.title,
          context: `From ${run.title}`,
        });

        return {
          result: { id: document.id, title: document.title, formats: ['pdf', 'doc', 'md', 'html', 'json'] },
          action: {
            tool: 'write_memo',
            summary: `Wrote “${document.title}” into Documents`,
            href: `/w/${slug}/documents`,
          },
        };
      }

      default:
        throw new Error(`No such tool: ${name}`);
    }
  };
}

export async function agentRoutes(app: FastifyInstance) {
  /**
   * One exchange with the workspace agent.
   *
   * The conversation is held by the client and sent whole each time. That
   * keeps the server stateless and means a reload starts a clean conversation,
   * which is the right default for a panel in the corner of a screen — nobody
   * expects the thing in the corner to remember last Tuesday.
   */
  app.post<{
    Params: { slug: string };
    Body: { messages?: ConciergeMessage[] };
  }>('/api/workspaces/:slug/agent', async (request, reply) => {
    try {
      requireCsrf(request);
      const context = await requireWorkspace(request, request.params.slug, 'intelligence.read');

      const messages = (request.body?.messages ?? [])
        .filter((message) => message && typeof message.content === 'string' && message.content.trim())
        .map((message) => ({
          role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: message.content.slice(0, 4000),
        }))
        // A long panel conversation is still a panel conversation.
        .slice(-16);

      if (messages.length === 0) throw invalid('Say something first.', 'messages');
      if (messages[messages.length - 1].role !== 'user') {
        throw invalid('The last message has to be yours.', 'messages');
      }

      const { snapshot } = await resolveBasis(context.workspace.id, sample.DEFAULT_SCOPE_ID);

      const result = await converse({
        system: conciergeSystemPrompt({
          workspaceName: context.workspace.name,
          userName: context.user.name,
          scopeLabel: snapshot.label,
          rangeLabel: sample.WINDOW_LABEL,
          currency: context.workspace.defaultCurrency,
        }),
        messages,
        execute: buildExecutor(context),
      });

      return result;
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
