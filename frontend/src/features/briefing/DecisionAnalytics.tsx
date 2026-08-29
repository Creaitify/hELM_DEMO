import type { Decision, Finding, IntelligenceRun, Recommendation } from '@/contracts';
import { ChartFrame, ColumnChart, RangeBars, RankedBars } from '@/components/data/Charts';
import { SectionHeading } from '@/components/primitives/States';
import { StatusBadge } from '@/components/primitives/Status';
import { formatDate, formatDuration, formatMoney } from '@/lib/format';

/**
 * The arithmetic of the decision queue, before the decisions themselves.
 *
 * The briefing already argues each finding one at a time. What it never showed
 * is the shape of the queue as a whole: how much money the open decisions are
 * modelled to carry, how they compare to each other, how the last ones were
 * resolved, and how quickly. Those are four different questions and each gets
 * its own figure rather than one composite score, which would hide all four.
 *
 * Every number here is derived from findings, runs and decisions the page
 * already holds. Nothing is estimated to fill a gap: a finding with no exposure
 * model is counted as a decision and left out of the money, and it says so.
 */

/** Exposure is stored in minor units as a string, and is a range, not a point. */
function exposureBounds(finding: Finding): { low: number; high: number } | null {
  if (!finding.exposure) return null;
  const low = Number(finding.exposure.low.minorUnits) / 100;
  const high = Number(finding.exposure.high.minorUnits) / 100;
  if (Number.isNaN(low) || Number.isNaN(high)) return null;
  return { low, high };
}

/**
 * The reporting day a timestamp falls on.
 *
 * Taken off the string rather than through Date, because every fixture carries
 * an explicit +05:30 and parsing would resolve the day in the server's zone
 * instead of the account's.
 */
function reportingDay(iso: string): string {
  return iso.slice(0, 10);
}

/** The n days ending on `endDay`, inclusive, as YYYY-MM-DD. */
function daysEnding(endDay: string, count: number): string[] {
  const end = Date.parse(`${endDay}T00:00:00Z`);
  if (Number.isNaN(end)) return [];
  const days: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(new Date(end - offset * 86_400_000).toISOString().slice(0, 10));
  }
  return days;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const OUTCOME_LABELS: Record<Decision['outcome'], string> = {
  approved: 'Approved',
  revision_requested: 'Revision requested',
  saved: 'Saved for later',
  dismissed: 'Dismissed',
};

const OUTCOME_COLORS: Record<Decision['outcome'], string> = {
  approved: 'var(--good)',
  revision_requested: 'var(--warn)',
  saved: 'var(--ink-400)',
  dismissed: 'var(--line-strong)',
};

/** How soon the recommendation attached to a finding wants an answer. */
function urgencyColor(urgency: Recommendation['urgency'] | undefined): string {
  if (urgency === 'today') return 'var(--urgent)';
  if (urgency === 'this_week') return 'var(--warn)';
  return 'var(--line-strong)';
}

function urgencyNote(urgency: Recommendation['urgency'] | undefined): string {
  if (urgency === 'today') return 'Wants an answer today';
  if (urgency === 'this_week') return 'Wants an answer this week';
  if (urgency === 'this_month') return 'Wants an answer this month';
  return 'No recommendation attached yet';
}

