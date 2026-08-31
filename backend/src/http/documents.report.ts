import type {
  AdAccount,
  CampaignSummary,
  CreativeSummary,
  DataBasis,
  Finding,
  MetricSeries,
  MetricValue,
  Recommendation,
} from '../domain/types.js';
import type { Block, ReportDoc } from './documents.blocks.js';

/**
 * The campaign performance report.
 *
 * A decision memo answers one question the fleet was asked. This answers the
 * standing one — how is the account doing — from the analysis already on it.
 *
 * It is written for somebody who does not work in the ad accounts. That is a
 * real constraint and it drives most of what follows: the report opens with
 * four sentences of plain English rather than a table, every chart says what
 * it is asking before it shows the answer, and a number is never left to speak
 * for itself when a sentence could say what it means. The detail is still all
 * there, further down, for the person who does work in the accounts.
 *
 * Nothing here is estimated. A metric the platforms did not report is written
 * as unavailable and the reason travels with it.
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
  /** The blended daily cost series, when the workspace has measured one. */
  costSeries?: MetricSeries;
  /** True when the figures were folded from stored measurements. */
  measured: boolean;
  preparedBy: string;
  preparedAt: string;
};

/* ------------------------------------------------------------ formatting -- */

function money(value: number | null | undefined, currency: string, compact = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'not available';
  if (!compact) return `${currency} ${Math.round(value).toLocaleString('en-IN')}`;
  // Compact only where the exact digits stop being readable. A cost per
  // purchase of 1,504 must never render as "2K" — that is not the same number
  // and the reader has no way to tell it was rounded.
  if (Math.abs(value) >= 10_000_000) return `${currency} ${(value / 10_000_000).toFixed(1)}Cr`;
  if (Math.abs(value) >= 100_000) return `${currency} ${(value / 100_000).toFixed(1)}L`;
  return `${currency} ${Math.round(value).toLocaleString('en-IN')}`;
}

