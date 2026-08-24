'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Artifact } from '@/contracts';
import { ArcBottlePoster, type PosterVariant } from '@/components/brand/ArcBottlePoster';
import { Button } from '@/components/primitives/Button';
import { SearchField, Tabs } from '@/components/primitives/Controls';
import { StatusBadge } from '@/components/primitives/Status';
import { EmptyState } from '@/components/primitives/States';
import { Drawer } from '@/components/primitives/Overlay';
import { IconArrowRight, IconDownload, IconEvidence, IconPlus, IconShare } from '@/components/icons';
import { CREATIVE_LINE } from '@/services/mock/campaigns';
import { formatRelative } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

const STATUS_TONE = {
  draft: 'neutral',
  in_review: 'warn',
  approved: 'good',
  archived: 'neutral',
} as const;

const STATUS_LABEL = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  archived: 'Archived',
} as const;

const TYPE_LABEL: Record<Artifact['type'], string> = {
  decision_memo: 'Decision memo',
  briefing_snapshot: 'Briefing snapshot',
  export: 'Export',
  creative_direction: 'Creative direction',
  creative_variant: 'Creative variant',
  copy_set: 'Copy set',
};

const POSTER_FOR: Record<string, PosterVariant> = {
  art_var_product_proof: 'product-proof',
  art_var_field_use: 'field-use',
  art_var_typographic: 'typographic',
};

