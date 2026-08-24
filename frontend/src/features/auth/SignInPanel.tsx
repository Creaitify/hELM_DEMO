'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HelmWordmark } from '@/components/brand/HelmMark';
import { Button } from '@/components/primitives/Button';
import { GoogleGMark, IconAlert, IconArrowRight, IconLock } from '@/components/icons';
import { authScenarios, type AuthViewState } from '@/services/mock/public-content';
import { describeReturnTo } from '@/lib/safe-return';
import { routes } from '@/lib/routes';
import { WORKSPACE_SLUG } from '@/services/mock/constants';
import { cn } from '@/lib/cn';

/**
 * Identity authentication only. Signing in never connects an ad account.
 *
 * In this build the AuthAdapter boundary is visual: pressing Continue with
 * Google moves through the redirecting state and lands on the sample
 * workspace so the product can be reviewed end to end.
 */
export function SignInPanel({
  returnTo,
  initialState = 'ready',
}: {
  returnTo: string;
  initialState?: AuthViewState;
}) {
  const router = useRouter();
  const [state, setState] = useState<AuthViewState>(initialState);
  const scenario = authScenarios[state];
  const destinationLabel = describeReturnTo(returnTo);

  const start = () => {
    setState('redirecting');
    window.setTimeout(() => router.push(returnTo || routes.briefing(WORKSPACE_SLUG)), 620);
  };

  return (
    <div className="flex w-full max-w-[430px] flex-col">
      <div className="lg:hidden">
        <HelmWordmark size="md" subtitle="Paid-media intelligence" />
      </div>
      <div className="hidden lg:block">
        <HelmWordmark size="lg" subtitle="Paid-media intelligence" />
      </div>

      <h1 className="mt-9 text-[clamp(26px,3vw,34px)] font-semibold leading-[1.12] tracking-[-0.028em] text-ink-950">
        Enter your intelligence workspace.
      </h1>
      <p className="mt-3 text-[16px] leading-[25px] text-ink-500">
        One work identity for every connected brand and ad account.
      </p>

      {destinationLabel ? (
        <p className="mono mt-5 inline-flex w-fit items-center gap-2 rounded-control border border-line bg-surface-subtle px-3 py-2 text-[12px] text-ink-500">
          <IconArrowRight size={14} />
          Continuing to {destinationLabel}
        </p>
      ) : null}

      <div className="mt-8">
        {state === 'unavailable' ? (
          <div className="rounded-field border border-warn/30 bg-warn-soft px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="mt-[2px] shrink-0 text-warn">
                <IconAlert size={18} />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-ink-950">Sign-in is temporarily unavailable</p>
                <p className="mt-1 text-[14px] leading-[21px] text-ink-700">
                  Try again or contact your workspace administrator.
                </p>
                <Button variant="neutral" size="compact" className="mt-3" onClick={() => setState('ready')}>
                  Try again
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button
            variant="provider"
            size="lg"
            block
            onClick={start}
            pending={state === 'redirecting'}
            pendingLabel="Opening Google…"
            leading={<GoogleGMark size={19} />}
            aria-label="Continue with Google"
          >
            Continue with Google
          </Button>
        )}
      </div>

      {/* Errors are announced, not just coloured. */}
      <div aria-live="polite" aria-atomic="true" className="min-h-[24px]">
        {state === 'failed' && scenario.message ? (
          <p
            className={cn(
              'mt-3 flex items-start gap-2 rounded-control border border-bad/25 bg-bad-soft px-3 py-2.5 text-[13.5px] leading-[20px] text-ink-950',
            )}
          >
            <span className="mt-[2px] shrink-0 text-bad">
              <IconAlert size={16} />
            </span>
            <span>
              {scenario.message}{' '}
              <button
                type="button"
                onClick={start}
                className="font-medium text-helm-600 underline underline-offset-2"
              >
                Retry
              </button>
            </span>
          </p>
        ) : null}
      </div>

      <p className="mt-6 flex items-start gap-2.5 text-[13.5px] leading-[21px] text-ink-500">
        <span className="mt-[2px] shrink-0 text-ink-400">
          <IconLock size={16} />
        </span>
        Signing in does not connect an ad account. You choose what HELM can read after entry.
      </p>

      <div className="mt-10 border-t border-line pt-5">
        <Link
          href={routes.home()}
          className="text-[14px] text-ink-500 transition-colors hover:text-ink-950"
        >
          ← Back to HELM
        </Link>
      </div>

      {/* Deterministic view states. Compiled only outside production. */}
      {process.env.NODE_ENV !== 'production' ? (
        <div className="mt-8 rounded-field border border-dashed border-line-strong px-4 py-3">
          <p className="micro-label">Developer access · not present in production</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(['ready', 'redirecting', 'failed', 'unavailable'] as AuthViewState[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setState(option)}
                className={cn(
                  'rounded-control border px-2.5 py-1.5 text-[12px] transition-colors',
                  state === option
                    ? 'border-helm-500 bg-helm-100 text-ink-950'
                    : 'border-line text-ink-500 hover:text-ink-950',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
