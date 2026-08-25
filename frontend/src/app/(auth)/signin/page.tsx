import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MistField } from '@/components/brand/MistField';
import { HelmWordmark } from '@/components/brand/HelmMark';
import { SigninScene } from '@/components/public/SigninScene';
import { SignInPanel } from '@/features/auth/SignInPanel';
import { safeReturnTo } from '@/lib/safe-return';
import { routes } from '@/lib/routes';
import { getAuthConfig, getSession } from '@/services/http/queries';
import { WORKSPACE_SLUG } from '@/services/mock/constants';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Enter your HELM intelligence workspace with one work identity.',
  alternates: { canonical: '/signin' },
  robots: { index: false, follow: true },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo, routes.briefing(WORKSPACE_SLUG));

  // Whether Google is live is a server-rendered fact, not a client probe, so
  // the button never changes its label after paint.
  const [config, session] = await Promise.all([getAuthConfig(), getSession()]);
  const apiReachable = config.ok;
  const googleConfigured = config.ok ? config.data.googleConfigured : false;

  // With AUTH_ENABLED=false the API answers as the sample owner already, so
  // the sign-in page has nothing to ask for.
  if (session.ok && session.data.authenticated) {
    redirect(returnTo);
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row lg:overflow-hidden">
      {/* Dark signal field — 58% on desktop, 34–40% on mobile */}
      <section className="pub-shell on-night relative flex h-[38dvh] shrink-0 flex-col justify-between overflow-hidden px-6 pb-6 pt-6 sm:px-8 lg:h-auto lg:w-[58%] lg:flex-1 lg:px-12 lg:py-12">
        <MistField tone="dark" grid />
        <div className="relative">
          <HelmWordmark tone="dark" size="sm" />
        </div>

        <div className="relative hidden lg:block">
          <p className="mono text-[10.5px] uppercase tracking-[0.14em] text-night-faint">
            Your operating context
          </p>
          <h2 className="mt-4 max-w-[20ch] text-[clamp(26px,2.4vw,38px)] font-semibold leading-[1.1] tracking-[-0.028em] text-night-ink">
            Every connected account, resolved into one scope.
          </h2>
          <div className="mt-9">
            <SigninScene />
          </div>
        </div>

        {/* Compact brand scene for mobile */}
        <div className="relative lg:hidden">
          <p className="mono text-[10px] uppercase tracking-[0.14em] text-night-faint">
            Your operating context
          </p>
          <p className="mt-2 max-w-[26ch] text-[19px] font-semibold leading-[1.18] tracking-[-0.02em] text-night-ink">
            Every connected account, resolved into one scope.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['Northstar Group', 'India · Google + Meta', '4 accounts'].map((chip) => (
              <span
                key={chip}
                className="mono rounded-full border border-night-line px-2.5 py-1 text-[10.5px] text-night-muted"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <p className="relative mono hidden text-[10.5px] text-night-faint lg:block">
          Illustrative sample workspace
        </p>
      </section>

      {/* Light sign-in field — the field itself carries the form */}
      <section className="relative flex flex-1 items-center justify-center overflow-y-auto bg-canvas px-6 py-10 sm:px-10 lg:w-[42%] lg:flex-none lg:px-14 lg:py-12">
        <MistField tone="light" grid={false} />
        <main id="main" className="relative flex w-full justify-center">
          <SignInPanel
            returnTo={returnTo}
            googleConfigured={googleConfigured}
            authEnabled={config.ok ? config.data.authEnabled : true}
            buttonLabel={config.ok ? config.data.signInLabel : 'Continue with Google'}
            apiReachable={apiReachable}
            initialError={params.error ? decodeURIComponent(params.error) : undefined}
          />
        </main>
      </section>
    </div>
  );
}
