import type { Metadata } from 'next';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { MistField } from '@/components/brand/MistField';
import { WORKSPACE_SLUG, accounts } from '@/services/mock';

export const metadata: Metadata = {
  title: 'Set up your workspace',
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <div className="relative min-h-dvh bg-canvas">
      <MistField tone="light" grid={false} />
      <main id="main" className="relative">
        <OnboardingFlow accounts={accounts} workspaceSlug={WORKSPACE_SLUG} />
      </main>
    </div>
  );
}
