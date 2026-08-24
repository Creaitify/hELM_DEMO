import type { MetricKey, MetricSeries, SeriesAnnotation, SeriesPoint } from '@/contracts';
import { COMPARE_START, WINDOW_START } from './constants';

/**
 * Deterministic sample series.
 *
 * A fixed-seed generator keeps server and client output byte-identical, so the
 * charts never hydrate-mismatch and screenshots stay reproducible.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dateSequence(startIso: string, days: number): string[] {
  const [y, m, d] = startIso.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(Date.UTC(y, m - 1, d + i));
    out.push(date.toISOString().slice(0, 10));
  }
  return out;
}

export const WINDOW_DATES = dateSequence(WINDOW_START, 30);
export const COMPARE_DATES = dateSequence(COMPARE_START, 30);

type ShapeConfig = {
  seed: number;
  /** Multiplier applied across the window, start to end. */
  drift: number;
  /** Amplitude of the weekly rhythm. */
  weekly: number;
  /** Amplitude of the deterministic jitter. */
  noise: number;
  total: number;
};

function shaped({ seed, drift, weekly, noise, total }: ShapeConfig, days: number): number[] {
  const random = mulberry32(seed);
  const raw: number[] = [];
  for (let i = 0; i < days; i += 1) {
    const progress = days === 1 ? 0 : i / (days - 1);
    const trend = 1 + (drift - 1) * progress;
    const rhythm = 1 + weekly * Math.sin(((i % 7) / 7) * Math.PI * 2 - 0.8);
    const wobble = 1 + (random() - 0.5) * 2 * noise;
    raw.push(Math.max(0.05, trend * rhythm * wobble));
  }
  const sum = raw.reduce((acc, value) => acc + value, 0);
  return raw.map((value) => (value / sum) * total);
}

function toPoints(dates: string[], values: number[], comparison: number[]): SeriesPoint[] {
  return dates.map((date, index) => ({
    date,
    value: Math.round(values[index]),
    comparisonValue: Math.round(comparison[index]),
  }));
}

/* ---------------------------------------------------------------
   Blended totals across the three compatible India accounts.
   --------------------------------------------------------------- */

export const TOTALS = {
  spend: 3_959_000,
  spendPrev: 3_610_000,
  value: 16_616_000,
  valuePrev: 15_820_000,
  conversions: 2_268,
  conversionsPrev: 2_214,
  impressions: 18_942_000,
  impressionsPrev: 16_104_000,
  clicks: 486_300,
  clicksPrev: 452_800,
} as const;

export const DERIVED = {
  roas: TOTALS.value / TOTALS.spend,
  roasPrev: TOTALS.valuePrev / TOTALS.spendPrev,
  cpa: TOTALS.spend / TOTALS.conversions,
  cpaPrev: TOTALS.spendPrev / TOTALS.conversionsPrev,
  ctr: TOTALS.clicks / TOTALS.impressions,
  ctrPrev: TOTALS.clicksPrev / TOTALS.impressionsPrev,
} as const;

const spendCurrent = shaped({ seed: 1021, drift: 1.34, weekly: 0.1, noise: 0.07, total: TOTALS.spend }, 30);
const spendPrevious = shaped({ seed: 4402, drift: 1.06, weekly: 0.11, noise: 0.08, total: TOTALS.spendPrev }, 30);

const valueCurrent = shaped({ seed: 2213, drift: 1.12, weekly: 0.13, noise: 0.09, total: TOTALS.value }, 30);
const valuePrevious = shaped({ seed: 7781, drift: 1.05, weekly: 0.12, noise: 0.09, total: TOTALS.valuePrev }, 30);

const conversionsCurrent = shaped({ seed: 3391, drift: 1.09, weekly: 0.12, noise: 0.08, total: TOTALS.conversions }, 30);
const conversionsPrevious = shaped({ seed: 9014, drift: 1.04, weekly: 0.12, noise: 0.08, total: TOTALS.conversionsPrev }, 30);

/** Material changes are annotated directly on the chart, not buried in a legend. */
export const movementAnnotations: SeriesAnnotation[] = [
  { date: '2026-07-29', label: 'Advantage+ creative refresh', tone: 'good' },
  { date: '2026-08-04', label: 'Broad 04 daily budget raised 40%', tone: 'warn' },
  { date: '2026-08-11', label: 'Meta frequency crossed 4.0', tone: 'warn' },
  { date: '2026-08-17', label: 'High Intent began losing impression share to budget', tone: 'bad' },
];

