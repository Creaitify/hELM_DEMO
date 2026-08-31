import 'server-only';
import { apiGet, type ApiResult } from './server';
import type {
  AccountGroup,
  AccountScope,
  AdAccount,
  Artifact,
  AuditEntry,
  BrandKit,
  CampaignSummary,
  ChannelContribution,
  Connection,
  ConnectorDefinition,
  CreativeSummary,
  DataBasis,
  Decision,
  Evidence,
  Finding,
  IntelligenceRun,
  Member,
  MetricValue,
  Recommendation,
  Role,
  ScopeSnapshot,
  SeriesAnnotation,
  TimelineEvent,
  Workspace,
} from '@/contracts';
import type { AgentInvocation, FleetSnapshot } from '@/contracts/fleet';

/**
 * Typed reads for every product surface.
 *
 * One function per screen, returning exactly what that screen renders. Feature
 * components consume these domain shapes and never a raw network response.
 */

export type SessionResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      user: { id: string; name: string; email: string; title: string; picture?: string; identityProvider: 'google' | 'demo' };
      csrfToken: string;
      workspaces: Workspace[];
      permissionsByWorkspace: Record<string, string[]>;
      isPlatformAdmin?: boolean;
      capabilities: {
        graph: 'neon' | 'neo4j' | 'memory';
        identity: 'google' | 'demo' | 'disabled';
        rbac: 'enforced' | 'open';
        googleAds: 'live' | 'mock' | 'unconfigured';
        metaAds: 'live' | 'sample';
        reasoning: 'anthropic' | 'scripted';
        imageGeneration: 'gemini' | 'openai' | 'studio-render';
      };
    };

export const getSession = () => apiGet<SessionResponse>('/api/auth/session');

export type AuthConfig = {
  identity: 'google' | 'demo' | 'disabled';
  /** False while AUTH_ENABLED=false: there is nothing to sign in to. */
  authEnabled: boolean;
  rbacEnabled: boolean;
  googleConfigured: boolean;
  devLoginAllowed: boolean;
  signInLabel: string;
  devLoginLabel?: string;
};

export const getAuthConfig = () => apiGet<AuthConfig>('/api/auth/config');

export type WorkspaceResponse = {
  workspace: Workspace;
  role: Role;
  roleLabel: string;
  permissions: string[];
  accounts: AdAccount[];
  scopes: AccountScope[];
  groups: AccountGroup[];
  connections: Connection[];
};

export const getWorkspace = (slug: string) => apiGet<WorkspaceResponse>(`/api/workspaces/${slug}`);

export type BriefingResponse = {
  snapshot: ScopeSnapshot;
  basis: DataBasis;
  state: 'success' | 'partial';
  scoreline: MetricValue[];
  channelContribution: ChannelContribution[];
  decisionStorySeries: { label: string; provider: 'google_ads' | 'meta_ads'; points: { date: string; value: number | null }[] }[];
  movementAnnotations: SeriesAnnotation[];
  campaigns: CampaignSummary[];
  timeline: TimelineEvent[];
  findings: Finding[];
};

export const getBriefing = (slug: string, scope?: string) =>
  apiGet<BriefingResponse>(`/api/workspaces/${slug}/briefing${scope ? `?scope=${scope}` : ''}`);

export type CampaignsResponse = {
  snapshot: ScopeSnapshot;
  basis: DataBasis;
  campaigns: CampaignSummary[];
};

export const getCampaigns = (slug: string, query = '') =>
  apiGet<CampaignsResponse>(`/api/workspaces/${slug}/campaigns${query}`);

export type CampaignDetailResponse = {
  snapshot: ScopeSnapshot;
  basis: DataBasis;
  campaign: CampaignSummary;
  creatives: CreativeSummary[];
  findings: Finding[];
};

export const getCampaign = (slug: string, id: string) =>
  apiGet<CampaignDetailResponse>(`/api/workspaces/${slug}/campaigns/${id}`);

export type IntelligenceResponse = {
  runs: IntelligenceRun[];
  findings: Finding[];
  campaigns: CampaignSummary[];
  intents: readonly { id: string; label: string; detail: string }[];
  canRun: boolean;
  canApprove: boolean;
  /**
   * The whole fleet snapshot. It used to be declared as the cast list alone,
   * which silently dropped every health field the API was already sending.
   */
  fleet: FleetSnapshot & {
    mode: { reasoning: 'anthropic' | 'scripted'; images: string };
  };
};

export const getIntelligence = (slug: string) =>
  apiGet<IntelligenceResponse>(`/api/workspaces/${slug}/intelligence`);