export function DecisionAnalytics({
  decision,
  recommendations,
  runs,
  decisions,
  nowIso,
  currency = 'INR',
  windowDays = 21,
}: {
  decision: Finding[];
  recommendations: Recommendation[];
  runs: IntelligenceRun[];
  /** Decisions already recorded, used only to describe how the queue clears. */
  decisions: Decision[];
  nowIso: string;
  currency?: string;
  windowDays?: number;
}) {
  const recommendationFor = (findingId: string) =>
    recommendations.find((entry) => entry.findingId === findingId);

  // ---- What the open queue is modelled to carry -------------------------
  const priced = decision
    .map((finding) => ({ finding, bounds: exposureBounds(finding) }))
    .filter((entry): entry is { finding: Finding; bounds: { low: number; high: number } } =>
      Boolean(entry.bounds),
    )
    .sort((a, b) => b.bounds.high - a.bounds.high);

  const unpricedCount = decision.length - priced.length;
  const totalLow = priced.reduce((sum, entry) => sum + entry.bounds.low, 0);
  const totalHigh = priced.reduce((sum, entry) => sum + entry.bounds.high, 0);
  const totalMid = (totalLow + totalHigh) / 2;

  // ---- What the fleet is holding ----------------------------------------
  const waitingRuns = runs.filter((run) => run.stage === 'waiting_for_approval');
  const blockedRuns = runs.filter((run) => run.stage === 'blocked' || run.stage === 'failed');

  // ---- How long the last decisions took ---------------------------------
  // Measured from the moment the run finished and could be answered, not from
  // when it started: time the fleet spent working is not time anybody waited.
  const waits = decisions
    .map((entry) => {
      const run = runs.find((candidate) => candidate.id === entry.runId);
      if (!run?.completedAt) return null;
      const gap = Date.parse(entry.at) - Date.parse(run.completedAt);
      return Number.isNaN(gap) || gap < 0 ? null : gap;
    })
    .filter((gap): gap is number => gap !== null);

  const medianWait = median(waits);

  // ---- How the last decisions were resolved -----------------------------
  const outcomeCounts = decisions.reduce<Partial<Record<Decision['outcome'], number>>>(
    (counts, entry) => ({ ...counts, [entry.outcome]: (counts[entry.outcome] ?? 0) + 1 }),
    {},
  );
  const outcomeRows = (Object.keys(OUTCOME_LABELS) as Decision['outcome'][])
    .map((outcome) => ({ outcome, count: outcomeCounts[outcome] ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  // ---- When the fleet actually runs -------------------------------------
  const axis = daysEnding(reportingDay(nowIso), windowDays);
  const runsByDay = runs.reduce<Record<string, IntelligenceRun[]>>((map, run) => {
    const day = reportingDay(run.startedAt);
    return { ...map, [day]: [...(map[day] ?? []), run] };
  }, {});

  const columns = axis.map((day) => {
    const onDay = runsByDay[day] ?? [];
    const holdsADecision = onDay.some((run) => run.stage === 'waiting_for_approval');
    return {
      label: formatDate(day, 'short'),
      value: onDay.length,
      caption:
        onDay.length === 0
          ? 'no runs'
          : `${onDay.length} ${onDay.length === 1 ? 'run' : 'runs'}${holdsADecision ? ', one waiting on you' : ''}`,
      // Amber means the same thing here as it does in the rail: this one is
      // waiting for you.
      color: holdsADecision ? 'var(--action-400)' : 'var(--ink-950)',
    };
  });

  const runsInWindow = axis.reduce((sum, day) => sum + (runsByDay[day]?.length ?? 0), 0);

  if (decision.length === 0) return null;

  return (
    <section aria-labelledby="decision-analytics" className="scroll-mt-24">
      <SectionHeading
        id="decision-analytics"
        title="The decision queue"
        hint="What the open decisions carry, how they compare, and how quickly the last ones cleared."
        action={
          <StatusBadge tone="bad">
            {decision.length} open {decision.length === 1 ? 'decision' : 'decisions'}
          </StatusBadge>
        }
      />

      {/* One divided scoreline, in the same language as the performance one
          above it, so the page does not introduce a second kind of KPI. */}
      <div className="s-panel mt-5 overflow-hidden p-0">
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Modelled at stake"
            value={formatMoney(totalMid, currency, { compact: true })}
            detail={`${formatMoney(totalLow, currency, { compact: true })} – ${formatMoney(totalHigh, currency, { compact: true })} across ${priced.length} priced ${priced.length === 1 ? 'finding' : 'findings'}`}
            caveat={
              unpricedCount > 0
                ? `${unpricedCount} open ${unpricedCount === 1 ? 'decision carries' : 'decisions carry'} no exposure model and ${unpricedCount === 1 ? 'is' : 'are'} not in this figure.`
                : undefined
            }
          />
          <Stat
            label="Waiting on you"
            value={String(waitingRuns.length)}
            detail={
              waitingRuns.length
                ? `${waitingRuns[0].title.length > 42 ? `${waitingRuns[0].title.slice(0, 41)}…` : waitingRuns[0].title}`
                : 'No run is holding a recommendation'
            }
          />
          <Stat
            label="Median time to decide"
            value={medianWait === null ? 'Not available' : formatDuration(medianWait)}
            detail={
              waits.length
                ? `Across the last ${waits.length} recorded ${waits.length === 1 ? 'decision' : 'decisions'}, measured from the run finishing`
                : 'No decision has been recorded against a completed run yet'
            }
          />
          <Stat
            label="Fleet runs"
            value={String(runsInWindow)}
            detail={`Started in the last ${windowDays} days`}
            caveat={
              blockedRuns.length
                ? `${blockedRuns.length} ${blockedRuns.length === 1 ? 'run is' : 'runs are'} blocked and produced nothing.`
                : undefined
            }
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <ChartFrame
          footer={
            unpricedCount > 0
              ? `${unpricedCount} open ${unpricedCount === 1 ? 'decision has' : 'decisions have'} no exposure model, so ${unpricedCount === 1 ? 'it does' : 'they do'} not appear here.`
              : 'Every open decision carries an exposure model.'
          }
        >
          <RangeBars
            question="What is each decision worth?"
            basis="Modelled exposure over the next 14 days · the band is the range, not an error bar"
            rows={priced.map(({ finding, bounds }) => {
              const recommendation = recommendationFor(finding.id);
              return {
                label: finding.title,
                low: bounds.low,
                high: bounds.high,
                display: `${formatMoney(bounds.low, currency, { compact: true })} – ${formatMoney(bounds.high, currency, { compact: true })}`,
                color: urgencyColor(recommendation?.urgency),
                note: urgencyNote(recommendation?.urgency),
              };
            })}
          />
        </ChartFrame>

        <ChartFrame
          footer={
            outcomeRows.length
              ? 'Approving a recommendation records a decision. It never executes a change in Google Ads or Meta Ads.'
              : 'No decision has been recorded yet.'
          }
        >
          <RankedBars
            question="How did the last decisions go?"
            basis={`Every one of the ${decisions.length} recorded ${decisions.length === 1 ? 'decision' : 'decisions'} on this workspace`}
            rows={outcomeRows.map((row) => ({
              label: OUTCOME_LABELS[row.outcome],
              value: row.count,
              display: String(row.count),
              color: OUTCOME_COLORS[row.outcome],
              note:
                decisions
                  .filter((entry) => entry.outcome === row.outcome)
                  .map((entry) => entry.by)
                  .join(', ') || undefined,
            }))}
          />
        </ChartFrame>

        <ChartFrame footer="A run only reaches you when it has a recommendation to put. Amber marks a day whose run is still waiting.">
          <ColumnChart
            question="When does the fleet run?"
            basis={`Runs started per day over the last ${windowDays} days`}
            columns={columns}
          />
        </ChartFrame>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  caveat,
}: {
  label: string;
  value: string;
  detail: string;
  caveat?: string;
}) {
  return (
    <div className="bg-surface px-4 py-4 lg:px-5">
      <p className="micro-label">{label}</p>
      <p
        data-metric
        className="mt-2 text-[clamp(20px,2vw,26px)] font-semibold leading-none tracking-[-0.02em] text-ink-950"
      >
        {value}
      </p>
      <p className="mt-2 text-[11.5px] leading-[16px] text-ink-500">{detail}</p>
      {/* A caveat changes how the figure should be read, so it stays on screen. */}
      {caveat ? <p className="mt-1.5 text-[11.5px] leading-[16px] text-ink-400">{caveat}</p> : null}
    </div>
  );
}
