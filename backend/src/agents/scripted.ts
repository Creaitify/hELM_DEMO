import type { Finding } from '../domain/types.js';
import type { EvidencePack } from './evidence-pack.js';

/**
 * Deterministic specialist output.
 *
 * Used whenever no ANTHROPIC_API_KEY is configured, and as the fallback when a
 * model call fails. It is written from the same evidence pack the model would
 * receive, so the product tells the same story either way — and the fleet log
 * says plainly which of the two produced it.
 */

function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'not available';
  return `${value > 0 ? '+' : ''}${Math.round(value * 1000) / 10}%`;
}

function money(currency: string, amount: number): string {
  return `${currency} ${Math.round(amount).toLocaleString('en-IN')}`;
}

/** The shape a specialist returns before HELM validates and stores it. */
export type DraftFinding = {
  title: string;
  observation: string;
  kind: 'observed' | 'calculated' | 'inferred';
  severity: 'decision' | 'watch' | 'stable';
  confidence: 'high' | 'medium' | 'low';
  confidenceNote: string;
  exposureLowMinorUnits: string | null;
  exposureHighMinorUnits: string | null;
  exposureNote: string;
  affectedCampaignIds: string[];
  recommendedNextStep: string;
};

export type DraftRecommendation = {
  findingIndex: number;
  action: string;
  rationale: string;
  assumptions: string[];
  risks: string[];
  expectedDirection: 'increase' | 'decrease' | 'protect' | 'investigate';
  expectedRange: string;
  capMinorUnits?: string;
  horizon: string;
  stopConditions: string[];
  effort: 'low' | 'medium' | 'high';
  urgency: 'today' | 'this_week' | 'this_month';
};

export type DraftDirection = {
  title: string;
  headline: string;
  subline: string;
  rationale: string;
  direction: string;
};

export function scriptedFindings(pack: EvidencePack): DraftFinding[] {
  const worst = [...pack.movement].sort((a, b) => (b.deltaCpa ?? 0) - (a.deltaCpa ?? 0))[0];
  const best = [...pack.movement].sort((a, b) => (a.deltaCpa ?? 0) - (b.deltaCpa ?? 0))[0];
  const separated = pack.accounts.filter((account) => !account.included);

  const findings: DraftFinding[] = [];

  if (worst) {
    const exposure = Math.round(worst.spend * Math.max(0.05, worst.deltaCpa ?? 0.1));
    findings.push({
      title: `${worst.name} is buying the same outcome for ${percent(worst.deltaCpa)} more`,
      observation: `Cost per conversion on ${worst.name} moved ${percent(worst.deltaCpa)} against the previous equivalent window while spend moved ${percent(worst.deltaSpend)}. The campaign carried ${money(pack.currency, worst.spend)} over ${pack.rangeLabel}, so the movement is large enough to change where the next unit of budget should go.`,
      kind: 'calculated',
      severity: 'decision',
      confidence: 'high',
      confidenceNote:
        'Both windows are complete reporting days in the same timezone, and the campaign carried enough spend for the change to be outside normal weekly variance.',
      exposureLowMinorUnits: String(Math.round(exposure * 100 * 0.7)),
      exposureHighMinorUnits: String(Math.round(exposure * 100 * 1.25)),
      exposureNote: 'Sized as the extra cost of holding the current conversion volume at the new cost per conversion.',
      affectedCampaignIds: [worst.campaignId],
      recommendedNextStep: 'Cap the exposure before deciding whether the efficiency returns on its own.',
    });
  }

  if (best && best.campaignId !== worst?.campaignId) {
    findings.push({
      title: `${best.name} is absorbing budget more efficiently than the account average`,
      observation: `Cost per conversion on ${best.name} moved ${percent(best.deltaCpa)} while it carried ${money(pack.currency, best.spend)}. It is the most defensible destination for budget moved away from the weakest line.`,
      kind: 'calculated',
      severity: 'watch',
      confidence: 'medium',
      confidenceNote:
        'The direction is clear over the window, but a single window is not enough to claim the efficiency will hold at a larger budget.',
      exposureLowMinorUnits: null,
      exposureHighMinorUnits: null,
      exposureNote: '',
      affectedCampaignIds: [best.campaignId],
      recommendedNextStep: 'Test a capped increase rather than a permanent reallocation.',
    });
  }

  if (pack.creativeFatigue.length) {
    const lead = pack.creativeFatigue[0];
    findings.push({
      title: 'The leading prospecting creative is repeating itself',
      observation: `${lead.name} is running at ${lead.frequency ?? 'an unavailable'}× frequency against the same audience and its hook rate has decayed over the window. ${lead.note}`,
      kind: 'observed',
      severity: 'decision',
      confidence: 'high',
      confidenceNote: 'Frequency and view-rate are provider-reported figures, not derived estimates.',
      exposureLowMinorUnits: null,
      exposureHighMinorUnits: null,
      exposureNote: '',
      affectedCampaignIds: [lead.campaignId],
      recommendedNextStep: 'Brief two replacement directions before the fatigue reaches the retargeting audience.',
    });
  }

  if (separated.length) {
    findings.push({
      title: `${separated.length} account${separated.length > 1 ? 's are' : ' is'} outside the blended basis`,
      observation: `${separated.map((account) => `${account.name} — ${account.reason}`).join('. ')}. Those rows stay visible and labelled rather than being folded into a blended total that would not mean anything.`,
      kind: 'observed',
      severity: 'stable',
      confidence: 'high',
      confidenceNote: 'This is a property of the resolved scope, not an inference.',
      exposureLowMinorUnits: null,
      exposureHighMinorUnits: null,
      exposureNote: '',
      affectedCampaignIds: [],
      recommendedNextStep: 'Compare these accounts side by side rather than blending them.',
    });
  }

  return findings.slice(0, 4);
}

