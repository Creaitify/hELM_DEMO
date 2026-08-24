import type {
  AnalyticRequest,
  HelmAdapter,
  Scoped,
} from '@/services/adapters/workspace-adapter';
import type { CampaignSummary, ContentState, MetricKey } from '@/contracts';

import * as constants from './constants';
import { campaigns, campaignById, creatives, creativesForCampaign } from './campaigns';
import { seriesFor } from './series';
import { scoreline } from './scoreline';
import { evidence, evidenceById, findings, recommendations, runById, runs } from './intelligence';
import { artifactById, artifacts, timeline } from './library';

export * from './constants';
export * from './series';
export * from './campaigns';
export * from './scoreline';
export * from './intelligence';
export * from './library';
export * from './public-content';

/** Which scopes resolve to which accounts, and which of those blend. */
function resolveSnapshot(scopeId: string) {
  const scope = constants.scopeById(scopeId);
  return {
    scopeId: scope.id,
    label: scope.label,
    accountIds: scope.accountIds,
    resolvedAt: constants.NOW_ISO,
    schemaVersion: 3,
  };
}

function scoped<T>(data: T, scopeId: string, state: ContentState = 'success'): Scoped<T> {
  return {
    data,
    snapshot: resolveSnapshot(scopeId),
    basis: constants.primaryBasis,
    state,
  };
}

function campaignsForScope(scopeId: string): CampaignSummary[] {
  const accountIds = new Set(constants.scopeById(scopeId).accountIds);
  return campaigns.filter((campaign) => accountIds.has(campaign.accountId));
}

/**
 * Mock implementation of the adapter surface. Latency is zero and
 * deterministic; nothing here reaches the network.
 */
export const mockAdapter: HelmAdapter = {
  listWorkspaces: () => constants.workspaces,
  getWorkspace: (slug) => constants.workspaces.find((workspace) => workspace.slug === slug),
  listAccounts: () => constants.accounts,
  listScopes: () => constants.scopes,
  listConnections: () => constants.connections,

  getScoreline: (request: AnalyticRequest) =>
    scoped(scoreline, request.scopeId, 'partial'),

  getSeries: (request: AnalyticRequest, metric: MetricKey) =>
    scoped(seriesFor(metric), request.scopeId),

  listCampaigns: (request: AnalyticRequest) =>
    scoped(campaignsForScope(request.scopeId), request.scopeId),

  getCampaign: (request: AnalyticRequest, campaignId: string) => {
    const campaign = campaignById(campaignId);
    return campaign ? scoped(campaign, request.scopeId) : undefined;
  },

  listCreatives: (request: AnalyticRequest, campaignId?: string) =>
    scoped(campaignId ? creativesForCampaign(campaignId) : creatives, request.scopeId),

  listTimeline: () => timeline,

  listFindings: (request: AnalyticRequest) => scoped(findings, request.scopeId),
  getEvidence: (id) => evidenceById(id),
  listRecommendations: (findingId) =>
    findingId ? recommendations.filter((rec) => rec.findingId === findingId) : recommendations,
  listRuns: () => runs,
  getRun: (id) => runById(id),

  listArtifacts: (_workspaceSlug, mode) =>
    mode ? artifacts.filter((artifact) => artifact.mode === mode) : artifacts,
  getArtifact: (id) => artifactById(id),
};

export const adapter = mockAdapter;
export { evidence };
