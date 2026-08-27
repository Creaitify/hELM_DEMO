'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CampaignSummary } from '@/contracts';
import { ProviderMark, IconArrowRight, IconChevronDown, IconColumns, IconFilter } from '@/components/icons';
import { Button } from '@/components/primitives/Button';
import { SearchField, SegmentedControl } from '@/components/primitives/Controls';
import { DeltaChip, StatusBadge } from '@/components/primitives/Status';
import { Sparkline } from '@/components/data/Charts';
import { CampaignDot } from '@/components/data/CampaignTag';
import { Drawer } from '@/components/primitives/Overlay';
import { EmptyState } from '@/components/primitives/States';
import { formatDelta, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { deltaSemantic, formatMetric } from '@/lib/metrics';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

type SortKey = 'name' | 'spend' | 'value' | 'roas' | 'cpa' | 'deltaCpa';

const STATUS_LABEL: Record<CampaignSummary['status'], string> = {
  active: 'Active',
  limited: 'Limited by budget',
  paused: 'Paused',
  ended: 'Ended',
  learning: 'Learning',
};

const STATUS_TONE: Record<CampaignSummary['status'], 'good' | 'warn' | 'neutral' | 'info'> = {
  active: 'good',
  limited: 'warn',
  paused: 'neutral',
  ended: 'neutral',
  learning: 'info',
};

export function CampaignExplorer({
  campaigns,
  workspaceSlug,
  excludedAccountId,
}: {
  campaigns: CampaignSummary[];
  workspaceSlug: string;
  excludedAccountId: string;
}) {
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<'all' | 'google_ads' | 'meta_ads'>('all');
  const [status, setStatus] = useState<'all' | CampaignSummary['status']>('all');
  const [level, setLevel] = useState<'campaign' | 'ad_group' | 'ad'>('campaign');
  const [sort, setSort] = useState<SortKey>('spend');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [inspect, setInspect] = useState<CampaignSummary | null>(null);

  const rows = useMemo(() => {
    const filtered = campaigns.filter((campaign) => {
      if (platform !== 'all' && campaign.provider !== platform) return false;
      if (status !== 'all' && campaign.status !== status) return false;
      if (!query.trim()) return true;
      const needle = query.toLowerCase();
      return (
        campaign.name.toLowerCase().includes(needle) ||
        campaign.accountName.toLowerCase().includes(needle) ||
        campaign.objective.toLowerCase().includes(needle)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      const factor = direction === 'asc' ? 1 : -1;
      if (sort === 'name') return a.name.localeCompare(b.name) * factor;
      const av = (a[sort] ?? 0) as number;
      const bv = (b[sort] ?? 0) as number;
      return (av - bv) * factor;
    });

    return sorted;
  }, [campaigns, platform, status, query, sort, direction]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) {
      setDirection((value) => (value === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setDirection(key === 'name' ? 'asc' : 'desc');
    }
  };

  const totals = rows.reduce(
    (acc, row) => ({
      spend: acc.spend + row.spend,
      value: acc.value + (row.value ?? 0),
      conversions: acc.conversions + row.conversions,
    }),
    { spend: 0, value: 0, conversions: 0 },
  );

  return (
    <div className="space-y-5">
      {/* Controls. Date, comparison and account scope stay in the global scope bar. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField
          label="Search campaigns"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full sm:w-[280px]"
        />

        <FilterMenu
          label="Platform"
          value={platform}
          onChange={(value) => setPlatform(value as typeof platform)}
          options={[
            { value: 'all', label: 'All platforms' },
            { value: 'google_ads', label: 'Google Ads' },
            { value: 'meta_ads', label: 'Meta Ads' },
          ]}
        />

        <FilterMenu
          label="Status"
          value={status}
          onChange={(value) => setStatus(value as typeof status)}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'limited', label: 'Limited by budget' },
            { value: 'learning', label: 'Learning' },
          ]}
        />

        <SegmentedControl
          label="Analysis level"
          value={level}
          onChange={(value) => setLevel(value as typeof level)}
          options={[
            { value: 'campaign', label: 'Campaign' },
            { value: 'ad_group', label: 'Ad set / group' },
            { value: 'ad', label: 'Ad' },
          ]}
          className="hidden md:inline-flex"
        />

        <Button variant="quiet" size="compact" leading={<IconColumns size={16} />} className="ml-auto hidden lg:inline-flex">
          Columns
        </Button>
      </div>

      {level !== 'campaign' ? (
        <EmptyState
          title={`${level === 'ad_group' ? 'Ad set and ad group' : 'Ad'} level is not in this sample workspace`}
          description="The sample data set covers campaign level only. Switch back to Campaign to continue exploring."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No campaigns match these filters"
          description="Nothing in the current account scope matches the search and filters you have applied. Clear them to see all 11 campaigns."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="s-panel hidden overflow-hidden p-0 lg:block">
            <div className="thin-scrollbar overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left">
                <caption className="sr-only">
                  Campaign performance for the selected account scope and date range
                </caption>
                <thead>
                  <tr className="border-b border-line bg-surface-subtle">
                    <SortHeader label="Campaign" active={sort === 'name'} direction={direction} onClick={() => toggleSort('name')} className="sticky left-0 z-10 bg-surface-subtle" />
                    <th scope="col" className="px-3 py-2.5 text-[11.5px] font-medium text-ink-500">
                      Status
                    </th>
                    <SortHeader label="Spend" numeric active={sort === 'spend'} direction={direction} onClick={() => toggleSort('spend')} />
                    <SortHeader label="Value" numeric active={sort === 'value'} direction={direction} onClick={() => toggleSort('value')} />
                    <SortHeader label="ROAS" numeric active={sort === 'roas'} direction={direction} onClick={() => toggleSort('roas')} />
                    <SortHeader label="CPA" numeric active={sort === 'cpa'} direction={direction} onClick={() => toggleSort('cpa')} />
                    <SortHeader label="CPA change" numeric active={sort === 'deltaCpa'} direction={direction} onClick={() => toggleSort('deltaCpa')} />
                    <th scope="col" className="px-3 py-2.5 text-[11.5px] font-medium text-ink-500">
                      Trend
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-[11.5px] font-medium text-ink-500">
                      Intelligence
                    </th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  {rows.map((campaign) => {
                    const excluded = campaign.accountId === excludedAccountId;
                    return (
                      <tr
                        key={campaign.id}
                        className={cn(
                          'group border-b border-line transition-colors last:border-b-0 hover:bg-surface-subtle',
                          excluded && 'bg-warn-soft/25',
                        )}
                      >
                        <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 font-normal">
                          <Link
                            href={routes.campaign(workspaceSlug, campaign.id)}
                            className="group flex items-start gap-2.5"
                          >
                            <span className="mt-[3px] flex shrink-0 items-center gap-1.5">
                              <CampaignDot campaignId={campaign.id} />
                              <ProviderMark provider={campaign.provider} size={16} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13.5px] font-medium text-ink-950 group-hover:text-helm-600">
                                {campaign.name}
                              </span>
                              <span className="mono block truncate text-[11px] text-ink-400">
                                {campaign.accountName}
                              </span>
                            </span>
                          </Link>
                        </th>
                        <td className="px-3 py-3">
                          <StatusBadge tone={STATUS_TONE[campaign.status]}>
                            {STATUS_LABEL[campaign.status]}
                          </StatusBadge>
                          {excluded ? (
                            <span className="mono mt-1 block text-[11px] text-warn">Excluded</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-right text-[13px] text-ink-950">
                          {formatMoney(campaign.spend, campaign.currency, { compact: true })}
                        </td>
                        <td className="px-3 py-3 text-right text-[13px] text-ink-950">
                          {formatMoney(campaign.value, campaign.currency, { compact: true })}
                        </td>
                        <td className="px-3 py-3 text-right text-[13px] text-ink-950">
                          {formatMetric(campaign.roas, 'roas')}
                        </td>
                        <td className="px-3 py-3 text-right text-[13px] text-ink-950">
                          {formatMoney(campaign.cpa, campaign.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <DeltaChip
                            text={formatDelta(campaign.deltaCpa)}
                            semantic={deltaSemantic('cpa', campaign.deltaCpa)}
                            className="justify-end"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Sparkline
                            values={campaign.dailySpend}
                            label={`Daily spend trend for ${campaign.name}`}
                            color={campaign.provider === 'google_ads' ? 'var(--google)' : 'var(--meta)'}
                          />
                        </td>
                        <td className="px-3 py-3">
                          {campaign.intelligence === 'decision' ? (
                            <StatusBadge tone="bad">Needs a decision</StatusBadge>
                          ) : campaign.intelligence === 'watch' ? (
                            <StatusBadge tone="warn">Watching</StatusBadge>
                          ) : campaign.intelligence === 'stable' ? (
                            <StatusBadge tone="good">Stable</StatusBadge>
                          ) : (
                            <span className="text-[12px] text-ink-400">Not assessed</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setInspect(campaign)}
                            className="mono mt-1 block text-[11px] text-helm-600 underline-offset-2 opacity-0 transition-opacity hover:underline focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            Quick inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line-strong bg-surface-subtle">
                    <th scope="row" className="sticky left-0 bg-surface-subtle px-4 py-3 text-left text-[12.5px] font-medium text-ink-700">
                      {rows.length} campaigns
                    </th>
                    <td />
                    <td className="px-3 py-3 text-right text-[13px] font-medium text-ink-950">
                      {formatMoney(totals.spend, 'INR', { compact: true })}
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] font-medium text-ink-950">
                      {formatMoney(totals.value, 'INR', { compact: true })}
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] font-medium text-ink-950">
                      {(totals.value / totals.spend).toFixed(2)}×
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] font-medium text-ink-950">
                      {formatMoney(totals.spend / totals.conversions, 'INR')}
                    </td>
                    <td colSpan={3} className="px-3 py-3 text-[11.5px] text-ink-400">
                      Footer totals include every visible row, including accounts excluded from the Briefing.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Mobile records — a distinct hierarchy, not a squeezed table */}
          <ul className="space-y-3 lg:hidden">
            {rows.map((campaign) => (
              <li key={campaign.id} className="s-panel px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-[3px] flex shrink-0 items-center gap-1.5">
                      <CampaignDot campaignId={campaign.id} />
                      <ProviderMark provider={campaign.provider} size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-medium leading-snug text-ink-950">{campaign.name}</p>
                      <p className="mono text-[11px] text-ink-400">{campaign.accountName}</p>
                    </div>
                  </div>
                  <StatusBadge tone={STATUS_TONE[campaign.status]}>{STATUS_LABEL[campaign.status]}</StatusBadge>
                </div>

                <dl className="tnum mt-3.5 grid grid-cols-3 gap-3 border-t border-line pt-3">
                  {[
                    ['Spend', formatMoney(campaign.spend, campaign.currency, { compact: true })],
                    ['ROAS', formatMetric(campaign.roas, 'roas')],
                    ['CPA', formatMoney(campaign.cpa, campaign.currency)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="micro-label">{label}</dt>
                      <dd className="mt-1 text-[14px] font-medium text-ink-950">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <DeltaChip
                    text={`CPA ${formatDelta(campaign.deltaCpa)}`}
                    semantic={deltaSemantic('cpa', campaign.deltaCpa)}
                  />
                  <Link
                    href={routes.campaign(workspaceSlug, campaign.id)}
                    className="inline-flex h-11 items-center gap-1.5 text-[13.5px] font-medium text-helm-600"
                  >
                    Open campaign
                    <IconArrowRight size={15} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Quick inspect keeps the durable link available */}
      <Drawer
        open={Boolean(inspect)}
        onClose={() => setInspect(null)}
        title={inspect?.name ?? ''}
        description={inspect ? `${inspect.accountName} · ${inspect.objective}` : undefined}
        footer={
          inspect ? (
            <Link
              href={routes.campaign(workspaceSlug, inspect.id)}
              className="inline-flex h-11 items-center gap-2 rounded-control bg-helm-500 px-4 text-[14px] font-medium text-white"
            >
              Open campaign detail
              <IconArrowRight size={16} />
            </Link>
          ) : null
        }
      >
        {inspect ? (
          <div className="space-y-5">
            <dl className="tnum grid grid-cols-2 gap-4">
              {[
                ['Spend', formatMoney(inspect.spend, inspect.currency)],
                ['Attributed value', formatMoney(inspect.value, inspect.currency)],
                ['ROAS', formatMetric(inspect.roas, 'roas')],
                ['CPA', formatMoney(inspect.cpa, inspect.currency)],
                ['Purchases', formatNumber(inspect.conversions)],
                ['Impressions', formatNumber(inspect.impressions, { compact: true })],
                ['Clicks', formatNumber(inspect.clicks, { compact: true })],
                ['CTR', formatPercent(inspect.ctr)],
                ...(inspect.frequency ? [['Frequency', inspect.frequency.toFixed(1)]] : []),
                ...(inspect.impressionShareLostToBudget
                  ? [['IS lost to budget', formatPercent(inspect.impressionShareLostToBudget)]]
                  : []),
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="micro-label">{label}</dt>
                  <dd className="mt-1 text-[15px] text-ink-950">{value}</dd>
                </div>
              ))}
            </dl>

            {inspect.intelligenceNote ? (
              <div className="rounded-field border border-line bg-surface-subtle px-4 py-3">
                <p className="micro-label">What HELM sees</p>
                <p className="mt-1.5 text-[14px] leading-[21px] text-ink-700">{inspect.intelligenceNote}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function SortHeader({
  label,
  numeric = false,
  active,
  direction,
  onClick,
  className,
}: {
  label: string;
  numeric?: boolean;
  active: boolean;
  direction: 'asc' | 'desc';
  onClick: () => void;
  className?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-3 py-2.5', numeric && 'text-right', className)}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 text-[11.5px] font-medium transition-colors hover:text-ink-950',
          active ? 'text-ink-950' : 'text-ink-500',
        )}
      >
        {label}
        <span
          aria-hidden="true"
          className={cn('transition-transform', active && direction === 'asc' && 'rotate-180', !active && 'opacity-30')}
        >
          <IconChevronDown size={13} />
        </span>
      </button>
    </th>
  );
}

function FilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
        <IconFilter size={15} />
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-11 appearance-none rounded-control border border-line bg-surface pl-9 pr-8 text-[13px] text-ink-700 outline-none transition-colors hover:border-line-strong focus:border-helm-500 md:h-10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400">
        <IconChevronDown size={15} />
      </span>
      <span className="sr-only">{current?.label}</span>
    </label>
  );
}
