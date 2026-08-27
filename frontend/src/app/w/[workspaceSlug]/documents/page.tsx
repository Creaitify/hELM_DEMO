import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/shell/AppShell';
import { ErrorState } from '@/components/primitives/States';
import { DocumentShelf } from '@/features/documents/DocumentShelf';
import { routes } from '@/lib/routes';
import { getDocuments } from '@/services/http/queries';

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
  const documents = await getDocuments(workspaceSlug);

  return (
    <PageShell
      title="Documents"
      context={
        <p className="mono text-[12px] text-ink-400">
          {documents.ok
            ? `${documents.data.documents.length} written · ${documents.data.sources.length} investigations to write up`
            : 'Documents need the HELM API'}
        </p>
      }
    >
      {documents.ok ? (
        <DocumentShelf workspaceSlug={workspaceSlug} data={documents.data} />
      ) : (
        <ErrorState
          title="Documents need the HELM API"
          description={documents.error.message}
          onRetry={
            <Link
              href={routes.briefing(workspaceSlug)}
              className="text-[13.5px] text-helm-600 hover:underline"
            >
              Back to the briefing
            </Link>
          }
        />
      )}
    </PageShell>
  );
}
