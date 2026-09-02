'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HelmWordmark } from '@/components/brand/HelmMark';
import { Button } from '@/components/primitives/Button';
import { GoogleGMark, IconAlert, IconArrowRight, IconLock } from '@/components/icons';
import { authScenarios, type AuthViewState } from '@/services/mock/public-content';
import { DEMO_EMAIL, DEMO_PASSWORD, matchesDemoCredentials } from './demo-credentials';
import { api, describeError } from '@/lib/api';
import { describeReturnTo } from '@/lib/safe-return';
import { routes } from '@/lib/routes';
import { WORKSPACE_SLUG } from '@/services/mock/constants';
import { cn } from '@/lib/cn';

/**
 * Identity authentication only. Signing in never connects an ad account.
 *
 * Live and demo identity sit behind one interface. With a Google client
 * configured, the button hands off to Google's consent screen and the API sets
 * the session cookie on the way back. Without one, the same button signs the
 * sample identity in through the API so the product is reviewable end to end —
 * and says which of the two it is doing.
 */
export function SignInPanel({
  returnTo,
  initialState = 'ready',
  googleConfigured = false,
  buttonLabel = 'Continue with Google',
  apiReachable = true,
  authEnabled = true,
  initialError,
}: {
  returnTo: string;
  initialState?: AuthViewState;
  /** True once GOOGLE_CLIENT_ID and secret are configured on the API. */
  googleConfigured?: boolean;
  buttonLabel?: string;
  apiReachable?: boolean;
  /** False while the deployment has sign-in switched off entirely. */
  authEnabled?: boolean;
  /** A failure carried back on the callback's query string. */
  initialError?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<AuthViewState>(initialError ? 'failed' : initialState);
  const [problem, setProblem] = useState<string | null>(initialError ?? null);
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const scenario = authScenarios[state];
  const destinationLabel = describeReturnTo(returnTo);

  const start = () => {
    setState('redirecting');
    setProblem(null);

    // Without a reachable API there is nothing to authenticate against; the
    // sample workspace is still worth reviewing, so go straight there.
    if (!apiReachable) {
      window.setTimeout(() => router.push(returnTo || routes.briefing(WORKSPACE_SLUG)), 620);
      return;
    }

    if (googleConfigured) {
      window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
      return;
    }

    void (async () => {
      try {
        await api.post('/api/auth/demo');
        router.push(returnTo || routes.briefing(WORKSPACE_SLUG));
        router.refresh();
      } catch (error) {
        setProblem(describeError(error));
        setState('failed');
      }
    })();
  };

  /**
   * The demo credential path.
   *
   * The pair is checked in the browser and then hands off to the same open
   * demo endpoint the provider button uses — see demo-credentials.ts for why
   * that is a stage prop rather than a lock.
   */
  const submitCredentials = (event: React.FormEvent) => {
    event.preventDefault();
    if (state === 'redirecting') return;

    if (!matchesDemoCredentials(email, password)) {
      setProblem('That email and password pair is not the demo account.');
      setState('failed');
      return;
    }

    setProblem(null);
    setState('redirecting');

    if (!apiReachable) {
      window.setTimeout(() => router.push(returnTo || routes.briefing(WORKSPACE_SLUG)), 520);
      return;
    }

    void (async () => {
      try {
        await api.post('/api/auth/demo');
        router.push(returnTo || routes.briefing(WORKSPACE_SLUG));
        router.refresh();
      } catch (error) {
        setProblem(describeError(error));
        setState('failed');
      }
    })();
  };

  const field =
    'h-12 w-full rounded-field border border-line-strong bg-surface px-3.5 text-[15px] text-ink-950 ' +
    'outline-none transition-colors placeholder:text-ink-400 focus:border-action-400';

  return (
    <div className="flex w-full max-w-[430px] flex-col">
      <div className="lg:hidden">
        <HelmWordmark size="md" subtitle="Paid-media intelligence" />
      </div>
      <div className="hidden lg:block">
        <HelmWordmark size="lg" subtitle="Paid-media intelligence" />
      </div>

      {/* The same display face the landing page and the product use, so the
          three surfaces read as one thing. */}
      <h1 className="text-page mt-9 text-ink-950">Enter your workspace.</h1>
      <p className="text-aside mt-2 text-[16px]">
        One work identity for every connected brand and ad account.
      </p>

      {destinationLabel ? (
        <p className="mono mt-5 inline-flex w-fit items-center gap-2 rounded-control border border-line bg-surface-subtle px-3 py-2 text-[12px] text-ink-500">
          <IconArrowRight size={14} />
          Continuing to {destinationLabel}
        </p>
      ) : null}

      {/* Credentials first: it is the path a reviewer will actually take. */}
      <form onSubmit={submitCredentials} className="mt-8 space-y-3">
        <div>
          <label htmlFor="signin-email" className="micro-label mb-1.5 block">
            Work email
          </label>
          <input
            id="signin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="signin-password" className="micro-label mb-1.5 block">
            Password
          </label>
          <input
            id="signin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={field}
          />
        </div>
        <Button
          type="submit"
          variant="indigo"
          size="lg"
          block
          pending={state === 'redirecting'}
          pendingLabel="Opening the workspace…"
          trailing={<IconArrowRight size={17} />}
        >
          Sign in
        </Button>
      </form>

      {/* The pair is printed because it is a demo, and a demo you cannot get
          into is a screenshot. */}
      <p className="mono mt-3 rounded-control border border-dashed border-action-400/50 bg-helm-50 px-3 py-2 text-[11.5px] leading-[17px] text-ink-700">
        Demo account — <span className="text-ink-950">{DEMO_EMAIL}</span> ·{' '}
        <span className="text-ink-950">{DEMO_PASSWORD}</span>
      </p>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-ink-400">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div>
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
            aria-label={buttonLabel}
          >
            {buttonLabel}
          </Button>
        )}
      </div>

      {/* Errors are announced, not just coloured. */}
      <div aria-live="polite" aria-atomic="true" className="min-h-[24px]">
        {state === 'failed' && (problem ?? scenario.message) ? (
          <p
            className={cn(
              'mt-3 flex items-start gap-2 rounded-control border border-bad/25 bg-bad-soft px-3 py-2.5 text-[13.5px] leading-[20px] text-ink-950',
            )}
          >
            <span className="mt-[2px] shrink-0 text-bad">
              <IconAlert size={16} />
            </span>
            <span>
              {problem ?? scenario.message}{' '}
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

      {!authEnabled ? (
        <p className="mono mt-3 text-[11.5px] leading-[17px] text-ink-400">
          Sign-in is switched off for this deployment (AUTH_ENABLED=false), so the workspace opens
          directly. Set AUTH_ENABLED=true to require an identity.
        </p>
      ) : !googleConfigured ? (
        <p className="mono mt-3 text-[11.5px] leading-[17px] text-ink-400">
          {apiReachable
            ? 'No Google client is configured, so this signs you into the sample workspace through the HELM API. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to switch to live Google sign-in.'
            : 'The HELM API is not reachable, so this opens the sample workspace directly.'}
        </p>
      ) : null}

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
