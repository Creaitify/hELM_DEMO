import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { getFleet, getSession, getWorkspace } from '@/services/http/queries';
import { routes } from '@/lib/routes';
import {
  DEFAULT_SCOPE_ID,
  NOW_ISO,
  accounts as sampleAccounts,
  connections as sampleConnections,
  currentUser,
  runs,
  recentScopeIds,
  savedGroups,
  scopeById,
  scopes as sampleScopes,
  workspaces as sampleWorkspaces,
} from '@/services/mock';

/**
 * Protected layout.
 *
 * The session is resolved on the server before any protected UI paints. An
 * unauthenticated visitor is redirected to sign-in with a safe return path; a
 * signed-in visitor who is not a member of this workspace gets a not-found,
 * never a partially rendered workspace they cannot see.
 *
 * If the API itself is unreachable the shell still renders from the typed
 * sample workspace so the product is reviewable offline — the routes inside it
 * say so rather than implying the data is live.
 */
/**
 * Which pages exist in a static export.
 *
 * `output: 'export'` has no server, so every dynamic route has to be named at
 * build time or the build fails. The list comes from the sample fixtures —
 * which is also the only data the exported site has, since there is no API
 * behind it to ask for a real one.
 */
export function generateStaticParams() {
  return sampleWorkspaces.map((workspace) => ({ workspaceSlug: workspace.slug }));
}

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  const session = await getSession();
  const apiReachable = session.ok;

  if (apiReachable && !session.data.authenticated) {
    redirect(routes.signin(routes.briefing(workspaceSlug)));
  }

  /*
   * The workspace and what the fleet is doing, fetched together.
   *
   * Neither needs the other, and this layout wraps all ten workspace routes,
   * so awaiting them in sequence charged every screen in the product the sum
   * of two round trips to learn two unrelated things.
   *
   * On the fleet half: the banner used to come from a fixture whose stage was
   * "analyzing" and always would be, so every page carried a permanent claim
   * that an investigation was in progress. The fleet knows what it is doing;
   * when it is doing nothing, the banner is absent, which is the honest state
   * and now the usual one.
   */
  const [live, fleet] = apiReachable
    ? await Promise.all([getWorkspace(workspaceSlug), getFleet(workspaceSlug)])
    : [null, null];
  const running =
    fleet?.ok && fleet.data.activeRunId
      ? {
          id: fleet.data.activeRunId,
          title: (fleet.data.activeSummary ?? 'Investigation').split(' · ')[0],
          stage: (fleet.data.activeSummary ?? 'Running').split(' · ').slice(1).join(' · ') || 'Running',
        }
      : null;

  if (live && !live.ok && live.status === 404) notFound();
  if (live && !live.ok && live.status === 401) {
    redirect(routes.signin(routes.briefing(workspaceSlug)));
  }

  const workspace =
    live?.ok === true
      ? live.data.workspace
      : sampleWorkspaces.find((entry) => entry.slug === workspaceSlug);
  if (!workspace) notFound();

  const workspaces =
    apiReachable && session.data.authenticated ? session.data.workspaces : sampleWorkspaces;
  const accounts = live?.ok ? live.data.accounts : sampleAccounts;
  const scopes = live?.ok ? live.data.scopes : sampleScopes;
  const groups = live?.ok ? live.data.groups : savedGroups;
  const connections = live?.ok ? live.data.connections : sampleConnections;
  const user =
    apiReachable && session.data.authenticated
      ? session.data.user
      : { name: currentUser.name, email: currentUser.email, title: currentUser.title };

  const scope = scopes.find((entry) => entry.id === DEFAULT_SCOPE_ID) ?? scopes[0] ?? scopeById(DEFAULT_SCOPE_ID);
  const attentionCount = accounts.filter(
    (account) => scope.accountIds.includes(account.id) && account.health.state !== 'fresh',
  ).length;

  const syncing = connections.some((connection) => connection.status === 'syncing');
  const decisionCount = runs.filter((run) => run.stage === 'waiting_for_approval').length;

  return (
    <AppShell
      workspace={workspace}
      workspaces={workspaces}
      accounts={accounts}
      scopes={scopes}
      groups={groups}
      recentScopeIds={recentScopeIds}
      scopeId={scope.id}
      scopeLabel={scope.label}
      range="30d"
      compare="previous"
      rangeLabel="25 Jul – 23 Aug 2026"
      freshnessLabel={syncing ? 'Syncing now' : 'Synced 8 min ago'}
      attentionCount={attentionCount}
      decisionCount={decisionCount}
      nowIso={NOW_ISO}
      user={{ name: user.name, email: user.email, title: user.title }}
      activeRun={running}
      query=""
    >
      {children}
    </AppShell>
  );
}