export type RunResponse = {
  run: IntelligenceRun;
  findings: Finding[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  decisions: Decision[];
  invocations: AgentInvocation[];
  artifact: Artifact | null;
  accounts: AdAccount[];
  live: boolean;
  canApprove: boolean;
};

export const getRun = (slug: string, id: string) =>
  apiGet<RunResponse>(`/api/workspaces/${slug}/intelligence/${id}`);

export const getFleet = (slug: string) => apiGet<FleetSnapshot>(`/api/workspaces/${slug}/fleet`);

export type EvidenceListResponse = { evidence: Evidence[] };

/** Every record in the workspace, for surfaces that resolve ids in place. */
export const getEvidenceList = (slug: string) =>
  apiGet<EvidenceListResponse>(`/api/workspaces/${slug}/evidence`);

export type EvidenceRecordResponse = {
  evidence: Evidence;
  /** The findings that cite this record, so it never arrives as a loose table. */
  findings: Finding[];
  accounts: AdAccount[];
  runs: IntelligenceRun[];
};

export const getEvidenceRecord = (slug: string, id: string) =>
  apiGet<EvidenceRecordResponse>(`/api/workspaces/${slug}/evidence/${id}`);

export type LibraryResponse = {
  artifacts: Artifact[];
  counts: { reports: number; creative: number };
  canCreate: boolean;
  canPublish: boolean;
  create: {
    formats: { format: string; aspect: string; spec: string }[];
    startingPoints: { findingId: string; title: string; hint: string }[];
    inherited: Record<string, string>;
  };
};

export const getLibrary = (slug: string, mode?: 'reports' | 'creative') =>
  apiGet<LibraryResponse>(`/api/workspaces/${slug}/library${mode ? `?mode=${mode}` : ''}`);

export type StudioResponse = {
  canGenerate: boolean;
  provider: { key: 'gemini' | 'openai' | 'studio-render'; label: string; live: boolean; note: string };
  director: { name: string; gate: string };
  presets: { id: string; label: string; aspect: string; spec: string; channel: string }[];
  directions: string[];
  brand: Record<string, string>;
  startingPoints: { findingId: string; title: string; hint: string; campaignId?: string }[];
  fatiguedCreatives: { id: string; name: string; campaignId: string; frequency: number | null; note: string }[];
  campaigns: { id: string; name: string; provider: 'google_ads' | 'meta_ads' }[];
  recent: Artifact[];
  brandKits: BrandKit[];
  activeBrandKitId: string;
  canEditBrand: boolean;
};

export const getStudio = (slug: string) => apiGet<StudioResponse>(`/api/workspaces/${slug}/studio`);

export type DocumentFormat = { id: 'pdf' | 'doc' | 'md' | 'html' | 'json'; label: string; detail: string };

/** What the shelf says about itself, counted rather than modelled. */
export type DocumentAnalytics = {
  total: number;
  byStatus: Record<string, number>;
  words: number;
  /** Finished investigations nobody has written up yet. */
  unwrittenRuns: number;
  /** Share of finished investigations that have a document, or null if none. */
  coverage: number | null;
  lastWrittenAt: string | null;
};

export type DocumentsResponse = {
  documents: Artifact[];
  formats: DocumentFormat[];
  canWrite: boolean;
  canPublish: boolean;
  analytics?: DocumentAnalytics;
  /** Finished investigations, which are the only ones worth writing up. */
  sources: {
    id: string;
    title: string;
    stage: string;
    rangeLabel: string;
    scopeLabel: string;
    findingCount: number;
    alreadyWritten: boolean;
  }[];
};

export const getDocuments = (slug: string) =>
  apiGet<DocumentsResponse>(`/api/workspaces/${slug}/documents`);

/** The campaign report as it would be written right now, before filing it. */
export type CampaignReportPreview = {
  title: string;
  markdown: string;
  html: string;
  formats: DocumentFormat[];
  measured: boolean;
  campaignCount: number;
  findingCount: number;
};

export const getDocument = (slug: string, id: string) =>
  apiGet<{ document: Artifact; formats: DocumentFormat[]; html: string }>(
    `/api/workspaces/${slug}/documents/${id}`,
  );

export type ConnectionsResponse = {
  connections: Connection[];
  accounts: AdAccount[];
  connectors: ConnectorDefinition[];
  canManage: boolean;
  canDeleteData: boolean;
  providerConfiguration: Record<'google_ads' | 'meta_ads', { live: boolean; note: string }>;
};

export const getConnections = (slug: string) =>
  apiGet<ConnectionsResponse>(`/api/workspaces/${slug}/connections`);

export type MembersResponse = {
  members: Member[];
  canManage: boolean;
  assignableRoles: Role[];
  roleMatrix: { role: Role; label: string; permissions: string[] }[];
};

export const getBrandKits = (slug: string) =>
  apiGet<{ kits: BrandKit[]; canEdit: boolean }>(`/api/workspaces/${slug}/brand-kits`);

export const getMembers = (slug: string) => apiGet<MembersResponse>(`/api/workspaces/${slug}/members`);

export const getAudit = (slug: string) =>
  apiGet<{ entries: AuditEntry[] }>(`/api/workspaces/${slug}/audit`);

export type OpsResponse = {
  graph: { kind: 'neo4j' | 'memory'; ok: boolean; detail: string; nodes: number; relationships: number; labels: Record<string, number> };
  capabilities: Record<string, unknown>;
  providers: { key: string; label: string; configured: boolean }[];
  workspaces: { slug: string; name: string; role: Role; accounts: number }[];
  runs: { id: string; title: string; stage: string; startedAt: string; completedAt: string | null; workspaceSlug: string | null }[];
  connections: { id: string; provider: string; status: string; live: boolean; lastSyncAt: string | null }[];
  audit: AuditEntry[];
  fleet: FleetSnapshot;
};

export const getOps = () => apiGet<OpsResponse>('/api/ops/overview');

export type { ApiResult };
