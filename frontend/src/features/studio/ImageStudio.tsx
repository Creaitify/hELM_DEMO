'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Artifact, MetricValue } from '@/contracts';
import type { BriefingResponse, StudioResponse } from '@/services/http/queries';
import { Button } from '@/components/primitives/Button';
import { DeltaChip } from '@/components/primitives/Status';
import { EmptyState, InlineNotice } from '@/components/primitives/States';
import { Drawer } from '@/components/primitives/Overlay';
import { Scoreline } from '@/components/data/Scoreline';
import {
  IconChevronDown,
  IconDownload,
  IconLock,
  IconRefresh,
  IconSpark,
} from '@/components/icons';
import { api, describeError } from '@/lib/api';
import { routes } from '@/lib/routes';
import { deltaSemantic, formatMetric, metricLabel } from '@/lib/metrics';
import { formatDelta } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * The image studio.
 *
 * One narrow column of stacked rows, the way a generation tool is actually
 * used: choose the medium, set the few things that matter, describe the image,
 * press the button. Everything is a single row with its label on the left and
 * its current value on the right, so the whole configuration can be read top to
 * bottom in one pass rather than hunted for across three columns.
 *
 * A generation inherits something HELM already understands — a finding, a
 * campaign, the brand guidance — and the result is filed back into the library
 * carrying its prompt, its format and the model that drew it, so a generated
 * image is an object with provenance rather than a download.
 *
 * The creative director writes the brief; the person editing it decides. The
 * model proposes and never publishes.
 */

type Brief = {
  title: string;
  headline: string;
  subline: string;
  direction: string;
  rationale: string;
  prompt: string;
};

type Medium = 'image' | 'video';

const DIRECTION_COPY: Record<string, string> = {
  'product-proof': 'Product proof',
  'field-use': 'Field use',
  typographic: 'Typographic',
  evidence: 'Evidence',
};

/** Four figures fit on one line; the rest are one click away. */
const STRIP_METRICS = 4;

/** One setting: what it is on the left, what it is set to on the right. */
function Row({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2.5',
        !last && 'border-b border-line',
      )}
    >
      <span className="shrink-0 text-[13px] text-ink-500">{label}</span>
      {children}
    </div>
  );
}

const SELECT_CLASS =
  'min-w-0 flex-1 cursor-pointer truncate rounded-control bg-transparent py-1 pl-2 pr-1 text-right text-[13.5px] text-ink-950 outline-none transition-colors hover:bg-surface-subtle focus:bg-surface-subtle';

