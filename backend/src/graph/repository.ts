import { graph } from './index.js';
import { decryptSecret, encryptSecret } from '../auth/crypto.js';
import type {
  AccountGroup,
  AccountScope,
  AdAccount,
  Artifact,
  AuditEntry,
  BrandKit,
  CampaignSummary,
  Connection,
  CreativeSummary,
  Decision,
  Evidence,
  Finding,
  IntelligenceRun,
  Member,
  MetricDay,
  Recommendation,
  Role,
  SessionUser,
  TimelineEvent,
  Workspace,
  AgentInvocation,
} from '../domain/types.js';

/**
 * Domain reads and writes over the decision graph.
 *
 * Everything above this layer speaks in HELM entities. Nothing above it knows
 * whether the graph is Neo4j or the in-process store.
 */

/* ------------------------------------------------------------- identity -- */

export type StoredUser = SessionUser & { createdAt: string };

export async function upsertUser(user: SessionUser): Promise<StoredUser> {
  const existing = await graph().getNode<StoredUser>('User', user.id);
  const record: StoredUser = {
    ...user,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  await graph().upsertNode('User', user.id, record as unknown as Record<string, unknown>);
  return record;
}

export async function getUser(id: string): Promise<StoredUser | null> {
  return graph().getNode<StoredUser>('User', id);
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const users = await graph().listNodes<StoredUser>('User', { email: email.toLowerCase() });
  return users[0] ?? null;
}

export async function setMembership(userId: string, workspaceId: string, role: Role, status: Member['status'] = 'active') {
  await graph().relate({
    fromLabel: 'User',
    fromId: userId,
    type: 'MEMBER_OF',
    toLabel: 'Workspace',
    toId: workspaceId,
    props: { role, status, since: new Date().toISOString() },
  });
}

export async function removeMembership(userId: string, workspaceId: string) {
  await graph().unrelate({
    fromLabel: 'User',
    fromId: userId,
    type: 'MEMBER_OF',
    toLabel: 'Workspace',
    toId: workspaceId,
  });
}

export async function membershipRole(userId: string, workspaceId: string): Promise<Role | null> {
  const props = await graph().relationProps({
    fromLabel: 'User',
    fromId: userId,
    type: 'MEMBER_OF',
    toLabel: 'Workspace',
    toId: workspaceId,
  });
  const role = props?.role;
  return typeof role === 'string' ? (role as Role) : null;
}

/** A workspace as it is stored: the caller's role is resolved per request. */
type StoredWorkspace = Omit<Workspace, 'role'> & {
  /** Set when the workspace was provisioned from a work email domain. */
  domain?: string;
};

export async function listWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const nodes = await graph().neighbours<StoredWorkspace>('User', userId, 'MEMBER_OF', 'Workspace');
  const out: Workspace[] = [];
  for (const node of nodes) {
    const role = (await membershipRole(userId, node.id)) ?? 'viewer';
    out.push({ ...node, role });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getWorkspaceBySlug(slug: string): Promise<StoredWorkspace | null> {
  const found = await graph().listNodes<StoredWorkspace>('Workspace', { slug });
  return found[0] ?? null;
}

export async function upsertWorkspace(workspace: StoredWorkspace) {
  await graph().upsertNode('Workspace', workspace.id, workspace as unknown as Record<string, unknown>);
  return workspace;
}

/** Used by domain auto-join, so colleagues land in the workspace that exists. */
export async function findWorkspaceByDomain(domain: string): Promise<StoredWorkspace | null> {
  const found = await graph().listNodes<StoredWorkspace>('Workspace', { domain: domain.toLowerCase() });
  return found[0] ?? null;
}

export async function listMembers(workspaceId: string): Promise<Member[]> {
  const users = await graph().inbound<StoredUser>('Workspace', workspaceId, 'MEMBER_OF', 'User');
  const out: Member[] = [];
  for (const user of users) {
    const props = await graph().relationProps({
      fromLabel: 'User',
      fromId: user.id,
      type: 'MEMBER_OF',
      toLabel: 'Workspace',
      toId: workspaceId,
    });
    out.push({
      id: user.id,
      name: user.name,
      email: user.email,
      role: (props?.role as Role) ?? 'viewer',
      status: (props?.status as Member['status']) ?? 'active',
      lastActive: (props?.lastActive as string) ?? (props?.since as string) ?? user.createdAt,
    });
  }
  return out;
}

/* ---------------------------------------------------------- connections -- */

export async function listConnections(workspaceId: string): Promise<Connection[]> {
  const rows = await graph().neighbours<Connection>('Workspace', workspaceId, 'HAS_CONNECTION', 'Connection');
  const order = { google_ads: 0, meta_ads: 1, upload: 2 } as const;
  return rows.sort((a, b) => order[a.provider] - order[b.provider]);
}

export async function getConnection(id: string): Promise<Connection | null> {
  return graph().getNode<Connection>('Connection', id);
}

export async function upsertConnection(workspaceId: string, connection: Connection) {
  await graph().upsertNode('Connection', connection.id, connection as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Workspace',
    fromId: workspaceId,
    type: 'HAS_CONNECTION',
    toLabel: 'Connection',
    toId: connection.id,
  });
  return connection;
}

export type OAuthGrant = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
  accountIdentity?: string;
};

