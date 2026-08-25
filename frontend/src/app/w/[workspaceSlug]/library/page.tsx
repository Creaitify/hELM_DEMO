import type { Metadata } from 'next';
import { PageShell } from '@/components/shell/AppShell';
import { InlineNotice } from '@/components/primitives/States';
import { WorkspacePlaceholder, isPopulated } from '@/features/briefing/WorkspacePlaceholder';
import { LibraryWorkspace } from '@/features/library/LibraryWorkspace';
import { fleetNotice } from '@/features/intelligence/fleet-fallback';
import { getLibrary } from '@/services/http/queries';
import { NOW_ISO, artifacts as sampleArtifacts } from '@/services/mock';

export const metadata: Metadata = { title: 'Library' };

export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { tab } = await searchParams;
  if (!isPopulated(workspaceSlug)) {
    return <WorkspacePlaceholder slug={workspaceSlug} title="Library" section="library" />;
  }

  const live = await getLibrary(workspaceSlug);
  const artifacts = live.ok ? live.data.artifacts : sampleArtifacts;
  const offline = fleetNotice(live.ok, live.ok ? undefined : live.error);

  const reports = artifacts.filter((artifact) => artifact.mode === 'reports').length;
  const creative = artifacts.length - reports;

  return (
    <PageShell
      title="Library"
      context={
        <p className="mono text-[12px] text-ink-400">
          {artifacts.length} artifacts · {reports} reports, {creative} creative · decision memos, snapshots,
          exports and the Arc Bottle creative family
        </p>
      }
    >
      {offline ? (
        <InlineNotice tone="warn" title={offline.title} className="mb-6">
          {offline.body}
        </InlineNotice>
      ) : null}

      <LibraryWorkspace
        artifacts={artifacts}
        workspaceSlug={workspaceSlug}
        nowIso={NOW_ISO}
        initialMode={tab === 'reports' ? 'reports' : 'creative'}
        canCreate={live.ok ? live.data.canCreate : false}
        create={live.ok ? live.data.create : undefined}
        live={live.ok}
      />
    </PageShell>
  );
}