export function ImageStudio({
  workspaceSlug,
  studio,
  overview,
  nowIso,
}: {
  workspaceSlug: string;
  studio: StudioResponse;
  overview: BriefingResponse | null;
  nowIso: string;
}) {
  const router = useRouter();

  const [brief, setBrief] = useState<Brief>({
    title: '',
    headline: '',
    subline: '',
    direction: 'product-proof',
    rationale: '',
    prompt: '',
  });
  const [findingId, setFindingId] = useState<string | undefined>(studio.startingPoints[0]?.findingId);
  const [campaignId, setCampaignId] = useState<string | undefined>(studio.campaigns[0]?.id);
  const [preset, setPreset] = useState(studio.presets[0]?.id ?? 'meta_feed');
  const [medium, setMedium] = useState<Medium>('image');
  const [variants, setVariants] = useState(2);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [instructions, setInstructions] = useState('');

  const [accountOpen, setAccountOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [authoredBy, setAuthoredBy] = useState<string | null>(null);
  const [results, setResults] = useState<Artifact[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [inspect, setInspect] = useState<Artifact | null>(null);

  const activePreset = studio.presets.find((entry) => entry.id === preset) ?? studio.presets[0];
  const ready = brief.prompt.trim().length > 0 && medium === 'image';
  const director = studio.director.name.split(' ')[0];

  const latest = useMemo(() => [...results, ...studio.recent].slice(0, 8), [results, studio.recent]);
  const strip = (overview?.scoreline ?? []).slice(0, STRIP_METRICS) as MetricValue[];

  const writeBrief = async () => {
    setWriting(true);
    setProblem(null);
    try {
      const response = await api.post<{ brief: Brief; authoredBy: string; live: boolean }>(
        `/api/workspaces/${workspaceSlug}/studio/brief`,
        { findingId, campaignId, note: instructions.trim() || undefined, preset },
      );
      setBrief({ ...response.brief });
      setAuthoredBy(response.authoredBy);
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setWriting(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setProblem(null);
    try {
      const response = await api.post<{ artifacts: Artifact[]; provider: string; notes: string[] }>(
        `/api/workspaces/${workspaceSlug}/studio/generate`,
        {
          prompt: brief.prompt,
          headline: brief.headline,
          subline: brief.subline,
          title: brief.title || brief.headline,
          aspect: activePreset?.aspect,
          direction: brief.direction,
          findingId,
          campaignId,
          variants,
          saveToLibrary,
          // Sent with the generation, not only with the brief — otherwise the
          // one thing the person typed is the one thing the image ignores.
          instructions: instructions.trim() || undefined,
        },
      );
      setResults((current) => [...response.artifacts, ...current]);
      setNotices(response.notes ?? []);
      if (saveToLibrary) router.refresh();
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setGenerating(false);
    }
  };

  if (!studio.canGenerate) {
    return (
      <EmptyState
        title="Generating images needs the analyst role or above"
        description="You can still browse everything the creative side of the library holds, including the directions and variants other people have generated."
        actionLabel="Back to the library"
        actionHref={routes.library(workspaceSlug)}
        icon={<IconLock size={20} />}
      />
    );
  }

  return (
    // Left-aligned rather than centred, so the column sits under the page
    // title instead of floating away from it in the empty half of the canvas.
    <div className="w-full max-w-[760px] space-y-3">
      {/* The account, folded to one line. Open it when you want it. */}
      <section aria-label="Account overview" className="s-panel px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            {strip.length ? (
              strip.map((metric) => (
                <span key={metric.key} className="inline-flex items-baseline gap-1.5">
                  <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink-400">
                    {metricLabel(metric.key, true)}
                  </span>
                  <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink-950">
                    {formatMetric(metric.value, metric.key, {
                      currency: metric.currency,
                      compact: Math.abs(metric.value ?? 0) >= 100_000,
                    })}
                  </span>
                  <DeltaChip
                    text={formatDelta(metric.deltaRatio)}
                    semantic={deltaSemantic(metric.key, metric.deltaRatio)}
                  />
                </span>
              ))
            ) : (
              <span className="text-[12.5px] text-ink-400">Account figures need the HELM API</span>
            )}
          </div>

          {strip.length ? (
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              className="inline-flex shrink-0 items-center gap-1 text-[12px] text-ink-500 transition-colors hover:text-ink-950"
            >
              {accountOpen ? 'Less' : 'All figures'}
              <span className={cn('transition-transform', accountOpen && 'rotate-180')}>
                <IconChevronDown size={13} />
              </span>
            </button>
          ) : null}
        </div>

        {accountOpen && overview ? (
          <div className="mt-2.5">
            <Scoreline metrics={overview.scoreline} comparisonLabel="previous period" />
          </div>
        ) : null}
      </section>

      {/* The tool */}
      <section aria-label="Generate" className="s-panel overflow-hidden p-0">
        {/* Medium */}
        <div className="grid grid-cols-2 gap-2 p-2">
          {(['image', 'video'] as Medium[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMedium(option)}
              aria-pressed={medium === option}
              className={cn(
                'rounded-control border py-2.5 text-[13.5px] font-medium capitalize transition-colors',
                medium === option
                  ? 'border-helm-500 bg-helm-50 text-ink-950'
                  : 'border-line text-ink-500 hover:bg-surface-subtle',
              )}
            >
              {option}
            </button>
          ))}
        </div>

        {medium === 'video' ? (
          <p className="border-t border-line bg-surface-subtle px-4 py-2.5 text-[12.5px] leading-[18px] text-ink-500">
            Video is not wired up yet — no video model is configured, so the studio would have
            nothing to call. Switch back to Image to generate.
          </p>
        ) : null}

        <div className="border-t border-line">
          <Row label="Format">
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className={SELECT_CLASS}>
              {studio.presets.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label} · {entry.spec}
                </option>
              ))}
            </select>
          </Row>

          <Row label="Answers">
            <select
              value={findingId ?? ''}
              onChange={(event) => {
                const next = event.target.value || undefined;
                setFindingId(next);
                const point = studio.startingPoints.find((entry) => entry.findingId === next);
                if (point?.campaignId) setCampaignId(point.campaignId);
              }}
              className={SELECT_CLASS}
            >
              <option value="">Nothing in particular</option>
              {studio.startingPoints.map((point) => (
                <option key={point.findingId} value={point.findingId}>
                  {point.title}
                </option>
              ))}
            </select>
          </Row>

          <Row label="Filed against" last>
            <select
              value={campaignId ?? ''}
              onChange={(event) => setCampaignId(event.target.value || undefined)}
              className={SELECT_CLASS}
            >
              <option value="">No campaign</option>
              {studio.campaigns.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </Row>
        </div>

        {/* The prompt */}
        <div className="border-t border-line p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[13.5px] font-medium text-ink-950">Describe the image</p>
            <button
              type="button"
              onClick={() => void writeBrief()}
              disabled={writing}
              className={cn(
                'group inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 transition-colors',
                writing
                  ? 'border-line bg-surface-subtle text-ink-400'
                  : 'border-helm-500/40 bg-helm-50 text-ink-950 hover:border-helm-500 hover:bg-helm-100',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-white transition-colors',
                  writing ? 'bg-ink-300' : 'bg-helm-600 group-hover:bg-helm-700',
                )}
              >
                <IconSpark size={12} />
              </span>
              <span className="text-[12.5px] font-medium">
                {writing ? 'Writing…' : `Ask ${director}`}
              </span>
            </button>
          </div>

          <textarea
            rows={4}
            value={brief.prompt}
            onChange={(event) => setBrief((value) => ({ ...value, prompt: event.target.value }))}
            placeholder={`Describe the image, or ask ${director} to write it from the finding.`}
            className="w-full resize-y rounded-field border border-line-strong bg-surface-sunk px-3 py-2.5 text-[14px] leading-[21px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
          />

          <input
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Anything to change — sent with every variant"
            className="mt-2 h-10 w-full rounded-field border border-line-strong bg-surface-sunk px-3 text-[13.5px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
          />

          {brief.rationale ? (
            <p className="mt-2 rounded-control border border-line bg-surface-subtle px-3 py-2 text-[12.5px] leading-[18px] text-ink-500">
              {brief.rationale}
            </p>
          ) : null}
          {authoredBy ? (
            <p className="mono mt-2 text-[11px] text-ink-400">Written by {authoredBy}</p>
          ) : null}
        </div>

        {/* The words that end up in the frame, and where it is filed */}
        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          className="flex w-full items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-left transition-colors hover:bg-surface-subtle"
        >
          <span className="text-[13px] text-ink-500">Words in the image, and how it is filed</span>
          <span className={cn('text-ink-400 transition-transform', detailsOpen && 'rotate-180')}>
            <IconChevronDown size={14} />
          </span>
        </button>

        {detailsOpen ? (
          <div className="border-t border-line">
            <Row label="Headline">
              <input
                value={brief.headline}
                onChange={(event) => setBrief((value) => ({ ...value, headline: event.target.value }))}
                placeholder="18 hours cold"
                className="min-w-0 flex-1 rounded-control bg-transparent px-2 py-1 text-right text-[13.5px] text-ink-950 outline-none placeholder:text-ink-400 focus:bg-surface-subtle"
              />
            </Row>
            <Row label="Supporting line">
              <input
                value={brief.subline}
                onChange={(event) => setBrief((value) => ({ ...value, subline: event.target.value }))}
                placeholder="Measured, not claimed."
                className="min-w-0 flex-1 rounded-control bg-transparent px-2 py-1 text-right text-[13.5px] text-ink-950 outline-none placeholder:text-ink-400 focus:bg-surface-subtle"
              />
            </Row>
            <Row label="Art direction">
              <select
                value={brief.direction}
                onChange={(event) => setBrief((value) => ({ ...value, direction: event.target.value }))}
                className={SELECT_CLASS}
              >
                {studio.directions.map((direction) => (
                  <option key={direction} value={direction}>
                    {DIRECTION_COPY[direction] ?? direction}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="File in the library" last>
              <button
                type="button"
                role="switch"
                aria-checked={saveToLibrary}
                onClick={() => setSaveToLibrary((value) => !value)}
                className={cn(
                  'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                  saveToLibrary ? 'bg-helm-600' : 'bg-line-strong',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                    saveToLibrary ? 'left-[18px]' : 'left-0.5',
                  )}
                />
              </button>
            </Row>
          </div>
        ) : null}

        {/* Act */}
        <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-subtle px-4 py-3">
          <div className="flex items-center gap-1 rounded-control border border-line bg-surface px-1 py-0.5">
            <button
              type="button"
              onClick={() => setVariants((count) => Math.max(1, count - 1))}
              disabled={variants <= 1}
              aria-label="One fewer variant"
              className="h-7 w-7 rounded-control text-[15px] text-ink-500 transition-colors hover:bg-surface-subtle disabled:opacity-40"
            >
              −
            </button>
            <span className="mono w-8 text-center text-[13px] text-ink-950">{variants}</span>
            <button
              type="button"
              onClick={() => setVariants((count) => Math.min(4, count + 1))}
              disabled={variants >= 4}
              aria-label="One more variant"
              className="h-7 w-7 rounded-control text-[15px] text-ink-500 transition-colors hover:bg-surface-subtle disabled:opacity-40"
            >
              +
            </button>
          </div>

          <Button
            variant="action"
            className="flex-1"
            onClick={() => void generate()}
            disabled={!ready}
            pending={generating}
            pendingLabel="Drawing…"
          >
            Generate {variants > 1 ? `${variants} variants` : 'the image'}
          </Button>

          <span className="mono shrink-0 text-[11px] text-ink-400">{activePreset?.spec}</span>
        </div>

        <div aria-live="polite">
          {problem ? (
            <p className="border-t border-line px-4 py-2 text-[13px] text-bad">{problem}</p>
          ) : null}
        </div>
      </section>

      {!studio.provider.live ? (
        <InlineNotice compact tone="info" title={studio.provider.label}>
          {studio.provider.note}
        </InlineNotice>
      ) : null}

      {/* What came back */}
      <section aria-label="Latest generated" className="s-panel px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-ink-950">
            Latest generated
            {results.length ? (
              <span className="mono ml-2 text-[11px] font-normal text-ink-400">
                {results.length} this session
              </span>
            ) : null}
          </p>
        </div>

        {notices.map((entry) => (
          <p key={entry} className="mono mt-1.5 text-[11px] leading-[16px] text-ink-400">
            {entry}
          </p>
        ))}

        {latest.length === 0 ? (
          <p className="mt-2.5 rounded-control border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-ink-400">
            Nothing generated yet.
          </p>
        ) : (
          <ul className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
            {latest.map((artifact) => (
              <li key={artifact.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setInspect(artifact)}
                  title={artifact.title}
                  className="block w-[88px] overflow-hidden rounded-control border border-line transition-colors hover:border-helm-500"
                >
                  {artifact.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={artifact.imageUrl}
                      alt={artifact.title}
                      className="block aspect-[4/5] w-full bg-night-900 object-cover"
                    />
                  ) : (
                    <span className="flex aspect-[4/5] w-full items-center justify-center bg-surface-sunk text-ink-400">
                      <IconRefresh size={16} />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Drawer
        open={Boolean(inspect)}
        onClose={() => setInspect(null)}
        title={inspect?.title ?? 'Variant'}
        description="Everything the studio knows about this image."
      >
        {inspect ? (
          <div className="space-y-5">
            {inspect.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={inspect.imageUrl}
                alt={inspect.title}
                className="w-full rounded-card border border-line"
              />
            ) : null}
            <dl className="mono space-y-1.5 text-[12px]">
              {[
                ['Created by', inspect.createdBy],
                ['Format', inspect.format ?? inspect.aspect ?? '—'],
                ['Status', inspect.status],
                ['Linked campaign', inspect.linkedCampaignId ?? 'None'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-line/70 pb-1.5">
                  <dt className="text-ink-400">{label}</dt>
                  <dd className="text-right text-ink-700">{value}</dd>
                </div>
              ))}
            </dl>
            {inspect.prompt ? (
              <div>
                <p className="micro-label">Prompt</p>
                <p className="mt-1.5 whitespace-pre-wrap rounded-control border border-line bg-surface-subtle px-3 py-2 text-[12.5px] leading-[18px] text-ink-700">
                  {inspect.prompt}
                </p>
              </div>
            ) : null}
            {inspect.imageUrl ? (
              <a
                href={inspect.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13.5px] text-helm-600 hover:underline"
              >
                <IconDownload size={15} />
                Open the full-size file
              </a>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <p className="mono flex items-center gap-2 pt-1 text-[11px] text-ink-400">
        <IconLock size={13} />
        The studio never publishes. Generated {nowIso.slice(0, 10)}.
      </p>
    </div>
  );
}
