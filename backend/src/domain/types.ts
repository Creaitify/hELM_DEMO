import type { WorkflowNode } from './workflow.js';

export type {
  WorkflowNode,
  WorkflowNodeId,
  WorkflowNodeKind,
  WorkflowNodeState,
  WorkflowOutput,
  WorkflowOutputItem,
} from './workflow.js';

/**
 * Backend domain contracts.
 *
 * These mirror frontend/src/contracts/index.ts exactly where a value crosses
 * the wire. The frontend parses responses at its adapter boundary; this file
 * is the authority for what that boundary receives.
 */

export type ProviderKey = 'google_ads' | 'meta_ads' | 'upload';
export type AdProviderKey = Exclude<ProviderKey, 'upload'>;
export type Role = 'owner' | 'admin' | 'analyst' | 'viewer';

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  defaultCurrency: string;
  timeZone: string;
  role: Role;
  isSample: boolean;
  activeAccountCount: number;
  attention?: string;
};

export type SyncState =
  | 'never_synced'
  | 'fresh'
  | 'syncing'
  | 'partial'
  | 'delayed'
  | 'stale'
  | 'paused'
  | 'needs_reauthorization'
  | 'failed';

export type SyncHealth = {
  state: SyncState;
  lastSuccessfulSyncAt: string | null;
  nextScheduledSyncAt?: string | null;
  message?: string;
};

export type AdAccount = {
  id: string;
  provider: AdProviderKey;
  nativeId: string;
  name: string;
  parentLabel?: string;
  currency: string;
  timeZone: string;
  status: 'active' | 'disabled' | 'attention';
  connectionId: string;
  lastSyncedAt: string | null;
  health: SyncHealth;
  selected?: boolean;
};

export type AccountScope =
  | { id: string; kind: 'all-compatible'; label: string; accountIds: string[] }
  | { id: string; kind: 'group'; label: string; accountIds: string[] }
  | { id: string; kind: 'selection'; label: string; accountIds: string[] };

export type ConnectionStatus =
  | 'disconnected'
  | 'authorizing'
  | 'connected'
  | 'syncing'
  | 'paused'
  | 'needs_reauthorization'
  | 'attention';

export type Connection = {
  id: string;
  provider: ProviderKey;
  status: ConnectionStatus;
  identityLabel: string;
  accessibleAccounts: number;
  selectedAccounts: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  grantedReads: string[];
  message?: string;
  /** True when the connection was created through a real provider OAuth grant. */
  live?: boolean;
};

export type Money = { currency: string; minorUnits: string };

export type AccountDataBasis = {
  accountId: string;
  provider: AdProviderKey;
  timeZone: string;
  currency: string;
  attributionLabel: string;
  freshness: SyncHealth;
};

export type AggregationCompatibility =
  | { state: 'compatible' }
  | { state: 'converted'; reportingCurrency: string; conversionBasis: string }
  | { state: 'separated'; reasons: string[] };

export type DataBasis = {
  accountIds: string[];
  startDateInclusive: string;
  endDateInclusive: string;
  comparisonStartDateInclusive?: string;
  comparisonEndDateInclusive?: string;
  completeThroughDate: string;
  accountBasis: AccountDataBasis[];
  aggregation: AggregationCompatibility;
  exclusions: string[];
};

export type ScopeSnapshot = {
  scopeId: string;
  label: string;
  accountIds: string[];
  resolvedAt: string;
  schemaVersion: number;
};

export type MetricKey =
  | 'spend'
  | 'value'
  | 'roas'
  | 'cpa'
  | 'conversions'
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'cpc'
  | 'cpm'
  | 'frequency'
  | 'reach'
  | 'hook_rate'
  | 'hold_rate'
  | 'impression_share';

export type MetricValue = {
  key: MetricKey;
  value: number | null;
  currency?: string;
  previousValue?: number | null;
  deltaRatio?: number | null;
  availability?: 'available' | 'partial' | 'unavailable';
  caveat?: string;
};

export type SeriesPoint = { date: string; value: number | null; comparisonValue?: number | null };

export type SeriesAnnotation = {
  date: string;
  label: string;
  tone: 'neutral' | 'good' | 'warn' | 'bad';
};

export type MetricSeries = {
  metric: MetricKey;
  points: SeriesPoint[];
  annotations?: SeriesAnnotation[];
};

export type CampaignStatus = 'active' | 'limited' | 'paused' | 'ended' | 'learning';
export type IntelligenceFlag = 'decision' | 'watch' | 'stable' | 'none';

export type CampaignSummary = {
  id: string;
  name: string;
  provider: AdProviderKey;
  accountId: string;
  accountName: string;
  objective: string;
  status: CampaignStatus;
  spend: number;
  value: number | null;
  roas: number | null;
  cpa: number | null;
  conversions: number;
  impressions: number;
  clicks: number;
  ctr: number;
  frequency?: number;
  impressionShareLostToBudget?: number;
  deltaSpend: number;
  deltaCpa: number | null;
  currency: string;
  intelligence: IntelligenceFlag;
  intelligenceNote?: string;
  dailySpend: number[];
};

