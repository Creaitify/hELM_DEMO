import type { Metadata } from 'next';
import { PageShell } from '@/components/shell/AppShell';
import { InlineNotice } from '@/components/primitives/States';
import { DocumentShelf } from '@/features/documents/DocumentShelf';
import { fleetNotice } from '@/features/intelligence/fleet-fallback';
import { getDocuments } from '@/services/http/queries';
import { sampleDocumentsResponse } from '@/services/mock';

export const metadata: Metadata = { title: 'Documents' };

/**
 * Documents have their own address.
 *
 * They used to share the library with generated creative behind a tab, which
 * meant a memo and a poster were presented as the same kind of object. They
 * are not: one is looked at, the other is read, cited and handed to somebody
 * who was not in the room, and each needs a surface built for that.
 */
export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const live = await getDocuments(workspaceSlug);
  // Every other surface falls back to the sample workspace rather than
  // dead-ending; the shelf does too, and says which one it is showing.
  const data = live.ok ? live.data : sampleDocumentsResponse;
  const offline = fleetNotice(live.ok, live.ok ? undefined : live.error);

  return (
    <PageShell
      title="Documents"
      context={
        <p className="mono text-[12px] text-ink-400">
          {`${data.documents.length} written · ${data.sources.length} investigations to write up`}
        </p>
      }
    >
      {offline ? (
        <InlineNotice tone="warn" title={offline.title} className="mb-6">
          {offline.body}
        </InlineNotice>
      ) : null}

      <DocumentShelf workspaceSlug={workspaceSlug} data={data} />
    </PageShell>
  );
}
