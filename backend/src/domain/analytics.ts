import type {
  ChannelContribution,
  MetricDay,
  MetricKey,
  MetricSeries,
  MetricValue,
  SeriesAnnotation,
  SeriesPoint,
} from './types.js';

/**
 * Every blended figure, folded from the daily rows.
 *
 * This module is the reason the briefing can be trusted: a scoreline, a
 * series, a channel split and a window-over-window comparison are all folds
 * over the same `MetricDay` rows, for whatever range and account set the
 * reader asked for. Nothing here is written down in advance, so a figure
 * cannot drift away from the data it claims to summarise.
 *
 * Two rules hold throughout, because they are what makes the numbers honest:
 *
 *   - A ratio whose denominator is zero is `null`, never zero and never
 *     carried over from the previous window. An account that spent nothing
 *     has no CPA; saying it is ₹0 would be a lie that reads as success.
 *   - A metric the platform did not report is `null`, not `0`. Summing
 *     absent values as zero silently understates every total that includes
 *     an account which does not report them.
 */

export type Totals = {
  spend: number;
  /** null when no row in the set reported a conversion value. */
  value: number | null;
  conversions: number;
  impressions: number;
  clicks: number;
};

export function fold(rows: MetricDay[]): Totals {
  let spend = 0;
  let value = 0;
  let reportedValue = false;
  let conversions = 0;
  let impressions = 0;
  let clicks = 0;

  for (const row of rows) {
    spend += row.spend;
    if (row.value !== null && row.value !== undefined) {
      value += row.value;
      reportedValue = true;
    }
    conversions += row.conversions;
    impressions += row.impressions;
    clicks += row.clicks;
  }

  return { spend, value: reportedValue ? value : null, conversions, impressions, clicks };
}

/** A ratio, or null when the denominator cannot support one. */
function ratio(numerator: number | null, denominator: number): number | null {
  if (numerator === null || denominator === 0) return null;
  return numerator / denominator;
}

export function roasOf(totals: Totals): number | null {
  return ratio(totals.value, totals.spend);
}

export function cpaOf(totals: Totals): number | null {
  return ratio(totals.spend, totals.conversions);
}

export function ctrOf(totals: Totals): number | null {
  return ratio(totals.clicks, totals.impressions);
}

/**
 * The change between two windows, or null when it cannot be stated.
 *
 * A delta against a previous window of zero is not "infinite growth", it is
 * an unanswerable question — the first month a campaign ran has nothing to be
 * compared with.
 */
function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return current / previous - 1;
}

const CAVEAT: Partial<Record<MetricKey, string>> = {
  value: 'Platform-reported conversion value, not audited revenue.',
  cpa: 'Media cost per mapped purchase. This is not customer acquisition cost.',
  conversions: 'Mapped purchase events reported by the source platform.',
  spend: 'Amount charged by the platform for delivery in the selected window.',
  roas: 'Attributed value returned for every unit of spend.',
};

/**
 * The scoreline for a window, against the window before it.
 *
 * Availability is stated per metric rather than assumed: a figure nothing in
 * the set reported comes back `unavailable` with a null value, so the
 * interface can say so instead of rendering a confident zero.
 */
export function scorelineFrom(
  current: MetricDay[],
  previous: MetricDay[],
  currency: string,
): MetricValue[] {
  const now = fold(current);
  const before = fold(previous);

  const entries: { key: MetricKey; value: number | null; previousValue: number | null }[] = [
    { key: 'spend', value: now.spend, previousValue: before.spend },
    { key: 'value', value: now.value, previousValue: before.value },
    { key: 'roas', value: roasOf(now), previousValue: roasOf(before) },
    { key: 'cpa', value: cpaOf(now), previousValue: cpaOf(before) },
    { key: 'conversions', value: now.conversions, previousValue: before.conversions },
  ];

  return entries.map(({ key, value, previousValue }) => ({
    key,
    value,
    currency: key === 'spend' || key === 'value' || key === 'cpa' ? currency : undefined,
    previousValue,
    deltaRatio: delta(value, previousValue),
    availability: value === null ? ('unavailable' as const) : ('available' as const),
    caveat: CAVEAT[key],
  }));
}

/** Inclusive date sequence, in UTC so a run never skips or repeats a day. */
export function dateRange(startIso: string, endIso: string): string[] {
  const [ys, ms, ds] = startIso.split('-').map(Number);
  const [ye, me, de] = endIso.split('-').map(Number);
  const end = Date.UTC(ye, me - 1, de);
  const out: string[] = [];
  for (let at = Date.UTC(ys, ms - 1, ds); at <= end; at += 86_400_000) {
    out.push(new Date(at).toISOString().slice(0, 10));
  }
  return out;
}