export type CreativeSummary = {
  id: string;
  name: string;
  campaignId: string;
  provider: AdProviderKey;
  format: 'video' | 'image' | 'carousel' | 'search_text';
  variant: 'product-proof' | 'field-use' | 'typographic' | 'search';
  spend: number;
  impressions: number;
  frequency: number | null;
  hookRate: number | null;
  holdRate: number | null;
  conversionRate: number | null;
  cpa: number | null;
  fatigue: 'healthy' | 'watch' | 'fatigued';
  firstSeen: string;
  note: string;
  hookRateTrend: number[];
};

export type EvidenceRow = {
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  mono?: boolean;
};

export type Evidence = {
  id: string;
  title: string;
  kind: 'observed' | 'calculated' | 'inferred';
  summary: string;
  rows: EvidenceRow[];
  series?: MetricSeries;
  basis: DataBasis;
  method?: string;
};

export type Finding = {
  id: string;
  title: string;
  observation: string;
  kind: 'observed' | 'calculated' | 'inferred';
  severity: 'decision' | 'watch' | 'stable';
  exposure?: { low: Money; high: Money; note: string };
  confidence: 'high' | 'medium' | 'low';
  confidenceNote: string;
  evidenceIds: string[];
  basis: DataBasis;
  recommendedNextStep?: string;
  affectedCampaignIds: string[];
  metricHighlights: MetricValue[];
  sourceAccountIds: string[];
  /** Which fleet agent authored this finding. */
  authoredBy?: AgentKey;
};

export type Recommendation = {
  id: string;
  findingId: string;
  action: string;
  rationale: string;
  assumptions: string[];
  risks: string[];
  affectedAccountIds: string[];
  affectedCampaignIds: string[];
  expectedDirection: 'increase' | 'decrease' | 'protect' | 'investigate';
  expectedRange: string;
  cap?: Money;
  horizon: string;
  stopConditions: string[];
  effort: 'low' | 'medium' | 'high';
  urgency: 'today' | 'this_week' | 'this_month';
  status: 'proposed' | 'approved' | 'revision_requested' | 'dismissed';
  authoredBy?: AgentKey;
};

/**
 * The stages of the HELM workflow, in order.
 *
 * These are the real steps a run passes through, not a progress bar: each one
 * maps to exactly one node the interface draws.
 */
export type RunStage =
  | 'queued'
  | 'collecting_data'
  | 'analyzing'
  | 'reviewing_analysis'
  | 'creating'
  | 'reviewing_creative'
  | 'waiting_for_approval'
  | 'generating_images'
  | 'complete'
  | 'cancelled'
  | 'blocked'
  | 'failed';

export type RunStageRecord = {
  stage: RunStage;
  label: string;
  state: 'done' | 'active' | 'pending' | 'skipped' | 'failed';
  detail?: string;
  at?: string;
};

export type IntelligenceRun = {
  id: string;
  /** Set when the run is written to the graph; sample fixtures omit it. */
  workspaceSlug?: string;
  /** The eight workflow nodes, in order, with their live state. */
  workflow?: WorkflowNode[];
  title: string;
  intent: string;
  stage: RunStage;
  stages: RunStageRecord[];
  startedAt: string;
  completedAt?: string;
  requestedBy: string;
  scopeLabel: string;
  rangeLabel: string;
  findingIds: string[];
  recommendationIds: string[];
  summary: string;
  artifactId?: string;
};

export type Decision = {
  id: string;
  runId: string;
  recommendationId: string;
  outcome: 'approved' | 'dismissed' | 'revision_requested' | 'saved';
  by: string;
  at: string;
  note?: string;
};

export type Artifact = {
  id: string;
  title: string;
  type:
    | 'decision_memo'
    | 'briefing_snapshot'
    | 'export'
    | 'creative_direction'
    | 'creative_variant'
    | 'copy_set'
    | 'generated_image';
  mode: 'reports' | 'creative';
  updatedAt: string;
  createdBy: string;
  status: 'draft' | 'in_review' | 'approved' | 'archived';
  linkedCampaignId?: string;
  linkedRunId?: string;
  summary: string;
  format?: string;
  tags: string[];
  /** Present for rendered creative. A served asset path under /api/studio/assets. */
  imageUrl?: string;
  aspect?: string;
  prompt?: string;
};

export type TimelineEvent = {
  id: string;
  at: string;
  kind: 'sync' | 'spend' | 'creative' | 'decision' | 'definition' | 'connection';
  title: string;
  detail: string;
  tone: 'neutral' | 'good' | 'warn' | 'bad';
  href?: string;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastActive: string;
  status: 'active' | 'invited';
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  context: string;
};

export type AccountGroup = {
  id: string;
  label: string;
  accountIds: string[];
  createdBy: string;
};

/* ---------------------------------------------------------------- fleet -- */

export type AgentKey = 'scout' | 'analyst' | 'creative' | 'imager';

export type AgentDefinition = {
  key: AgentKey;
  name: string;
  role: string;
  kind: 'retrieval' | 'reasoning' | 'planning' | 'generative';
  summary: string;
  /** Node labels this agent reads from the decision graph. */
  reads: string[];
  /** Node labels it writes back. */
  writes: string[];
  /** The review gate its output must clear before the run advances. */
  gate: string;
  order: number;
  model: string;
  setting: string;
};

