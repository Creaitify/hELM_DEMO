import type {
  AccountScope,
  AdAccount,
  Artifact,
  CampaignSummary,
  Connection,
  ContentState,
  CreativeSummary,
  DataBasis,
  Evidence,
  Finding,
  IntelligenceRun,
  MetricKey,
  MetricSeries,
  MetricValue,
  Recommendation,
  ScopeSnapshot,
  TimelineEvent,
  Workspace,
} from '@/contracts';

/**
 * Feature adapter boundary.
 *
 * Features depend on this interface, never on the mock module directly, so a
 * future HTTP implementation is a swap rather than a rewrite. Every analytic
 * response carries the ScopeSnapshot that produced it.
 */

export type AnalyticRequest = {
  workspaceSlug: string;
  scopeId: string;
  range: string;
  compare: string;
};

export type Scoped<T> = {
  data: T;
  snapshot: ScopeSnapshot;
  basis: DataBasis;
  state: ContentState;
};

export interface WorkspaceAdapter {
  listWorkspaces(): Workspace[];
  getWorkspace(slug: string): Workspace | undefined;
  listAccounts(workspaceSlug: string): AdAccount[];
  listScopes(workspaceSlug: string): AccountScope[];
  listConnections(workspaceSlug: string): Connection[];
}

export interface AnalyticsAdapter {
  getScoreline(request: AnalyticRequest): Scoped<MetricValue[]>;
  getSeries(request: AnalyticRequest, metric: MetricKey): Scoped<MetricSeries>;
  listCampaigns(request: AnalyticRequest): Scoped<CampaignSummary[]>;
  getCampaign(request: AnalyticRequest, campaignId: string): Scoped<CampaignSummary> | undefined;
  listCreatives(request: AnalyticRequest, campaignId?: string): Scoped<CreativeSummary[]>;
  listTimeline(request: AnalyticRequest): TimelineEvent[];
}

export interface IntelligenceAdapter {
  listFindings(request: AnalyticRequest): Scoped<Finding[]>;
  getEvidence(id: string): Evidence | undefined;
  listRecommendations(findingId?: string): Recommendation[];
  listRuns(workspaceSlug: string): IntelligenceRun[];
  getRun(id: string): IntelligenceRun | undefined;
}

export interface LibraryAdapter {
  listArtifacts(workspaceSlug: string, mode?: 'reports' | 'creative'): Artifact[];
  getArtifact(id: string): Artifact | undefined;
}

export type HelmAdapter = WorkspaceAdapter & AnalyticsAdapter & IntelligenceAdapter & LibraryAdapter;