function derivedSeries(
  metric: MetricKey,
  compute: (index: number) => number,
  computePrev: (index: number) => number,
): MetricSeries {
  return {
    metric,
    points: WINDOW_DATES.map((date, index) => ({
      date,
      value: Number(compute(index).toFixed(metric === 'roas' ? 3 : 0)),
      comparisonValue: Number(computePrev(index).toFixed(metric === 'roas' ? 3 : 0)),
    })),
    annotations: movementAnnotations,
  };
}

export const seriesByMetric: Partial<Record<MetricKey, MetricSeries>> = {
  spend: {
    metric: 'spend',
    points: toPoints(WINDOW_DATES, spendCurrent, spendPrevious),
    annotations: movementAnnotations,
  },
  value: {
    metric: 'value',
    points: toPoints(WINDOW_DATES, valueCurrent, valuePrevious),
    annotations: movementAnnotations,
  },
  conversions: {
    metric: 'conversions',
    points: toPoints(WINDOW_DATES, conversionsCurrent, conversionsPrevious),
    annotations: movementAnnotations,
  },
  roas: derivedSeries(
    'roas',
    (i) => valueCurrent[i] / spendCurrent[i],
    (i) => valuePrevious[i] / spendPrevious[i],
  ),
  cpa: derivedSeries(
    'cpa',
    (i) => spendCurrent[i] / Math.max(1, conversionsCurrent[i]),
    (i) => spendPrevious[i] / Math.max(1, conversionsPrevious[i]),
  ),
};

export function seriesFor(metric: MetricKey): MetricSeries {
  return seriesByMetric[metric] ?? seriesByMetric.spend!;
}

/* ---------------------------------------------------------------
   The decision story, expressed as two contrasting CPA series.
   --------------------------------------------------------------- */

const metaBroadCpa = shaped({ seed: 5150, drift: 1.0, weekly: 0.05, noise: 0.05, total: 30 }, 30).map(
  (_, index) => {
    const progress = index / 29;
    // Flat through late July, then a clear break after the budget increase.
    const step = progress < 0.32 ? 0 : (progress - 0.32) / 0.68;
    const base = 1869 + step * 720;
    const jitter = mulberry32(880 + index)() - 0.5;
    return Math.round(base * (1 + jitter * 0.06));
  },
);

const googleHighIntentCpa = shaped({ seed: 6160, drift: 1.0, weekly: 0.04, noise: 0.04, total: 30 }, 30).map(
  (_, index) => {
    const jitter = mulberry32(940 + index)() - 0.5;
    return Math.round(1712 * (1 + jitter * 0.07) + index * 1.4);
  },
);

export const decisionStorySeries: { label: string; provider: 'google_ads' | 'meta_ads'; points: SeriesPoint[] }[] = [
  {
    label: 'Meta · Prospecting / Broad 04',
    provider: 'meta_ads',
    points: WINDOW_DATES.map((date, index) => ({ date, value: metaBroadCpa[index] })),
  },
  {
    label: 'Google · Non-Brand / High Intent',
    provider: 'google_ads',
    points: WINDOW_DATES.map((date, index) => ({ date, value: googleHighIntentCpa[index] })),
  },
];

/** Frequency climb on Broad 04, the signal that precedes the CPA break. */
export const frequencySeries: SeriesPoint[] = WINDOW_DATES.map((date, index) => {
  const progress = index / 29;
  const jitter = mulberry32(1200 + index)() - 0.5;
  return { date, value: Number((3.18 + progress * 1.62 + jitter * 0.12).toFixed(2)) };
});

/** 3-second view rate on the leading Broad 04 creative: 32% down to 24%. */
export const hookRateSeries: SeriesPoint[] = WINDOW_DATES.map((date, index) => {
  const progress = index / 29;
  const jitter = mulberry32(1500 + index)() - 0.5;
  return { date, value: Number((0.32 - progress * 0.08 + jitter * 0.011).toFixed(4)) };
});

/** Google High Intent impression share lost to budget, climbing to 18%. */
export const impressionShareSeries: SeriesPoint[] = WINDOW_DATES.map((date, index) => {
  const progress = index / 29;
  const step = progress < 0.6 ? progress * 0.06 : 0.036 + (progress - 0.6) * 0.36;
  const jitter = mulberry32(1800 + index)() - 0.5;
  return { date, value: Number(Math.max(0, step + jitter * 0.008).toFixed(4)) };
});

export function sparkline(seed: number, points = 14, drift = 1): number[] {
  const random = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < points; i += 1) {
    const progress = points === 1 ? 0 : i / (points - 1);
    out.push(Number((60 * (1 + (drift - 1) * progress) * (0.86 + random() * 0.28)).toFixed(2)));
  }
  return out;
}
