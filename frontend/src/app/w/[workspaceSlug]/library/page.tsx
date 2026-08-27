import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageShell } from '@/components/shell/AppShell';
import { InlineNotice } from '@/components/primitives/States';
import { WorkspacePlaceholder, isPopulated } from '@/features/briefing/WorkspacePlaceholder';
import { LibraryWorkspace } from '@/features/library/LibraryWorkspace';
import { fleetNotice } from '@/features/intelligence/fleet-fallback';
import { routes } from '@/lib/routes';
import { getLibrary } from '@/services/http/queries';
import { NOW_ISO, artifacts as sampleArtifacts } from '@/services/mock';

export const metadata: Metadata = { title: 'Assets' };

/**
 * Assets, and only assets.
 *
 * Documents moved to their own route. A memo and a poster were never the same
 * kind of object, and presenting them as two tabs of one shelf meant the shelf
 * could not be built for either.
 */

export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspaceSlug } = await params;
  // The tab is still read so an old bookmark to ?tab=reports lands somewhere
  // sensible rather than on an empty shelf.
  const { tab } = await searchParams;
  if (tab === 'reports') redirect(routes.documents(workspaceSlug));
  if (!isPopulated(workspaceSlug)) {
    return <WorkspacePlaceholder slug={workspaceSlug} title="Assets" section="library" />;
  }

  const live = await getLibrary(workspaceSlug);
  const artifacts = live.ok ? live.data.artifacts : sampleArtifacts;
  const offline = fleetNotice(live.ok, live.ok ? undefined : live.error);

  const creative = artifacts.filter((artifact) => artifact.mode === 'creative');

  return (
    <PageShell
      title="Assets"
      context={
        <p className="mono text-[12px] text-ink-400">
          {creative.length} generated and uploaded creative · every variant keeps the prompt, the format
          and the model that drew it
        </p>
      }
    >
      {offline ? (
        <InlineNotice tone="warn" title={offline.title} className="mb-6">
          {offline.body}
        </InlineNotice>
      ) : null}

      <LibraryWorkspace
        artifacts={creative}
        workspaceSlug={workspaceSlug}
        nowIso={NOW_ISO}
        initialMode="creative"
        canCreate={live.ok ? live.data.canCreate : false}
        create={live.ok ? live.data.create : undefined}
        live={live.ok}
      />
    </PageShell>
  );
}