function byDate(rows: MetricDay[]): Map<string, MetricDay[]> {
  const map = new Map<string, MetricDay[]>();
  for (const row of rows) {
    const bucket = map.get(row.date);
    if (bucket) bucket.push(row);
    else map.set(row.date, [row]);
  }
  return map;
}

/** The value of one metric for one day's rows, at the right precision. */
function pointValue(metric: MetricKey, rows: MetricDay[] | undefined): number | null {
  if (!rows || rows.length === 0) return null;
  const totals = fold(rows);
  switch (metric) {
    case 'spend':
      return Math.round(totals.spend);
    case 'value':
      return totals.value === null ? null : Math.round(totals.value);
    case 'conversions':
      return Math.round(totals.conversions);
    case 'roas': {
      const value = roasOf(totals);
      return value === null ? null : Number(value.toFixed(3));
    }
    case 'cpa': {
      const value = cpaOf(totals);
      return value === null ? null : Math.round(value);
    }
    default:
      return null;
  }
}

/**
 * One series per metric, current window against the one before it.
 *
 * The two windows are zipped by position rather than by date, because they
 * are different dates by definition — day 1 of this window is compared with
 * day 1 of the last, which is what a reader means by "versus the previous
 * 30 days".
 */
export function seriesFrom(
  current: MetricDay[],
  previous: MetricDay[],
  window: { start: string; end: string },
  comparison: { start: string; end: string } | null,
  annotations: SeriesAnnotation[] = [],
): Partial<Record<MetricKey, MetricSeries>> {
  const dates = dateRange(window.start, window.end);
  const priorDates = comparison ? dateRange(comparison.start, comparison.end) : [];
  const now = byDate(current);
  const before = byDate(previous);

  const metrics: MetricKey[] = ['spend', 'value', 'conversions', 'roas', 'cpa'];
  const out: Partial<Record<MetricKey, MetricSeries>> = {};

  for (const metric of metrics) {
    const points: SeriesPoint[] = dates.map((date, index) => {
      const priorDate = priorDates[index];
      return {
        date,
        value: pointValue(metric, now.get(date)),
        comparisonValue: priorDate ? pointValue(metric, before.get(priorDate)) : null,
      };
    });

    // A metric no row reported is not a flat line at zero; it is absent.
    if (points.every((point) => point.value === null)) continue;
    out[metric] = { metric, points, annotations };
  }

  return out;
}

const PROVIDER_LABEL: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
};

/**
 * Where the spend went, and whether that split moved.
 *
 * The share change is stated in points of share rather than as a percentage
 * change of a percentage, which is the form that gets misread.
 */
export function channelContributionFrom(
  current: MetricDay[],
  previous: MetricDay[],
): ChannelContribution[] {
  const group = (rows: MetricDay[]) => {
    const map = new Map<string, MetricDay[]>();
    for (const row of rows) {
      const bucket = map.get(row.provider);
      if (bucket) bucket.push(row);
      else map.set(row.provider, [row]);
    }
    return map;
  };

  const now = group(current);
  const before = group(previous);
  const totalNow = fold(current).spend;
  const totalBefore = fold(previous).spend;

  return [...now.entries()]
    .map(([provider, rows]) => {
      const totals = fold(rows);
      const share = totalNow === 0 ? 0 : totals.spend / totalNow;
      const priorRows = before.get(provider) ?? [];
      const priorShare = totalBefore === 0 ? 0 : fold(priorRows).spend / totalBefore;
      return {
        provider: provider as ChannelContribution['provider'],
        label: PROVIDER_LABEL[provider] ?? provider,
        spend: Math.round(totals.spend),
        value: totals.value === null ? null : Math.round(totals.value),
        share,
        deltaShare: share - priorShare,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

/**
 * The decision story: CPA per platform, so the two can be read against each
 * other rather than blended into one line that hides the divergence.
 */
export function decisionStoryFrom(
  current: MetricDay[],
  window: { start: string; end: string },
): { label: string; provider: ChannelContribution['provider']; points: { date: string; value: number | null }[] }[] {
  const dates = dateRange(window.start, window.end);
  const providers = [...new Set(current.map((row) => row.provider))];

  return providers.map((provider) => {
    const rows = byDate(current.filter((row) => row.provider === provider));
    return {
      label: PROVIDER_LABEL[provider] ?? provider,
      provider,
      points: dates.map((date) => ({ date, value: pointValue('cpa', rows.get(date)) })),
    };
  });
}
