'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MetricKey, SeriesAnnotation, SeriesPoint } from '@/contracts';
import { METRICS, formatMetric, metricLabel } from '@/lib/metrics';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Disclosure } from '@/components/primitives/Controls';

/**
 * One semantic question per chart. The title states the question, the subtitle
 * states the basis and comparison, series are direct-labelled, and the exact
 * values are always reachable by hover, tap, focus, and a data table.
 */

function useMeasuredWidth(fallback = 960) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && Math.abs(next - width) > 1) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, width };
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) return [min];
  const span = max - min;
  const rawStep = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1) * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 0.5; value += step) ticks.push(value);
  return ticks;
}

export type ChartSeries = {
  label: string;
  points: SeriesPoint[];
  color: string;
  dashed?: boolean;
  fill?: boolean;
};

export function MetricChart({
  question,
  basis,
  metric,
  series,
  annotations = [],
  currency = 'INR',
  height,
  className,
  compact = false,
}: {
  question: string;
  basis: string;
  metric: MetricKey;
  series: ChartSeries[];
  annotations?: SeriesAnnotation[];
  currency?: string;
  height?: number;
  className?: string;
  compact?: boolean;
}) {
  const { ref, width } = useMeasuredWidth();
  const [active, setActive] = useState<number | null>(null);

  const chartHeight = height ?? (compact ? 176 : 264);
  const pad = { top: 18, right: compact ? 16 : 108, bottom: 30, left: compact ? 46 : 62 };
  const plotW = Math.max(80, width - pad.left - pad.right);
  const plotH = chartHeight - pad.top - pad.bottom;

  const dates = series[0]?.points.map((point) => point.date) ?? [];

  const { min, max, ticks } = useMemo(() => {
    const values = series.flatMap((entry) =>
      entry.points.flatMap((point) =>
        [point.value, point.comparisonValue].filter((value): value is number => value !== null && value !== undefined),
      ),
    );
    if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = (rawMax - rawMin) * 0.18 || rawMax * 0.12 || 1;
    const lo = METRICS[metric].unit === 'money' || METRICS[metric].unit === 'count'
      ? Math.max(0, rawMin - padding)
      : rawMin - padding;
    const hi = rawMax + padding;
    return { min: lo, max: hi, ticks: niceTicks(lo, hi, compact ? 3 : 4) };
  }, [series, metric, compact]);

  const x = (index: number) => pad.left + (dates.length <= 1 ? plotW / 2 : (index / (dates.length - 1)) * plotW);
  const y = (value: number) => pad.top + plotH - ((value - min) / (max - min || 1)) * plotH;

  const linePath = (points: SeriesPoint[], key: 'value' | 'comparisonValue') => {
    let path = '';
    points.forEach((point, index) => {
      const value = point[key];
      if (value === null || value === undefined) return;
      path += `${path ? 'L' : 'M'}${x(index).toFixed(2)} ${y(value).toFixed(2)}`;
    });
    return path;
  };

  const areaPath = (points: SeriesPoint[]) => {
    const line = linePath(points, 'value');
    if (!line) return '';
    const lastIndex = points.length - 1;
    return `${line}L${x(lastIndex).toFixed(2)} ${(pad.top + plotH).toFixed(2)}L${x(0).toFixed(2)} ${(pad.top + plotH).toFixed(2)}Z`;
  };

  const labelStep = Math.max(1, Math.ceil(dates.length / (compact ? 4 : 7)));
  const activePoint = active !== null ? dates[active] : null;

  const summary = useMemo(() => {
    const primary = series[0];
    if (!primary) return '';
    const first = primary.points.find((point) => point.value !== null)?.value ?? null;
    const last = [...primary.points].reverse().find((point) => point.value !== null)?.value ?? null;
    if (first === null || last === null) return question;
    const direction = last > first ? 'rose' : last < first ? 'fell' : 'held';
    return `${metricLabel(metric)} ${direction} from ${formatMetric(first, metric, { currency, compact: true })} to ${formatMetric(last, metric, { currency, compact: true })} across ${dates.length} days.`;
  }, [series, metric, currency, dates.length, question]);

  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="mb-3">
        <h3 className="text-[15px] font-semibold leading-snug text-ink-950">{question}</h3>
        <p className="mt-1 text-[12px] leading-[17px] text-ink-500">{basis}</p>
      </figcaption>

      <div ref={ref} className="relative w-full">
        <svg
          width={width}
          height={chartHeight}
          viewBox={`0 0 ${width} ${chartHeight}`}
          role="img"
          aria-label={summary}
          className="block w-full select-none"
          onMouseLeave={() => setActive(null)}
        >
          {/* Horizontal reference rules */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={pad.left + plotW}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={pad.left - 10}
                y={y(tick) + 4}
                textAnchor="end"
                className="mono"
                fontSize={11}
                fill="var(--ink-400)"
              >
                {formatMetric(tick, metric, { currency, compact: true })}
              </text>
            </g>
          ))}

          {/* Annotations pinned to the decisive dates */}
          {annotations.map((annotation) => {
            const index = dates.indexOf(annotation.date);
            if (index < 0) return null;
            const tone =
              annotation.tone === 'bad'
                ? 'var(--bad)'
                : annotation.tone === 'warn'
                  ? 'var(--warn)'
                  : annotation.tone === 'good'
                    ? 'var(--good)'
                    : 'var(--ink-400)';
            return (
              <g key={`${annotation.date}-${annotation.label}`}>
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  stroke={tone}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.5}
                />
                <circle cx={x(index)} cy={pad.top} r={3} fill={tone} />
              </g>
            );
          })}

          {/* Series */}
          {series.map((entry) => (
            <g key={entry.label}>
              {entry.fill ? (
                <path d={areaPath(entry.points)} fill={entry.color} opacity={0.07} className="chart-fade" />
              ) : null}
              {entry.points.some((point) => point.comparisonValue !== null && point.comparisonValue !== undefined) ? (
                <path
                  d={linePath(entry.points, 'comparisonValue')}
                  fill="none"
                  stroke="var(--ink-400)"
                  strokeWidth={1.4}
                  strokeDasharray="4 4"
                  opacity={0.72}
                  className="chart-fade"
                />
              ) : null}
              <path
                d={linePath(entry.points, 'value')}
                fill="none"
                stroke={entry.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="chart-fade"
              />
            </g>
          ))}

          {/* Direct labels rather than a floating legend */}
          {!compact
            ? series.map((entry) => {
                const lastIndex = entry.points.length - 1;
                const lastValue = entry.points[lastIndex]?.value;
                if (lastValue === null || lastValue === undefined) return null;
                return (
                  <g key={`label-${entry.label}`}>
                    <circle cx={x(lastIndex)} cy={y(lastValue)} r={3.5} fill={entry.color} />
                    <text
                      x={x(lastIndex) + 10}
                      y={y(lastValue) - 2}
                      fontSize={11.5}
                      fill="var(--ink-700)"
                      fontWeight={600}
                    >
                      {entry.label.length > 16 ? `${entry.label.slice(0, 15)}…` : entry.label}
                    </text>
                    <text x={x(lastIndex) + 10} y={y(lastValue) + 12} fontSize={11} className="mono" fill="var(--ink-500)">
                      {formatMetric(lastValue, metric, { currency, compact: true })}
                    </text>
                  </g>
                );
              })
            : null}

          {/* X labels */}
          {dates.map((date, index) =>
            index % labelStep === 0 || index === dates.length - 1 ? (
              <text
                key={date}
                x={x(index)}
                y={chartHeight - 8}
                textAnchor={index === 0 ? 'start' : index === dates.length - 1 ? 'end' : 'middle'}
                fontSize={11}
                className="mono"
                fill="var(--ink-400)"
              >
                {formatDate(date, 'short')}
              </text>
            ) : null,
          )}

          {/* Crosshair */}
          {active !== null ? (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke="var(--ink-700)"
              strokeWidth={1}
              opacity={0.35}
            />
          ) : null}

          {/* Hit targets: keyboard reachable, one per point */}
          {dates.map((date, index) => (
            <rect
              key={`hit-${date}`}
              x={x(index) - plotW / Math.max(1, dates.length - 1) / 2}
              y={pad.top}
              width={plotW / Math.max(1, dates.length - 1)}
              height={plotH}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${formatDate(date, 'long')}: ${series
                .map((entry) => `${entry.label} ${formatMetric(entry.points[index]?.value ?? null, metric, { currency })}`)
                .join(', ')}`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="outline-none focus-visible:fill-helm-500/10"
            />
          ))}
        </svg>

        {/* Readout */}
        <div
          className={cn(
            'pointer-events-none absolute left-0 top-0 rounded-control border border-line bg-surface px-3 py-2 shadow-lift transition-opacity duration-[110ms]',
            activePoint ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            transform: `translate(${Math.min(Math.max(0, x(active ?? 0) - 70), Math.max(0, width - 190))}px, 0)`,
          }}
          aria-hidden="true"
        >
          <p className="mono text-[11px] text-ink-400">{activePoint ? formatDate(activePoint, 'long') : ''}</p>
          {series.map((entry) => (
            <p key={entry.label} className="mt-1 flex items-center gap-2 text-[12px] text-ink-950">
              <span className="h-[2px] w-3 rounded-full" style={{ background: entry.color }} />
              <span className="mono">
                {formatMetric(active !== null ? (entry.points[active]?.value ?? null) : null, metric, { currency })}
              </span>
            </p>
          ))}
        </div>
      </div>

      {annotations.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {annotations.map((annotation) => (
            <li key={annotation.label} className="flex items-center gap-2 text-[12px] text-ink-500">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background:
                    annotation.tone === 'bad'
                      ? 'var(--bad)'
                      : annotation.tone === 'warn'
                        ? 'var(--warn)'
                        : annotation.tone === 'good'
                          ? 'var(--good)'
                          : 'var(--ink-400)',
                }}
              />
              <span className="mono text-ink-400">{formatDate(annotation.date, 'short')}</span>
              {annotation.label}
            </li>
          ))}
        </ul>
      ) : null}

      <Disclosure summary="View exact values" className="mt-2 border-t border-line">
        <div className="thin-scrollbar max-h-64 overflow-auto">
          <table className="w-full text-left text-[12px]">
            <caption className="sr-only">{question}</caption>
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line">
                <th scope="col" className="py-1.5 pr-4 font-medium text-ink-500">
                  Date
                </th>
                {series.map((entry) => (
                  <th key={entry.label} scope="col" className="py-1.5 pr-4 text-right font-medium text-ink-500">
                    {entry.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="mono">
              {dates.map((date, index) => (
                <tr key={date} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="py-1.5 pr-4 font-normal text-ink-500">
                    {formatDate(date)}
                  </th>
                  {series.map((entry) => (
                    <td key={entry.label} className="py-1.5 pr-4 text-right text-ink-950">
                      {formatMetric(entry.points[index]?.value ?? null, metric, { currency })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </figure>
  );
}

export const SERIES_COLORS = {
  primary: 'var(--helm-500)',
  google: 'var(--google)',
  meta: 'var(--meta)',
  iris: 'var(--iris-500)',
  good: 'var(--good)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
} as const;
