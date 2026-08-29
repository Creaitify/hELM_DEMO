import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Small, static chart forms. Server-renderable, no client bundle.
 * Ranked comparison uses bars, never a donut with many slices.
 */

export function Sparkline({
  values,
  color = 'var(--helm-500)',
  width = 84,
  height = 26,
  label,
  className,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  label: string;
  className?: string;
}) {
  if (values.length < 2) return <span className="text-[11px] text-ink-400">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((value - min) / span) * (height - 4);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join('');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={cn('shrink-0', className)}
    >
      <path d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RankedBars({
  question,
  basis,
  rows,
  className,
}: {
  question: string;
  basis?: string;
  rows: { label: string; value: number; display: string; color?: string; note?: string }[];
  className?: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="mb-3">
        <h3 className="text-[15px] font-semibold leading-snug text-ink-950">{question}</h3>
        {basis ? <p className="mt-1 text-[12px] leading-[17px] text-ink-500">{basis}</p> : null}
      </figcaption>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] text-ink-700">{row.label}</span>
              <span className="mono shrink-0 text-[13px] font-medium text-ink-950">{row.display}</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-sunk">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, (row.value / max) * 100)}%`, background: row.color ?? 'var(--helm-500)' }}
              />
            </div>
            {row.note ? <p className="mt-1 text-[12px] text-ink-400">{row.note}</p> : null}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * A modelled figure with a low and a high, drawn as a band rather than a bar.
 *
 * A single bar would state a precision the estimate does not have. The band is
 * the honest shape: it occupies the range it actually covers, and the midpoint
 * is marked so the rows can still be compared at a glance without implying the
 * midpoint is the answer.
 */
export function RangeBars({
  question,
  basis,
  rows,
  className,
}: {
  question: string;
  basis?: string;
  rows: { label: string; low: number; high: number; display: string; color?: string; note?: string }[];
  className?: string;
}) {
  const ceiling = Math.max(...rows.map((row) => row.high), 1);
  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="mb-3">
        <h3 className="text-[15px] font-semibold leading-snug text-ink-950">{question}</h3>
        {basis ? <p className="mt-1 text-[12px] leading-[17px] text-ink-500">{basis}</p> : null}
      </figcaption>
      <ul className="space-y-3">
        {rows.map((row) => {
          const left = (Math.min(row.low, row.high) / ceiling) * 100;
          const width = Math.max(2, (Math.abs(row.high - row.low) / ceiling) * 100);
          const mid = left + width / 2;
          return (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] text-ink-700">{row.label}</span>
                <span className="mono shrink-0 text-[13px] font-medium text-ink-950">{row.display}</span>
              </div>
              <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-sunk">
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{ left: `${left}%`, width: `${width}%`, background: row.color ?? 'var(--helm-500)' }}
                />
                {/* The midpoint is a reading aid, never the headline figure. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px bg-surface/70"
                  style={{ left: `${mid}%` }}
                />
              </div>
              {row.note ? <p className="mt-1 text-[12px] text-ink-400">{row.note}</p> : null}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/**
 * Counts over time, one column per period.
 *
 * Bars sit on a shared baseline because the question is always "how many, and
 * when" — a line would imply the quiet days are a continuous quantity falling
 * to zero rather than days on which nothing happened.
 */
export function ColumnChart({
  question,
  basis,
  columns,
  className,
}: {
  question: string;
  basis?: string;
  columns: { label: string; value: number; caption?: string; color?: string }[];
  className?: string;
}) {
  const max = Math.max(...columns.map((column) => column.value), 1);
  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="mb-3">
        <h3 className="text-[15px] font-semibold leading-snug text-ink-950">{question}</h3>
        {basis ? <p className="mt-1 text-[12px] leading-[17px] text-ink-500">{basis}</p> : null}
      </figcaption>

      <div className="flex h-[96px] items-end gap-[3px] border-b border-line-strong" aria-hidden="true">
        {columns.map((column) => (
          <div
            key={column.label}
            title={`${column.label}: ${column.caption ?? column.value}`}
            className="min-w-0 flex-1 rounded-t-[2px] transition-[height] duration-[var(--t-chart)]"
            style={{
              height: column.value === 0 ? '2px' : `${Math.max(6, (column.value / max) * 100)}%`,
              background:
                column.value === 0 ? 'var(--line)' : (column.color ?? 'var(--helm-500)'),
            }}
          />
        ))}
      </div>

      {/* The columns are decorative markup; the values themselves stay readable. */}
      <ul className="sr-only">
        {columns.map((column) => (
          <li key={column.label}>{`${column.label}: ${column.caption ?? column.value}`}</li>
        ))}
      </ul>

      <div className="mono mt-1.5 flex justify-between text-[11px] text-ink-400">
        <span>{columns[0]?.label}</span>
        <span>{columns[columns.length - 1]?.label}</span>
      </div>
    </figure>
  );
}

/** Two-part share only. Anything with more parts becomes a bar chart. */
export function ShareBar({
  question,
  parts,
  className,
}: {
  question: string;
  parts: { label: string; share: number; display: string; color: string; sub?: string }[];
  className?: string;
}) {
  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="mb-3">
        <h3 className="text-[15px] font-semibold leading-snug text-ink-950">{question}</h3>
      </figcaption>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-sunk" role="img" aria-label={question}>
        {parts.map((part) => (
          <div
            key={part.label}
            style={{ width: `${part.share * 100}%`, background: part.color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {parts.map((part) => (
          <li key={part.label} className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] text-ink-700">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: part.color }} />
              {part.label}
            </span>
            <span className="text-right">
              <span className="mono block text-[13px] font-medium text-ink-950">{part.display}</span>
              {part.sub ? <span className="mono block text-[11px] text-ink-400">{part.sub}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Quadrant scatter with an explicit decision rule written on it. */
export function DecisionQuadrant({
  question,
  xLabel,
  yLabel,
  rule,
  points,
  className,
}: {
  question: string;
  xLabel: string;
  yLabel: string;
  rule: string;
  points: { id: string; label: string; x: number; y: number; color: string; flagged?: boolean }[];
  className?: string;
}) {
  const W = 460;
  const H = 300;
  const pad = { l: 52, r: 18, t: 16, b: 40 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="mb-3">
        <h3 className="text-[15px] font-semibold leading-snug text-ink-950">{question}</h3>
        <p className="mt-1 text-[12px] leading-[17px] text-ink-500">{rule}</p>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${question}. ${rule}`}>
        <rect x={pad.l} y={pad.t} width={pw} height={ph} fill="var(--surface-subtle)" rx={6} />
        <line x1={pad.l + pw / 2} x2={pad.l + pw / 2} y1={pad.t} y2={pad.t + ph} stroke="var(--line-strong)" strokeDasharray="4 4" />
        <line x1={pad.l} x2={pad.l + pw} y1={pad.t + ph / 2} y2={pad.t + ph / 2} stroke="var(--line-strong)" strokeDasharray="4 4" />
        {points.map((point) => {
          const cx = pad.l + point.x * pw;
          const cy = pad.t + (1 - point.y) * ph;
          return (
            <g key={point.id}>
              {point.flagged ? <circle cx={cx} cy={cy} r={11} fill={point.color} opacity={0.16} /> : null}
              <circle cx={cx} cy={cy} r={5} fill={point.color} />
              <text x={cx + 9} y={cy + 4} fontSize={10.5} fill="var(--ink-700)">
                {point.label}
              </text>
            </g>
          );
        })}
        <text x={pad.l + pw / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--ink-500)">
          {xLabel}
        </text>
        <text
          x={-(pad.t + ph / 2)}
          y={14}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize={11}
          fill="var(--ink-500)"
        >
          {yLabel}
        </text>
      </svg>
    </figure>
  );
}

export function ChartFrame({
  children,
  className,
  footer,
}: {
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <div className={cn('s-panel px-5 py-5', className)}>
      {children}
      {footer ? <div className="mt-4 border-t border-line pt-3 text-[12px] text-ink-400">{footer}</div> : null}
    </div>
  );
}
