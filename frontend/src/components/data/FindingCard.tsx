'use client';

import Link from 'next/link';
import type { Evidence, Finding, Recommendation } from '@/contracts';
import { Button } from '@/components/primitives/Button';
import { ConfidenceMarker, DeltaChip, KindMarker, StatusBadge } from '@/components/primitives/Status';
import { IconEvidence, IconIntelligence, IconLock, ProviderMark } from '@/components/icons';
import { deltaSemantic, formatMetric, metricLabel } from '@/lib/metrics';
import { formatDelta, formatDateRange, formatMoneyContract } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * A finding is a precise statement plus everything needed to check it:
 * exposure, evidence quality, source accounts, window, and one next step.
 */
export function FindingCard({
  finding,
  recommendation,
  accountNames,
  onOpenEvidence,
  investigateHref,
  emphasis = false,
}: {
  finding: Finding;
  recommendation?: Recommendation;
  accountNames: { id: string; name: string; provider: 'google_ads' | 'meta_ads' }[];
  onOpenEvidence: (evidenceId: string) => void;
  investigateHref: string;
  emphasis?: boolean;
}) {
  const severityTone =
    finding.severity === 'decision' ? 'bad' : finding.severity === 'watch' ? 'warn' : 'good';

  return (
    <article
      className={cn(
        'relative',
        emphasis
          ? 's-panel border-l-[3px] border-l-bad px-5 py-5 sm:px-6 sm:py-6'
          : 'border-b border-line py-5 last:border-b-0',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <KindMarker kind={finding.kind} />
        {finding.severity === 'decision' ? (
          <StatusBadge tone="bad">Needs a decision</StatusBadge>
        ) : null}
        {accountNames.map((account) => (
          <span key={account.id} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-400">
            <ProviderMark provider={account.provider} size={13} />
            {account.name}
          </span>
        ))}
      </div>

      <h3
        className={cn(
          'mt-3 font-semibold leading-snug tracking-[-0.015em] text-ink-950',
          emphasis ? 'text-[20px] sm:text-[22px]' : 'text-[16px]',
        )}
      >
        {finding.title}
      </h3>

      <p className={cn('mt-2.5 max-w-prose leading-[23px] text-ink-700', emphasis ? 'text-[15px]' : 'text-[14px]')}>
        {finding.observation}
      </p>

      {finding.metricHighlights.length > 0 ? (
        <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
          {finding.metricHighlights.map((metric) => (
            <div key={metric.key}>
              <dt className="micro-label">{metricLabel(metric.key, true)}</dt>
              <dd className="mt-1 flex items-baseline gap-2">
                <span data-metric className="text-[16px] font-medium text-ink-950">
                  {formatMetric(metric.value, metric.key, { currency: metric.currency })}
                </span>
                {metric.deltaRatio !== null && metric.deltaRatio !== undefined ? (
                  <DeltaChip
                    text={formatDelta(metric.deltaRatio)}
                    semantic={deltaSemantic(metric.key, metric.deltaRatio)}
                  />
                ) : (
                  <span className="text-[11.5px] text-ink-400">{metric.caveat ?? 'No comparison'}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {finding.exposure ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface-sunk px-3.5 py-2.5">
          <span className="micro-label">Financial exposure</span>
          <span className="mono text-[14px] font-medium text-bad">
            {formatMoneyContract(finding.exposure.low, 'en-IN', true)} –{' '}
            {formatMoneyContract(finding.exposure.high, 'en-IN', true)}
          </span>
          <span className="text-[11.5px] text-ink-400">{finding.exposure.note}</span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <ConfidenceMarker level={finding.confidence} />
        <span className="mono text-[11.5px] text-ink-400">
          {formatDateRange(finding.basis.startDateInclusive, finding.basis.endDateInclusive)} vs previous 30 days
        </span>
        <StatusBadge tone={severityTone === 'good' ? 'good' : severityTone === 'warn' ? 'warn' : 'bad'}>
          {finding.evidenceIds.length} evidence records
        </StatusBadge>
      </div>

      <p className="mt-2 text-[12px] leading-[18px] text-ink-400">{finding.confidenceNote}</p>

      {recommendation ? (
        <div className="mt-4 rounded-field border border-line bg-surface-subtle px-4 py-3.5">
          <p className="micro-label">Next step</p>
          <p className="mt-1.5 text-[14px] leading-[21px] text-ink-950">{recommendation.action}</p>
          <p className="mono mt-2 text-[11.5px] text-ink-500">
            {recommendation.expectedRange} · {recommendation.horizon}
          </p>
        </div>
      ) : finding.recommendedNextStep ? (
        <div className="mt-4 rounded-field border border-line bg-surface-subtle px-4 py-3">
          <p className="micro-label">Next step</p>
          <p className="mt-1.5 text-[14px] leading-[21px] text-ink-950">{finding.recommendedNextStep}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant={emphasis ? 'neutral' : 'quiet'}
          size="compact"
          leading={<IconEvidence size={16} />}
          onClick={() => onOpenEvidence(finding.evidenceIds[0])}
          disabled={finding.evidenceIds.length === 0}
        >
          Open evidence
        </Button>
        <Link
          href={investigateHref}
          className="inline-flex h-11 items-center gap-2 rounded-control px-3.5 text-[14px] text-ink-700 transition-colors hover:bg-surface-sunk hover:text-ink-950 md:h-9"
        >
          <IconIntelligence size={16} />
          Investigate with HELM
        </Link>
      </div>
    </article>
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
