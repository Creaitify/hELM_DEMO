'use client';

import { useEffect } from 'react';
import { HelmWordmark } from '@/components/brand/HelmMark';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Route errors are captured here. Account identifiers and report contents
    // are never included in client telemetry.
    console.error('Route error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-6">
      <main id="main" className="w-full max-w-[460px]">
        <HelmWordmark size="sm" />
        <h1 className="mt-8 text-[26px] font-semibold tracking-[-0.024em] text-ink-950">
          This section could not load
        </h1>
        <p className="mt-3 text-[15px] leading-[23px] text-ink-500">
          Something went wrong while building this view. Your connected accounts and stored data are
          unaffected.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center rounded-control bg-helm-500 px-4 text-[15px] font-medium text-white transition-colors hover:bg-helm-600"
          >
            Try again
          </button>
        </div>
        {error.digest ? (
          <details className="mt-6">
            <summary className="cursor-pointer text-[13px] text-ink-500">Support detail</summary>
            <p className="mono mt-2 rounded-control bg-surface-sunk px-3 py-2 text-[12px] text-ink-700">
              Reference {error.digest}
            </p>
          </details>
        ) : null}
      </main>
    </div>
  );
}