export type AgentInvocationStatus = 'queued' | 'running' | 'review' | 'passed' | 'revised' | 'failed';

export type AgentInvocation = {
  id: string;
  runId: string;
  workspaceSlug: string;
  agent: AgentKey;
  status: AgentInvocationStatus;
  revision: number;
  startedAt: string;
  endedAt?: string;
  latencyMs?: number;
  /** Review-gate verdict written by the orchestrator, never by the specialist. */
  verdict?: 'passed' | 'revision_requested' | 'rejected';
  verdictNote?: string;
  qualityScore?: number;
  groundingScore?: number;
  tokensIn?: number;
  tokensOut?: number;
  producedIds: string[];
  note?: string;
};

export type FleetEvent =
  | { type: 'run.stage'; runId: string; stage: RunStage; label: string; at: string }
  | { type: 'workflow.node'; runId: string; node: WorkflowNode; at: string }
  | { type: 'agent.started'; runId: string; invocation: AgentInvocation; at: string }
  | { type: 'agent.progress'; runId: string; agent: AgentKey; message: string; at: string }
  | { type: 'agent.review'; runId: string; invocation: AgentInvocation; at: string }
  | { type: 'agent.finished'; runId: string; invocation: AgentInvocation; at: string }
  | { type: 'graph.write'; runId: string; label: string; detail: string; at: string }
  | { type: 'run.finding'; runId: string; finding: Finding; at: string }
  | { type: 'run.recommendation'; runId: string; recommendation: Recommendation; at: string }
  | { type: 'run.artifact'; runId: string; artifact: Artifact; at: string }
  | { type: 'run.completed'; runId: string; run: IntelligenceRun; at: string }
  | { type: 'run.failed'; runId: string; reason: string; at: string };

export type FleetAgentHealth = AgentDefinition & {
  live: boolean;
  runs: number;
  avgLatencyMs: number | null;
  lastRunAt: string | null;
  passRate: number | null;
};

export type FleetSnapshot = {
  agents: FleetAgentHealth[];
  powering: { label: string; value: string; note: string }[];
  activeRunId: string | null;
  activeSummary: string | null;
  activeProgress: number | null;
  invocations: AgentInvocation[];
};

/* ------------------------------------------------------------- identity -- */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  picture?: string;
  title: string;
  /** google when the identity came from a real Google sign-in. */
  identityProvider: 'google' | 'demo';
};

export type HelmErrorCode =
  | 'unauthenticated'
  | 'unauthorized'
  | 'network_unavailable'
  | 'service_unavailable'
  | 'needs_reauthorization'
  | 'partial_data'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'run_blocked';

/**
 * One campaign, one day, as the platform reported it.
 *
 * This is the grain everything else is derived from. A scoreline, a series, a
 * channel split and a window comparison are all folds over these rows for a
 * date range and a set of accounts — which is what makes them answerable for
 * any window rather than fixed at whatever the totals were written to be.
 *
 * Rows are immutable facts keyed by (account, campaign, date), so re-reading a
 * day from the provider corrects it in place instead of double-counting.
 */
export type MetricDay = {
  id: string;
  workspaceId: string;
  accountId: string;
  campaignId: string;
  provider: AdProviderKey;
  /** YYYY-MM-DD in the account's own time zone, as the platform reported it. */
  date: string;
  currency: string;
  spend: number;
  /** null when the platform reports no conversion value, never 0 as a stand-in. */
  value: number | null;
  conversions: number;
  impressions: number;
  clicks: number;
};

export function metricDayId(accountId: string, campaignId: string, date: string): string {
  return `md_${accountId}_${campaignId}_${date}`;
}

export type ChannelContribution = {
  provider: AdProviderKey;
  label: string;
  spend: number;
  value: number | null;
  share: number;
  deltaShare: number;
};

export type UserPreference = {
  locale: string;
  displayCurrency: string;
  numberFormat: 'compact' | 'exact';
  weekStart: 'monday' | 'sunday';
  reducedMotion: 'system' | 'always';
  briefingDigest: 'daily' | 'weekly' | 'off';
};

export type MetricUnit = 'money' | 'count' | 'ratio' | 'percent' | 'multiple' | 'decimal';

export type MetricDefinition = {
  key: MetricKey;
  label: string;
  shortLabel?: string;
  unit: MetricUnit;
  favorable: 'up' | 'down' | 'neutral';
  definition: string;
  formula?: string;
  caveat?: string;
  kind: 'observed' | 'calculated' | 'inferred';
};

export type ConnectorCapability =
  | 'campaigns'
  | 'ad_groups'
  | 'ads'
  | 'keywords'
  | 'creative'
  | 'daily_metrics';

export type ConnectorDefinition = {
  key: ProviderKey;
  label: string;
  accountNoun: string;
  supportsMultipleAccounts: boolean;
  capabilities: ConnectorCapability[];
  setupSteps: string[];
  readsPlainLanguage: string[];
  neverDoes: string[];
};