/**
 * Provider tokens live only here, keyed to the connection, never in a cookie.
 * They are encrypted at rest and decrypted for the length of one call.
 */
export async function storeGrant(connectionId: string, grant: OAuthGrant) {
  const id = `grant_${connectionId}`;
  await graph().upsertNode('OAuthGrant', id, {
    ...grant,
    accessToken: encryptSecret(grant.accessToken),
    refreshToken: grant.refreshToken ? encryptSecret(grant.refreshToken) : undefined,
    connectionId,
    updatedAt: new Date().toISOString(),
  });
  await graph().relate({
    fromLabel: 'Connection',
    fromId: connectionId,
    type: 'GRANTED',
    toLabel: 'OAuthGrant',
    toId: id,
  });
}

export async function readGrant(connectionId: string): Promise<OAuthGrant | null> {
  const stored = await graph().getNode<OAuthGrant>('OAuthGrant', `grant_${connectionId}`);
  if (!stored) return null;
  return {
    ...stored,
    accessToken: decryptSecret(stored.accessToken),
    refreshToken: stored.refreshToken ? decryptSecret(stored.refreshToken) : undefined,
  };
}

export async function deleteGrant(connectionId: string) {
  await graph().deleteNode('OAuthGrant', `grant_${connectionId}`);
}

/* -------------------------------------------------------------- accounts -- */

export async function listAccounts(workspaceId: string): Promise<AdAccount[]> {
  const connections = await listConnections(workspaceId);
  const out: AdAccount[] = [];
  for (const connection of connections) {
    const accounts = await graph().neighbours<AdAccount>('Connection', connection.id, 'PROVIDES', 'AdAccount');
    out.push(...accounts);
  }
  return out;
}

export async function upsertAccount(account: AdAccount) {
  await graph().upsertNode('AdAccount', account.id, account as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Connection',
    fromId: account.connectionId,
    type: 'PROVIDES',
    toLabel: 'AdAccount',
    toId: account.id,
  });
  return account;
}

export async function deleteAccount(id: string) {
  await graph().deleteNode('AdAccount', id);
}

export async function listScopes(workspaceId: string): Promise<AccountScope[]> {
  return graph().neighbours<AccountScope>('Workspace', workspaceId, 'IN_SCOPE', 'Scope');
}

export async function upsertScope(workspaceId: string, scope: AccountScope) {
  await graph().upsertNode('Scope', scope.id, scope as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Workspace',
    fromId: workspaceId,
    type: 'IN_SCOPE',
    toLabel: 'Scope',
    toId: scope.id,
  });
  return scope;
}

export async function listGroups(workspaceId: string): Promise<AccountGroup[]> {
  return graph().neighbours<AccountGroup>('Workspace', workspaceId, 'GROUPS', 'AccountGroup');
}

export async function upsertGroup(workspaceId: string, group: AccountGroup) {
  await graph().upsertNode('AccountGroup', group.id, group as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Workspace',
    fromId: workspaceId,
    type: 'GROUPS',
    toLabel: 'AccountGroup',
    toId: group.id,
  });
  return group;
}

export async function deleteGroup(id: string) {
  await graph().deleteNode('AccountGroup', id);
}

/* ------------------------------------------------------------- campaigns -- */

export async function listCampaigns(workspaceId: string): Promise<CampaignSummary[]> {
  const accounts = await listAccounts(workspaceId);
  const out: CampaignSummary[] = [];
  for (const account of accounts) {
    const campaigns = await graph().neighbours<CampaignSummary>(
      'AdAccount',
      account.id,
      'RUNS_CAMPAIGN',
      'Campaign',
    );
    out.push(...campaigns);
  }
  return out;
}

export async function upsertCampaign(campaign: CampaignSummary) {
  await graph().upsertNode('Campaign', campaign.id, campaign as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'AdAccount',
    fromId: campaign.accountId,
    type: 'RUNS_CAMPAIGN',
    toLabel: 'Campaign',
    toId: campaign.id,
  });
  return campaign;
}

