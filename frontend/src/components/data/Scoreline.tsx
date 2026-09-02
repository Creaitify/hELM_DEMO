import type { MetricKey, MetricValue } from '@/contracts';
import { METRICS, deltaSemantic, formatMetric, metricLabel } from '@/lib/metrics';
import { formatDelta } from '@/lib/format';
import { DeltaChip } from '@/components/primitives/Status';
import { Sparkline } from '@/components/data/Charts';
import { AskAbout } from '@/features/agent/AskAbout';
import { cn } from '@/lib/cn';

/**
 * One divided horizontal scoreline. Not eight equal hover-lifting KPI cards.
 *
 * Each cell used to carry a paragraph explaining what its metric means. Five
 * of those, stacked across the most valuable row on the page, made the row
 * something you read rather than something you scan — and they said the same
 * thing every morning, which is the definition of reference material. The
 * definitions are still here, on the label's tooltip, where reference belongs.
 *
 * What replaced them earns its space: the shape of the last thirty days. A
 * number with a delta tells you it moved. The line under it tells you whether
 * it drifted, spiked, or has been going the wrong way for a fortnight — which
 * is the difference between a figure and a finding, and it costs no words.
 */
export function Scoreline({
  metrics,
  spark,
  unavailable,
  comparisonLabel,
  className,
}: {
  metrics: MetricValue[];
  /** Thirty days of shape per metric. Absent metrics simply show no line. */
  spark?: Partial<Record<MetricKey, (number | null)[]>>;
  unavailable?: { label: string; reason: string };
  comparisonLabel: string;
  className?: string;
}) {
  // Present means the platform returned a figure. Everything else is named
  // below the row rather than drawn as an empty column.
  const present = metrics.filter((metric) => metric.value !== null && metric.value !== undefined);
  const missing = metrics.filter((metric) => metric.value === null || metric.value === undefined);

  const absentLabels = [
    ...missing.map((metric) => metricLabel(metric.key)),
    ...(unavailable ? [unavailable.label] : []),
  ];

  const columns = present.length;

  return (
    <section
      aria-label="Performance scoreline"
      className={cn('s-panel overflow-hidden p-0', className)}
    >
      {/* gap-px over the line colour gives exact hairlines at every column count */}
      <div
        className={cn(
          'grid gap-px bg-line sm:grid-cols-2 md:grid-cols-3',
          // The row divides into as many columns as it has figures, so four
          // measured metrics fill the width rather than leaving a gap where a
          // fifth used to sit.
          columns >= 6 ? 'lg:grid-cols-6' : columns === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4',
        )}
      >
        {present.map((metric) => {
          const definition = METRICS[metric.key];
          const semantic = deltaSemantic(metric.key, metric.deltaRatio);
          // Compact only where the exact digits stop being readable. A CPA of
          // ₹1,746 must never render as ₹1.7K.
          const compact = Math.abs(metric.value ?? 0) >= 100_000;
          const values = (spark?.[metric.key] ?? []).filter(
            (point): point is number => point !== null,
          );

          return (
            <div
              key={metric.key}
              className="ask-host group relative bg-surface px-4 py-4 transition-colors duration-150 hover:bg-surface-subtle lg:px-5"
            >
              <div className="flex items-start justify-between gap-2">
                {/*
                  The label carries everything reference-shaped about the metric.

                  Both the definition and the caveat sit on the tooltip, and a
                  caveated metric is marked with a degree sign. In practice the
                  API sends a caveat for nearly every metric and writes most of
                  them as definitions — printing all five put a paragraph under
                  every figure and turned the most valuable row on the page into
                  a wall of text. The mark keeps the qualifier discoverable
                  without letting it outweigh the number it qualifies.
                */}
                <p
                  className="micro-label"
                  title={
                    metric.caveat
                      ? `${definition.definition} — ${metric.caveat}`
                      : definition.definition
                  }
                >
                  {metricLabel(metric.key, true)}
                  {metric.caveat ? (
                    <span aria-hidden="true" className="ml-0.5 text-action-400">
                      °
                    </span>
                  ) : null}
                  {metric.caveat ? <span className="sr-only"> — {metric.caveat}</span> : null}
                </p>
                <AskAbout
                  subject={metricLabel(metric.key)}
                  question={`${metricLabel(metric.key)} is ${formatMetric(metric.value, metric.key, { currency: metric.currency, compact })} against ${formatMetric(metric.previousValue ?? null, metric.key, { currency: metric.currency, compact })} last period. What is driving that, and which campaigns are responsible?`}
                  className="-mr-1 -mt-1"
                />
              </div>

              <p
                data-metric
                className="mt-2.5 text-[clamp(24px,2.4vw,32px)] font-semibold leading-none tracking-[-0.025em] text-ink-950"
              >
                {formatMetric(metric.value, metric.key, { currency: metric.currency, compact })}
              </p>

              <div className="mt-2.5 flex items-end justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <DeltaChip text={formatDelta(metric.deltaRatio)} semantic={semantic} />
                  <span className="mono text-[11px] text-ink-400">
                    {formatMetric(metric.previousValue ?? null, metric.key, {
                      currency: metric.currency,
                      compact,
                    })}
                  </span>
                </div>

                {values.length > 1 ? (
                  <Sparkline
                    values={values}
                    label={`${metricLabel(metric.key)} across the window`}
                    width={72}
                    height={26}
                    className="opacity-90 transition-opacity duration-150 group-hover:opacity-100"
                  />
                ) : null}
              </div>

            </div>
          );
        })}
      </div>

      {/* One line, not a paragraph and a disclosure. What the comparison is,
          and what is missing from it. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-surface-subtle px-4 py-2 lg:px-5">
        <p className="mono text-[10.5px] uppercase tracking-[0.08em] text-ink-400">
          vs {comparisonLabel}
        </p>
        {absentLabels.length ? (
          <p className="mono text-[10.5px] text-ink-400">
            Not reported: <span className="text-ink-500">{absentLabels.join(' · ')}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
