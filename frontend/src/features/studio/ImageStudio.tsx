'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Artifact } from '@/contracts';
import type { BriefingResponse, StudioResponse } from '@/services/http/queries';
import { Button } from '@/components/primitives/Button';
import { Checkbox, Disclosure, SegmentedControl } from '@/components/primitives/Controls';
import { StatusBadge } from '@/components/primitives/Status';
import { EmptyState, InlineNotice, SectionHeading } from '@/components/primitives/States';
import { Drawer } from '@/components/primitives/Overlay';
import { Scoreline } from '@/components/data/Scoreline';
import { MetricChart, SERIES_COLORS } from '@/components/data/MetricChart';
import {
  IconCheck,
  IconDownload,
  IconEvidence,
  IconLock,
  IconRefresh,
  IconSpark,
  ProviderMark,
} from '@/components/icons';
import { api, describeError } from '@/lib/api';
import { routes } from '@/lib/routes';
import { formatDateRange } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * The image studio.
 *
 * Laid out the way the work actually runs: the account sits on top, because a
 * creative decision is a response to what the numbers are doing; the chart and
 * the format sit side by side, because the aspect ratio is part of the media
 * plan and not an afterthought; and the creative director's prompt runs along
 * the bottom, wide enough to read, edit and lift straight into a generation.
 *
 * A generation inherits something HELM already understands — a finding, a
 * fatiguing creative, the brand guidance — and the result is filed back into
 * the library as an artifact with its prompt, its format and the model that
 * drew it, so a generated image is an object with provenance rather than a
 * download.
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
  'product-proof': 'Product proof — the claim, lit and cropped hard',
  'field-use': 'Field use — the product where the claim is tested',
  typographic: 'Typographic — the line carries the frame',
  evidence: 'Evidence — the measurement itself is the image',
};

