import type {
  Artifact,
  Finding,
  IntelligenceRun,
  Money,
  Recommendation,
} from '../domain/types.js';
import type { Block, ReportDoc } from './documents.blocks.js';

/**
 * The decision memo — what the fleet produces at the end of a run.
 *
 * The campaign report answers the standing question. This answers the one
 * somebody actually asked, and it is written to be handed to a person who was
 * not in the room when it was asked: what we looked at, what we found, what it
 * costs, what we propose, and what was decided.
 *
 * The order is deliberate. The answer comes first, because a memo that opens
 * on method asks the reader to take the conclusion on trust at the end. The
 * method is at the bottom, where somebody checking the work will look for it.
 */

export type MemoInput = {
  run: IntelligenceRun;
  findings: Finding[];
  recommendations: Recommendation[];
  decisions: { recommendationId: string; outcome: string; by: string; at: string; note?: string }[];
  artifacts: Artifact[];
  workspaceName: string;
};

function money(value: Money | undefined, compact = false): string {
  if (!value) return 'not available';
  const major = Number(value.minorUnits) / 100;
  if (Number.isNaN(major)) return 'not available';
  if (!compact) return `${value.currency} ${Math.round(major).toLocaleString('en-IN')}`;
  // Compact only where the exact digits stop being readable. Rounding an
  // exposure of 42,000 to "42K" is fine; rounding 1,504 to "2K" is a different
  // number the reader cannot tell was rounded.
  if (Math.abs(major) >= 10_000_000) return `${value.currency} ${(major / 10_000_000).toFixed(1)}Cr`;
  if (Math.abs(major) >= 100_000) return `${value.currency} ${(major / 100_000).toFixed(1)}L`;
  return `${value.currency} ${Math.round(major).toLocaleString('en-IN')}`;
}

const OUTCOME_WORD: Record<string, string> = {
  approved: 'approved',
  dismissed: 'dismissed',
  revision_requested: 'sent back for revision',
  saved: 'saved for later',
};

/** The metric strip on a finding, written out rather than tabulated. */
function figures(finding: Finding): string {
  const parts = finding.metricHighlights
    .filter((metric) => metric.value !== null && metric.value !== undefined)
    .slice(0, 3)
    .map((metric) => {
      const name = metric.key.replace(/_/g, ' ');
      const value =
        metric.currency && ['cpa', 'spend', 'value', 'cpc', 'cpm'].includes(metric.key)
          ? `${metric.currency} ${Math.round(metric.value as number).toLocaleString('en-IN')}`
          : ['ctr', 'hook_rate', 'hold_rate', 'impression_share'].includes(metric.key)
            ? `${(((metric.value as number) ?? 0) * 100).toFixed(1)}%`
            : String(Math.round(((metric.value as number) ?? 0) * 100) / 100);
      const move =
        metric.deltaRatio === null || metric.deltaRatio === undefined || Math.abs(metric.deltaRatio) < 0.005
          ? ''
          : ` (${metric.deltaRatio > 0 ? 'up' : 'down'} ${Math.abs(metric.deltaRatio * 100).toFixed(1)}%)`;
      return `${name} ${value}${move}`;
    });
  return parts.join(', ');
}

