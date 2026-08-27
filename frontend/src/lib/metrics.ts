import type { Evidence, Finding, MetricDefinition, MetricKey, MetricValue } from '@/contracts';
import { formatMoney, formatMultiple, formatNumber, formatPercent } from './format';

/**
 * Central metric catalog. Definitions are honest about what a number is and
 * what it is not: CPA is not CAC, conversion value is not revenue, link clicks
 * are not all clicks, and a derived metric always publishes its formula.
 */
export const METRICS: Record<MetricKey, MetricDefinition> = {
  spend: {
    key: 'spend',
    label: 'Spend',
    unit: 'money',
    favorable: 'neutral',
    kind: 'observed',
    definition: 'Amount charged by the platform for delivery in the selected window.',
  },
  value: {
    key: 'value',
    label: 'Attributed value',
    shortLabel: 'Value',
    unit: 'money',
    favorable: 'up',
    kind: 'observed',
    definition: 'Platform-reported conversion value for the mapped purchase event.',
    caveat: 'Attributed value is not audited revenue.',
  },
  roas: {
    key: 'roas',
    label: 'ROAS',
    unit: 'multiple',
    favorable: 'up',
    kind: 'calculated',
    definition: 'Attributed value returned for every unit of spend.',
    formula: 'Attributed value ÷ spend',
    caveat: 'Uses the mapped purchase event only, on a 7-day click basis.',
  },
  cpa: {
    key: 'cpa',
    label: 'CPA',
    unit: 'money',
    favorable: 'down',
    kind: 'calculated',
    definition: 'Cost per mapped purchase inside the selected window.',
    formula: 'Spend ÷ mapped purchases',
    caveat: 'CPA is a media cost per purchase. It is not customer acquisition cost.',
  },
  conversions: {
    key: 'conversions',
    label: 'Purchases',
    unit: 'count',
    favorable: 'up',
    kind: 'observed',
    definition: 'Mapped purchase events reported by the source platform.',
    caveat: 'Google primary Purchase and Meta Purchase, normalized to 7-day click.',
  },
  impressions: {
    key: 'impressions',
    label: 'Impressions',
    unit: 'count',
    favorable: 'neutral',
    kind: 'observed',
    definition: 'Times an ad was served. Impressions are not reach.',
  },
  clicks: {
    key: 'clicks',
    label: 'Clicks',
    unit: 'count',
    favorable: 'up',
    kind: 'observed',
    definition: 'All recorded clicks. On Meta this differs from link clicks.',
  },
  ctr: {
    key: 'ctr',
    label: 'CTR',
    unit: 'percent',
    favorable: 'up',
    kind: 'calculated',
    definition: 'Share of impressions that produced a click.',
    formula: 'Clicks ÷ impressions',
  },
  cpc: {
    key: 'cpc',
    label: 'CPC',
    unit: 'money',
    favorable: 'down',
    kind: 'calculated',
    definition: 'Average cost of a click.',
    formula: 'Spend ÷ clicks',
  },
  cpm: {
    key: 'cpm',
    label: 'CPM',
    unit: 'money',
    favorable: 'down',
    kind: 'calculated',
    definition: 'Cost of one thousand impressions.',
    formula: 'Spend ÷ impressions × 1,000',
  },
  frequency: {
    key: 'frequency',
    label: 'Frequency',
    unit: 'decimal',
    favorable: 'down',
    kind: 'observed',
    definition: 'Average impressions delivered per person reached.',
    caveat: 'Meta only. Google Search does not report a comparable figure.',
  },
  reach: {
    key: 'reach',
    label: 'Reach',
    unit: 'count',
    favorable: 'neutral',
    kind: 'observed',
    definition: 'People who saw an ad at least once. Reach is not impressions.',
  },
  hook_rate: {
    key: 'hook_rate',
    label: '3-second view rate',
    shortLabel: 'Hook',
    unit: 'percent',
    favorable: 'up',
    kind: 'calculated',
    definition: 'Share of impressions that produced a 3-second video play.',
    formula: '3-second video plays ÷ impressions',
    caveat: 'Derived from Meta video metrics. Not a universal hook score.',
  },
  hold_rate: {
    key: 'hold_rate',
    label: 'Hold rate',
    unit: 'percent',
    favorable: 'up',
    kind: 'calculated',
    definition: 'Share of 3-second plays that reached the 15-second milestone.',
    formula: '15-second plays ÷ 3-second plays',
  },
  impression_share: {
    key: 'impression_share',
    label: 'Impression share lost to budget',
    shortLabel: 'IS lost (budget)',
    unit: 'percent',
    favorable: 'down',
    kind: 'observed',
    definition: 'Share of eligible impressions missed because daily budget ran out.',
    caveat: 'Google Ads only.',
  },
};

export function metricLabel(key: MetricKey, short = false): string {
  const definition = METRICS[key];
  return short ? (definition.shortLabel ?? definition.label) : definition.label;
}

export function formatMetric(
  value: number | null | undefined,
  key: MetricKey,
  options: { currency?: string; compact?: boolean } = {},
): string {
  if (value === null || value === undefined) return 'Not available';
  const { currency = 'INR', compact = false } = options;
  switch (METRICS[key].unit) {
    case 'money':
      return formatMoney(value, currency, { compact });
    case 'percent':
      return formatPercent(value, { digits: 1 });
    case 'multiple':
      return formatMultiple(value);
    case 'decimal':
      return value.toFixed(1);
    case 'ratio':
      return value.toFixed(2);
    default:
      return formatNumber(value, { compact });
  }
}

/**
 * Scale a figure only once it stops being readable at full precision.
 *
 * A dense row cannot afford ₹7,64,000, but ₹2.4K throws away the digits that
 * make a CPA worth reading. One lakh is where the tradeoff flips.
 */
export function formatMetricDense(
  value: number | null | undefined,
  key: MetricKey,
  currency?: string,
): string {
  const compact = typeof value === 'number' && Math.abs(value) >= 1e5;
  return formatMetric(value, key, { currency, compact });
}

/**
 * The leading metric's series, taken from the evidence behind the finding.
 *
 * Returns nothing when the evidence carries no series for that metric. A shape
 * invented to fill the slot would be the one dishonest mark on the card.
 */
export function findingTrend(finding: Finding, evidence: Evidence[]): number[] | undefined {
  const leading = finding.metricHighlights[0]?.key;
  const records = finding.evidenceIds
    .map((id) => evidence.find((entry) => entry.id === id))
    .filter((entry): entry is Evidence => Boolean(entry?.series));
  const match = records.find((entry) => entry.series?.metric === leading) ?? records[0];
  const values = (match?.series?.points ?? [])
    .map((point) => point.value)
    .filter((value): value is number => value !== null);
  return values.length > 1 ? values : undefined;
}

export type DeltaSemantic = 'favorable' | 'unfavorable' | 'neutral';

/** Direction alone never carries meaning; the metric decides what good looks like. */
export function deltaSemantic(key: MetricKey, deltaRatio: number | null | undefined): DeltaSemantic {
  if (deltaRatio === null || deltaRatio === undefined || Math.abs(deltaRatio) < 0.002) {
    return 'neutral';
  }
  const favorable = METRICS[key].favorable;
  if (favorable === 'neutral') return 'neutral';
  const rising = deltaRatio > 0;
  if (favorable === 'up') return rising ? 'favorable' : 'unfavorable';
  return rising ? 'unfavorable' : 'favorable';
}

export function isAvailable(metric: MetricValue): boolean {
  return metric.value !== null && metric.availability !== 'unavailable';
}
