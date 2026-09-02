import type { Metadata } from 'next';
import type { MetricKey, TimelineEvent } from '@/contracts';
import { PageShell } from '@/components/shell/AppShell';
import { WorkspacePlaceholder, isPopulated } from '@/features/briefing/WorkspacePlaceholder';
import { Scoreline } from '@/components/data/Scoreline';
import { RankedBars, ShareBar } from '@/components/data/Charts';
import { InlineNotice } from '@/components/primitives/States';
import { DecisionAnalytics } from '@/features/briefing/DecisionAnalytics';
import { DecisionBrief } from '@/features/briefing/DecisionBrief';
import { SinceLastLook } from '@/features/briefing/SinceLastLook';
import { PerformanceMovement } from '@/features/briefing/PerformanceMovement';
import { IconShare, ProviderMark } from '@/components/icons';
import { LinkButton } from '@/components/primitives/Button';
import { DownloadMenu } from '@/features/intelligence/DownloadMenu';
import { routes } from '@/lib/routes';
import { formatDateRange, formatMoney, formatRelative } from '@/lib/format';
import { getBriefing, getEvidenceList, getIntelligence, getWorkspace } from '@/services/http/queries';
import {
  COMPARE_END,
  COMPARE_START,
  HUMAN_TODAY,
  NOW_ISO,
  WINDOW_END,
  WINDOW_START,
  accounts as sampleAccounts,
  blendedCampaigns as sampleCampaigns,
  channelContribution as sampleContribution,
  creatives as sampleCreatives,
  decisions as sampleDecisions,
  evidence as sampleEvidence,
  findings as sampleFindings,
  recommendations,
  runs as sampleRuns,
  scoreline as sampleScoreline,
  seriesByMetric,
  timeline as sampleTimeline,
  unavailableMetric,
} from '@/services/mock';

export const metadata: Metadata = { title: 'Briefing' };

/**
 * Did this event move a figure on this page?
 *
 * Spend, creative and definition changes all land in the numbers above.
 * A degraded sync does too, because an excluded account changes every blended
 * total. A healthy sync and a person's own decision do not, so they wait
 * behind the disclosure rather than padding the list.
 */
