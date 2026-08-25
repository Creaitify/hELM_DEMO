import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/shell/AppShell';
import { WorkspacePlaceholder, isPopulated } from '@/features/briefing/WorkspacePlaceholder';
import { Scoreline } from '@/components/data/Scoreline';
import { RankedBars, ShareBar } from '@/components/data/Charts';
import { InlineNotice, SectionHeading } from '@/components/primitives/States';
import { StatusBadge } from '@/components/primitives/Status';
import { DecisionBrief } from '@/features/briefing/DecisionBrief';
import { PerformanceMovement } from '@/features/briefing/PerformanceMovement';
import { IconArrowRight, IconShare, ProviderMark } from '@/components/icons';
import { LinkButton } from '@/components/primitives/Button';
import { DownloadMenu } from '@/features/intelligence/DownloadMenu';
import { routes } from '@/lib/routes';
import { formatDateRange, formatMoney, formatRelative } from '@/lib/format';
import { getBriefing, getWorkspace } from '@/services/http/queries';
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
  evidence as sampleEvidence,
  findings as sampleFindings,
  partialNotice,
  recommendations,
  scoreline as sampleScoreline,
  seriesByMetric,
  timeline as sampleTimeline,
  unavailableMetric,
} from '@/services/mock';

export const metadata: Metadata = { title: 'Briefing' };

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
  const [live, workspaceRead] = await Promise.all([
    getBriefing(workspaceSlug),
    getWorkspace(workspaceSlug),
  ]);

  const scoreline = live.ok ? live.data.scoreline : sampleScoreline;
  const channelContribution = live.ok ? live.data.channelContribution : sampleContribution;
  const blendedCampaigns = live.ok ? live.data.campaigns : sampleCampaigns;
  const timeline = live.ok ? live.data.timeline : sampleTimeline;
  const accounts = workspaceRead.ok ? workspaceRead.data.accounts : sampleAccounts;
  const findings = live.ok && live.data.findings.length ? live.data.findings : sampleFindings;
  const evidence = sampleEvidence;
  const creatives = sampleCreatives;

  const decisionFindings = findings.filter((finding) => finding.severity === 'decision');
  const watchFindings = findings.filter((finding) => finding.severity === 'watch');
  const stableFindings = findings.filter((finding) => finding.severity === 'stable');

  const windowLabel = formatDateRange(WINDOW_START, WINDOW_END);

  const budgetOpportunities = blendedCampaigns
    .filter((campaign) => (campaign.impressionShareLostToBudget ?? 0) > 0.03)
    .sort((a, b) => (b.impressionShareLostToBudget ?? 0) - (a.impressionShareLostToBudget ?? 0));

  const fatigued = creatives
    .filter((creative) => creative.hookRate !== null)
    .sort((a, b) => (a.hookRate ?? 1) - (b.hookRate ?? 1));

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
          <LinkButton
            href={routes.run(workspaceSlug, 'run_0824_cpa')}
            variant="neutral"
            size="compact"
            leading={<IconShare size={16} />}
          >
            Open this morning&apos;s run
          </LinkButton>
        </>
      }
    >
      <div className="space-y-10">
        <Scoreline
          metrics={scoreline}
          unavailable={{ label: unavailableMetric.label, reason: unavailableMetric.reason }}
          comparisonLabel={`${formatDateRange(COMPARE_START, COMPARE_END)} (previous 30 days)`}
        />

        <InlineNotice
          tone="warn"
          title={partialNotice.title}
          action={
            <LinkButton href={routes.connections(workspaceSlug)} variant="neutral" size="compact">
              Open connections
            </LinkButton>
          }
        >
          {partialNotice.detail}
        </InlineNotice>

        <DecisionBrief
          workspaceSlug={workspaceSlug}
          decision={decisionFindings}
          watch={watchFindings}
          stable={stableFindings}
          recommendations={recommendations}
          evidence={evidence}
          accounts={accounts}
        />

        {/* Performance movement */}
        <section aria-labelledby="movement" className="scroll-mt-24">
          <SectionHeading
            id="movement"
            title="Performance movement"
            hint="Material changes are annotated on the series rather than explained in a legend."
          />
          <div className="mt-5 space-y-5">
            <PerformanceMovement
              seriesByMetric={seriesByMetric}
              windowLabel={windowLabel}
            />

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
                <p className="mt-4 border-t border-line pt-3 text-[12px] leading-[18px] text-ink-400">
                  Meta took 3.8 points more of the budget than in the previous 30 days, and returned less for
                  it.
                </p>
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
                <p className="mt-4 border-t border-line pt-3 text-[12px] leading-[18px] text-ink-400">
                  Meta does not report a comparable figure, so only Google campaigns appear here.
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
                <p className="mt-4 border-t border-line pt-3 text-[12px] leading-[18px] text-ink-400">
                  One asset in this ad set is a carousel and reports no video metrics, so 12% of spend is not
                  covered.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Since your last visit */}
        <section aria-labelledby="since" className="scroll-mt-24">
          <SectionHeading
            id="since"
            title="Since your last visit"
            hint="Material events, in order. This is an interpretation, not the raw audit feed."
            action={
              <Link
                href={routes.settings(workspaceSlug, 'audit')}
                className="mono inline-flex items-center gap-1.5 text-[12px] text-helm-600 hover:underline"
              >
                Open audit
                <IconArrowRight size={14} />
              </Link>
            }
          />
          <ol className="s-panel mt-5 divide-y divide-line px-5 sm:px-6">
            {timeline.map((event) => (
              <li key={event.id} className="flex flex-wrap items-start gap-x-4 gap-y-1.5 py-4">
                <span className="mono w-[104px] shrink-0 text-[11.5px] text-ink-400">
                  {formatRelative(event.at, NOW_ISO)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-medium text-ink-950">{event.title}</span>
                    <StatusBadge
                      tone={
                        event.tone === 'good'
                          ? 'good'
                          : event.tone === 'warn'
                            ? 'warn'
                            : event.tone === 'bad'
                              ? 'bad'
                              : 'neutral'
                      }
                      className="capitalize"
                    >
                      {event.kind}
                    </StatusBadge>
                  </span>
                  <span className="mt-1 block text-[13.5px] leading-[20px] text-ink-500">{event.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Data basis */}
        <section aria-labelledby="basis" className="scroll-mt-24">
          <SectionHeading
            id="basis"
            title="What these numbers are built on"
            hint="Every blended figure on this page uses exactly this basis."
          />
          <div className="s-panel-subtle mt-5 grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {accounts
              .filter((account) => ['acct_g_search', 'acct_g_pmax', 'acct_m_prospect'].includes(account.id))
              .map((account) => (
                <div key={account.id}>
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink-950">
                    <ProviderMark provider={account.provider} size={15} />
                    {account.name}
                  </p>
                  <dl className="mono mt-2.5 space-y-1.5 text-[12px] text-ink-400">
                    <div className="flex justify-between gap-3">
                      <dt>Account</dt>
                      <dd className="text-ink-700">{account.nativeId}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Reporting</dt>
                      <dd className="text-ink-700">
                        {account.currency} · {account.timeZone}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Last sync</dt>
                      <dd className="text-ink-700">{formatRelative(account.lastSyncedAt, NOW_ISO)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
          </div>
          <ul className="mt-4 space-y-1.5">
            {[
              'Northstar US / Search is separated: USD and an America/New_York reporting day.',
              'Northstar India / Retargeting is excluded from totals while its sync is 19 hours behind.',
              'The current partial day (24 August) is excluded from every figure.',
            ].map((line) => (
              <li key={line} className="flex gap-2 text-[12.5px] leading-[19px] text-ink-500">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-400" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