export function decisionMemo(input: MemoInput): ReportDoc {
  const { run, findings, recommendations, decisions, artifacts } = input;
  const blocks: Block[] = [];

  const decisionGrade = findings.filter((finding) => finding.severity === 'decision');
  const watching = findings.filter((finding) => finding.severity === 'watch');
  const stable = findings.filter((finding) => finding.severity === 'stable');
  const approved = decisions.filter((entry) => entry.outcome === 'approved');

  /* --------------------------------------------------------- the answer -- */

  blocks.push({ kind: 'heading', level: 1, text: 'The answer' });
  blocks.push({ kind: 'lede', text: run.summary });

  blocks.push({
    kind: 'stats',
    items: [
      { label: 'Findings', value: String(findings.length), note: `${decisionGrade.length} needing a decision` },
      { label: 'Proposals', value: String(recommendations.length), note: `${approved.length} approved` },
      { label: 'Accounts read', value: run.scopeLabel },
      { label: 'Window', value: run.rangeLabel },
    ],
  });

  /* ------------------------------------------------------ what it is worth */

  const priced = decisionGrade.filter((finding) => finding.exposure);
  if (priced.length > 1) {
    blocks.push({
      kind: 'bars',
      title: 'What each finding is worth',
      note: 'The midpoint of the modelled range over the next fortnight. A range, not a forecast.',
      rows: priced.map((finding) => {
        const low = Number(finding.exposure!.low.minorUnits) / 100;
        const high = Number(finding.exposure!.high.minorUnits) / 100;
        return {
          label: finding.title.slice(0, 44),
          value: (low + high) / 2,
          display: `${money(finding.exposure!.low, true)}–${money(finding.exposure!.high, true).replace(finding.exposure!.high.currency + ' ', '')}`,
          tone: 'bad' as const,
        };
      }),
    });
  }

  /* -------------------------------------------------------- what we found */

  if (decisionGrade.length) {
    blocks.push({ kind: 'heading', level: 1, text: 'What needs a decision' });
    for (const finding of decisionGrade) {
      blocks.push({ kind: 'heading', level: 2, text: finding.title });
      blocks.push({ kind: 'para', text: finding.observation });

      const detail: string[] = [];
      const numbers = figures(finding);
      if (numbers) detail.push(`**The figures** ${numbers}`);
      if (finding.exposure) {
        detail.push(
          `**What it costs** ${money(finding.exposure.low)} to ${money(finding.exposure.high)} if nothing changes. ${finding.exposure.note}`,
        );
      }
      detail.push(`**How sure we are** ${finding.confidence}. ${finding.confidenceNote}`);
      detail.push(
        `**How we know** ${finding.kind === 'observed' ? 'Reported directly by the platform' : finding.kind === 'calculated' ? 'Calculated from reported figures' : 'Inferred from a pattern across campaigns'}, from ${finding.evidenceIds.length} evidence ${finding.evidenceIds.length === 1 ? 'record' : 'records'}.`,
      );
      if (finding.recommendedNextStep) detail.push(`**What to do** ${finding.recommendedNextStep}`);
      blocks.push({ kind: 'list', items: detail });
    }
  }

  if (watching.length) {
    blocks.push({ kind: 'heading', level: 1, text: 'Worth keeping an eye on' });
    blocks.push({
      kind: 'para',
      text: 'Real signals that do not justify a budget change yet.',
    });
    blocks.push({ kind: 'list', items: watching.map((finding) => `**${finding.title}** ${finding.observation}`) });
  }

  if (stable.length) {
    blocks.push({ kind: 'heading', level: 1, text: 'Checked and behaving' });
    blocks.push({ kind: 'list', items: stable.map((finding) => finding.title) });
  }

  /* ---------------------------------------------------------- what we propose */

  if (recommendations.length) {
    blocks.push({ kind: 'heading', level: 1, text: 'What we propose' });
    blocks.push({
      kind: 'callout',
      tone: 'neutral',
      title: 'Nothing here has been done',
      text: 'Every proposal below is a proposal. Approving one in HELM records a decision; it does not write anything to Google Ads or Meta Ads.',
    });

    for (const entry of recommendations) {
      const decision = decisions.find((row) => row.recommendationId === entry.id);
      blocks.push({ kind: 'heading', level: 2, text: entry.action });
      blocks.push({ kind: 'para', text: entry.rationale });

      const detail: string[] = [
        `**Decision** ${decision ? `${OUTCOME_WORD[decision.outcome] ?? decision.outcome} by ${decision.by}` : `still open — ${entry.status.replace(/_/g, ' ')}`}`,
        `**Expected** ${entry.expectedDirection} of ${entry.expectedRange}, over ${entry.horizon}`,
        `**How urgent** ${entry.urgency.replace(/_/g, ' ')} · **How much work** ${entry.effort}`,
      ];
      if (entry.cap) detail.push(`**Capped at** ${money(entry.cap)} — it cannot cost more than this`);
      if (entry.stopConditions.length) detail.push(`**Stop if** ${entry.stopConditions.join('; ')}`);
      if (entry.risks.length) detail.push(`**What could go wrong** ${entry.risks.join('; ')}`);
      if (entry.assumptions.length) detail.push(`**Assuming** ${entry.assumptions.join('; ')}`);
      if (decision?.note) detail.push(`**Note** ${decision.note}`);
      blocks.push({ kind: 'list', items: detail });
    }
  }

  /* -------------------------------------------------------- what was made */

  if (artifacts.length) {
    blocks.push({ kind: 'heading', level: 1, text: 'What the run produced' });
    blocks.push({
      kind: 'list',
      items: artifacts.map(
        (artifact) =>
          `**${artifact.title}** — ${artifact.type.replace(/_/g, ' ')}${artifact.format ? `, ${artifact.format}` : ''}${artifact.createdBy ? `, by ${artifact.createdBy}` : ''}`,
      ),
    });
  }

  /* ---------------------------------------------------------- how we know */

  blocks.push({ kind: 'heading', level: 1, text: 'How this was produced' });
  blocks.push({
    kind: 'para',
    text:
      'Four specialists did the work and HELM held two review gates between them. A specialist never grades its own output: ' +
      'a failing review sends the work back to be redone. The approval in the middle is a person\'s, not the fleet\'s.',
  });

  const stages = (run.stages ?? []).filter((stage) => stage.label);
  if (stages.length) {
    blocks.push({
      kind: 'table',
      columns: ['Step', 'Outcome', 'What happened'],
      rows: stages.map((stage) => [stage.label, stage.state, stage.detail ?? '—']),
    });
  }

  const basis = findings[0]?.basis;
  if (basis) {
    const lines = [
      `Window ${basis.startDateInclusive} to ${basis.endDateInclusive}, complete through ${basis.completeThroughDate}.`,
    ];
    if (basis.comparisonStartDateInclusive) {
      lines.push(`Compared against ${basis.comparisonStartDateInclusive} to ${basis.comparisonEndDateInclusive}.`);
    }
    lines.push(`${basis.accountIds.length} accounts blended.`);
    for (const exclusion of basis.exclusions) lines.push(exclusion);
    blocks.push({ kind: 'list', items: lines });
  }

  blocks.push({ kind: 'rule' });
  blocks.push({
    kind: 'footnote',
    text:
      'Produced by HELM. The figures are frozen at the moment of writing; the account will have moved on. ' +
      'Attributed value is what the platforms report, not audited revenue. Nothing in this memo has been applied to an ad account.',
  });

  return {
    title: run.title,
    subtitle: `${input.workspaceName} · ${run.intent.replace(/_/g, ' ')}`,
    meta: [
      { label: 'Accounts', value: run.scopeLabel },
      { label: 'Window', value: run.rangeLabel },
      { label: 'Requested by', value: run.requestedBy },
      { label: 'Status', value: run.stage.replace(/_/g, ' ') },
    ],
    blocks,
  };
}