export async function listCreatives(workspaceId: string, campaignId?: string): Promise<CreativeSummary[]> {
  if (campaignId) {
    return graph().neighbours<CreativeSummary>('Campaign', campaignId, 'HAS_CREATIVE', 'Creative');
  }
  const campaigns = await listCampaigns(workspaceId);
  const out: CreativeSummary[] = [];
  for (const campaign of campaigns) {
    out.push(
      ...(await graph().neighbours<CreativeSummary>('Campaign', campaign.id, 'HAS_CREATIVE', 'Creative')),
    );
  }
  return out;
}

export async function upsertCreative(creative: CreativeSummary) {
  await graph().upsertNode('Creative', creative.id, creative as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Campaign',
    fromId: creative.campaignId,
    type: 'HAS_CREATIVE',
    toLabel: 'Creative',
    toId: creative.id,
  });
  return creative;
}

/* ---------------------------------------------------------- intelligence -- */

export async function upsertRun(workspaceId: string, run: IntelligenceRun) {
  await graph().upsertNode('Run', run.id, run as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Run',
    fromId: run.id,
    type: 'IN_WORKSPACE',
    toLabel: 'Workspace',
    toId: workspaceId,
  });
  return run;
}

export async function getRun(id: string): Promise<IntelligenceRun | null> {
  return graph().getNode<IntelligenceRun>('Run', id);
}

export async function listRuns(workspaceId: string): Promise<IntelligenceRun[]> {
  const runs = await graph().inbound<IntelligenceRun>('Workspace', workspaceId, 'IN_WORKSPACE', 'Run');
  return runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export async function upsertInvocation(invocation: AgentInvocation) {
  await graph().upsertNode('Invocation', invocation.id, invocation as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Run',
    fromId: invocation.runId,
    type: 'INVOKED',
    toLabel: 'Invocation',
    toId: invocation.id,
  });
  return invocation;
}

export async function listInvocations(runId?: string): Promise<AgentInvocation[]> {
  const rows = runId
    ? await graph().neighbours<AgentInvocation>('Run', runId, 'INVOKED', 'Invocation')
    : await graph().listNodes<AgentInvocation>('Invocation');
  return rows.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export async function upsertFinding(runId: string, finding: Finding) {
  await graph().upsertNode('Finding', finding.id, finding as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Run',
    fromId: runId,
    type: 'PRODUCED',
    toLabel: 'Finding',
    toId: finding.id,
  });
  for (const evidenceId of finding.evidenceIds) {
    await graph().relate({
      fromLabel: 'Finding',
      fromId: finding.id,
      type: 'SUPPORTED_BY',
      toLabel: 'Evidence',
      toId: evidenceId,
    });
  }
  for (const campaignId of finding.affectedCampaignIds) {
    await graph().relate({
      fromLabel: 'Finding',
      fromId: finding.id,
      type: 'ABOUT_CAMPAIGN',
      toLabel: 'Campaign',
      toId: campaignId,
    });
  }
  for (const accountId of finding.sourceAccountIds) {
    await graph().relate({
      fromLabel: 'Finding',
      fromId: finding.id,
      type: 'ABOUT_ACCOUNT',
      toLabel: 'AdAccount',
      toId: accountId,
    });
  }
  return finding;
}

/**
 * Removes a run and everything that only existed because of it.
 *
 * Findings, recommendations and evidence belong to the run that produced them
 * — nothing else cites them — so deleting a run without them leaves rows that
 * still surface on the briefing with no way back to where they came from.
 * Artifacts are deliberately left: a memo somebody was handed is a record of
 * what was said at the time, and it outlives the investigation behind it.
 */
export async function deleteRunCascade(run: IntelligenceRun): Promise<void> {
  for (const findingId of run.findingIds) {
    const finding = await getFinding(findingId);
    for (const evidenceId of finding?.evidenceIds ?? []) {
      await graph().deleteNode('Evidence', evidenceId);
    }
    await graph().deleteNode('Finding', findingId);
  }
  for (const recommendationId of run.recommendationIds) {
    await graph().deleteNode('Recommendation', recommendationId);
  }
  for (const decision of await listDecisions(run.id)) {
    await graph().deleteNode('Decision', decision.id);
  }
  await graph().deleteNode('Run', run.id);
}

/**
 * Rewrites a finding in place.
 *
 * `upsertFinding` takes the producing run because it also draws the PRODUCED
 * edge. A finding that came from a fixture rather than a run has no such run,
 * and a maintenance pass that only changes figures does not need one — the
 * edges it already has are still correct.
 */
