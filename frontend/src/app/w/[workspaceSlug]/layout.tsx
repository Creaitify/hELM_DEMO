import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import {
  DEFAULT_SCOPE_ID,
  NOW_ISO,
  accounts,
  activeRun,
  connections,
  currentUser,
  runs,
  recentScopeIds,
  savedGroups,
  scopeById,
  scopes,
  workspaces,
} from '@/services/mock';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = workspaces.find((entry) => entry.slug === workspaceSlug);
  if (!workspace) notFound();

  const scope = scopeById(DEFAULT_SCOPE_ID);
  const attentionCount = accounts.filter(
    (account) => scope.accountIds.includes(account.id) && account.health.state !== 'fresh',
  ).length;

  const syncing = connections.some((connection) => connection.status === 'syncing');
  const decisionCount = runs.filter((run) => run.stage === 'waiting_for_decision').length;

  return (
    <AppShell
      workspace={workspace}
      workspaces={workspaces}
      accounts={accounts}
      scopes={scopes}
      groups={savedGroups}
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
      user={{ name: currentUser.name, email: currentUser.email, title: currentUser.title }}
      activeRun={activeRun ?? null}
      query=""
    >
      {children}
    </AppShell>
  );
}
