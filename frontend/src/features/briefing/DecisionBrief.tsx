'use client';

import { useState } from 'react';
import type { AdAccount, CampaignSummary, Evidence, Finding, Recommendation } from '@/contracts';
import { FindingCard, RecommendationPanel } from '@/components/data/FindingCard';
import { EvidenceDrawer } from '@/components/data/EvidenceDrawer';
import { SectionHeading } from '@/components/primitives/States';
import { StatusBadge } from '@/components/primitives/Status';
import { CampaignTag } from '@/components/data/CampaignTag';
import { findingTrends } from '@/lib/metrics';
import { routes } from '@/lib/routes';

type DecisionState = 'proposed' | 'approved' | 'revision_requested' | 'dismissed' | 'saved';

/** The briefing shows what needs reading now; the rest stays one click away. */
const INLINE_LIMIT = 3;

/** Reveals the tail of a list in place, so the page never loses its order. */
function ShowAll({
  total,
  shown,
  onShowAll,
  noun,
}: {
  total: number;
  shown: number;
  onShowAll: () => void;
  noun: string;
}) {
  if (shown >= total) return null;
  return (
    <button
      type="button"
      onClick={onShowAll}
      className="mono flex h-11 items-center text-[12px] text-helm-600 underline-offset-2 hover:underline"
    >
      Show all {total} {noun}
    </button>
  );
}

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
  campaigns,
  runIdByFinding = {},
}: {
  workspaceSlug: string;
  decision: Finding[];
  watch: Finding[];
  stable: Finding[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  accounts: AdAccount[];
  campaigns: CampaignSummary[];
  /** The run that produced each finding, so "investigate" reopens it. */
  runIdByFinding?: Record<string, string>;
}) {
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);
  const [decisionState, setDecisionState] = useState<DecisionState>('proposed');
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<'decision' | 'watch' | 'stable', boolean>>({
    decision: false,
    watch: false,
    stable: false,
  });

  const primaryRecommendation = recommendations.find((rec) => rec.id === 'rec_budget_test');

  const activeEvidence = evidence.find((entry) => entry.id === openEvidenceId) ?? null;
  const activeIndex = evidence.findIndex((entry) => entry.id === openEvidenceId);

  const accountsFor = (finding: Finding) =>
    finding.sourceAccountIds
      .map((id) => accounts.find((account) => account.id === id))
      .filter((account): account is AdAccount => Boolean(account))
      .map((account) => ({ id: account.id, name: account.name, provider: account.provider }));

  const campaignsFor = (finding: Finding) =>
    finding.affectedCampaignIds.map((id) => ({
      id,
      name: campaigns.find((campaign) => campaign.id === id)?.name ?? id,
    }));

  /** The producing run when there is one; the composer only as a fallback. */
  const investigateHref = (finding: Finding) => {
    const runId = runIdByFinding[finding.id];
    return runId ? routes.run(workspaceSlug, runId) : routes.intelligence(workspaceSlug);
  };

  const cardProps = (finding: Finding) => ({
    finding,
    workspaceSlug,
    accountNames: accountsFor(finding),
    campaignNames: campaignsFor(finding),
    trends: findingTrends(finding, evidence, campaigns),
    onOpenEvidence: (id: string) => setOpenEvidenceId(id),
    investigateHref: investigateHref(finding),
  });

  const record = (state: DecisionState, message: string) => {
    setDecisionState(state);
    setNotice(message);
  };

  const visibleDecision = expanded.decision ? decision : decision.slice(0, INLINE_LIMIT);
  const visibleWatch = expanded.watch ? watch : watch.slice(0, INLINE_LIMIT);
  const visibleStable = expanded.stable ? stable : stable.slice(0, INLINE_LIMIT);

  return (
    <>
      <section aria-labelledby="needs-decision" className="scroll-mt-24">
        <SectionHeading
          id="needs-decision"
          title="Needs a decision"
          hint="Each one carries real money this week and links to the evidence that produced it."
          action={<StatusBadge tone="bad">{decision.length} findings</StatusBadge>}
        />

        <div className="mt-5 space-y-4">
          {visibleDecision.map((finding) => (
            <FindingCard
              key={finding.id}
              emphasis
              {...cardProps(finding)}
              recommendation={recommendations.find((rec) => rec.findingId === finding.id)}
            />
          ))}
        </div>
        <ShowAll
          total={decision.length}
          shown={visibleDecision.length}
          noun="findings"
          onShowAll={() => setExpanded((state) => ({ ...state, decision: true }))}
        />

        {primaryRecommendation ? (
          <div className="mt-5">
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

      <section aria-labelledby="worth-watching" className="mt-10 scroll-mt-24">
        <SectionHeading
          id="worth-watching"
          title="Worth watching"
          hint="Directional signals that do not justify a budget change yet."
          action={<StatusBadge tone="warn">{watch.length} findings</StatusBadge>}
        />
        <div className="s-panel mt-5 px-5 py-1 sm:px-6">
          {visibleWatch.map((finding) => (
            <FindingCard key={finding.id} {...cardProps(finding)} />
          ))}
          <ShowAll
            total={watch.length}
            shown={visibleWatch.length}
            noun="findings"
            onShowAll={() => setExpanded((state) => ({ ...state, watch: true }))}
          />
        </div>
      </section>

      <section aria-labelledby="working" className="mt-10 scroll-mt-24">
        <SectionHeading
          id="working"
          title="Working as expected"
          hint="Confirmed stable so you do not have to check them."
          action={<StatusBadge tone="good">{stable.length} findings</StatusBadge>}
        />
        <ul className="s-panel-subtle mt-5 divide-y divide-line px-5 sm:px-6">
          {visibleStable.map((finding) => (
            <li key={finding.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3">
              <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[14px] text-ink-950">{finding.title}</span>
                {finding.affectedCampaignIds.slice(0, 1).map((id) => (
                  <CampaignTag
                    key={id}
                    campaignId={id}
                    name={campaigns.find((campaign) => campaign.id === id)?.name ?? id}
                  />
                ))}
              </span>
              <button
                type="button"
                onClick={() => setOpenEvidenceId(finding.evidenceIds[0])}
                className="mono shrink-0 text-[11.5px] text-helm-600 underline-offset-2 hover:underline"
              >
                Quick look
              </button>
            </li>
          ))}
          {stable.length > visibleStable.length ? (
            <li>
              <ShowAll
                total={stable.length}
                shown={visibleStable.length}
                noun="findings"
                onShowAll={() => setExpanded((state) => ({ ...state, stable: true }))}
              />
            </li>
          ) : null}
        </ul>
      </section>

      <EvidenceDrawer
        evidence={activeEvidence}
        open={Boolean(activeEvidence)}
        onClose={() => setOpenEvidenceId(null)}
        index={activeIndex >= 0 ? activeIndex : undefined}
        total={evidence.length}
        fullRecordHref={activeEvidence ? routes.evidence(workspaceSlug, activeEvidence.id) : undefined}
        onNext={
          activeIndex >= 0 && activeIndex < evidence.length - 1
            ? () => setOpenEvidenceId(evidence[activeIndex + 1].id)
            : undefined
        }
      />
    </>
  );
}
