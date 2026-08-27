import { MarketingHeader } from '@/components/public/MarketingHeader';
import { MarketingFooter } from '@/components/public/MarketingFooter';
import { Hero } from '@/components/public/Hero';
import {
  ClosingTransition,
  MovementAccountOptionality,
  MovementCreativeIntelligence,
  MovementDecisionBrief,
  MovementEvidenceAndControl,
  MovementOneMoneyView,
} from '@/components/public/Movements';

export default function LandingPage() {
  return (
    <div className="pub-world pub-shell on-night min-h-dvh">
      <MarketingHeader />
      <main id="main">
        <Hero />
        <MovementOneMoneyView />
        <MovementDecisionBrief />
        <MovementCreativeIntelligence />
        <MovementAccountOptionality />
        <MovementEvidenceAndControl />
        <ClosingTransition />
      </main>
      <MarketingFooter />
    </div>
  );
}
