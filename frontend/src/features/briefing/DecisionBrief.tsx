'use client';

import { useState } from 'react';
import type { AdAccount, Evidence, Finding, Recommendation } from '@/contracts';
import { FindingCard, RecommendationPanel } from '@/components/data/FindingCard';
import { EvidenceDrawer } from '@/components/data/EvidenceDrawer';
import { SectionHeading } from '@/components/primitives/States';
import { StatusBadge } from '@/components/primitives/Status';
import { routes } from '@/lib/routes';

type DecisionState = 'proposed' | 'approved' | 'revision_requested' | 'dismissed' | 'saved';

/**
 * Three sections. "Needs a decision" is visually dominant and holds roughly
 * three findings; everything else is deliberately quieter.
 */
export function DecisionBrief({
  workspaceSlug,
  decision,
  watch,
  stable,
  recommendations,
  evidence,
  accounts,
}: {
  workspaceSlug: string;
  decision: Finding[];
  watch: Finding[];
  stable: Finding[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  accounts: AdAccount[];
}) {
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);
  const [decisionState, setDecisionState] = useState<DecisionState>('proposed');
  const [notice, setNotice] = useState<string | null>(null);

  const primaryRecommendation = recommendations.find((rec) => rec.id === 'rec_budget_test');

  const activeEvidence = evidence.find((entry) => entry.id === openEvidenceId) ?? null;
  const activeIndex = evidence.findIndex((entry) => entry.id === openEvidenceId);

  const accountsFor = (finding: Finding) =>
    finding.sourceAccountIds
      .map((id) => accounts.find((account) => account.id === id))
      .filter((account): account is AdAccount => Boolean(account))
      .map((account) => ({ id: account.id, name: account.name, provider: account.provider }));

  const record = (state: DecisionState, message: string) => {
    setDecisionState(state);
    setNotice(message);
  };

  return (
    <>
      <section aria-labelledby="needs-decision" className="scroll-mt-24">
        <SectionHeading
          id="needs-decision"
          title="Needs a decision"
          hint="Three findings carry real money this week. Each one links to the evidence that produced it."
          action={<StatusBadge tone="bad">{decision.length} findings</StatusBadge>}
        />

        <div className="mt-5 space-y-5">
          {decision.map((finding) => (
            <FindingCard
              key={finding.id}
              emphasis
              finding={finding}
              recommendation={recommendations.find((rec) => rec.findingId === finding.id)}
              accountNames={accountsFor(finding)}
              onOpenEvidence={(id) => setOpenEvidenceId(id)}
              investigateHref={routes.run(workspaceSlug, 'run_0824_cpa')}
            />
          ))}
        </div>

        {primaryRecommendation ? (
          <div className="mt-6">
            <RecommendationPanel
              recommendation={primaryRecommendation}
              decisionState={decisionState}
              onApprove={() =>
                record('approved', 'Recommendation approved. Nothing was executed in Google Ads or Meta Ads.')
              }
              onRevise={() => record('revision_requested', 'Revision requested. The run has been reopened.')}
              onSave={() => record('saved', 'Saved to Library. It stays on the Briefing until you decide.')}
              onDismiss={() => record('dismissed', 'Dismissed. The finding stays visible under Worth watching.')}
            />
            {/* Local confirmation, never a redirect and never toast-only. */}
            <div aria-live="polite" className="min-h-[22px]">
              {notice ? <p className="mt-3 text-[13px] text-good">{notice}</p> : null}
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="worth-watching" className="mt-12 scroll-mt-24">
        <SectionHeading
          id="worth-watching"
          title="Worth watching"
          hint="Directional signals that do not justify a budget change yet."
          action={<StatusBadge tone="warn">{watch.length} findings</StatusBadge>}
        />
        <div className="s-panel mt-5 px-5 py-1 sm:px-6">
          {watch.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              accountNames={accountsFor(finding)}
              onOpenEvidence={(id) => setOpenEvidenceId(id)}
              investigateHref={routes.intelligence(workspaceSlug)}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="working" className="mt-12 scroll-mt-24">
        <SectionHeading
          id="working"
          title="Working as expected"
          hint="Confirmed stable so you do not have to check them."
          action={<StatusBadge tone="good">{stable.length} findings</StatusBadge>}
        />
        <ul className="s-panel-subtle mt-5 divide-y divide-line px-5 sm:px-6">
          {stable.map((finding) => (
            <li key={finding.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5">
              <span className="min-w-0">
                <span className="block text-[14.5px] text-ink-950">{finding.title}</span>
                <span className="block text-[12.5px] text-ink-500">{finding.observation}</span>
              </span>
              <button
                type="button"
                onClick={() => setOpenEvidenceId(finding.evidenceIds[0])}
                className="mono shrink-0 text-[11.5px] text-helm-600 underline-offset-2 hover:underline"
              >
                Open evidence
              </button>
            </li>
          ))}
        </ul>
      </section>

      <EvidenceDrawer
        evidence={activeEvidence}
        open={Boolean(activeEvidence)}
        onClose={() => setOpenEvidenceId(null)}
        index={activeIndex >= 0 ? activeIndex : undefined}
        total={evidence.length}
        onNext={
          activeIndex >= 0 && activeIndex < evidence.length - 1
            ? () => setOpenEvidenceId(evidence[activeIndex + 1].id)
            : undefined
        }
      />
    </>
  );
}