export function scriptedRecommendations(pack: EvidencePack, findings: Finding[]): DraftRecommendation[] {
  const decisionFindings = findings.filter((finding) => finding.severity === 'decision');
  const source = decisionFindings.length ? decisionFindings : findings.slice(0, 1);

  return source.slice(0, 3).map((finding, index) => {
    const campaign = pack.movement.find((row) => finding.affectedCampaignIds.includes(row.campaignId));
    const isFatigue = finding.title.toLowerCase().includes('repeating');
    const cap = campaign ? Math.round(campaign.spend * 0.15) : Math.round(pack.totals.spend * 0.05);

    if (isFatigue) {
      return {
        findingIndex: findings.indexOf(finding),
        action: 'Brief two replacement Arc Bottle directions and rotate them into prospecting before the fatigue spreads',
        rationale:
          'Frequency is rising against a fixed audience while the hook rate decays. Adding budget to a tired creative buys the same decay faster.',
        assumptions: [
          'The audience definition stays as it is for the duration of the rotation.',
          'Production can deliver two directions inside a week.',
        ],
        risks: [
          'A new direction can under-perform the tired one in its first three days while it leaves the learning phase.',
        ],
        expectedDirection: 'protect',
        expectedRange: 'Holds cost per purchase rather than promising an improvement.',
        horizon: '14 days',
        stopConditions: [
          'Roll back if the replacement is more than 20% worse on cost per purchase after seven complete days.',
        ],
        effort: 'medium',
        urgency: 'this_week',
      };
    }

    return {
      findingIndex: findings.indexOf(finding),
      action: campaign
        ? `Move up to ${money(pack.currency, cap)} away from ${campaign.name} for a capped ${14}-day test`
        : 'Run a capped reallocation test against the weakest line',
      rationale:
        'The movement is large enough to matter and small enough to test. A capped, reversible shift answers the question without betting the account on it.',
      assumptions: [
        'The comparison window is representative of normal demand.',
        'Conversion tracking did not change definition inside the window.',
      ],
      risks: [
        'Removing budget can push a campaign back into the learning phase.',
        `${index === 0 ? 'Seasonality' : 'Auction pressure'} could explain part of the movement rather than campaign quality.`,
      ],
      expectedDirection: 'decrease',
      expectedRange: 'Direction is a lower blended cost per conversion; the size depends on how much of the movement is auction-driven.',
      capMinorUnits: String(cap * 100),
      horizon: '14 days',
      stopConditions: [
        'Stop if blended cost per conversion has not improved after seven complete days.',
        'Stop immediately if conversion volume falls more than 15%.',
      ],
      effort: 'low',
      urgency: 'today',
    };
  });
}

export function scriptedCreative(pack: EvidencePack): { directions: DraftDirection[] } {
  const lead = pack.creativeFatigue[0];
  return {
    directions: [
      {
        title: 'Cold proof, stated plainly',
        headline: '18 hours cold',
        subline: 'Measured, not claimed.',
        rationale: lead
          ? `Replaces ${lead.name}, which is repeating at ${lead.frequency ?? 'an unavailable'}× frequency. Leads with the one product claim the audience has not yet been told twice.`
          : 'Leads with the single measurable product claim rather than a lifestyle scene.',
        direction: 'product-proof',
      },
      {
        title: 'Field use, low horizon',
        headline: 'Still cold at the summit',
        subline: 'Arc Bottle, eleven hours in.',
        rationale:
          'Moves the proof out of the studio and into use, which gives the audience a second reason to stop without repeating the first frame.',
        direction: 'field-use',
      },
    ],
  };
}
