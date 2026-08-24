import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/shell/AppShell';
import { SettingsWorkspace } from '@/features/settings/SettingsWorkspace';
import {
  NOW_ISO,
  auditEntries,
  connections,
  members,
  preferences,
  workspaces,
} from '@/services/mock';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { tab } = await searchParams;
  const workspace = workspaces.find((entry) => entry.slug === workspaceSlug);
  if (!workspace) notFound();

  return (
    <PageShell
      title="Settings"
      context={
        <p className="mono text-[12px] text-ink-400">
          Workspace, team, connections, preferences and audit for {workspace.name}
        </p>
      }
    >
      <SettingsWorkspace
        workspace={workspace}
        members={members}
        connections={connections}
        audit={auditEntries}
        preferences={preferences}
        workspaceSlug={workspaceSlug}
        initialTab={tab}
        nowIso={NOW_ISO}
      />
    </PageShell>
  );
}
