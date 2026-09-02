import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/shell/AppShell';
import { InlineNotice } from '@/components/primitives/States';
import { SettingsWorkspace } from '@/features/settings/SettingsWorkspace';
import { fleetNotice } from '@/features/intelligence/fleet-fallback';
import { getBrandKits, getAudit, getMembers, getSession, getWorkspace } from '@/services/http/queries';
import {
  NOW_ISO,
  auditEntries as sampleAudit,
  connections as sampleConnections,
  members as sampleMembers,
  preferences,
  workspaces as sampleWorkspaces,
} from '@/services/mock';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  // The tab is read from the URL by SettingsWorkspace itself: a static export
  // has no server to resolve searchParams on.
  const tab = undefined;

  const [workspaceRead, membersRead, auditRead, session, brandRead] = await Promise.all([
    getWorkspace(workspaceSlug),
    getMembers(workspaceSlug),
    getAudit(workspaceSlug),
    getSession(),
    getBrandKits(workspaceSlug),
  ]);

  const workspace = workspaceRead.ok
    ? workspaceRead.data.workspace
    : sampleWorkspaces.find((entry) => entry.slug === workspaceSlug);
  if (!workspace) notFound();

  const offline = fleetNotice(workspaceRead.ok, workspaceRead.ok ? undefined : workspaceRead.error);

  return (
    <PageShell
      title="Settings"
      context={
        <p className="mono text-[12px] text-ink-400">
          Workspace, team, brand, connections, preferences and audit for {workspace.name}
        </p>
      }
    >
      {offline ? (
        <InlineNotice tone="warn" title={offline.title} className="mb-6">
          {offline.body}
        </InlineNotice>
      ) : null}

      <SettingsWorkspace
        workspace={workspace}
        members={membersRead.ok ? membersRead.data.members : sampleMembers}
        connections={workspaceRead.ok ? workspaceRead.data.connections : sampleConnections}
        audit={auditRead.ok ? auditRead.data.entries : sampleAudit}
        preferences={preferences}
        workspaceSlug={workspaceSlug}
        brandKits={brandRead.ok ? brandRead.data.kits : []}
        canEditBrand={brandRead.ok ? brandRead.data.canEdit : false}
        initialTab={tab}
        nowIso={NOW_ISO}
        canManageMembers={membersRead.ok ? membersRead.data.canManage : false}
        assignableRoles={membersRead.ok ? membersRead.data.assignableRoles : []}
        roleMatrix={membersRead.ok ? membersRead.data.roleMatrix : []}
        currentUserId={session.ok && session.data.authenticated ? session.data.user.id : undefined}
        live={membersRead.ok}
      />
    </PageShell>
  );
}
