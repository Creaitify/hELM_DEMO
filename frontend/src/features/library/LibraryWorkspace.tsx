'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Artifact } from '@/contracts';
import { ArcBottlePoster, type PosterVariant } from '@/components/brand/ArcBottlePoster';
import { Button } from '@/components/primitives/Button';
import { SearchField, Tabs } from '@/components/primitives/Controls';
import { StatusBadge } from '@/components/primitives/Status';
import { EmptyState } from '@/components/primitives/States';
import { Drawer } from '@/components/primitives/Overlay';
import {
  IconArrowRight,
  IconDownload,
  IconEvidence,
  IconLock,
  IconPlus,
  IconShare,
  IconSpark,
} from '@/components/icons';
import { CREATIVE_LINE } from '@/services/mock/campaigns';
import { api, describeError } from '@/lib/api';
import { DownloadMenu } from '@/features/intelligence/DownloadMenu';
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
  generated_image: 'Generated image',
};

export type LibraryCreateContext = {
  formats: { format: string; aspect: string; spec: string }[];
  startingPoints: { findingId: string; title: string; hint: string }[];
  inherited: Record<string, string>;
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
  initialMode = 'reports',
  canCreate = false,
  create,
  live = false,
}: {
  artifacts: Artifact[];
  workspaceSlug: string;
  nowIso: string;
  initialMode?: 'reports' | 'creative';
  /** Viewers read the library; they do not add to it. */
  canCreate?: boolean;
  create?: LibraryCreateContext;
  live?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'reports' | 'creative'>(initialMode);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [startingPoint, setStartingPoint] = useState<string | null>(null);
  const [chosenFormat, setChosenFormat] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const formats = create?.formats ?? [
    { format: 'Meta · 4:5 feed', aspect: '4:5', spec: '1080 × 1350' },
    { format: 'Meta · 9:16 story', aspect: '9:16', spec: '1080 × 1920' },
    { format: 'Meta · 1:1 square', aspect: '1:1', spec: '1080 × 1080' },
    { format: 'Decision memo', aspect: 'document', spec: 'Document' },
  ];

  const startingPoints = create?.startingPoints ?? [];
  const inherited = create?.inherited ?? {
    brand: 'Northstar Hydration · Arc Bottle',
    campaignLine: CREATIVE_LINE,
    palette: 'Graphite, frost, deep cobalt, one coral annotation',
    audience: 'Broad prospecting · India',
    objective: 'Sales · purchase',
  };

  /**
   * Contextual create.
   *
   * A visual format hands off to the image studio with the finding already
   * chosen; a document is filed straight into the library as a draft. Either
   * way the artifact starts from something HELM already understands.
   */
  const continueCreate = async () => {
    const format = formats.find((entry) => entry.format === chosenFormat) ?? formats[0];
    const point = startingPoints.find((entry) => entry.findingId === startingPoint);

    if (format.aspect !== 'document') {
      const search = new URLSearchParams();
      if (point) search.set('finding', point.findingId);
      search.set('aspect', format.aspect);
      router.push(`${routes.library(workspaceSlug)}/studio?${search.toString()}`);
      return;
    }

    if (!live) {
      setCreateOpen(false);
      return;
    }

    setSaving(true);
    setProblem(null);
    try {
      await api.post(`/api/workspaces/${workspaceSlug}/library`, {
        title: point?.title ?? 'Untitled decision memo',
        type: 'decision_memo',
        mode: 'reports',
        findingId: point?.findingId,
        summary: point?.hint,
        tags: ['Draft'],
      });
      setCreateOpen(false);
      router.refresh();
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setSaving(false);
    }
  };

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
            { value: 'reports', label: 'Documents', count: artifacts.filter((a) => a.mode === 'reports').length },
            { value: 'creative', label: 'Assets', count: artifacts.filter((a) => a.mode === 'creative').length },
          ]}
          className="border-b border-line"
        />
        <SearchField
          label="Search the library"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full sm:ml-auto sm:w-[260px]"
        />
        {mode === 'creative' ? (
          <Link
            href={`${routes.library(workspaceSlug)}/studio`}
            className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line-strong px-3 text-[13.5px] font-medium text-ink-950 transition-colors hover:bg-surface-subtle"
          >
            <IconSpark size={15} />
            Open the image studio
          </Link>
        ) : null}
        {canCreate ? (
          <Button
            variant="indigo"
            size="compact"
            leading={<IconPlus size={16} />}
            onClick={() => setCreateOpen(true)}
          >
            Create
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-400">
            <IconLock size={14} />
            Read only
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing matches that search"
          description={`No ${mode === 'reports' ? 'reports' : 'creative artifacts'} in Northstar Group match “${query}”. Clear the search to see everything.`}
        />
      ) : mode === 'reports' ? (
        <ul className="s-panel divide-y divide-line p-0">
          {rows.map((artifact) => (
            <li key={artifact.id} className="relative">
              {live ? (
                <div className="absolute right-4 top-1/2 z-10 -translate-y-1/2 sm:right-6">
                  <DownloadMenu
                    href={
                      artifact.linkedRunId
                        ? `/api/workspaces/${workspaceSlug}/intelligence/${artifact.linkedRunId}/export`
                        : `/api/workspaces/${workspaceSlug}/library/${artifact.id}/export`
                    }
                    label="Download"
                  />
                </div>
              ) : null}
              <Link
                href={artifact.linkedRunId ? routes.run(workspaceSlug, artifact.linkedRunId) : routes.library(workspaceSlug)}
                className="flex flex-wrap items-start gap-x-5 gap-y-2 px-5 py-4 pr-[150px] transition-colors hover:bg-surface-subtle sm:px-6 sm:pr-[168px]"
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
                {artifact.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artifact.imageUrl}
                    alt={artifact.title}
                    className="block w-full border-b border-line bg-night-900"
                  />
                ) : poster ? (
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
          <div className="flex items-center justify-end gap-2">
            {problem ? <p className="mr-auto text-[12.5px] text-bad">{problem}</p> : null}
            <Button variant="quiet" size="compact" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="indigo"
              size="compact"
              onClick={() => void continueCreate()}
              pending={saving}
              pendingLabel="Filing…"
            >
              Continue
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <section>
            <p className="micro-label">Start from a finding</p>
            {startingPoints.length ? (
              <ul className="mt-2 divide-y divide-line rounded-control border border-line">
                {startingPoints.map((point) => (
                  <li key={point.findingId}>
                    <button
                      type="button"
                      onClick={() => setStartingPoint(point.findingId)}
                      aria-pressed={startingPoint === point.findingId}
                      className={cn(
                        'w-full px-3.5 py-3 text-left transition-colors',
                        startingPoint === point.findingId ? 'bg-helm-100/50' : 'hover:bg-surface-subtle',
                      )}
                    >
                      <span className="block text-[14px] text-ink-950">{point.title}</span>
                      <span className="block text-[12.5px] text-ink-500">{point.hint}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-ink-400">
                No open findings to start from. Run an investigation first, or choose a format below.
              </p>
            )}
          </section>

          <section>
            <p className="micro-label">Choose a format</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {formats.map((entry) => (
                <button
                  key={entry.format}
                  type="button"
                  onClick={() => setChosenFormat(entry.format)}
                  aria-pressed={chosenFormat === entry.format}
                  className={cn(
                    'rounded-control border px-3 py-2.5 text-left transition-colors',
                    chosenFormat === entry.format
                      ? 'border-helm-500 bg-helm-50'
                      : 'border-line hover:border-line-strong hover:bg-surface-subtle',
                  )}
                >
                  <span className="block text-[13.5px] text-ink-950">{entry.format}</span>
                  <span className="mono block text-[11px] text-ink-400">{entry.spec}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12.5px] leading-[18px] text-ink-400">
              A visual format opens the image studio with this finding already attached. A document is filed
              here as a draft.
            </p>
          </section>

          <section>
            <p className="micro-label">Inherited</p>
            <dl className="mono mt-2 space-y-1.5 text-[12px]">
              {Object.entries(inherited).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-line/70 pb-1.5">
                  <dt className="capitalize text-ink-400">{label.replace(/([A-Z])/g, ' $1')}</dt>
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
