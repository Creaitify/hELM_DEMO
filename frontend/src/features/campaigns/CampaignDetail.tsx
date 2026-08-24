'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CampaignSummary, CreativeSummary, Evidence, Finding, Recommendation, SeriesPoint } from '@/contracts';
import { ArcBottlePoster, type PosterVariant } from '@/components/brand/ArcBottlePoster';
import { MetricChart, SERIES_COLORS } from '@/components/data/MetricChart';
import { EvidenceDrawer } from '@/components/data/EvidenceDrawer';
import { FindingCard } from '@/components/data/FindingCard';
import { Disclosure, Tabs } from '@/components/primitives/Controls';
import { DeltaChip, StatusBadge } from '@/components/primitives/Status';
import { EmptyState, SectionHeading } from '@/components/primitives/States';
import { IconIntelligence, ProviderMark } from '@/components/icons';
import { formatDelta, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { deltaSemantic, formatMetric } from '@/lib/metrics';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

const FATIGUE_TONE = { healthy: 'good', watch: 'warn', fatigued: 'bad' } as const;

export function CampaignDetail({
  campaign,
  creatives,
  findings,
  recommendations,
  evidence,
  spendSeries,
  cpaSeries,
  workspaceSlug,
}: {
  campaign: CampaignSummary;
  creatives: CreativeSummary[];
  findings: Finding[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  spendSeries: SeriesPoint[];
  cpaSeries: SeriesPoint[];
  workspaceSlug: string;
}) {
  const [tab, setTab] = useState('overview');
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);
  const activeEvidence = evidence.find((entry) => entry.id === openEvidenceId) ?? null;

  return (
    <div>
      <Tabs
        label="Campaign sections"
        value={tab}
        onChange={setTab}
        className="border-b border-line"
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'creative', label: 'Ads & Creative', count: creatives.length },
          { value: 'intelligence', label: 'Intelligence', count: findings.length },
        ]}
      />

      <div className="mt-7">
        {tab === 'overview' ? (
          <div className="space-y-6">
            <div className="s-panel px-5 py-5 sm:px-6">
              <MetricChart
                question="How did cost per purchase move in this campaign?"
                basis="25 Jul – 23 Aug 2026 · dashed line is the previous 30 days · spend ÷ mapped purchases"
                metric="cpa"
                series={[
                  { label: campaign.name.split(' / ').pop() ?? 'CPA', points: cpaSeries, color: SERIES_COLORS.primary, fill: true },
                ]}
                annotations={
                  campaign.id === 'cmp_m_broad_04'
                    ? [{ date: '2026-08-04', label: 'Daily budget raised 40%', tone: 'warn' as const }]
                    : campaign.id === 'cmp_g_high_intent'
                      ? [{ date: '2026-08-17', label: 'Began losing impression share to budget', tone: 'bad' as const }]
                      : []
                }
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="s-panel px-5 py-5">
                <MetricChart
                  compact
                  question="Daily spend"
                  basis="Reported by the platform in INR"
                  metric="spend"
                  series={[
                    {
                      label: 'Spend',
                      points: spendSeries,
                      color: campaign.provider === 'google_ads' ? SERIES_COLORS.google : SERIES_COLORS.meta,
                      fill: true,
                    },
                  ]}
                />
              </div>

              <div className="s-panel px-5 py-5">
                <p className="micro-label">Full metric set</p>
                <dl className="tnum mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    ['Spend', formatMoney(campaign.spend, campaign.currency)],
                    ['Attributed value', formatMoney(campaign.value, campaign.currency)],
                    ['ROAS', formatMetric(campaign.roas, 'roas')],
                    ['CPA', formatMoney(campaign.cpa, campaign.currency)],
                    ['Purchases', formatNumber(campaign.conversions)],
                    ['Impressions', formatNumber(campaign.impressions, { compact: true })],
                    ['Clicks', formatNumber(campaign.clicks, { compact: true })],
                    ['CTR', formatPercent(campaign.ctr)],
                    ['CPC', formatMoney(campaign.spend / campaign.clicks, campaign.currency)],
                    ['CPM', formatMoney((campaign.spend / campaign.impressions) * 1000, campaign.currency)],
                    ...(campaign.frequency !== undefined
                      ? [['Frequency', campaign.frequency.toFixed(1)]]
                      : [['Frequency', 'Not available']]),
                    ...(campaign.impressionShareLostToBudget !== undefined
                      ? [['IS lost to budget', formatPercent(campaign.impressionShareLostToBudget)]]
                      : [['IS lost to budget', 'Not available']]),
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="micro-label">{label}</dt>
                      <dd className={cn('mt-1 text-[15px]', value === 'Not available' ? 'text-ink-400' : 'text-ink-950')}>
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 border-t border-line pt-3 text-[12px] leading-[18px] text-ink-400">
                  {campaign.provider === 'google_ads'
                    ? 'Google Search does not report frequency. Impression share is Google-only.'
                    : 'Meta does not report impression share. Link clicks differ from all clicks.'}
                </p>
              </div>
            </div>

            {/* Secondary detail lives in disclosures, not extra tabs */}
            <div className="s-panel px-5 py-2 sm:px-6">
              <Disclosure summary="Campaign structure" className="border-b border-line">
                <dl className="mono grid gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2">
                  {[
                    ['Objective', campaign.objective],
                    ['Account', `${campaign.accountName}`],
                    ['Provider', campaign.provider === 'google_ads' ? 'Google Ads' : 'Meta Ads'],
                    ['Status', campaign.status],
                    ['Currency', campaign.currency],
                    ['Reporting day', 'Asia/Kolkata'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-line/60 py-1.5">
                      <dt className="text-ink-400">{label}</dt>
                      <dd className="text-ink-700">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Disclosure>
              <Disclosure summary="Conversion mapping" className="border-b border-line">
                <p className="text-[13.5px] leading-[21px] text-ink-700">
                  {campaign.provider === 'google_ads'
                    ? 'Mapped to the primary conversion action “Purchase — web”, normalized to a 7-day click basis. Google’s native reporting uses a data-driven 30-day click window; that value stays inspectable per account.'
                    : 'Mapped to the pixel Purchase event, normalized to a 7-day click basis. Meta’s native reporting also includes 1-day view; view-through is excluded from the mapped basis.'}
                </p>
              </Disclosure>
              <Disclosure summary="Source files and freshness">
                <p className="text-[13.5px] leading-[21px] text-ink-700">
                  Loaded by scheduled sync from the provider reporting API. Complete through 23 August 2026. The
                  current partial day is excluded.
                </p>
              </Disclosure>
            </div>
          </div>
        ) : null}

        {tab === 'creative' ? (
          creatives.length === 0 ? (
            <EmptyState
              title="No creative assets are attached to this campaign"
              description="Search text ads and Performance Max asset groups are not part of the sample creative set. Meta prospecting campaigns carry the Arc Bottle family."
            />
          ) : (
            <div className="space-y-5">
              <SectionHeading
                title="Creative performance"
                hint="Each asset carries its own frequency, view rate, hold rate and cost per purchase."
              />
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {creatives.map((creative) => (
                  <article key={creative.id} className="s-panel overflow-hidden p-0">
                    {creative.format === 'video' || creative.format === 'image' ? (
                      <div className="aspect-[4/5] w-full border-b border-line">
                        <ArcBottlePoster
                          variant={creative.variant as PosterVariant}
                          label={`Creative preview — ${creative.name}`}
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-[4/5] w-full items-center justify-center border-b border-line bg-surface-sunk px-6 text-center">
                        <p className="text-[13px] leading-[20px] text-ink-400">
                          {creative.format === 'carousel'
                            ? 'Carousel asset. No single rendered frame is stored.'
                            : 'Responsive search ad. Text assets only.'}
                        </p>
                      </div>
                    )}
                    <div className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[14px] font-medium leading-snug text-ink-950">{creative.name}</p>
                        <StatusBadge tone={FATIGUE_TONE[creative.fatigue]}>
                          {creative.fatigue === 'fatigued'
                            ? 'Fatigued'
                            : creative.fatigue === 'watch'
                              ? 'Watch'
                              : 'Healthy'}
                        </StatusBadge>
                      </div>
                      <dl className="tnum mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-3">
                        {[
                          ['Spend', formatMoney(creative.spend, 'INR', { compact: true })],
                          ['CPA', formatMoney(creative.cpa, 'INR')],
                          ['Frequency', creative.frequency?.toFixed(1) ?? 'Not available'],
                          ['3-sec view rate', creative.hookRate !== null ? formatPercent(creative.hookRate, { digits: 0 }) : 'Not available'],
                          ['Hold rate', creative.holdRate !== null ? formatPercent(creative.holdRate, { digits: 0 }) : 'Not available'],
                          ['Conv. rate', creative.conversionRate !== null ? formatPercent(creative.conversionRate, { digits: 2 }) : 'Not available'],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt className="micro-label">{label}</dt>
                            <dd
                              className={cn(
                                'mt-0.5 text-[13.5px]',
                                value === 'Not available' ? 'text-[12px] text-ink-400' : 'text-ink-950',
                              )}
                            >
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-3 border-t border-line pt-3 text-[12px] leading-[18px] text-ink-500">
                        {creative.note}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
              <p className="mono text-[11.5px] text-ink-400">
                3-second view rate = 3-second video plays ÷ impressions. Hold rate = 15-second plays ÷ 3-second
                plays. Both are derived and labelled as derived.
              </p>
            </div>
          )
        ) : null}

        {tab === 'intelligence' ? (
          findings.length === 0 ? (
            <EmptyState
              title="HELM has no open findings on this campaign"
              description="It is inside its normal range for the selected window. Start an investigation if you want a deeper read."
              actionLabel="Investigate with HELM"
              actionHref={routes.intelligence(workspaceSlug)}
            />
          ) : (
            <div className="s-panel px-5 py-1 sm:px-6">
              {findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  recommendation={recommendations.find((rec) => rec.findingId === finding.id)}
                  accountNames={[
                    { id: campaign.accountId, name: campaign.accountName, provider: campaign.provider },
                  ]}
                  onOpenEvidence={(id) => setOpenEvidenceId(id)}
                  investigateHref={routes.run(workspaceSlug, 'run_0824_cpa')}
                />
              ))}
            </div>
          )
        ) : null}
      </div>

      <EvidenceDrawer
        evidence={activeEvidence}
        open={Boolean(activeEvidence)}
        onClose={() => setOpenEvidenceId(null)}
      />
    </div>
  );
}

export function CampaignHeaderMetrics({ campaign }: { campaign: CampaignSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
      {[
        { label: 'Spend', value: formatMoney(campaign.spend, campaign.currency, { compact: true }), delta: campaign.deltaSpend, key: 'spend' as const },
        { label: 'ROAS', value: formatMetric(campaign.roas, 'roas'), delta: null, key: 'roas' as const },
        { label: 'CPA', value: formatMoney(campaign.cpa, campaign.currency), delta: campaign.deltaCpa, key: 'cpa' as const },
        { label: 'Purchases', value: formatNumber(campaign.conversions), delta: null, key: 'conversions' as const },
      ].map((entry) => (
        <div key={entry.label}>
          <p className="micro-label">{entry.label}</p>
          <p className="tnum mt-1 flex items-baseline gap-2 text-[18px] font-medium text-ink-950">
            {entry.value}
            {entry.delta !== null && entry.delta !== undefined ? (
              <DeltaChip text={formatDelta(entry.delta)} semantic={deltaSemantic(entry.key, entry.delta)} />
            ) : null}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CampaignIdentity({
  campaign,
  workspaceSlug,
}: {
  campaign: CampaignSummary;
  workspaceSlug: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="inline-flex items-center gap-2 text-[13px] text-ink-500">
        <ProviderMark provider={campaign.provider} size={16} />
        {campaign.accountName}
      </span>
      <span className="mono text-[12px] text-ink-400">{campaign.objective}</span>
      <Link
        href={routes.run(workspaceSlug, 'run_0824_cpa')}
        className="inline-flex items-center gap-1.5 text-[13px] text-helm-600 hover:underline"
      >
        <IconIntelligence size={15} />
        Investigate with HELM
      </Link>
    </div>
  );
}
