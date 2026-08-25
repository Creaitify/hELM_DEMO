import type { AdAccount, CampaignSummary, CreativeSummary, DataBasis } from '../domain/types.js';

/**
 * The evidence pack.
 *
 * A compact, already-reconciled view of the decision graph that specialists
 * are allowed to reason over. Building it here rather than inside a prompt
 * means the same numbers reach the model, the finding, and the UI.
 */

export type EvidencePack = {
  scopeLabel: string;
  rangeLabel: string;
  currency: string;
  blendedAccountIds: string[];
  separatedAccountIds: string[];
  accounts: {
    id: string;
    name: string;
    provider: string;
    currency: string;
    timeZone: string;
    freshness: string;
    included: boolean;
    reason?: string;
  }[];
  totals: {
    spend: number;
    value: number;
    conversions: number;
    cpa: number | null;
    roas: number | null;
  };
  movement: {
    campaignId: string;
    name: string;
    provider: string;
    spend: number;
    deltaSpend: number;
    cpa: number | null;
    deltaCpa: number | null;
    status: string;
    note?: string;
  }[];
  creativeFatigue: {
    id: string;
    name: string;
    campaignId: string;
    frequency: number | null;
    hookRate: number | null;
    fatigue: string;
    note: string;
  }[];
  exclusions: string[];
};

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function buildEvidencePack(input: {
  scopeLabel: string;
  rangeLabel: string;
  currency: string;
  accounts: AdAccount[];
  campaigns: CampaignSummary[];
  creatives: CreativeSummary[];
  basis: DataBasis;
  focusCampaignIds?: string[];
}): EvidencePack {
  const blended = new Set(input.basis.accountIds);

  const accountRows = input.accounts.map((account) => {
    const included = blended.has(account.id);
    return {
      id: account.id,
      name: account.name,
      provider: account.provider,
      currency: account.currency,
      timeZone: account.timeZone,
      freshness: account.health.state,
      included,
      reason: included
        ? undefined
        : account.currency !== input.currency
          ? `Reports in ${account.currency} on an ${account.timeZone} day boundary`
          : (account.health.message ?? 'Excluded from the blended basis'),
    };
  });

  const blendedCampaigns = input.campaigns.filter((campaign) => blended.has(campaign.accountId));
  const spend = blendedCampaigns.reduce((total, campaign) => total + campaign.spend, 0);
  const value = blendedCampaigns.reduce((total, campaign) => total + (campaign.value ?? 0), 0);
  const conversions = blendedCampaigns.reduce((total, campaign) => total + campaign.conversions, 0);

  const focus = new Set(input.focusCampaignIds ?? []);
  const movement = [...input.campaigns]
    .sort((a, b) => {
      const focusDelta = Number(focus.has(b.id)) - Number(focus.has(a.id));
      if (focusDelta !== 0) return focusDelta;
      return Math.abs(b.deltaCpa ?? 0) - Math.abs(a.deltaCpa ?? 0);
    })
    .slice(0, 8)
    .map((campaign) => ({
      campaignId: campaign.id,
      name: campaign.name,
      provider: campaign.provider,
      spend: campaign.spend,
      deltaSpend: round(campaign.deltaSpend, 4),
      cpa: campaign.cpa,
      deltaCpa: campaign.deltaCpa === null ? null : round(campaign.deltaCpa, 4),
      status: campaign.status,
      note: campaign.intelligenceNote,
    }));

  const creativeFatigue = input.creatives
    .filter((creative) => creative.fatigue !== 'healthy')
    .slice(0, 6)
    .map((creative) => ({
      id: creative.id,
      name: creative.name,
      campaignId: creative.campaignId,
      frequency: creative.frequency,
      hookRate: creative.hookRate,
      fatigue: creative.fatigue,
      note: creative.note,
    }));

  return {
    scopeLabel: input.scopeLabel,
    rangeLabel: input.rangeLabel,
    currency: input.currency,
    blendedAccountIds: [...blended],
    separatedAccountIds: accountRows.filter((row) => !row.included).map((row) => row.id),
    accounts: accountRows,
    totals: {
      spend: round(spend, 0),
      value: round(value, 0),
      conversions,
      cpa: conversions > 0 ? round(spend / conversions, 2) : null,
      roas: spend > 0 ? round(value / spend, 3) : null,
    },
    movement,
    creativeFatigue,
    exclusions: input.basis.exclusions,
  };
}
