import type { Metadata } from 'next';
import { PageShell } from '@/components/shell/AppShell';
import { WorkspacePlaceholder, isPopulated } from '@/features/briefing/WorkspacePlaceholder';
import { LibraryWorkspace } from '@/features/library/LibraryWorkspace';
import { NOW_ISO, artifacts } from '@/services/mock';

export const metadata: Metadata = { title: 'Library' };

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  if (!isPopulated(workspaceSlug)) {
    return <WorkspacePlaceholder slug={workspaceSlug} title="Library" section="library" />;
  }


  return (
    <PageShell
      title="Library"
      context={
        <p className="mono text-[12px] text-ink-400">
          11 artifacts · decision memos, snapshots, exports and the Arc Bottle creative family
        </p>
      }
    >
      <LibraryWorkspace artifacts={artifacts} workspaceSlug={workspaceSlug} nowIso={NOW_ISO} />
    </PageShell>
  );
}
