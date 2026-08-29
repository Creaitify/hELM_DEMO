import type {
  AdAccount,
  CampaignSummary,
  CreativeSummary,
  DataBasis,
  Finding,
  MetricValue,
  Recommendation,
} from '../domain/types.js';

/**
 * The campaign performance report.
 *
 * A decision memo answers one question the fleet was asked. This answers the
 * standing one — how is the account doing right now — from the analysis that
 * has already been done rather than from a fresh investigation. It is the
 * document somebody actually has to hand over on a Monday: the totals, what
 * moved, which campaigns are carrying the money, which creative is wearing
 * out, and what HELM has already concluded about all of it.
 *
 * It is written as Markdown for exactly one reason: every other format the
 * product offers is rendered from Markdown, so a report written once leaves
 * the product as PDF, Word, HTML or JSON without a second builder to keep in
 * step with this one.
 *
 * Nothing here is estimated. A metric the platforms did not report is written
 * as unavailable, and the reason travels with it.
 */

export type CampaignReportInput = {
  workspaceName: string;
  scopeLabel: string;
  rangeLabel: string;
  currency: string;
  basis: DataBasis;
  accounts: AdAccount[];
  campaigns: CampaignSummary[];
  creatives: CreativeSummary[];
  scoreline: MetricValue[];
  findings: Finding[];
  recommendations: Recommendation[];
  /** True when the figures were folded from stored measurements. */
  measured: boolean;
  preparedBy: string;
  preparedAt: string;
};

const METRIC_LABEL: Record<string, string> = {
  spend: 'Spend',
  value: 'Attributed value',
  roas: 'ROAS',
  cpa: 'CPA',
  conversions: 'Purchases',
  impressions: 'Impressions',
  clicks: 'Clicks',
  ctr: 'CTR',
  cpc: 'CPC',
  cpm: 'CPM',
  frequency: 'Frequency',
  reach: 'Reach',
  hook_rate: '3-second view rate',
  hold_rate: 'Hold rate',
  impression_share: 'Impression share lost to budget',
};

const MONEY_KEYS = new Set(['spend', 'value', 'cpa', 'cpc', 'cpm']);
const RATIO_KEYS = new Set(['ctr', 'hook_rate', 'hold_rate', 'impression_share']);

function money(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Not available';
  return `${currency} ${Math.round(value).toLocaleString('en-IN')}`;
}

function metricText(metric: MetricValue, currency: string): string {
  if (metric.value === null || metric.value === undefined) return 'Not available';
  if (MONEY_KEYS.has(metric.key)) return money(metric.value, metric.currency ?? currency);
  if (RATIO_KEYS.has(metric.key)) return `${(metric.value * 100).toFixed(1)}%`;
  if (metric.key === 'roas') return `${metric.value.toFixed(2)}x`;
  if (metric.key === 'frequency') return metric.value.toFixed(1);
  return Math.round(metric.value).toLocaleString('en-IN');
}

/** A movement only reads as a movement when its direction is written out. */
function deltaText(metric: MetricValue): string {
  if (metric.deltaRatio === null || metric.deltaRatio === undefined) return 'no comparison available';
  const pct = (metric.deltaRatio * 100).toFixed(1);
  if (Math.abs(metric.deltaRatio) < 0.001) return 'unchanged';
  return `${metric.deltaRatio > 0 ? 'up' : 'down'} ${Math.abs(Number(pct))}%`;
}

export function campaignReportTitle(input: CampaignReportInput): string {
  return `Campaign performance — ${input.scopeLabel}`;
}

