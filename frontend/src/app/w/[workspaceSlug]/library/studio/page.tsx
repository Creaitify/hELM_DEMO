import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/shell/AppShell';
import { ErrorState } from '@/components/primitives/States';
import { ImageStudio } from '@/features/studio/ImageStudio';
import { IconChevronLeft } from '@/components/icons';
import { routes } from '@/lib/routes';
import { getBriefing, getStudio } from '@/services/http/queries';
import { NOW_ISO } from '@/services/mock';

export const metadata: Metadata = { title: 'Image studio' };

/**
 * The image studio lives inside the library, not beside it.
 *
 * It is reached from the creative mode of the library or from a finding, so a
 * generation always starts from something the workspace already understands.
 *
 * The briefing is read alongside it so the studio opens on the account as it
 * stands right now. Creative is a response to what the numbers are doing; a
 * generator that cannot see them is a toy.
 */
export default async function StudioPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const [studio, briefing] = await Promise.all([
    getStudio(workspaceSlug),
    getBriefing(workspaceSlug),
  ]);

  return (
    <PageShell
      wide
      title="Image studio"
      context={
        <p className="mono text-[12px] text-ink-400">
          {studio.ok
            ? `${studio.data.director.name} · ${studio.data.provider.label} · files into the library`
            : 'The studio needs the HELM API'}
        </p>
      }
    >
      <Link
        href={routes.library(workspaceSlug)}
        className="mb-5 inline-flex items-center gap-1 text-[13.5px] text-ink-500 transition-colors hover:text-ink-950"
      >
        <IconChevronLeft size={16} />
        Back to the library
      </Link>

      {studio.ok ? (
        <ImageStudio
          workspaceSlug={workspaceSlug}
          studio={studio.data}
          overview={briefing.ok ? briefing.data : null}
          nowIso={NOW_ISO}
        />
      ) : (
        <ErrorState
          title="The image studio needs the HELM API"
          description={studio.error.message}
          onRetry={
            <Link
              href={routes.library(workspaceSlug)}
              className="text-[13.5px] text-helm-600 hover:underline"
            >
              Back to the library
            </Link>
          }
        />
      )}
    </PageShell>
  );
}
