import type { MetricValue } from '../domain/types.js';
import { DERIVED, TOTALS } from './series.js';

/**
 * One divided scoreline, not a wall of KPI cards.
 * Every entry carries a comparison, a favourability semantic and a caveat.
 */
export const scoreline: MetricValue[] = [
  {
    key: 'spend',
    value: TOTALS.spend,
    currency: 'INR',
    previousValue: TOTALS.spendPrev,
    deltaRatio: TOTALS.spend / TOTALS.spendPrev - 1,
    availability: 'available',
  },
  {
    key: 'value',
    value: TOTALS.value,
    currency: 'INR',
    previousValue: TOTALS.valuePrev,
    deltaRatio: TOTALS.value / TOTALS.valuePrev - 1,
    availability: 'available',
    caveat: 'Platform-reported conversion value, not audited revenue.',
  },
  {
    key: 'roas',
    value: DERIVED.roas,
    previousValue: DERIVED.roasPrev,
    deltaRatio: DERIVED.roas / DERIVED.roasPrev - 1,
    availability: 'available',
  },
  {
    key: 'cpa',
    value: DERIVED.cpa,
    currency: 'INR',
    previousValue: DERIVED.cpaPrev,
    deltaRatio: DERIVED.cpa / DERIVED.cpaPrev - 1,
    availability: 'available',
    caveat: 'Media cost per mapped purchase. This is not customer acquisition cost.',
  },
  {
    key: 'conversions',
    value: TOTALS.conversions,
    previousValue: TOTALS.conversionsPrev,
    deltaRatio: TOTALS.conversions / TOTALS.conversionsPrev - 1,
    availability: 'available',
  },
];

/**
 * A genuinely unavailable metric. HELM states this rather than estimating it.
 */
export const unavailableMetric = {
  label: 'New customers',
  reason: 'New-customer reporting is not enabled on 605-DEM-7740, so a workspace total is not available.',
  action: 'Enable it in Google Ads',
};

export const partialNotice = {
  title: 'Totals cover 3 of 4 accounts in this scope',
  detail:
    'Northstar India / Retargeting last reported at 14:20 on 23 August. Its campaigns stay visible below and are excluded from every blended figure until the sync recovers.',
  action: 'Open connections',
};