export function campaignReportMarkdown(input: CampaignReportInput): string {
  const { currency } = input;
  const lines: string[] = [];

  lines.push(`# ${campaignReportTitle(input)}`, '');
  lines.push(`**Workspace** ${input.workspaceName}  `);
  lines.push(`**Account scope** ${input.scopeLabel}  `);
  lines.push(`**Window** ${input.rangeLabel}  `);
  lines.push(`**Prepared by** ${input.preparedBy}  `);
  lines.push(`**Prepared** ${new Date(input.preparedAt).toUTCString()}  `);
  lines.push(
    `**Basis** ${input.measured ? 'Folded from stored daily measurements' : 'Sample portfolio — this workspace has not measured anything yet'}`,
    '',
  );

  /* ---------------------------------------------------------- headline -- */

  const spend = input.scoreline.find((metric) => metric.key === 'spend');
  const cpa = input.scoreline.find((metric) => metric.key === 'cpa');
  const roas = input.scoreline.find((metric) => metric.key === 'roas');

  lines.push('## Where the account stands', '');
  lines.push(
    [
      spend ? `Spend was ${metricText(spend, currency)}, ${deltaText(spend)} against the previous equivalent window.` : '',
      cpa ? `Cost per purchase was ${metricText(cpa, currency)}, ${deltaText(cpa)}.` : '',
      roas ? `ROAS was ${metricText(roas, currency)}, ${deltaText(roas)}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
    '',
  );

  /* ------------------------------------------------------------ totals -- */

  lines.push('## The totals', '');
  for (const metric of input.scoreline) {
    const label = METRIC_LABEL[metric.key] ?? metric.key;
    const previous =
      metric.previousValue === null || metric.previousValue === undefined
        ? null
        : metricText({ ...metric, value: metric.previousValue }, currency);
    lines.push(
      `- **${label}** ${metricText(metric, currency)}${previous ? ` — ${deltaText(metric)} from ${previous}` : ''}${metric.caveat ? `. ${metric.caveat}` : ''}`,
    );
  }
  lines.push('');

  /* --------------------------------------------------------- campaigns -- */

  const ranked = [...input.campaigns].sort((a, b) => b.spend - a.spend);

  if (ranked.length) {
    lines.push('## Campaigns, by spend', '');
    for (const campaign of ranked) {
      const parts = [
        `${money(campaign.spend, campaign.currency || currency)} spend`,
        campaign.cpa === null ? 'CPA not available' : `${money(campaign.cpa, campaign.currency || currency)} CPA`,
        campaign.roas === null ? 'ROAS not available' : `${campaign.roas.toFixed(2)}x ROAS`,
        `${campaign.conversions.toLocaleString('en-IN')} purchases`,
      ];
      lines.push(`### ${campaign.name}`, '');
      lines.push(
        `${campaign.accountName} · ${campaign.provider === 'google_ads' ? 'Google Ads' : 'Meta Ads'} · ${campaign.status}`,
        '',
      );
      lines.push(`- ${parts.join(' · ')}`);
      if (campaign.deltaCpa !== null && campaign.deltaCpa !== undefined) {
        lines.push(
          `- Cost per purchase ${campaign.deltaCpa > 0 ? 'rose' : 'fell'} ${Math.abs(campaign.deltaCpa * 100).toFixed(1)}% against the previous window`,
        );
      }
      if (campaign.impressionShareLostToBudget) {
        lines.push(
          `- Losing ${(campaign.impressionShareLostToBudget * 100).toFixed(0)}% of eligible impressions to its daily budget`,
        );
      }
      if (campaign.intelligenceNote) lines.push(`- HELM: ${campaign.intelligenceNote}`);
      lines.push('');
    }
  }

  /* ---------------------------------------------------------- creative -- */

  const measurable = input.creatives.filter((creative) => creative.hookRate !== null);
  if (measurable.length) {
    lines.push('## Creative wear', '');
    lines.push(
      'Ranked by 3-second view rate. A falling view rate against a rising frequency is the shape fatigue takes.',
      '',
    );
    for (const creative of [...measurable].sort((a, b) => (a.hookRate ?? 1) - (b.hookRate ?? 1))) {
      lines.push(
        `- **${creative.name}** — ${((creative.hookRate ?? 0) * 100).toFixed(0)}% view rate` +
          `${creative.frequency === null ? '' : `, frequency ${creative.frequency.toFixed(1)}`}` +
          `, ${money(creative.spend, currency)} spend, ${creative.fatigue}`,
      );
    }
    const unmeasurable = input.creatives.length - measurable.length;
    if (unmeasurable > 0) {
      lines.push(
        '',
        `${unmeasurable} asset${unmeasurable === 1 ? '' : 's'} in this scope report no video metrics and are not ranked here.`,
      );
    }
    lines.push('');
  }

  /* ---------------------------------------------------------- findings -- */

  const decisionGrade = input.findings.filter((finding) => finding.severity === 'decision');
  if (input.findings.length) {
    lines.push('## What HELM has concluded', '');
    if (decisionGrade.length) {
      lines.push(
        `${decisionGrade.length} of these ${decisionGrade.length === 1 ? 'is' : 'are'} decision-grade — they carry money this week.`,
        '',
      );
    }
    for (const finding of input.findings) {
      lines.push(`### ${finding.title}`, '');
      lines.push(finding.observation, '');
      lines.push(`- **Severity** ${finding.severity}`);
      lines.push(`- **Kind** ${finding.kind}`);
      lines.push(`- **Confidence** ${finding.confidence} — ${finding.confidenceNote}`);
      if (finding.exposure) {
        lines.push(
          `- **Financial exposure** ${money(Number(finding.exposure.low.minorUnits) / 100, finding.exposure.low.currency)} – ${money(Number(finding.exposure.high.minorUnits) / 100, finding.exposure.high.currency)} (${finding.exposure.note})`,
        );
      }
      if (finding.recommendedNextStep) lines.push(`- **Next step** ${finding.recommendedNextStep}`);
      lines.push('');
    }
  }

  /* --------------------------------------------------- recommendations -- */

  if (input.recommendations.length) {
    lines.push('## Proposals on the table', '');
    lines.push(
      'Every one of these is a proposal. Approving one in HELM records a decision; it does not write anything to Google Ads or Meta Ads.',
      '',
    );
    for (const recommendation of input.recommendations) {
      lines.push(`### ${recommendation.action}`, '');
      lines.push(recommendation.rationale, '');
      lines.push(`- **Status** ${recommendation.status.replace(/_/g, ' ')}`);
      lines.push(`- **Urgency** ${recommendation.urgency.replace(/_/g, ' ')} · **Effort** ${recommendation.effort}`);
      lines.push(`- **Expected** ${recommendation.expectedDirection} — ${recommendation.expectedRange}`);
      lines.push(`- **Horizon** ${recommendation.horizon}`);
      if (recommendation.cap) {
        lines.push(`- **Cap** ${money(Number(recommendation.cap.minorUnits) / 100, recommendation.cap.currency)}`);
      }
      if (recommendation.stopConditions.length) {
        lines.push(`- **Stop if** ${recommendation.stopConditions.join('; ')}`);
      }
      if (recommendation.risks.length) lines.push(`- **Risks** ${recommendation.risks.join('; ')}`);
      lines.push('');
    }
  }

  /* ------------------------------------------------------------- basis -- */

  lines.push('## What these numbers are built on', '');
  lines.push(`- Window ${input.basis.startDateInclusive} to ${input.basis.endDateInclusive} inclusive`);
  if (input.basis.comparisonStartDateInclusive && input.basis.comparisonEndDateInclusive) {
    lines.push(
      `- Compared with ${input.basis.comparisonStartDateInclusive} to ${input.basis.comparisonEndDateInclusive}`,
    );
  }
  for (const account of input.accounts) {
    lines.push(
      `- ${account.name} — ${account.currency}, ${account.timeZone}, ${account.health.state}${account.health.message ? ` (${account.health.message})` : ''}`,
    );
  }
  // Exclusions are the part that changes what a reader should conclude, so
  // they are written out rather than summarised as "partial".
  for (const exclusion of input.basis.exclusions) lines.push(`- ${exclusion}`);
  if (input.basis.aggregation.state === 'separated') {
    for (const reason of input.basis.aggregation.reasons) lines.push(`- ${reason}`);
  }
  if (input.basis.aggregation.state === 'converted') {
    lines.push(
      `- Converted to ${input.basis.aggregation.reportingCurrency} on ${input.basis.aggregation.conversionBasis}`,
    );
  }
  lines.push('');

  lines.push('---', '');
  lines.push(
    '_Written by HELM from the analysis on the account at the time of writing. The figures are frozen here; the product will have moved on._',
  );

  return lines.join('\n');
}
