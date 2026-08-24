import Link from 'next/link';
import { HelmWordmark } from '@/components/brand/HelmMark';
import { MistField } from '@/components/brand/MistField';
import { routes } from '@/lib/routes';

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-canvas px-6">
      <MistField tone="light" grid={false} />
      <main id="main" className="relative w-full max-w-[440px]">
        <HelmWordmark size="sm" />
        <h1 className="mt-8 text-[28px] font-semibold tracking-[-0.024em] text-ink-950">
          That page does not exist
        </h1>
        <p className="mt-3 text-[15px] leading-[23px] text-ink-500">
          The workspace, campaign or investigation you followed may have been removed, or the link may be
          incomplete. Nothing has changed in your accounts.
        </p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Link
            href={routes.appEntry()}
            className="inline-flex h-11 items-center rounded-control bg-helm-500 px-4 text-[15px] font-medium text-white transition-colors hover:bg-helm-600"
          >
            Go to your Briefing
          </Link>
          <Link
            href={routes.home()}
            className="inline-flex h-11 items-center rounded-control border border-line-strong bg-surface px-4 text-[15px] text-ink-950 transition-colors hover:bg-surface-subtle"
          >
            Back to HELM
          </Link>
        </div>
      </main>
    </div>
  );
}
