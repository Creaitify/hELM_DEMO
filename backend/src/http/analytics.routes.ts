import type { FastifyInstance } from 'fastify';
import * as repo from '../graph/repository.js';
import type {
  ChannelContribution,
  DataBasis,
  MetricKey,
  MetricSeries,
  MetricValue,
  ScopeSnapshot,
  SeriesAnnotation,
  TimelineEvent,
} from '../domain/types.js';
import {
  channelContributionFrom,
  decisionStoryFrom,
  scorelineFrom,
  seriesFrom,
} from '../domain/analytics.js';
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

/**
 * Turns stored timeline events into chart annotations.
 *
 * Only events that actually moved a figure on the chart earn a mark. A healthy
 * sync and a person's own decision did not change the numbers, so annotating
 * them would be decoration competing with the series for attention.
 */
function annotationsFrom(events: TimelineEvent[], window: { start: string; end: string }): SeriesAnnotation[] {
  return events
    .filter((event) => {
      if (event.kind === 'spend' || event.kind === 'creative' || event.kind === 'definition') return true;
      return event.kind === 'sync' && event.tone !== 'good';
    })
    .map((event) => ({ date: event.at.slice(0, 10), label: event.title, tone: event.tone }))
    .filter((entry) => entry.date >= window.start && entry.date <= window.end)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export type DerivedAnalytics = {
  scoreline: MetricValue[];
  channelContribution: ChannelContribution[];
  seriesByMetric: Partial<Record<MetricKey, MetricSeries>>;
  decisionStorySeries: ReturnType<typeof decisionStoryFrom>;
  movementAnnotations: SeriesAnnotation[];
};

/**
 * Every blended figure for a basis, folded from the rows that produced it.
 *
 * Returns null when the workspace has no measured rows for the window, which
 * is the honest answer before anything has been ingested — the caller then
 * falls back to the sample portfolio rather than rendering an empty briefing
 * that looks like an account which stopped spending.
 */
export async function deriveAnalytics(
  workspaceId: string,
  basis: DataBasis,
  currency: string,
): Promise<DerivedAnalytics | null> {
  const window = { start: basis.startDateInclusive, end: basis.endDateInclusive };
  const comparison =
    basis.comparisonStartDateInclusive && basis.comparisonEndDateInclusive
      ? { start: basis.comparisonStartDateInclusive, end: basis.comparisonEndDateInclusive }
      : null;

  const current = await repo.listMetricDays(workspaceId, { ...window, accountIds: basis.accountIds });
  if (current.length === 0) return null;

  const [previous, timeline] = await Promise.all([
    comparison
      ? repo.listMetricDays(workspaceId, { ...comparison, accountIds: basis.accountIds })
      : Promise.resolve([]),
    repo.listTimeline(workspaceId),
  ]);

  const annotations = annotationsFrom(timeline, window);

  return {
    scoreline: scorelineFrom(current, previous, currency),
    channelContribution: channelContributionFrom(current, previous),
    seriesByMetric: seriesFrom(current, previous, window, comparison, annotations),
    decisionStorySeries: decisionStoryFrom(current, window),
    movementAnnotations: annotations,
  };
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string }; Querystring: { scope?: string; range?: string; compare?: string } }>(
    '/api/workspaces/:slug/briefing',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'analytics.read');
        const scopeId = request.query.scope ?? sample.DEFAULT_SCOPE_ID;
        const { snapshot, basis } = await resolveBasis(context.workspace.id, scopeId);

        const currency = basis.accountBasis[0]?.currency ?? context.workspace.defaultCurrency;
        const [campaigns, timeline, findings, derived] = await Promise.all([
          repo.listCampaigns(context.workspace.id),
          repo.listTimeline(context.workspace.id),
          repo.listFindings(context.workspace.id),
          deriveAnalytics(context.workspace.id, basis, currency),
        ]);

        const inScope = campaigns.filter((campaign) => snapshot.accountIds.includes(campaign.accountId));

        return {
          snapshot,
          basis,
          state: basis.aggregation.state === 'compatible' ? 'success' : 'partial',
          // Folded from the stored rows. The sample portfolio stands in only
          // for a workspace that has never measured anything.
          scoreline: derived?.scoreline ?? scoreline,
          channelContribution: derived?.channelContribution ?? channelContribution,
          decisionStorySeries: derived?.decisionStorySeries ?? decisionStorySeries,
          movementAnnotations: derived?.movementAnnotations ?? movementAnnotations,
          measured: derived !== null,
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
        const currency = basis.accountBasis[0]?.currency ?? context.workspace.defaultCurrency;
        const derived = await deriveAnalytics(context.workspace.id, basis, currency);
        const measured = derived?.seriesByMetric ?? null;

        // A metric with no measured rows falls back rather than answering with
        // an empty series, which a chart would draw as a flat line at zero.
        const series =
          measured?.[metric] ?? measured?.spend ?? seriesByMetric[metric] ?? seriesByMetric.spend;

        return { snapshot, basis, state: 'success', measured: derived !== null, series };
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
