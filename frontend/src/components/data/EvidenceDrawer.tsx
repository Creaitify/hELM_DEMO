'use client';

import Link from 'next/link';
import type { Evidence } from '@/contracts';
import { Drawer } from '@/components/primitives/Overlay';
import { KindMarker } from '@/components/primitives/Status';
import { Button } from '@/components/primitives/Button';
import { MetricChart, SERIES_COLORS } from './MetricChart';
import { formatDateRange } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Evidence opens beside the claim: a drawer on desktop, a full-height sheet on
 * mobile. It always carries the basis that produced the numbers.
 *
 * This is the quick look. It closes with the page, so anything worth sending to
 * someone else leaves through the durable record instead.
 */
export function EvidenceDrawer({
  evidence,
  open,
  onClose,
  onNext,
  index,
  total,
  fullRecordHref,
}: {
  evidence: Evidence | null;
  open: boolean;
  onClose: () => void;
  onNext?: () => void;
  index?: number;
  total?: number;
  fullRecordHref?: string;
}) {
  if (!evidence) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={evidence.title}
      description={
        total && index !== undefined ? `Evidence ${index + 1} of ${total}` : 'Evidence record'
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="mono text-[11.5px] text-ink-400">
            {formatDateRange(evidence.basis.startDateInclusive, evidence.basis.endDateInclusive)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {fullRecordHref ? (
              <Link
                href={fullRecordHref}
                className="inline-flex h-11 items-center rounded-control px-3 text-[13px] text-helm-600 underline-offset-2 transition-colors hover:bg-surface-sunk hover:underline md:h-9"
              >
                View full evidence
              </Link>
            ) : null}
            <Button variant="quiet" size="compact" onClick={onClose}>
              Close
            </Button>
            {onNext ? (
              <Button variant="neutral" size="compact" onClick={onNext}>
                Next evidence
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <KindMarker kind={evidence.kind} />
          <p className="mt-3 text-[15px] leading-[24px] text-ink-700">{evidence.summary}</p>
        </div>

        {evidence.series ? (
          <div className="s-panel-subtle px-4 py-4">
            <MetricChart
              compact
              question={evidence.title}
              basis={formatDateRange(evidence.basis.startDateInclusive, evidence.basis.endDateInclusive)}
              metric={evidence.series.metric}
              series={[
                {
                  label: 'Observed',
                  points: evidence.series.points,
                  color: SERIES_COLORS.primary,
                  fill: true,
                },
              ]}
              annotations={evidence.series.annotations}
            />
          </div>
        ) : null}

        <div>
          <p className="micro-label">Record</p>
          <dl className="mt-2 divide-y divide-line rounded-control border border-line">
            {evidence.rows.map((row, rowIndex) => (
              <div key={`${row.label}-${rowIndex}`} className="grid gap-1 px-3.5 py-3 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)] sm:gap-4">
                <dt className="text-[12.5px] text-ink-500">{row.label}</dt>
                <dd>
                  <span
                    className={cn(
                      'text-[13.5px] text-ink-950',
                      row.mono && 'mono',
                      row.tone === 'good' && 'text-good',
                      row.tone === 'warn' && 'text-warn',
                      row.tone === 'bad' && 'text-bad',
                    )}
                  >
                    {row.value}
                  </span>
                  {row.detail ? (
                    <span className="mt-0.5 block text-[12px] leading-[17px] text-ink-400">{row.detail}</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {evidence.method ? (
          <div>
            <p className="micro-label">Method</p>
            <p className="mt-2 text-[13.5px] leading-[21px] text-ink-700">{evidence.method}</p>
          </div>
        ) : null}

        <div>
          <p className="micro-label">Basis</p>
          <dl className="mono mt-2 space-y-1.5 text-[12px]">
            <Row
              label="Window"
              value={`${formatDateRange(evidence.basis.startDateInclusive, evidence.basis.endDateInclusive)} inclusive`}
            />
            {evidence.basis.comparisonStartDateInclusive ? (
              <Row
                label="Comparison"
                value={formatDateRange(
                  evidence.basis.comparisonStartDateInclusive,
                  evidence.basis.comparisonEndDateInclusive ?? evidence.basis.comparisonStartDateInclusive,
                )}
              />
            ) : null}
            <Row label="Complete through" value={evidence.basis.completeThroughDate} />
            <Row
              label="Aggregation"
              value={
                evidence.basis.aggregation.state === 'compatible'
                  ? 'Compatible — same currency and reporting day'
                  : evidence.basis.aggregation.state === 'converted'
                    ? `Converted to ${evidence.basis.aggregation.reportingCurrency}`
                    : 'Separated'
              }
            />
          </dl>
          {evidence.basis.exclusions.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {evidence.basis.exclusions.map((exclusion) => (
                <li key={exclusion} className="flex gap-2 text-[12.5px] leading-[19px] text-ink-500">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-400" aria-hidden="true" />
                  {exclusion}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-right text-ink-700">{value}</dd>
    </div>
  );
}