/** One artifact home with two modes. Create mode is contextual, not a wall of prompt fields. */
export function LibraryWorkspace({
  artifacts,
  workspaceSlug,
  nowIso,
}: {
  artifacts: Artifact[];
  workspaceSlug: string;
  nowIso: string;
}) {
  const [mode, setMode] = useState<'reports' | 'creative'>('reports');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    return artifacts.filter((artifact) => {
      if (artifact.mode !== mode) return false;
      if (!query.trim()) return true;
      const needle = query.toLowerCase();
      return (
        artifact.title.toLowerCase().includes(needle) ||
        artifact.summary.toLowerCase().includes(needle) ||
        artifact.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [artifacts, mode, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          label="Library mode"
          value={mode}
          onChange={(value) => setMode(value as 'reports' | 'creative')}
          options={[
            { value: 'reports', label: 'Reports', count: artifacts.filter((a) => a.mode === 'reports').length },
            { value: 'creative', label: 'Creative', count: artifacts.filter((a) => a.mode === 'creative').length },
          ]}
          className="border-b border-line"
        />
        <SearchField
          label="Search the library"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full sm:ml-auto sm:w-[260px]"
        />
        <Button variant="indigo" size="compact" leading={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
          Create
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing matches that search"
          description={`No ${mode === 'reports' ? 'reports' : 'creative artifacts'} in Northstar Group match “${query}”. Clear the search to see everything.`}
        />
      ) : mode === 'reports' ? (
        <ul className="s-panel divide-y divide-line p-0">
          {rows.map((artifact) => (
            <li key={artifact.id}>
              <Link
                href={artifact.linkedRunId ? routes.run(workspaceSlug, artifact.linkedRunId) : routes.library(workspaceSlug)}
                className="flex flex-wrap items-start gap-x-5 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-subtle sm:px-6"
              >
                <span className="mt-[3px] shrink-0 text-ink-400">
                  <IconEvidence size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-medium text-ink-950">{artifact.title}</span>
                    <StatusBadge tone={STATUS_TONE[artifact.status]}>{STATUS_LABEL[artifact.status]}</StatusBadge>
                  </span>
                  <span className="mt-1 block max-w-prose text-[13.5px] leading-[20px] text-ink-500">
                    {artifact.summary}
                  </span>
                  <span className="mono mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-400">
                    <span>{TYPE_LABEL[artifact.type]}</span>
                    <span>{artifact.createdBy}</span>
                    {artifact.format ? <span>{artifact.format}</span> : null}
                  </span>
                </span>
                <span className="mono shrink-0 text-[11.5px] text-ink-400">
                  {formatRelative(artifact.updatedAt, nowIso)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((artifact) => {
            const poster = POSTER_FOR[artifact.id];
            return (
              <article key={artifact.id} className="s-panel overflow-hidden p-0">
                {poster ? (
                  <div className="aspect-[4/5] w-full border-b border-line">
                    <ArcBottlePoster variant={poster} label={`Creative — ${artifact.title}`} />
                  </div>
                ) : (
                  <div className="flex aspect-[16/9] w-full flex-col justify-end border-b border-line bg-night-900 p-5">
                    <p className="mono text-[10px] uppercase tracking-[0.14em] text-night-faint">
                      Northstar Hydration
                    </p>
                    <p className="mt-2 text-[18px] font-semibold leading-tight text-night-ink">
                      {CREATIVE_LINE}
                    </p>
                    <span className="mt-3 h-[2px] w-8 bg-action-400" aria-hidden="true" />
                  </div>
                )}
                <div className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14.5px] font-medium leading-snug text-ink-950">{artifact.title}</p>
                    <StatusBadge tone={STATUS_TONE[artifact.status]}>{STATUS_LABEL[artifact.status]}</StatusBadge>
                  </div>
                  <p className="mt-2 text-[13px] leading-[19px] text-ink-500">{artifact.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {artifact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-line bg-surface-subtle px-2 py-0.5 text-[11px] text-ink-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mono mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-[11.5px] text-ink-400">
                    <span>{artifact.createdBy}</span>
                    <span>{formatRelative(artifact.updatedAt, nowIso)}</span>
                  </div>
                  {artifact.linkedCampaignId ? (
                    <Link
                      href={routes.campaign(workspaceSlug, artifact.linkedCampaignId)}
                      className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-helm-600 hover:underline"
                    >
                      Linked campaign
                      <IconArrowRight size={14} />
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Contextual create: start from a finding or a campaign, not a blank prompt form */}
      <Drawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create"
        description="Start from something HELM already understands."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="quiet" size="compact" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="indigo" size="compact" onClick={() => setCreateOpen(false)}>
              Continue
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <section>
            <p className="micro-label">Start from a finding</p>
            <ul className="mt-2 divide-y divide-line rounded-control border border-line">
              {[
                ['The leading prospecting creative is repeating itself', 'Brief two Arc Bottle replacements'],
                ['Meta prospecting CPA rose 31%', 'Write the decision memo for this week'],
              ].map(([title, hint]) => (
                <li key={title}>
                  <button
                    type="button"
                    className="w-full px-3.5 py-3 text-left transition-colors hover:bg-surface-subtle"
                  >
                    <span className="block text-[14px] text-ink-950">{title}</span>
                    <span className="block text-[12.5px] text-ink-500">{hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="micro-label">Choose a format</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                ['Meta · 4:5 feed', '1080 × 1350'],
                ['Meta · 9:16 story', '1080 × 1920'],
                ['Meta · 1:1 square', '1080 × 1080'],
                ['Decision memo', 'Document'],
              ].map(([label, spec]) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    'rounded-control border border-line px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-subtle',
                  )}
                >
                  <span className="block text-[13.5px] text-ink-950">{label}</span>
                  <span className="mono block text-[11px] text-ink-400">{spec}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="micro-label">Inherited</p>
            <dl className="mono mt-2 space-y-1.5 text-[12px]">
              {[
                ['Brand', 'Northstar Hydration · Arc Bottle'],
                ['Campaign line', CREATIVE_LINE],
                ['Palette', 'Graphite, frost, deep cobalt, one coral annotation'],
                ['Audience', 'Broad prospecting · India'],
                ['Objective', 'Sales · purchase'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-line/70 pb-1.5">
                  <dt className="text-ink-400">{label}</dt>
                  <dd className="text-right text-ink-700">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12.5px] leading-[19px] text-ink-400">
              Advanced settings stay hidden until you ask for them.
            </p>
          </section>

          <div className="flex gap-2">
            <Button variant="quiet" size="compact" leading={<IconDownload size={15} />}>
              Import an asset
            </Button>
            <Button variant="quiet" size="compact" leading={<IconShare size={15} />}>
              Share a direction
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
