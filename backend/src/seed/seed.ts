import * as repo from '../graph/repository.js';
import { graph } from '../graph/index.js';
import type { Member, Role, SessionUser, Workspace } from '../domain/types.js';
import * as sample from '../sample/constants.js';
import { ADVERTISER, CREATIVE_LINE, PRODUCT, campaigns, creatives } from '../sample/campaigns.js';
import { evidence, findings, recommendations, runs, decisions } from '../sample/intelligence.js';
import { artifacts, auditEntries, members, timeline } from '../sample/library.js';
import { metricDaysForCampaigns } from './metric-days.js';

/**
 * Seeds the Northstar Group sample workspace into the decision graph.
 *
 * The seed is idempotent: every write is an upsert keyed by id, so restarting
 * the service against a live Neo4j does not duplicate the graph. Sample rows
 * are marked so a real workspace can never be confused with them.
 */

const OWNER_EMAIL = (process.env.HELM_OWNER_EMAIL ?? sample.currentUser.email).toLowerCase();

/** The demo identity used when no Google client is configured. */
export const demoUser: SessionUser = {
  id: sample.currentUser.id,
  name: sample.currentUser.name,
  email: OWNER_EMAIL,
  title: sample.currentUser.title,
  identityProvider: 'demo',
};

/** Role assigned to a workspace's sample members, so RBAC is visible on screen. */
const MEMBER_ROLE_BY_EMAIL = new Map<string, Role>(
  members.map((member) => [member.email.toLowerCase(), member.role]),
);

export async function seedGraph(log: (message: string) => void = () => undefined) {
  const existing = await repo.getWorkspaceBySlug(sample.WORKSPACE_SLUG);

  // Workspaces
  for (const workspace of sample.workspaces as Workspace[]) {
    const { role: _role, ...stored } = workspace;
    await repo.upsertWorkspace(stored);
  }

  const northstar = sample.workspaces[0];

  // Identity + membership. The owner holds every permission; the other sample
  // members hold the roles the Team surface shows, so RBAC is demonstrable.
  await repo.upsertUser(demoUser);
  await repo.setMembership(demoUser.id, northstar.id, 'owner');
  await repo.setMembership(demoUser.id, sample.workspaces[1].id, 'analyst');
  await repo.setMembership(demoUser.id, sample.workspaces[2].id, 'viewer');

  for (const member of members as Member[]) {
    if (member.email.toLowerCase() === OWNER_EMAIL) continue;
    await repo.upsertUser({
      id: member.id,
      name: member.name,
      email: member.email.toLowerCase(),
      title: member.role === 'owner' ? 'Performance lead' : 'Member',
      identityProvider: 'demo',
    });
    await repo.setMembership(member.id, northstar.id, member.role, member.status);
  }

  // Connections, accounts, scopes, groups
  for (const connection of sample.connections) {
    await repo.upsertConnection(northstar.id, { ...connection, live: false });
  }
  for (const account of sample.accounts) {
    await repo.upsertAccount(account);
  }
  for (const scope of sample.scopes) {
    await repo.upsertScope(northstar.id, scope);
  }
  for (const group of sample.savedGroups) {
    await repo.upsertGroup(northstar.id, group);
  }

  // Delivery
  for (const campaign of campaigns) {
    await repo.upsertCampaign(campaign);
  }

  for (const creative of creatives) {
    await repo.upsertCreative(creative);
  }

  // The daily rows every blended figure is folded from. Seeding them means the
  // sample workspace reads through the same derivation a connected one does.
  const measured = metricDaysForCampaigns(
    campaigns,
    northstar.id,
    { start: sample.WINDOW_START, end: sample.WINDOW_END },
    { start: sample.COMPARE_START, end: sample.COMPARE_END },
  );
  await repo.upsertMetricDays(measured);

  // The guidance every generation inherits, as an editable object rather than
  // a constant compiled into the studio.
  await repo.upsertBrandKit(northstar.id, {
    id: 'brand_northstar',
    workspaceId: northstar.id,
    name: 'Northstar — Arc Bottle',
    advertiser: ADVERTISER,
    product: PRODUCT,
    campaignLine: CREATIVE_LINE,
    palette: 'Graphite, frost, deep cobalt, one warm coral annotation',
    audience: 'Broad prospecting · India',
    objective: 'Sales · purchase',
    guardrails: [
      'Never state a retention figure the product testing has not measured.',
      'No lifestyle gloss; the proof is the subject.',
      'One accent colour per frame.',
    ],
    isDefault: true,
    updatedAt: new Date().toISOString(),
  });
  log(`measured ${measured.length} campaign-days`);

  // Intelligence history
  for (const item of evidence) {
    await repo.upsertEvidence(item);
  }
  for (const run of runs) {
    await repo.upsertRun(northstar.id, { ...run, workspaceSlug: northstar.slug });
  }
  for (const finding of findings) {
    const owner = runs.find((run) => run.findingIds.includes(finding.id));
    await repo.upsertFinding(owner?.id ?? runs[0].id, { ...finding, authoredBy: 'analyst' });
  }
  for (const recommendation of recommendations) {
    await repo.upsertRecommendation({ ...recommendation, authoredBy: 'analyst' });
  }
  for (const decision of decisions) {
    await repo.recordDecision(decision);
  }

  // Library, timeline, audit
  for (const artifact of artifacts) {
    await repo.upsertArtifact(northstar.id, artifact);
  }
  for (const event of timeline) {
    await repo.upsertTimelineEvent(northstar.id, event);
  }
  for (const entry of auditEntries) {
    await repo.recordAudit(northstar.id, entry);
  }

  const counts = await graph().counts();
  log(
    existing
      ? `decision graph refreshed — ${counts.nodes} nodes, ${counts.relationships} relationships`
      : `decision graph seeded — ${counts.nodes} nodes, ${counts.relationships} relationships`,
  );
  return counts;
}

export function sampleRoleFor(email: string): Role | null {
  return MEMBER_ROLE_BY_EMAIL.get(email.toLowerCase()) ?? null;
}
