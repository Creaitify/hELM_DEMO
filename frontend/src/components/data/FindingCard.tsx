'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import type { Evidence, Finding, MetricValue, Recommendation } from '@/contracts';
import { Button } from '@/components/primitives/Button';
import { ConfidenceMarker, DeltaChip, KindMarker, StatusBadge } from '@/components/primitives/Status';
import { Sparkline } from '@/components/data/Charts';
import { CampaignTag } from '@/components/data/CampaignTag';
import { IconChevronDown, IconEvidence, IconIntelligence, IconLock, ProviderMark } from '@/components/icons';
import { deltaSemantic, formatMetricDense, metricLabel } from '@/lib/metrics';
import { formatDelta, formatDateRange, formatMoneyContract } from '@/lib/format';
import { leadCampaignIdentity } from '@/lib/campaign-color';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

/**
 * A finding is a precise statement plus everything needed to check it.
 *
 * The numbers lead. Someone deciding whether to act needs the figure, what it
 * was, how far it moved and what it costs — four things they can take in at a
 * glance. The sentence explaining it is still here, one disclosure away, but it
 * no longer stands between the reader and the arithmetic.
 */
export function FindingCard({
  finding,
  recommendation,
  accountNames,
  campaignNames = [],
  workspaceSlug,
  onOpenEvidence,
  investigateHref,
  trend,
  emphasis = false,
}: {
  finding: Finding;
  recommendation?: Recommendation;
  accountNames: { id: string; name: string; provider: 'google_ads' | 'meta_ads' }[];
  /** Names for finding.affectedCampaignIds. The colour never travels without one. */
  campaignNames?: { id: string; name: string }[];
  workspaceSlug: string;
  onOpenEvidence: (evidenceId: string) => void;
  investigateHref: string;
  /** The leading metric across the window, taken from the evidence behind it. */
  trend?: number[];
  emphasis?: boolean;
}) {
  const identity = leadCampaignIdentity(finding.affectedCampaignIds);
  const nextStep = recommendation?.action ?? finding.recommendedNextStep;
  const primaryEvidenceId = finding.evidenceIds[0];
  const [whyOpen, setWhyOpen] = useState(false);
  const whyId = useId();

  return (
    <article
      className={cn(
        'relative border-l-2 pl-4',
        emphasis ? 's-panel py-4 pr-5 sm:pr-6' : 'border-b border-line py-4 last:border-b-0',
      )}
      // The rule identifies the campaign, so it is always read against the name
      // beside it and never on its own. The wash stays well below the weight
      // where it could be mistaken for a status fill.
      style={{
        borderLeftColor: identity?.mark ?? 'var(--line-strong)',
        background: emphasis ? identity?.tint : undefined,
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <KindMarker kind={finding.kind} />
        {finding.severity === 'decision' ? (
          <StatusBadge tone="bad">Needs a decision</StatusBadge>
        ) : null}
        {campaignNames.map((campaign) => (
          <CampaignTag key={campaign.id} campaignId={campaign.id} name={campaign.name} />
        ))}
        {accountNames.map((account) => (
          <span key={account.id} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-400">
            <ProviderMark provider={account.provider} size={13} />
            {account.name}
          </span>
        ))}
      </div>

      <h3
        className={cn(
          'mt-2 font-semibold leading-snug tracking-[-0.015em] text-ink-950',
          emphasis ? 'text-[18px] sm:text-[19px]' : 'text-[15.5px]',
        )}
      >
        {finding.title}
      </h3>

      <MetricStrip
        metrics={finding.metricHighlights}
        exposure={finding.exposure}
        trend={trend}
        trendColor={identity?.mark}
      />

      {/* Quality, window, source and the way in to the prose, on one line.
          Each of these used to own a row of its own. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4">
        <ConfidenceMarker level={finding.confidence} />
        <span className="mono text-[11.5px] text-ink-400">
          {formatDateRange(finding.basis.startDateInclusive, finding.basis.endDateInclusive)} vs previous 30
        </span>
        {primaryEvidenceId ? (
          <Link
            href={routes.evidence(workspaceSlug, primaryEvidenceId)}
            className="mono inline-flex h-11 items-center text-[11.5px] text-helm-600 underline-offset-2 hover:underline md:h-9"
          >
            {finding.evidenceIds.length} evidence {finding.evidenceIds.length === 1 ? 'record' : 'records'}
          </Link>
        ) : (
          <span className="mono text-[11.5px] text-ink-400">No evidence attached</span>
        )}
        <button
          type="button"
          aria-expanded={whyOpen}
          aria-controls={whyId}
          onClick={() => setWhyOpen(!whyOpen)}
          className="mono inline-flex h-11 items-center gap-1 text-[11.5px] text-ink-500 transition-colors hover:text-ink-950 md:h-9"
        >
          Why
          <span className={cn('transition-transform duration-[160ms]', whyOpen && 'rotate-180')}>
            <IconChevronDown size={14} />
          </span>
        </button>
      </div>

      {/* The prose is still here and still exact. It is simply no longer the
          first thing between the reader and the decision. */}
      {whyOpen ? (
        <div id={whyId} className="mb-1 border-t border-line/70 pt-2">
          <p className="max-w-prose text-[13.5px] leading-[21px] text-ink-700">{finding.observation}</p>
          <p className="mt-2 max-w-prose text-[12px] leading-[18px] text-ink-500">{finding.confidenceNote}</p>
          {finding.exposure ? (
            <p className="mt-2 max-w-prose text-[12px] leading-[18px] text-ink-500">{finding.exposure.note}</p>
          ) : null}
        </div>
      ) : null}

      {nextStep ? (
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[13.5px] leading-[20px] text-ink-950">
          <span className="micro-label shrink-0">Next step</span>
          {nextStep}
          {recommendation ? (
            <span className="mono shrink-0 text-[11.5px] text-ink-500">
              {recommendation.expectedRange} · {recommendation.horizon}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
        <Button
          variant="quiet"
          size="compact"
          leading={<IconEvidence size={16} />}
          onClick={() => onOpenEvidence(primaryEvidenceId)}
          disabled={finding.evidenceIds.length === 0}
        >
          Quick look
        </Button>
        <Link
          href={investigateHref}
          className="inline-flex h-11 items-center gap-2 rounded-control px-3 text-[13.5px] text-ink-700 transition-colors hover:bg-surface-sunk hover:text-ink-950 md:h-9"
        >
          <IconIntelligence size={16} />
          Investigate with HELM
        </Link>
      </div>
    </article>
  );
}

/**
 * Current, previous, delta and the spend at stake, in one scannable row.
 *
 * Right-aligned and tabular so digits line up down each column. The sparkline
 * rides the leading metric because a shape is cheaper to read than a sentence
 * describing one.
 */
function MetricStrip({
  metrics,
  exposure,
  trend,
  trendColor,
}: {
  metrics: MetricValue[];
  exposure?: Finding['exposure'];
  trend?: number[];
  trendColor?: string;
}) {
  if (metrics.length === 0 && !exposure) return null;

  return (
    <dl className="mt-2.5 flex flex-wrap items-stretch gap-x-5 gap-y-2.5">
      {metrics.map((metric, index) => (
        <div key={metric.key} className="min-w-[92px] text-right">
          <dt className="micro-label">{metricLabel(metric.key, true)}</dt>
          <dd className="mt-1 flex items-center justify-end gap-2">
            {index === 0 && trend && trend.length > 1 ? (
              <Sparkline
                values={trend}
                width={52}
                height={16}
                color={trendColor ?? 'var(--line-strong)'}
                label={`${metricLabel(metric.key)} across the window`}
              />
            ) : null}
            <span data-metric className="text-[17px] font-medium leading-none text-ink-950">
              {formatMetricDense(metric.value, metric.key, metric.currency)}
            </span>
          </dd>
          <dd className="mono mt-1 flex items-center justify-end gap-2 text-[11.5px] text-ink-400">
            {metric.previousValue !== null && metric.previousValue !== undefined ? (
              <span>was {formatMetricDense(metric.previousValue, metric.key, metric.currency)}</span>
            ) : (
              <span>{metric.caveat ?? 'No comparison'}</span>
            )}
            {metric.deltaRatio !== null && metric.deltaRatio !== undefined ? (
              <DeltaChip
                text={formatDelta(metric.deltaRatio)}
                semantic={deltaSemantic(metric.key, metric.deltaRatio)}
              />
            ) : null}
          </dd>
        </div>
      ))}

      {exposure ? (
        <div
          className={cn(
            'min-w-[112px]',
            // The rule separates the modelled figure from the observed ones,
            // and the right edge only lines up with a column that exists. With
            // nothing to its left this cell is the row, so it starts the row.
            metrics.length > 0 ? 'border-l border-line pl-5 text-right' : 'text-left',
          )}
        >
          {/* Labelled modelled where it is read, not in a footnote below. */}
          <dt className="micro-label">At stake · modelled</dt>
          <dd className={cn('mt-1 flex h-4 items-center', metrics.length > 0 && 'justify-end')}>
            <span data-metric className="mono text-[17px] font-medium leading-none text-bad">
              {formatMoneyContract(exposure.low, 'en-IN', true)}–
              {formatMoneyContract(exposure.high, 'en-IN', true)}
            </span>
          </dd>
          <dd className="mono mt-1 text-[11.5px] text-ink-400">Not a forecast</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function RecommendationPanel({
  recommendation,
  onApprove,
  onRevise,
  onSave,
  onDismiss,
  decisionState,
  canApprove = true,
}: {
  recommendation: Recommendation;
  onApprove: () => void;
  onRevise: () => void;
  onSave: () => void;
  onDismiss: () => void;
  decisionState: 'proposed' | 'approved' | 'revision_requested' | 'dismissed' | 'saved';
  /** Approval is an admin or owner permission. Viewers still read the proposal. */
  canApprove?: boolean;
}) {
  return (
    <div className="s-panel overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-subtle px-5 py-3">
        <p className="micro-label">Recommendation · proposed, not executed</p>
        {/* The one place `urgent` is earned: the window for acting closes today. */}
        {recommendation.urgency === 'today' && decisionState === 'proposed' ? (
          <StatusBadge tone="urgent">Act today</StatusBadge>
        ) : null}
        <StatusBadge
          tone={
            decisionState === 'approved'
              ? 'good'
              : decisionState === 'dismissed'
                ? 'neutral'
                : decisionState === 'revision_requested'
                  ? 'warn'
                  : 'info'
          }
        >
          {decisionState === 'proposed'
            ? 'Waiting for your decision'
            : decisionState === 'approved'
              ? 'Approved'
              : decisionState === 'revision_requested'
                ? 'Revision requested'
                : decisionState === 'saved'
                  ? 'Saved for later'
                  : 'Dismissed'}
        </StatusBadge>
      </div>

      <div className="px-5 py-5">
        <h3 className="text-[17px] font-semibold leading-snug text-ink-950">{recommendation.action}</h3>
        <p className="mt-2.5 max-w-prose text-[14px] leading-[22px] text-ink-700">{recommendation.rationale}</p>

        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="micro-label">Expected</dt>
            <dd className="mt-1 text-[13.5px] text-ink-950">{recommendation.expectedRange}</dd>
          </div>
          <div>
            <dt className="micro-label">Horizon</dt>
            <dd className="mono mt-1 text-[13.5px] text-ink-950">{recommendation.horizon}</dd>
          </div>
          <div>
            <dt className="micro-label">Effort · urgency</dt>
            <dd className="mt-1 text-[13.5px] capitalize text-ink-950">
              {recommendation.effort} · {recommendation.urgency.replace('_', ' ')}
            </dd>
          </div>
        </dl>

        <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
          <div>
            <p className="micro-label">Assumptions</p>
            <ul className="mt-2 space-y-1.5">
              {recommendation.assumptions.map((item) => (
                <li key={item} className="flex gap-2 text-[13px] leading-[20px] text-ink-700">
                  <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-ink-400" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="micro-label">Risks</p>
            <ul className="mt-2 space-y-1.5">
              {recommendation.risks.map((item) => (
                <li key={item} className="flex gap-2 text-[13px] leading-[20px] text-ink-700">
                  <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-warn" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {recommendation.stopConditions.length > 0 ? (
          <div className="mt-5 border-t border-line pt-5">
            <p className="micro-label">Stop conditions</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {recommendation.stopConditions.map((item) => (
                <li
                  key={item}
                  className="rounded-full border border-line bg-surface-subtle px-3 py-1.5 text-[12.5px] text-ink-700"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-subtle px-5 py-4">
        {canApprove ? (
          <>
            <Button variant="action" onClick={onApprove} disabled={decisionState === 'approved'}>
              Approve recommendation
            </Button>
            <Button variant="neutral" size="compact" onClick={onRevise}>
              Request revision
            </Button>
            <Button variant="quiet" size="compact" onClick={onSave}>
              Save for later
            </Button>
            <Button variant="quiet" size="compact" onClick={onDismiss} className="ml-auto text-ink-500">
              Dismiss
            </Button>
          </>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-ink-500">
            <IconLock size={15} />
            Approving a recommendation needs the admin or owner role. You can still read the proposal and
            its evidence.
          </p>
        )}
      </div>
    </div>
  );
}

export function EvidenceLauncher({
  evidenceIds,
  evidence,
  onOpen,
}: {
  evidenceIds: string[];
  evidence: Evidence[];
  onOpen: (id: string) => void;
}) {
  const items = evidenceIds
    .map((id) => evidence.find((entry) => entry.id === id))
    .filter((entry): entry is Evidence => Boolean(entry));

  return (
    <ul className="divide-y divide-line rounded-card border border-line">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-subtle"
          >
            <span className="mt-[2px] shrink-0 text-ink-400">
              <IconEvidence size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] text-ink-950">{item.title}</span>
              <span className="mt-0.5 block text-[12.5px] leading-[18px] text-ink-500">{item.summary}</span>
            </span>
            <span className="shrink-0">
              <KindMarker kind={item.kind} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
