import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/shell/AppShell';
import { InlineNotice } from '@/components/primitives/States';
import { ImageStudio } from '@/features/studio/ImageStudio';
import { IconChevronLeft } from '@/components/icons';
import { routes } from '@/lib/routes';
import { getBriefing, getStudio } from '@/services/http/queries';
import { fleetNotice } from '@/features/intelligence/fleet-fallback';
import { NOW_ISO, sampleStudioResponse } from '@/services/mock';

export const metadata: Metadata = { title: 'Image studio' };

/**
 * The image studio lives inside the library, not beside it.
 *
 * The header is deliberately small. This is a surface you operate rather than
 * one you read, so the masthead gets a line and the work gets the screen; the
 * way back to the library rides in the header instead of taking a row of its
 * own beneath it.
 *
 * The briefing is read alongside the studio so the account is one click away
 * without occupying the page — creative is a response to what the numbers are
 * doing, but the numbers are context here, not the subject.
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
  const data = studio.ok ? studio.data : sampleStudioResponse;
  const offline = fleetNotice(studio.ok, studio.ok ? undefined : studio.error);

  return (
    <PageShell
      // A single narrow column of controls; the canvas width would strand it.
      dense
      title="Image studio"
      context={
        <p className="mono text-[11.5px] text-ink-400">
          {`${data.director.name} · ${data.provider.label}`}
        </p>
      }
      actions={
        <Link
          href={routes.library(workspaceSlug)}
          className="inline-flex items-center gap-1 text-[13px] text-ink-500 transition-colors hover:text-ink-950"
        >
          <IconChevronLeft size={15} />
          Library
        </Link>
      }
    >
      {offline ? (
        <InlineNotice tone="warn" title={offline.title} className="mb-6">
          {offline.body}
        </InlineNotice>
      ) : null}

      <ImageStudio
        workspaceSlug={workspaceSlug}
        studio={data}
        overview={briefing.ok ? briefing.data : null}
        nowIso={NOW_ISO}
      />
    </PageShell>
  );
}