/** The scoreline reads better in the studio at four figures than at six. */
const OVERVIEW_METRICS = 4;

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
  const [note, setNote] = useState('');

  const [writing, setWriting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [authoredBy, setAuthoredBy] = useState<string | null>(null);
  const [results, setResults] = useState<Artifact[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [inspect, setInspect] = useState<Artifact | null>(null);

  const activePreset = studio.presets.find((entry) => entry.id === preset) ?? studio.presets[0];
  const activeCampaign = studio.campaigns.find((entry) => entry.id === campaignId);
  const ready = brief.prompt.trim().length > 0 && medium === 'image';

  /** Session output first, then what the library already holds. */
  const latest = useMemo(() => [...results, ...studio.recent].slice(0, 6), [results, studio.recent]);

  const chartSeries = useMemo(
    () =>
      (overview?.decisionStorySeries ?? []).map((entry) => ({
        label: entry.label,
        points: entry.points,
        color: entry.provider === 'google_ads' ? SERIES_COLORS.google : SERIES_COLORS.meta,
        fill: false,
      })),
    [overview],
  );

  const windowLabel = overview
    ? formatDateRange(overview.basis.startDateInclusive, overview.basis.endDateInclusive)
    : '';

  const writeBrief = async () => {
    setWriting(true);
    setProblem(null);
    try {
      const response = await api.post<{ brief: Brief; authoredBy: string; live: boolean }>(
        `/api/workspaces/${workspaceSlug}/studio/brief`,
        { findingId, campaignId, note: note.trim() || undefined, preset },
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

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(brief.prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setProblem('The browser would not give the studio clipboard access.');
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
    <div className="space-y-5">
      {!studio.provider.live ? (
        <InlineNotice tone="info" title={`Drawing locally — ${studio.provider.label}`}>
          {studio.provider.note}
        </InlineNotice>
      ) : null}

      {/* The account, as it stands right now */}
      <section aria-labelledby="overview">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="overview" className="text-[15px] font-medium text-ink-950">
              The account right now
            </h2>
            <p className="mono mt-0.5 text-[11.5px] text-ink-400">
              {overview
                ? `${windowLabel} · complete through ${overview.basis.completeThroughDate}`
                : 'Live figures need the HELM API'}
            </p>
          </div>

          {/* The creative director. One button, because it is one decision. */}
          <button
            type="button"
            onClick={() => void writeBrief()}
            disabled={writing}
            className={cn(
              'group inline-flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 transition-colors',
              writing
                ? 'border-line bg-surface-subtle text-ink-400'
                : 'border-helm-500/40 bg-helm-50 text-ink-950 hover:border-helm-500 hover:bg-helm-100',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors',
                writing ? 'bg-ink-300' : 'bg-helm-600 group-hover:bg-helm-700',
              )}
            >
              <IconSpark size={15} />
            </span>
            <span className="text-[13.5px] font-medium">
              {writing ? 'Reading the account…' : `Ask ${studio.director.name.split(' ')[0]}`}
            </span>
          </button>
        </div>

        {overview ? (
          <Scoreline
            metrics={overview.scoreline.slice(0, OVERVIEW_METRICS)}
            comparisonLabel="previous period"
          />
        ) : (
          <div className="s-panel px-5 py-4">
            <p className="text-[13.5px] text-ink-500">
              The studio is running without the account figures. Everything below still works; the
              chart is the only thing missing.
            </p>
          </div>
        )}
      </section>

      {/* Chart · format · output */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,250px)_minmax(0,286px)]">
        {/* Movement, and where the result is headed */}
        <section aria-labelledby="movement" className="s-panel min-w-0 px-5 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p id="movement" className="micro-label">
              What the creative has to answer
            </p>
            {activeCampaign ? (
              <span className="mono inline-flex items-center gap-1.5 text-[11.5px] text-ink-400">
                <ProviderMark provider={activeCampaign.provider} size={14} />
                {activeCampaign.name}
              </span>
            ) : null}
          </div>

          {chartSeries.length ? (
            <MetricChart
              question="Where is the spend going, and what is it buying?"
              basis={`${windowLabel} · one line per platform`}
              metric="spend"
              series={chartSeries}
              annotations={overview?.movementAnnotations ?? []}
              height={230}
            />
          ) : (
            <div className="flex h-[230px] items-center justify-center rounded-card border border-dashed border-line text-[13px] text-ink-400">
              No series for this window.
            </div>
          )}

          {/* Add the output to an ad — the destination, chosen before drawing */}
          <div className="mt-4 border-t border-line pt-4">
            <label className="block">
              <span className="micro-label">Add the result to an ad</span>
              <select
                value={campaignId ?? ''}
                onChange={(event) => setCampaignId(event.target.value || undefined)}
                className="mt-1.5 h-10 w-full rounded-field border border-line-strong bg-surface-sunk px-2.5 text-[14px] text-ink-950 outline-none focus:border-helm-500 focus:bg-surface"
              >
                <option value="">Not attached to a campaign</option>
                {studio.campaigns.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="mono mt-2 text-[11px] leading-[16px] text-ink-400">
              The variant is filed against this campaign. Putting it live stays a human action inside
              the ad platform.
            </p>
          </div>
        </section>

        {/* Format, size, ratio, and the fields that end up in the image */}
        <section aria-labelledby="format" className="s-panel min-w-0 px-5 py-5">
          <p id="format" className="micro-label">
            Format
          </p>

          <div className="mt-2.5 grid gap-1.5">
            {studio.presets.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setPreset(entry.id)}
                aria-pressed={preset === entry.id}
                className={cn(
                  'rounded-control border px-3 py-2 text-left transition-colors',
                  preset === entry.id
                    ? 'border-helm-500 bg-helm-50'
                    : 'border-line hover:border-line-strong hover:bg-surface-subtle',
                )}
              >
                <span className="block text-[13px] leading-[18px] text-ink-950">{entry.label}</span>
                <span className="mono block text-[10.5px] text-ink-400">{entry.spec}</span>
              </button>
            ))}
          </div>

          <dl className="mono mt-4 space-y-1.5 border-t border-line pt-3.5 text-[11.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-400">Size</dt>
              <dd className="text-ink-700">{activePreset?.spec ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-400">Ratio</dt>
              <dd className="text-ink-700">{activePreset?.aspect ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-400">Channel</dt>
              <dd className="text-ink-700">{activePreset?.channel ?? '—'}</dd>
            </div>
          </dl>

          {/* Editable fields of the image generated */}
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <p className="micro-label">Fields in the image</p>

            <label className="block">
              <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-ink-400">
                Headline
              </span>
              <input
                value={brief.headline}
                onChange={(event) => setBrief((value) => ({ ...value, headline: event.target.value }))}
                placeholder="18 hours cold"
                className="mt-1 h-10 w-full rounded-field border border-line-strong bg-surface-sunk px-2.5 text-[14px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
              />
            </label>

            <label className="block">
              <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-ink-400">
                Supporting line
              </span>
              <input
                value={brief.subline}
                onChange={(event) => setBrief((value) => ({ ...value, subline: event.target.value }))}
                placeholder="Measured, not claimed."
                className="mt-1 h-10 w-full rounded-field border border-line-strong bg-surface-sunk px-2.5 text-[14px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
              />
            </label>

            <label className="block">
              <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-ink-400">
                Art direction
              </span>
              <select
                value={brief.direction}
                onChange={(event) => setBrief((value) => ({ ...value, direction: event.target.value }))}
                className="mt-1 h-10 w-full rounded-field border border-line-strong bg-surface-sunk px-2.5 text-[13.5px] text-ink-950 outline-none focus:border-helm-500 focus:bg-surface"
              >
                {studio.directions.map((direction) => (
                  <option key={direction} value={direction}>
                    {DIRECTION_COPY[direction] ?? direction}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-ink-700">Variants</span>
              <span className="flex items-center gap-1">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setVariants(count)}
                    aria-pressed={variants === count}
                    className={cn(
                      'mono h-8 w-8 rounded-control border text-[12.5px] transition-colors',
                      variants === count
                        ? 'border-helm-500 bg-helm-50 text-ink-950'
                        : 'border-line text-ink-500 hover:bg-surface-subtle',
                    )}
                  >
                    {count}
                  </button>
                ))}
              </span>
            </label>
          </div>

          <div className="mt-4 border-t border-line pt-3.5">
            <Disclosure summary="Inherited from the workspace" defaultOpen={false}>
              <dl className="mono space-y-1.5 text-[11.5px]">
                {Object.entries(studio.brand).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 border-b border-line/70 pb-1.5">
                    <dt className="capitalize text-ink-400">{key.replace(/([A-Z])/g, ' $1')}</dt>
                    <dd className="text-right text-ink-700">{value}</dd>
                  </div>
                ))}
              </dl>
            </Disclosure>
          </div>
        </section>

        {/* Medium switch and the latest output */}
        <section aria-labelledby="output" className="min-w-0 space-y-5">
          <div className="s-panel px-5 py-4">
            <p id="output" className="micro-label">
              Medium
            </p>
            <div className="mt-2.5">
              <SegmentedControl
                label="Generate an image or a video"
                value={medium}
                onChange={(value) => setMedium(value as Medium)}
                options={[
                  { value: 'image', label: 'Image' },
                  { value: 'video', label: 'Video' },
                ]}
              />
            </div>
            {medium === 'video' ? (
              <p className="mt-3 rounded-control border border-line bg-surface-subtle px-3 py-2 text-[12.5px] leading-[18px] text-ink-500">
                Video is not wired up yet. No video model is configured, so the studio would have
                nothing to call — switch back to Image to generate.
              </p>
            ) : (
              <p className="mono mt-2.5 text-[11px] text-ink-400">
                {activePreset?.aspect} · {studio.provider.label}
              </p>
            )}
          </div>

          <div className="s-panel px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="micro-label">Latest generated</p>
              {results.length ? (
                <StatusBadge tone="info">{results.length} this session</StatusBadge>
              ) : null}
            </div>

            {notices.map((entry) => (
              <p key={entry} className="mono mt-2 text-[11px] leading-[16px] text-ink-400">
                {entry}
              </p>
            ))}

            {latest.length === 0 ? (
              <p className="mt-3 rounded-control border border-dashed border-line px-3 py-6 text-center text-[12.5px] leading-[18px] text-ink-400">
                Nothing generated yet. Each variant keeps the prompt that produced it.
              </p>
            ) : (
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {latest.map((artifact) => (
                  <li key={artifact.id}>
                    <button
                      type="button"
                      onClick={() => setInspect(artifact)}
                      title={artifact.title}
                      className="block w-full overflow-hidden rounded-control border border-line transition-colors hover:border-helm-500"
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

            {latest.length ? (
              <p className="mono mt-2.5 text-[11px] text-ink-400">
                Tap a frame for its prompt, format and provenance.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {/* What the creative director wrote */}
      <section aria-labelledby="agent" className="s-panel px-5 py-5 sm:px-6">
        <SectionHeading
          id="agent"
          title="From the creative director"
          hint={`${studio.director.name} reads the finding and writes the prompt. You edit it, then draw.`}
          action={
            brief.prompt ? (
              <Button variant="neutral" size="compact" onClick={() => void copyPrompt()}>
                {copied ? 'Copied' : 'Copy the prompt'}
              </Button>
            ) : undefined
          }
        />

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          {/* What the generation is answering */}
          <div className="min-w-0">
            <p className="micro-label">Start from something HELM understands</p>
            <ul className="s-panel mt-2 divide-y divide-line p-0">
              {studio.startingPoints.map((point) => {
                const active = point.findingId === findingId;
                return (
                  <li key={point.findingId}>
                    <button
                      type="button"
                      onClick={() => {
                        setFindingId(point.findingId);
                        if (point.campaignId) setCampaignId(point.campaignId);
                      }}
                      aria-pressed={active}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition-colors',
                        active ? 'bg-helm-100/50' : 'hover:bg-surface-subtle',
                      )}
                    >
                      <span className={cn('mt-[2px] shrink-0', active ? 'text-helm-600' : 'text-ink-400')}>
                        {active ? <IconCheck size={15} /> : <IconEvidence size={15} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] leading-[19px] text-ink-950">
                          {point.title}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-[17px] text-ink-500">
                          {point.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {studio.fatiguedCreatives.length ? (
              <div className="mt-3">
                <p className="micro-label">Creative that is wearing out</p>
                <ul className="mono mt-1.5 space-y-1 text-[11.5px] text-ink-500">
                  {studio.fatiguedCreatives.map((creative) => (
                    <li key={creative.id} className="flex justify-between gap-3">
                      <span className="truncate">{creative.name}</span>
                      <span className="shrink-0 text-ink-400">
                        {creative.frequency === null ? 'n/a' : `${creative.frequency}×`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* The prompt itself, wide enough to actually read */}
          <div className="min-w-0 space-y-3">
            <label className="block">
              <span className="micro-label">Ask for something specific (optional)</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Lead with the cold-retention proof"
                className="mt-1.5 h-10 w-full rounded-field border border-line-strong bg-surface-sunk px-3 text-[14px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
              />
            </label>

            <label className="block">
              <span className="micro-label">Prompt</span>
              <textarea
                rows={6}
                value={brief.prompt}
                onChange={(event) => setBrief((value) => ({ ...value, prompt: event.target.value }))}
                placeholder="Ask the creative director, or describe the image yourself."
                className="mt-1.5 w-full resize-y rounded-field border border-line-strong bg-surface-sunk px-3 py-2.5 text-[14px] leading-[21px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
              />
            </label>

            {brief.rationale ? (
              <p className="rounded-control border border-line bg-surface-subtle px-3 py-2 text-[12.5px] leading-[18px] text-ink-500">
                {brief.rationale}
              </p>
            ) : null}

            {authoredBy ? (
              <p className="mono text-[11px] text-ink-400">Prompt written by {authoredBy}</p>
            ) : null}

            <Checkbox
              checked={saveToLibrary}
              onChange={setSaveToLibrary}
              label="File the result in the library"
              description="Keeps the prompt, the format and the model that drew it alongside the image."
            />

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <Button
                variant="action"
                onClick={() => void generate()}
                disabled={!ready}
                pending={generating}
                pendingLabel="Drawing…"
              >
                Generate {variants > 1 ? `${variants} variants` : 'the image'}
              </Button>
              <p className="mono text-[11.5px] text-ink-400">
                {activePreset?.spec} · {studio.provider.label}
              </p>
            </div>

            <div aria-live="polite" className="min-h-[20px]">
              {problem ? <p className="text-[13px] text-bad">{problem}</p> : null}
            </div>
          </div>
        </div>
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
                <p className="mt-1.5 rounded-control border border-line bg-surface-subtle px-3 py-2 text-[12.5px] leading-[18px] text-ink-700">
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

      <p className="mono flex items-center gap-2 border-t border-line pt-4 text-[11.5px] text-ink-400">
        <IconLock size={14} />
        The studio never publishes. Rotating a variant into a live campaign stays a human action inside
        the ad platform. Generated {nowIso.slice(0, 10)}.
      </p>
    </div>
  );
}