function pct(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return 'not available';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** "up 5.9%" reads; "+0.059" does not. */
function movement(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return 'with nothing to compare against';
  if (Math.abs(ratio) < 0.005) return 'essentially unchanged';
  return `${ratio > 0 ? 'up' : 'down'} ${Math.abs(ratio * 100).toFixed(1)}%`;
}

const METRIC_LABEL: Record<string, string> = {
  spend: 'Spend',
  value: 'Attributed value',
  roas: 'Return on ad spend',
  cpa: 'Cost per purchase',
  conversions: 'Purchases',
  impressions: 'Impressions',
  clicks: 'Clicks',
  ctr: 'Click rate',
};

const MONEY_KEYS = new Set(['spend', 'value', 'cpa', 'cpc', 'cpm']);

function metricText(metric: MetricValue, currency: string, compact = false): string {
  if (metric.value === null || metric.value === undefined) return 'not available';
  if (MONEY_KEYS.has(metric.key)) return money(metric.value, metric.currency ?? currency, compact);
  if (metric.key === 'roas') return `${metric.value.toFixed(2)}x`;
  if (metric.key === 'ctr') return pct(metric.value);
  return Math.round(metric.value).toLocaleString('en-IN');
}

export function campaignReportTitle(input: CampaignReportInput): string {
  return `How the ads are doing — ${input.scopeLabel}`;
}

/* ------------------------------------------------------------- the lede -- */

/**
 * Four sentences that answer the question before any chart is drawn.
 *
 * Somebody who reads only this paragraph should leave knowing whether the
 * month was good, what it cost, and what is about to go wrong. Everything
 * below it is the working.
 */
function lede(input: CampaignReportInput): string {
  const { currency } = input;
  const find = (key: string) => input.scoreline.find((metric) => metric.key === key);
  const spend = find('spend');
  const cpa = find('cpa');
  const purchases = find('conversions');
  const roas = find('value');

  const parts: string[] = [];

  if (spend) {
    parts.push(
      `Over ${input.rangeLabel.toLowerCase()} this account spent ${metricText(spend, currency, true)}, ${movement(spend.deltaRatio)} on the month before.`,
    );
  }
  if (purchases && cpa) {
    const cheaper = (cpa.deltaRatio ?? 0) < -0.005;
    const dearer = (cpa.deltaRatio ?? 0) > 0.005;
    parts.push(
      `That bought ${metricText(purchases, currency)} purchases, ${movement(purchases.deltaRatio)}, at ${metricText(cpa, currency)} each — ` +
        `${cheaper ? 'cheaper than last month' : dearer ? 'dearer than last month' : 'the same as last month'}.`,
    );
  }
  if (roas) {
    parts.push(`The platforms report ${metricText(roas, currency, true)} of value against that spend.`);
  }

  const decisions = input.findings.filter((finding) => finding.severity === 'decision');
  if (decisions.length === 0) {
    parts.push('Nothing in the account currently needs a decision from you.');
  } else if (decisions.length === 1) {
    parts.push(`One thing needs a decision from you, and it is described below.`);
  } else {
    parts.push(`${decisions.length} things need a decision from you, in the order they cost money.`);
  }

  return parts.join(' ');
}

/* ------------------------------------------------------------ the blocks -- */

export function campaignReport(input: CampaignReportInput): ReportDoc {
  const { currency } = input;
  const blocks: Block[] = [];

  const ranked = [...input.campaigns].sort((a, b) => b.spend - a.spend);
  const decisions = input.findings.filter((finding) => finding.severity === 'decision');
  const watching = input.findings.filter((finding) => finding.severity === 'watch');
  const stable = input.findings.filter((finding) => finding.severity === 'stable');

  /* ------------------------------------------------------ the short version */

  blocks.push({ kind: 'heading', level: 1, text: 'The short version' });
  blocks.push({ kind: 'lede', text: lede(input) });

  blocks.push({
    kind: 'stats',
    items: input.scoreline.slice(0, 5).map((metric) => ({
      label: METRIC_LABEL[metric.key] ?? metric.key,
      value: metricText(metric, currency, true),
      note: metric.deltaRatio === null || metric.deltaRatio === undefined ? undefined : movement(metric.deltaRatio),
    })),
  });

  if (!input.measured) {
    blocks.push({
      kind: 'callout',
      tone: 'warn',
      title: 'These are sample figures',
      text: 'This workspace has not measured anything yet, so the numbers below come from the sample portfolio rather than from a connected ad account.',
    });
  }

  /* ------------------------------------------------------------ cost trend */

  if (input.costSeries && input.costSeries.points.length > 2) {
    const values = input.costSeries.points
      .map((point) => point.value)
      .filter((value): value is number => value !== null);
    if (values.length > 1) {
      blocks.push({
        kind: 'line',
        title: 'What one purchase cost, day by day',
        note: 'Every day in the window. A break in the line is a day that reported no purchases, not a day that cost nothing.',
        points: input.costSeries.points.map((point) => ({ label: point.date.slice(5), value: point.value })),
        lowLabel: money(Math.min(...values), currency, true),
        highLabel: money(Math.max(...values), currency, true),
      });
    }
  }

  /* ----------------------------------------------------- where money went */

  blocks.push({ kind: 'heading', level: 1, text: 'Where the money went' });
  blocks.push({
    kind: 'para',
    text:
      `${ranked.length} campaigns ran in this window. The ${Math.min(8, ranked.length)} largest carry ` +
      `${pct(ranked.slice(0, 8).reduce((sum, c) => sum + c.spend, 0) / Math.max(1, ranked.reduce((sum, c) => sum + c.spend, 0)), 0)} of the spend between them.`,
  });

  blocks.push({
    kind: 'bars',
    title: 'Spend by campaign',
    note: 'Largest first. Colour is how the cost per purchase moved: red got dearer, green got cheaper.',
    rows: ranked.slice(0, 10).map((campaign) => ({
      label: campaign.name,
      value: campaign.spend,
      display: money(campaign.spend, campaign.currency || currency, true),
      tone:
        campaign.deltaCpa === null || campaign.deltaCpa === undefined
          ? ('neutral' as const)
          : campaign.deltaCpa > 0.08
            ? ('bad' as const)
            : campaign.deltaCpa < -0.05
              ? ('good' as const)
              : ('neutral' as const),
    })),
  });

  /* ---------------------------------------------------------- what moved */

  const moved = ranked
    .filter((campaign) => campaign.deltaCpa !== null && campaign.deltaCpa !== undefined && campaign.spend > 0)
    .sort((a, b) => (b.deltaCpa ?? 0) - (a.deltaCpa ?? 0));

  if (moved.length) {
    blocks.push({ kind: 'heading', level: 1, text: 'What got better and what got worse' });
    blocks.push({
      kind: 'para',
      text:
        'This is the one chart worth reading closely. It shows how much each campaign\'s cost per purchase moved against the month before. ' +
        'Bars to the right are campaigns paying more for the same result; bars to the left are campaigns paying less.',
    });
    blocks.push({
      kind: 'diverging',
      title: 'Change in cost per purchase',
      note: 'Against the previous equivalent window.',
      positiveIsGood: false,
      rows: moved.map((campaign) => ({
        label: campaign.name,
        value: campaign.deltaCpa ?? 0,
        display: `${(campaign.deltaCpa ?? 0) > 0 ? '+' : ''}${((campaign.deltaCpa ?? 0) * 100).toFixed(1)}%`,
      })),
    });

    const worst = moved[0];
    const best = moved[moved.length - 1];
    if (worst && (worst.deltaCpa ?? 0) > 0.05) {
      blocks.push({
        kind: 'callout',
        tone: 'bad',
        title: `${worst.name} is the one costing you money`,
        text:
          `It is paying ${pct(worst.deltaCpa)} more for each purchase than it was last month, on ` +
          `${money(worst.spend, currency, true)} of spend. ${worst.intelligenceNote ?? ''}`.trim(),
      });
    }
    if (best && (best.deltaCpa ?? 0) < -0.05) {
      blocks.push({
        kind: 'callout',
        tone: 'good',
        title: `${best.name} is the one worth feeding`,
        text:
          `Each purchase costs ${pct(Math.abs(best.deltaCpa ?? 0))} less than it did last month, on ` +
          `${money(best.spend, currency, true)} of spend. ${best.intelligenceNote ?? ''}`.trim(),
      });
    }
  }

  /* ------------------------------------------------------ needs a decision */

  if (decisions.length) {
    blocks.push({ kind: 'heading', level: 1, text: 'What needs a decision' });
    blocks.push({
      kind: 'para',
      text: 'Each of these costs real money this week. The range is what it is modelled to cost if nothing changes — a range, not a forecast.',
    });

    const priced = decisions.filter((finding) => finding.exposure);
    if (priced.length > 1) {
      blocks.push({
        kind: 'bars',
        title: 'What each one is worth',
        note: 'The midpoint of the modelled range over the next fortnight.',
        rows: priced.map((finding) => {
          const low = Number(finding.exposure!.low.minorUnits) / 100;
          const high = Number(finding.exposure!.high.minorUnits) / 100;
          return {
            label: finding.title.slice(0, 44),
            value: (low + high) / 2,
            // The currency is said once. Repeating it spends half the column.
            display: `${money(low, currency, true)}–${money(high, currency, true).replace(currency + ' ', '')}`,
            tone: 'bad' as const,
          };
        }),
      });
    }

    for (const finding of decisions) {
      blocks.push({ kind: 'heading', level: 2, text: finding.title });
      blocks.push({ kind: 'para', text: finding.observation });

      const detail: string[] = [];
      if (finding.exposure) {
        const low = Number(finding.exposure.low.minorUnits) / 100;
        const high = Number(finding.exposure.high.minorUnits) / 100;
        detail.push(
          `**What it costs** ${money(low, currency)} to ${money(high, currency)} over the next fortnight if nothing changes. ${finding.exposure.note}`,
        );
      }
      detail.push(`**How sure we are** ${finding.confidence}. ${finding.confidenceNote}`);
      if (finding.recommendedNextStep) detail.push(`**What to do** ${finding.recommendedNextStep}`);
      blocks.push({ kind: 'list', items: detail });

      const proposal = input.recommendations.find((entry) => entry.findingId === finding.id);
      if (proposal) {
        blocks.push({
          kind: 'callout',
          tone: 'neutral',
          title: `Proposed: ${proposal.action}`,
          text:
            `${proposal.rationale} Expected ${proposal.expectedDirection} of ${proposal.expectedRange} over ${proposal.horizon}. ` +
            `${proposal.stopConditions.length ? `Stop if ${proposal.stopConditions[0].toLowerCase()}` : ''}`.trim(),
        });
      }
    }
  }

  /* ---------------------------------------------------------- worth watching */

  if (watching.length) {
    blocks.push({ kind: 'heading', level: 1, text: 'Worth keeping an eye on' });
    blocks.push({
      kind: 'para',
      text: 'Real signals that do not justify changing a budget yet. They are here so nothing arrives as a surprise next month.',
    });
    blocks.push({
      kind: 'list',
      items: watching.map((finding) => `**${finding.title}** ${finding.observation}`),
    });
  }

  if (stable.length) {
    blocks.push({ kind: 'heading', level: 1, text: 'Checked and behaving' });
    blocks.push({
      kind: 'para',
      text: 'Reported so you do not have to go and look.',
    });
    blocks.push({ kind: 'list', items: stable.map((finding) => finding.title) });
  }

  /* ------------------------------------------------------------- creative */

  const measurable = input.creatives.filter((creative) => creative.hookRate !== null);
  if (measurable.length) {
    blocks.push({ kind: 'heading', level: 1, text: 'Which ads are wearing out' });
    blocks.push({
      kind: 'para',
      text:
        'The share of people who watch the first three seconds. When that falls while the same people see the ad more often, the ad has been seen enough. ' +
        'Lower bars are the tired ones.',
    });
    blocks.push({
      kind: 'bars',
      title: 'Three-second view rate',
      rows: [...measurable]
        .sort((a, b) => (a.hookRate ?? 1) - (b.hookRate ?? 1))
        .map((creative) => ({
          label: creative.name,
          value: creative.hookRate ?? 0,
          display: pct(creative.hookRate, 0),
          tone:
            creative.fatigue === 'fatigued'
              ? ('bad' as const)
              : creative.fatigue === 'watch'
                ? ('warn' as const)
                : ('good' as const),
        })),
    });

    const unmeasurable = input.creatives.length - measurable.length;
    if (unmeasurable > 0) {
      blocks.push({
        kind: 'para',
        text: `${unmeasurable} more ${unmeasurable === 1 ? 'ad is a still or a carousel' : 'ads are stills or carousels'}, which report no video metrics at all. They are left out of this chart rather than scored as zero.`,
      });
    }
  }

  /* ---------------------------------------------------------- the detail */

  blocks.push({ kind: 'heading', level: 1, text: 'Every campaign, in full' });
  blocks.push({
    kind: 'table',
    columns: ['Campaign', 'Platform', 'Spend', 'Cost per purchase', 'Purchases', 'Change'],
    numeric: [false, false, true, true, true, true],
    rows: ranked.map((campaign) => [
      campaign.name,
      campaign.provider === 'google_ads' ? 'Google' : 'Meta',
      money(campaign.spend, campaign.currency || currency, true),
      campaign.cpa === null ? 'not available' : money(campaign.cpa, campaign.currency || currency),
      campaign.conversions.toLocaleString('en-IN'),
      campaign.deltaCpa === null || campaign.deltaCpa === undefined
        ? '—'
        : `${campaign.deltaCpa > 0 ? '+' : ''}${(campaign.deltaCpa * 100).toFixed(1)}%`,
    ]),
  });

  /* -------------------------------------------------------------- basis -- */

  blocks.push({ kind: 'heading', level: 1, text: 'What these numbers are built on' });

  const basisLines: string[] = [
    `Every figure covers ${input.basis.startDateInclusive} to ${input.basis.endDateInclusive} inclusive, in each account's own time zone.`,
  ];
  if (input.basis.comparisonStartDateInclusive && input.basis.comparisonEndDateInclusive) {
    basisLines.push(
      `"Last month" means ${input.basis.comparisonStartDateInclusive} to ${input.basis.comparisonEndDateInclusive}, the equivalent window before this one.`,
    );
  }
  for (const account of input.accounts) {
    basisLines.push(
      `${account.name} — ${account.currency}, ${account.timeZone}, ${account.health.state}${account.health.message ? `. ${account.health.message}` : ''}`,
    );
  }
  for (const exclusion of input.basis.exclusions) basisLines.push(exclusion);
  if (input.basis.aggregation.state === 'separated') {
    for (const reason of input.basis.aggregation.reasons) basisLines.push(reason);
  }
  if (input.basis.aggregation.state === 'converted') {
    basisLines.push(
      `Converted to ${input.basis.aggregation.reportingCurrency} on ${input.basis.aggregation.conversionBasis}.`,
    );
  }
  blocks.push({ kind: 'list', items: basisLines });

  blocks.push({ kind: 'rule' });
  blocks.push({
    kind: 'footnote',
    text:
      'Written by HELM from the analysis on the account at the time of writing. The figures are frozen here; the account will have moved on. ' +
      'Attributed value is what the platforms report, not audited revenue, and cost per purchase is a media cost — it is not customer acquisition cost. ' +
      'Nothing in this report has been applied to an ad account.',
  });

  return {
    title: campaignReportTitle(input),
    subtitle: `${input.workspaceName} · ${input.rangeLabel}`,
    meta: [
      { label: 'Accounts', value: input.scopeLabel },
      { label: 'Prepared by', value: input.preparedBy },
      { label: 'Prepared', value: new Date(input.preparedAt).toUTCString() },
      {
        label: 'Basis',
        value: input.measured ? 'Folded from stored daily measurements' : 'Sample portfolio',
      },
    ],
    blocks,
  };
}
