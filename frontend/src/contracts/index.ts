/* ============================================================
   HELM frontend domain contracts.
   Feature components consume these, never raw network shapes.
   ============================================================ */

import type { WorkflowNode } from './fleet';

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
};

export type AccountScope =
  | { id: string; kind: 'all-compatible'; label: string; accountIds: string[] }
  | { id: string; kind: 'group'; label: string; accountIds: string[] }
  | { id: string; kind: 'selection'; label: string; accountIds: string[] };

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

/** Money never crosses a contract as a float. */
export type Money = {
  currency: string;
  minorUnits: string;
};

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

/** The resolved scope that actually produced a rendered dataset. */
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

export type MetricUnit = 'money' | 'count' | 'ratio' | 'percent' | 'multiple' | 'decimal';

export type MetricDefinition = {
  key: MetricKey;
  label: string;
  shortLabel?: string;
  unit: MetricUnit;
  /** Whether a rise is favourable, unfavourable, or context-dependent. */
  favorable: 'up' | 'down' | 'neutral';
  definition: string;
  formula?: string;
  caveat?: string;
  kind: 'observed' | 'calculated' | 'inferred';
};

export type MetricValue = {
  key: MetricKey;
  /** null means genuinely unavailable. Never estimate to fill a hole. */
  value: number | null;
  currency?: string;
  previousValue?: number | null;
  deltaRatio?: number | null;
  availability?: 'available' | 'partial' | 'unavailable';
  caveat?: string;
};

export type SeriesPoint = {
  date: string;
  value: number | null;
  comparisonValue?: number | null;
};

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

export type CreativeFatigue = 'healthy' | 'watch' | 'fatigued';

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
  fatigue: CreativeFatigue;
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
  /** Present on runs read from the API; sample fixtures omit it. */
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
  /**
   * The document itself, in Markdown, for artifacts that are read rather than
   * looked at. Frozen when written, so a memo reports what was decided then
   * rather than re-rendering against numbers that have since moved.
   */
  content?: string;
  /** A served asset path for generated creative. Never inline bytes. */
  imageUrl?: string;
  aspect?: string;
  /** The prompt that produced a generated image, kept for provenance. */
  prompt?: string;
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

export type AccountGroup = {
  id: string;
  label: string;
  accountIds: string[];
  createdBy: string;
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

export type Permission =
  | 'workspace.manage'
  | 'connections.manage'
  | 'recommendations.approve'
  | 'library.publish'
  | 'members.manage';

export type UserPreference = {
  locale: string;
  displayCurrency: string;
  numberFormat: 'compact' | 'exact';
  weekStart: 'monday' | 'sunday';
  reducedMotion: 'system' | 'always';
  briefingDigest: 'daily' | 'weekly' | 'off';
};

export type ContentState =
  | 'loading'
  | 'refreshing'
  | 'empty'
  | 'no_permission'
  | 'stale'
  | 'partial'
  | 'error'
  | 'offline'
  | 'success';

export type HelmError = {
  code:
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
  message: string;
  retryable: boolean;
  field?: string;
};

export type DateRangeKey = '7d' | '14d' | '30d' | '90d' | 'mtd';
export type ComparisonKey = 'previous' | 'previous_year' | 'none';
export type AnalysisLevel = 'campaign' | 'ad_group' | 'ad';

/** The guidance a generation inherits, editable rather than compiled in. */
export type BrandKit = {
  id: string;
  workspaceId: string;
  name: string;
  advertiser: string;
  product: string;
  campaignLine: string;
  palette: string;
  audience: string;
  objective: string;
  guardrails: string[];
  isDefault: boolean;
  updatedAt: string;
};

export type ChannelContribution = {
  provider: AdProviderKey;
  label: string;
  spend: number;
  value: number | null;
  share: number;
  deltaShare: number;
};
