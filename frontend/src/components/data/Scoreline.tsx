import type { MetricValue } from '@/contracts';
import { METRICS, deltaSemantic, formatMetric, metricLabel } from '@/lib/metrics';
import { formatDelta } from '@/lib/format';
import { DeltaChip } from '@/components/primitives/Status';
import { cn } from '@/lib/cn';

/**
 * One divided horizontal scoreline. Not eight equal hover-lifting KPI cards.
 * Each metric carries its comparison, favourability, definition and caveat.
 */
export function Scoreline({
  metrics,
  unavailable,
  comparisonLabel,
  className,
}: {
  metrics: MetricValue[];
  unavailable?: { label: string; reason: string };
  comparisonLabel: string;
  className?: string;
}) {
  const columns = metrics.length + (unavailable ? 1 : 0);

  return (
    <section
      aria-label="Performance scoreline"
      className={cn('s-panel overflow-hidden p-0', className)}
    >
      {/* gap-px over the line colour gives exact hairlines at every column count */}
      <div
        className={cn(
          'grid gap-px bg-line sm:grid-cols-2 md:grid-cols-3',
          columns >= 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-5',
        )}
      >
        {metrics.map((metric) => {
          const definition = METRICS[metric.key];
          const semantic = deltaSemantic(metric.key, metric.deltaRatio);
          // Compact only where the exact digits stop being readable. A CPA of
          // ₹1,746 must never render as ₹1.7K.
          const compact = Math.abs(metric.value ?? 0) >= 100_000;
          return (
            <div key={metric.key} className="bg-surface px-4 py-4 lg:px-5">
              <p className="micro-label" title={definition.definition}>
                {metricLabel(metric.key)}
              </p>
              <p
                data-metric
                className="mt-2 text-[clamp(20px,2vw,26px)] font-semibold leading-none tracking-[-0.02em] text-ink-950"
              >
                {formatMetric(metric.value, metric.key, { currency: metric.currency, compact })}
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <DeltaChip text={formatDelta(metric.deltaRatio)} semantic={semantic} />
                <span className="mono text-[11px] text-ink-400">
                  from {formatMetric(metric.previousValue ?? null, metric.key, { currency: metric.currency, compact })}
                </span>
              </div>
              <p className="mt-2 text-[11.5px] leading-[16px] text-ink-400">
                {metric.caveat ?? definition.definition}
              </p>
            </div>
          );
        })}

        {unavailable ? (
          <div className="bg-surface-subtle px-4 py-4 lg:px-5">
            <p className="micro-label">{unavailable.label}</p>
            <p className="mt-2 text-[16px] font-medium leading-none text-ink-400">Not available</p>
            <p className="mt-2.5 text-[11.5px] leading-[16px] text-ink-400">{unavailable.reason}</p>
          </div>
        ) : null}
      </div>

      <p className="mono border-t border-line bg-surface-subtle px-4 py-2 text-[11px] text-ink-400 lg:px-5">
        Compared with {comparisonLabel}
      </p>
    </section>
  );
}