export async function updateFinding(finding: Finding): Promise<Finding> {
  await graph().upsertNode('Finding', finding.id, finding as unknown as Record<string, unknown>);
  return finding;
}

export async function getFinding(id: string) {
  return graph().getNode<Finding>('Finding', id);
}

export async function listFindings(workspaceId: string): Promise<Finding[]> {
  const runs = await listRuns(workspaceId);
  const seen = new Map<string, Finding>();
  for (const run of runs) {
    const findings = await graph().neighbours<Finding>('Run', run.id, 'PRODUCED', 'Finding');
    for (const finding of findings) seen.set(finding.id, finding);
  }
  const order = { decision: 0, watch: 1, stable: 2 } as const;
  return [...seen.values()].sort((a, b) => order[a.severity] - order[b.severity]);
}

export async function upsertEvidence(evidence: Evidence) {
  await graph().upsertNode('Evidence', evidence.id, evidence as unknown as Record<string, unknown>);
  return evidence;
}

export async function getEvidence(id: string) {
  return graph().getNode<Evidence>('Evidence', id);
}

export async function listEvidence(): Promise<Evidence[]> {
  return graph().listNodes<Evidence>('Evidence');
}

export async function upsertRecommendation(recommendation: Recommendation) {
  await graph().upsertNode(
    'Recommendation',
    recommendation.id,
    recommendation as unknown as Record<string, unknown>,
  );
  await graph().relate({
    fromLabel: 'Finding',
    fromId: recommendation.findingId,
    type: 'SUGGESTS',
    toLabel: 'Recommendation',
    toId: recommendation.id,
  });
  return recommendation;
}

export async function getRecommendation(id: string) {
  return graph().getNode<Recommendation>('Recommendation', id);
}

export async function listRecommendations(findingId?: string): Promise<Recommendation[]> {
  if (findingId) {
    return graph().neighbours<Recommendation>('Finding', findingId, 'SUGGESTS', 'Recommendation');
  }
  return graph().listNodes<Recommendation>('Recommendation');
}

export async function recordDecision(decision: Decision) {
  await graph().upsertNode('Decision', decision.id, decision as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Recommendation',
    fromId: decision.recommendationId,
    type: 'DECIDED',
    toLabel: 'Decision',
    toId: decision.id,
  });
  return decision;
}

export async function listDecisions(runId?: string): Promise<Decision[]> {
  const all = await graph().listNodes<Decision>('Decision');
  return runId ? all.filter((decision) => decision.runId === runId) : all;
}

/* ---------------------------------------------------------------- library -- */

export async function upsertArtifact(workspaceId: string, artifact: Artifact) {
  await graph().upsertNode('Artifact', artifact.id, artifact as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Workspace',
    fromId: workspaceId,
    type: 'BUILT',
    toLabel: 'Artifact',
    toId: artifact.id,
  });
  if (artifact.linkedRunId) {
    await graph().relate({
      fromLabel: 'Artifact',
      fromId: artifact.id,
      type: 'DERIVED_FROM',
      toLabel: 'Run',
      toId: artifact.linkedRunId,
    });
  }
  if (artifact.linkedCampaignId) {
    await graph().relate({
      fromLabel: 'Artifact',
      fromId: artifact.id,
      type: 'ABOUT_CAMPAIGN',
      toLabel: 'Campaign',
      toId: artifact.linkedCampaignId,
    });
  }
  return artifact;
}

export async function listArtifacts(workspaceId: string, mode?: 'reports' | 'creative'): Promise<Artifact[]> {
  const rows = await graph().neighbours<Artifact>('Workspace', workspaceId, 'BUILT', 'Artifact');
  const filtered = mode ? rows.filter((artifact) => artifact.mode === mode) : rows;
  return filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getArtifact(id: string) {
  return graph().getNode<Artifact>('Artifact', id);
}

export async function deleteArtifact(id: string) {
  await graph().deleteNode('Artifact', id);
}

/* ------------------------------------------------------- audit + history -- */

export async function recordAudit(workspaceId: string, entry: AuditEntry) {
  await graph().upsertNode('AuditEntry', entry.id, entry as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Workspace',
    fromId: workspaceId,
    type: 'RECORDED',
    toLabel: 'AuditEntry',
    toId: entry.id,
  });
  return entry;
}

export async function listAudit(workspaceId: string): Promise<AuditEntry[]> {
  const rows = await graph().neighbours<AuditEntry>('Workspace', workspaceId, 'RECORDED', 'AuditEntry');
  return rows.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 200);
}