function movedANumber(event: TimelineEvent): boolean {
  if (event.kind === 'spend' || event.kind === 'creative' || event.kind === 'definition') return true;
  return event.kind === 'sync' && event.tone !== 'good';
}

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  if (!isPopulated(workspaceSlug)) {
    return <WorkspacePlaceholder slug={workspaceSlug} title="Briefing" section="briefing" />;
  }

  // The graph is the source of truth for what is on the account right now;
  // the derived series stay with the fixtures until MetricDay is populated.
  const [live, workspaceRead, intelligence, evidenceRead] = await Promise.all([
    getBriefing(workspaceSlug),
    getWorkspace(workspaceSlug),
    getIntelligence(workspaceSlug),
    getEvidenceList(workspaceSlug),
  ]);

  const scoreline = live.ok ? live.data.scoreline : sampleScoreline;
  const channelContribution = live.ok ? live.data.channelContribution : sampleContribution;
  const blendedCampaigns = live.ok ? live.data.campaigns : sampleCampaigns;
  const timeline = live.ok ? live.data.timeline : sampleTimeline;
  const accounts = workspaceRead.ok ? workspaceRead.data.accounts : sampleAccounts;
  const findings = live.ok && live.data.findings.length ? live.data.findings : sampleFindings;
  const runs = intelligence.ok ? intelligence.data.runs : sampleRuns;
  // Evidence has to come from wherever the findings did. Fixtures behind live
  // findings meant every id missed and the quick look silently did nothing.
  const evidence =
    evidenceRead.ok && evidenceRead.data.evidence.length ? evidenceRead.data.evidence : sampleEvidence;
  const creatives = sampleCreatives;

  /** Which run produced each finding, so "investigate" reopens it. */
  const runIdByFinding: Record<string, string> = {};
  for (const run of runs) {
    for (const findingId of run.findingIds) runIdByFinding[findingId] ??= run.id;
  }

  const decisionFindings = findings.filter((finding) => finding.severity === 'decision');
  const watchFindings = findings.filter((finding) => finding.severity === 'watch');
  const stableFindings = findings.filter((finding) => finding.severity === 'stable');

  const morningRunId = runIdByFinding[decisionFindings[0]?.id] ?? runs[0]?.id;
  const windowLabel = formatDateRange(WINDOW_START, WINDOW_END);

  const moved = timeline.filter(movedANumber);
  const rest = timeline.filter((event) => !movedANumber(event));

  /*
   * The shape of each headline metric, for the scoreline.
   *
   * The same series the movement chart is drawn from, reduced to bare values.
   * It costs nothing extra — the page already has this data in hand — and it
   * is what let five explanatory paragraphs come out of the row above.
   */
  const spark: Partial<Record<MetricKey, (number | null)[]>> = {};
  for (const [key, series] of Object.entries(seriesByMetric)) {
    if (series) spark[key as MetricKey] = series.points.map((point) => point.value);
  }

  const budgetOpportunities = blendedCampaigns
    .filter((campaign) => (campaign.impressionShareLostToBudget ?? 0) > 0.03)
    .sort((a, b) => (b.impressionShareLostToBudget ?? 0) - (a.impressionShareLostToBudget ?? 0));

  const fatigued = creatives
    .filter((creative) => creative.hookRate !== null)
    .sort((a, b) => (a.hookRate ?? 1) - (b.hookRate ?? 1));

  const basisAccounts = accounts.filter((account) =>
    ['acct_g_search', 'acct_g_pmax', 'acct_m_prospect'].includes(account.id),
  );

  return (
    <PageShell
      title="Briefing"
      context={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-[15px] text-ink-700">{HUMAN_TODAY}</p>
          <span className="h-3.5 w-px bg-line" aria-hidden="true" />
          <p className="mono text-[12.5px] text-ink-500">{windowLabel}</p>
        </div>
      }
      actions={
        <>
          <DownloadMenu
            href={`/api/workspaces/${workspaceSlug}/briefing/export`}
            label="Export snapshot"
            formats={[
              { format: 'csv', label: 'CSV', hint: 'Campaign rows for a spreadsheet' },
              { format: 'md', label: 'Markdown', hint: 'The findings, as text' },
              { format: 'json', label: 'JSON', hint: 'The whole snapshot' },
            ]}
          />
          {morningRunId ? (
            <LinkButton
              href={routes.run(workspaceSlug, morningRunId)}
              variant="neutral"
              size="compact"
              leading={<IconShare size={16} />}
            >
              Open this morning&apos;s run
            </LinkButton>
          ) : null}
        </>
      }
    >
      <div className="space-y-9">
        <Scoreline
          metrics={scoreline}
          spark={spark}
          unavailable={{ label: unavailableMetric.label, reason: unavailableMetric.reason }}
          comparisonLabel={formatDateRange(COMPARE_START, COMPARE_END)}
        />

        {/* The caveat that changes how every figure above should be read. One
            line: which accounts are in, and the way to fix it. */}
        <InlineNotice compact tone="warn" title="3 of 4 accounts">
          <span className="flex flex-wrap items-center gap-x-2">
            <span>Retargeting is 19h behind and excluded from every blended total.</span>
            <LinkButton href={routes.connections(workspaceSlug)} variant="quiet" size="compact">
              Fix sync
            </LinkButton>
          </span>
        </InlineNotice>

        {/*
          The movement comes before the decisions it produced.
          A briefing that opens on paragraphs asks the reader to take the
          conclusion on trust; opening on the series lets them see the thing
          the findings are about, then read what HELM made of it.
        */}
        <section aria-labelledby="movement" className="scroll-mt-24">
          {/* The chart states its own question and basis, so the section is a
              rule and a name — not a heading with a paragraph under it. */}
          <div className="rule-heavy pt-4">
            <h2 id="movement" className="text-section text-ink-950">
              Movement
            </h2>
          </div>
          <div className="mt-5 space-y-5">
            <PerformanceMovement seriesByMetric={seriesByMetric} windowLabel={windowLabel} />

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="s-panel px-5 py-5">
                <ShareBar
                  question="Where did the spend go?"
                  parts={channelContribution.map((channel) => ({
                    label: channel.label,
                    share: channel.share,
                    display: formatMoney(channel.spend, 'INR', { compact: true }),
                    color: channel.provider === 'google_ads' ? 'var(--google)' : 'var(--meta)',
                    sub: `${(channel.share * 100).toFixed(1)}% of spend · ${channel.deltaShare > 0 ? '+' : '−'}${Math.abs(channel.deltaShare * 100).toFixed(1)}pt`,
                  }))}
                />
              </div>

              <div className="s-panel px-5 py-5">
                <RankedBars
                  question="Which campaigns are limited by budget?"
                  basis="Google Ads impression share lost to daily budget"
                  rows={budgetOpportunities.map((campaign) => ({
                    label: campaign.name,
                    value: campaign.impressionShareLostToBudget ?? 0,
                    display: `${((campaign.impressionShareLostToBudget ?? 0) * 100).toFixed(0)}%`,
                    color:
                      (campaign.impressionShareLostToBudget ?? 0) > 0.1 ? 'var(--warn)' : 'var(--line-strong)',
                    note: `CPA ${formatMoney(campaign.cpa, 'INR')} · ${campaign.conversions} purchases`,
                  }))}
                />
                {/* States a limit of the chart, not a restatement of it. */}
                <p className="mono mt-4 border-t border-line pt-3 text-[10.5px] text-ink-400">
                  Google only · Meta reports no equivalent
                </p>
              </div>

              <div className="s-panel px-5 py-5">
                <RankedBars
                  question="Which creative is repeating itself?"
                  basis="3-second view rate · lower means more fatigue"
                  rows={fatigued.map((creative) => ({
                    label: creative.name.replace('Arc Bottle — ', ''),
                    value: creative.hookRate ?? 0,
                    display: `${((creative.hookRate ?? 0) * 100).toFixed(0)}%`,
                    color:
                      creative.fatigue === 'fatigued'
                        ? 'var(--bad)'
                        : creative.fatigue === 'watch'
                          ? 'var(--warn)'
                          : 'var(--good)',
                    note: `Frequency ${creative.frequency?.toFixed(1)} · ${formatMoney(creative.cpa, 'INR')} CPA`,
                  }))}
                />
                <p className="mono mt-4 border-t border-line pt-3 text-[10.5px] text-ink-400">
                  12% of spend uncovered · one carousel reports no video metrics
                </p>
              </div>
            </div>
          </div>
        </section>

        {/*
          The queue, priced, before the findings that make it up.

          The movement above says what changed. This says what the change is
          worth and how fast the last ones like it were answered — the two
          things a reader needs to decide what to open first. The findings
          themselves follow, unchanged.
        */}
        <DecisionAnalytics
          decision={decisionFindings}
          recommendations={recommendations}
          runs={runs}
          decisions={sampleDecisions}
          nowIso={NOW_ISO}
        />

        <DecisionBrief
          workspaceSlug={workspaceSlug}
          decision={decisionFindings}
          watch={watchFindings}
          stable={stableFindings}
          recommendations={recommendations}
          evidence={evidence}
          accounts={accounts}
          campaigns={blendedCampaigns}
          runIdByFinding={runIdByFinding}
        />

        <SinceLastLook
          workspaceSlug={workspaceSlug}
          moved={moved}
          rest={rest}
          nowIso={NOW_ISO}
        />

        {/*
          The basis, as a strip rather than an essay.

          This was a heading, a sub-heading, three bullet sentences and a
          disclosure containing a definition list per account — roughly a
          screen of text to say which accounts are in and which are out. It is
          reference material: it must be on the page and findable, and it must
          not compete with the findings above it. One dense mono row per
          account does the whole job.
        */}
        <section aria-labelledby="basis" className="scroll-mt-24">
          <div className="rule-heavy flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-4">
            <h2 id="basis" className="text-section text-ink-950">
              Basis
            </h2>
            <p className="mono text-[10.5px] uppercase tracking-[0.08em] text-ink-400">
              {basisAccounts.length} blended · 1 separated · 1 excluded · today omitted
            </p>
          </div>

          <div className="s-panel mt-5 overflow-hidden p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line bg-surface-subtle">
                  {['Account', 'Reporting', 'Last sync'].map((heading) => (
                    <th key={heading} className="micro-label px-4 py-2 font-medium lg:px-5">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {basisAccounts.map((account) => (
                  <tr key={account.id} className="transition-colors hover:bg-surface-subtle">
                    <td className="px-4 py-2.5 lg:px-5">
                      <span className="flex items-center gap-2 text-[13.5px] text-ink-950">
                        <ProviderMark provider={account.provider} size={14} />
                        {account.name}
                      </span>
                    </td>
                    <td className="mono px-4 py-2.5 text-[11.5px] text-ink-500 lg:px-5">
                      {account.currency} · {account.timeZone}
                    </td>
                    <td className="mono px-4 py-2.5 text-[11.5px] text-ink-500 lg:px-5">
                      {formatRelative(account.lastSyncedAt, NOW_ISO)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
