'use client';

import { useState } from 'react';
import type { MetricKey, MetricSeries } from '@/contracts';
import { MetricChart, SERIES_COLORS } from '@/components/data/MetricChart';
import { SegmentedControl } from '@/components/primitives/Controls';
import { METRICS, metricLabel } from '@/lib/metrics';

const OPTIONS: MetricKey[] = ['spend', 'value', 'roas', 'cpa', 'conversions'];

/**
 * One primary trend chart, driven by whichever scoreline metric the reader
 * selects. The comparison line is the previous 30 days, so the question the
 * chart answers never changes shape.
 */
export function PerformanceMovement({
  seriesByMetric,
  windowLabel,
}: {
  seriesByMetric: Partial<Record<MetricKey, MetricSeries>>;
  windowLabel: string;
}) {
  const [metric, setMetric] = useState<MetricKey>('cpa');
  const series = seriesByMetric[metric] ?? seriesByMetric.spend;
  if (!series) return null;

  return (
    <div className="s-panel px-5 py-5 sm:px-6">
      {/* The section above already names this panel; repeating it here only
          costs a line the chart could have used. */}
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <SegmentedControl
          label="Chart metric"
          value={metric}
          onChange={(value) => setMetric(value as MetricKey)}
          options={OPTIONS.map((key) => ({ value: key, label: metricLabel(key, true) }))}
        />
      </div>

      <MetricChart
        question={`How did ${metricLabel(metric)} move across the window?`}
        basis={`${windowLabel} · dashed line is the previous 30 days · ${METRICS[metric].definition}`}
        metric={metric}
        series={[
          {
            label: metricLabel(metric, true),
            points: series.points,
            color: SERIES_COLORS.primary,
            fill: true,
          },
        ]}
        annotations={series.annotations}
      />
    </div>
  );
}