export async function upsertTimelineEvent(workspaceId: string, event: TimelineEvent) {
  await graph().upsertNode('TimelineEvent', event.id, event as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Workspace',
    fromId: workspaceId,
    type: 'RECORDED',
    toLabel: 'TimelineEvent',
    toId: event.id,
  });
  return event;
}

export async function listTimeline(workspaceId: string): Promise<TimelineEvent[]> {
  const rows = await graph().neighbours<TimelineEvent>('Workspace', workspaceId, 'RECORDED', 'TimelineEvent');
  return rows.sort((a, b) => (a.at < b.at ? 1 : -1));
}

/* -------------------------------------------------------------- metrics -- */

/**
 * Daily rows, the grain every blended figure is folded from.
 *
 * Keyed by (account, campaign, date), so re-reading a day from the provider
 * corrects it rather than adding a second copy of it. Late conversions move
 * a day's numbers for weeks after the click, which makes idempotent rewrites
 * the normal case and not an error path.
 */
export async function upsertMetricDays(rows: MetricDay[]): Promise<number> {
  if (rows.length === 0) return 0;

  // In bulk, because a window of daily rows is hundreds for a seed and
  // thousands for a real account's history. Written one at a time, the
  // serverless connection is reaped before the loop finishes.
  return graph().upsertMany(
    'MetricDay',
    rows as unknown as (Record<string, unknown> & { id: string })[],
    rows.map((row) => ({
      fromLabel: 'AdAccount',
      fromId: row.accountId,
      type: 'MEASURED',
      toLabel: 'MetricDay',
      toId: row.id,
    })),
  );
}

/**
 * Every stored row for a workspace inside an inclusive date range.
 *
 * The date filter is applied here rather than in the store because the range
 * is a comparison, not an equality, and pushing it down would mean teaching
 * both stores a query language for one call site.
 */
export async function listMetricDays(
  workspaceId: string,
  range: { start: string; end: string; accountIds?: string[] },
): Promise<MetricDay[]> {
  // The store narrows by date when it can. Where it cannot, the filter below
  // still applies — the result is identical either way, only the volume read
  // off the wire differs.
  const store = graph();
  const rows = store.listNodesInDateRange
    ? await store.listNodesInDateRange<MetricDay>('MetricDay', { workspaceId }, range)
    : await store.listNodes<MetricDay>('MetricDay', { workspaceId });

  const wanted = range.accountIds ? new Set(range.accountIds) : null;
  return rows
    .filter((row) => row.date >= range.start && row.date <= range.end)
    .filter((row) => !wanted || wanted.has(row.accountId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Whether a workspace has any measured rows at all.
 *
 * This is a question about existence, and it used to be answered by reading
 * every row in the workspace and taking the length — the most expensive
 * possible way to find out whether a collection is empty. `some` stops at the
 * first row.
 */
export async function hasMetricDays(workspaceId: string): Promise<boolean> {
  const rows = await graph().listNodes<MetricDay>('MetricDay', { workspaceId });
  return rows.some(Boolean);
}

/* ----------------------------------------------------------- brand kits -- */

/**
 * The guidance a generation inherits.
 *
 * Held per workspace so a house running two brands can switch between them,
 * and so what the model was told is a thing somebody can read and correct
 * rather than a constant compiled into the studio.
 */
export async function listBrandKits(workspaceId: string): Promise<BrandKit[]> {
  const rows = await graph().neighbours<BrandKit>('Workspace', workspaceId, 'DEFINES', 'BrandKit');
  return rows.sort((a, b) => (a.isDefault === b.isDefault ? a.name.localeCompare(b.name) : a.isDefault ? -1 : 1));
}

export async function upsertBrandKit(workspaceId: string, kit: BrandKit): Promise<BrandKit> {
  // Exactly one default, so the studio never has to guess which to inherit.
  if (kit.isDefault) {
    for (const existing of await listBrandKits(workspaceId)) {
      if (existing.id !== kit.id && existing.isDefault) {
        await graph().upsertNode('BrandKit', existing.id, {
          ...existing,
          isDefault: false,
        } as unknown as Record<string, unknown>);
      }
    }
  }

  await graph().upsertNode('BrandKit', kit.id, kit as unknown as Record<string, unknown>);
  await graph().relate({
    fromLabel: 'Workspace',
    fromId: workspaceId,
    type: 'DEFINES',
    toLabel: 'BrandKit',
    toId: kit.id,
  });
  return kit;
}

export async function getBrandKit(id: string) {
  return graph().getNode<BrandKit>('BrandKit', id);
}

export async function deleteBrandKit(id: string) {
  await graph().deleteNode('BrandKit', id);
}
