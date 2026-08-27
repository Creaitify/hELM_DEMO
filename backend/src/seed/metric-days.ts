import type { CampaignSummary, MetricDay } from '../domain/types.js';
import { metricDayId } from '../domain/types.js';
import { dateRange } from '../domain/analytics.js';

/**
 * Daily rows for the sample workspace.
 *
 * The sample portfolio is written as campaign totals, but the product reads
 * daily rows — so the seed expands the totals into the grain the rest of the
 * system actually uses. That matters for more than tidiness: it means the
 * sample workspace travels the same derivation path as a connected one, and a
 * mistake in that path shows up on screen in development instead of the first
 * time somebody attaches a real ad account.
 *
 * Each campaign already carries a 30-day spend shape. Everything else is
 * distributed across the window in proportion to that shape, so a day with
 * more spend has proportionally more of the conversions it bought, and the
 * days sum back to the campaign totals they came from.
 *
 * The previous window is reconstructed from the deltas the campaign reports
 * (`deltaSpend` and `deltaCpa` are ratios against the window before), which is
 * the only comparison the sample data actually states. Nothing is invented
 * beyond that.
 */

/** Distributes a total across a window in proportion to a shape. */
function spread(total: number, shape: number[]): number[] {
  const sum = shape.reduce((acc, value) => acc + value, 0);
  if (sum === 0) return shape.map(() => total / Math.max(1, shape.length));
  return shape.map((value) => (value / sum) * total);
}

/**
 * The shape a campaign's window has, padded or trimmed to the window length.
 * A sparkline shorter than the window repeats rather than leaving holes,
 * because a hole would read as a day of zero spend that never happened.
 */
function shapeFor(campaign: CampaignSummary, days: number): number[] {
  const source = campaign.dailySpend?.length ? campaign.dailySpend : [1];
  return Array.from({ length: days }, (_, index) => source[index % source.length]);
}

function rowsForWindow(
  campaign: CampaignSummary,
  workspaceId: string,
  dates: string[],
  totals: { spend: number; value: number | null; conversions: number; impressions: number; clicks: number },
): MetricDay[] {
  const shape = shapeFor(campaign, dates.length);
  const spend = spread(totals.spend, shape);
  const value = totals.value === null ? null : spread(totals.value, shape);
  const conversions = spread(totals.conversions, shape);
  const impressions = spread(totals.impressions, shape);
  const clicks = spread(totals.clicks, shape);

  return dates.map((date, index) => ({
    id: metricDayId(campaign.accountId, campaign.id, date),
    workspaceId,
    accountId: campaign.accountId,
    campaignId: campaign.id,
    provider: campaign.provider,
    date,
    currency: campaign.currency,
    spend: Math.round(spend[index]),
    value: value === null ? null : Math.round(value[index]),
    conversions: Math.round(conversions[index]),
    impressions: Math.round(impressions[index]),
    clicks: Math.round(clicks[index]),
  }));
}

/**
 * Reconstructs what the previous window must have held for the campaign's
 * stated deltas to be true.
 *
 * Spend divides out of `deltaSpend`. Conversions follow from the previous CPA
 * implied by `deltaCpa`, because CPA is spend over conversions and two of the
 * three are now known. Value is scaled to hold ROAS steady, which is the
 * assumption the sample makes when it does not say otherwise.
 */
function previousTotals(campaign: CampaignSummary) {
  const spend = campaign.spend / (1 + (campaign.deltaSpend ?? 0));
  const cpa =
    campaign.cpa === null || campaign.cpa === undefined
      ? null
      : campaign.cpa / (1 + (campaign.deltaCpa ?? 0));
  const conversions = cpa && cpa > 0 ? spend / cpa : campaign.conversions;
  const roas = campaign.roas ?? (campaign.value !== null && campaign.spend > 0 ? campaign.value / campaign.spend : null);

  return {
    spend,
    value: roas === null ? null : spend * roas,
    conversions,
    impressions: campaign.impressions * (spend / Math.max(1, campaign.spend)),
    clicks: campaign.clicks * (spend / Math.max(1, campaign.spend)),
  };
}

export function metricDaysForCampaigns(
  campaigns: CampaignSummary[],
  workspaceId: string,
  window: { start: string; end: string },
  comparison: { start: string; end: string },
): MetricDay[] {
  const windowDates = dateRange(window.start, window.end);
  const priorDates = dateRange(comparison.start, comparison.end);
  const out: MetricDay[] = [];

  for (const campaign of campaigns) {
    out.push(
      ...rowsForWindow(campaign, workspaceId, windowDates, {
        spend: campaign.spend,
        value: campaign.value,
        conversions: campaign.conversions,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
      }),
      ...rowsForWindow(campaign, workspaceId, priorDates, previousTotals(campaign)),
    );
  }

  return out;
}
