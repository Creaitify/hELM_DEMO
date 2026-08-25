import type { FastifyInstance } from 'fastify';
import * as repo from '../graph/repository.js';
import type { DataBasis, MetricKey, ScopeSnapshot } from '../domain/types.js';
import { notFound, requireWorkspace, sendError } from './context.js';
import * as sample from '../sample/constants.js';
import { channelContribution } from '../sample/campaigns.js';
import { seriesByMetric, decisionStorySeries, movementAnnotations } from '../sample/series.js';
import { scoreline } from '../sample/scoreline.js';

/**
 * Analytics reads.
 *
 * Every response carries the ScopeSnapshot that produced it and the DataBasis
 * it was computed on, so the frontend can never render a new scope's label
 * over an old scope's numbers.
 */

export async function resolveBasis(workspaceId: string, scopeId: string): Promise<{ snapshot: ScopeSnapshot; basis: DataBasis }> {
  const scopes = await repo.listScopes(workspaceId);
  const scope = scopes.find((entry) => entry.id === scopeId) ?? scopes[0];
  if (!scope) throw notFound('That account scope no longer exists.');

  const accounts = await repo.listAccounts(workspaceId);
  const inScope = accounts.filter((account) => scope.accountIds.includes(account.id));

  const reportingCurrency = inScope[0]?.currency ?? 'INR';
  const blendable = inScope.filter(
    (account) =>
      account.currency === reportingCurrency &&
      account.timeZone === inScope[0]?.timeZone &&
      account.health.state !== 'delayed' &&
      account.status === 'active',
  );

  const exclusions: string[] = [];
  for (const account of inScope) {
    if (blendable.some((entry) => entry.id === account.id)) continue;
    if (account.currency !== reportingCurrency) {
      exclusions.push(`${account.name} is separated: ${account.currency} on an ${account.timeZone} reporting day.`);
    } else if (account.health.message) {
      exclusions.push(account.health.message);
    } else {
      exclusions.push(`${account.name} is excluded from totals while it is ${account.health.state}.`);
    }
  }
  exclusions.push('The current partial day is excluded from every figure.');

  const basis: DataBasis = {
    accountIds: blendable.map((account) => account.id),
    startDateInclusive: sample.WINDOW_START,
    endDateInclusive: sample.WINDOW_END,
    comparisonStartDateInclusive: sample.COMPARE_START,
    comparisonEndDateInclusive: sample.COMPARE_END,
    completeThroughDate: sample.COMPLETE_THROUGH,
    accountBasis: blendable.map((account) => ({
      accountId: account.id,
      provider: account.provider,
      timeZone: account.timeZone,
      currency: account.currency,
      attributionLabel:
        account.provider === 'google_ads' ? 'Primary Purchase · 7-day click' : 'Purchase · 7-day click',
      freshness: account.health,
    })),
    aggregation:
      blendable.length === inScope.length
        ? { state: 'compatible' }
        : { state: 'separated', reasons: exclusions.slice(0, inScope.length - blendable.length) },
    exclusions,
  };

  const snapshot: ScopeSnapshot = {
    scopeId: scope.id,
    label: scope.label,
    accountIds: scope.accountIds,
    resolvedAt: new Date().toISOString(),
    schemaVersion: 3,
  };

  return { snapshot, basis };
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string }; Querystring: { scope?: string; range?: string; compare?: string } }>(
    '/api/workspaces/:slug/briefing',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'analytics.read');
        const scopeId = request.query.scope ?? sample.DEFAULT_SCOPE_ID;
        const { snapshot, basis } = await resolveBasis(context.workspace.id, scopeId);

        const [campaigns, timeline, findings] = await Promise.all([
          repo.listCampaigns(context.workspace.id),
          repo.listTimeline(context.workspace.id),
          repo.listFindings(context.workspace.id),
        ]);

        const inScope = campaigns.filter((campaign) => snapshot.accountIds.includes(campaign.accountId));

        return {
          snapshot,
          basis,
          state: basis.aggregation.state === 'compatible' ? 'success' : 'partial',
          scoreline,
          channelContribution,
          decisionStorySeries,
          movementAnnotations,
          campaigns: inScope,
          timeline,
          findings: findings.slice(0, 6),
        };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { slug: string }; Querystring: { scope?: string; metric?: string } }>(
    '/api/workspaces/:slug/series',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'analytics.read');
        const { snapshot, basis } = await resolveBasis(
          context.workspace.id,
          request.query.scope ?? sample.DEFAULT_SCOPE_ID,
        );
        const metric = (request.query.metric ?? 'spend') as MetricKey;
        const series = seriesByMetric[metric] ?? seriesByMetric.spend;
        return { snapshot, basis, state: 'success', series };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { slug: string }; Querystring: { scope?: string; platform?: string } }>(
    '/api/workspaces/:slug/campaigns',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'analytics.read');
        const { snapshot, basis } = await resolveBasis(
          context.workspace.id,
          request.query.scope ?? sample.DEFAULT_SCOPE_ID,
        );
        const all = await repo.listCampaigns(context.workspace.id);
        const inScope = all.filter((campaign) => snapshot.accountIds.includes(campaign.accountId));
        const platform = request.query.platform;
        const filtered =
          platform && platform !== 'all'
            ? inScope.filter((campaign) => campaign.provider === platform)
            : inScope;
        return { snapshot, basis, state: 'success', campaigns: filtered };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { slug: string; id: string }; Querystring: { scope?: string } }>(
    '/api/workspaces/:slug/campaigns/:id',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'analytics.read');
        const { snapshot, basis } = await resolveBasis(
          context.workspace.id,
          request.query.scope ?? sample.DEFAULT_SCOPE_ID,
        );
        const campaigns = await repo.listCampaigns(context.workspace.id);
        const campaign = campaigns.find((entry) => entry.id === request.params.id);
        if (!campaign) throw notFound('That campaign is no longer in this workspace.');

        const creatives = await repo.listCreatives(context.workspace.id, campaign.id);
        const findings = await repo.listFindings(context.workspace.id);

        return {
          snapshot,
          basis,
          state: 'success',
          campaign,
          creatives,
          findings: findings.filter((finding) => finding.affectedCampaignIds.includes(campaign.id)),
        };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { slug: string }; Querystring: { campaignId?: string } }>(
    '/api/workspaces/:slug/creatives',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'analytics.read');
        const creatives = await repo.listCreatives(context.workspace.id, request.query.campaignId);
        return { creatives };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );
}
