'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Artifact } from '@/contracts';
import type { StudioResponse } from '@/services/http/queries';
import { Button } from '@/components/primitives/Button';
import { Checkbox, Disclosure } from '@/components/primitives/Controls';
import { StatusBadge } from '@/components/primitives/Status';
import { EmptyState, InlineNotice, SectionHeading } from '@/components/primitives/States';
import { Drawer } from '@/components/primitives/Overlay';
import {
  IconCheck,
  IconDownload,
  IconEvidence,
  IconLock,
  IconRefresh,
  IconSpark,
} from '@/components/icons';
import { api, describeError } from '@/lib/api';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

/**
 * The image studio.
 *
 * Reached from the creative side of the library, never as a standalone toy.
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

const DIRECTION_COPY: Record<string, string> = {
  'product-proof': 'Product proof — the claim, lit and cropped hard',
  'field-use': 'Field use — the product where the claim is tested',
  typographic: 'Typographic — the line carries the frame',
  evidence: 'Evidence — the measurement itself is the image',
};

export function ImageStudio({
  workspaceSlug,
  studio,
  nowIso,
}: {
  workspaceSlug: string;
  studio: StudioResponse;
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
  const [variants, setVariants] = useState(2);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [note, setNote] = useState('');

  const [writing, setWriting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [authoredBy, setAuthoredBy] = useState<string | null>(null);
  const [results, setResults] = useState<Artifact[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [inspect, setInspect] = useState<Artifact | null>(null);

  const activePreset = studio.presets.find((entry) => entry.id === preset) ?? studio.presets[0];
  const ready = brief.prompt.trim().length > 0;

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
    <div className="space-y-8">
      {!studio.provider.live ? (
        <InlineNotice tone="info" title={`Drawing locally — ${studio.provider.label}`}>
          {studio.provider.note}
        </InlineNotice>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
        {/* Brief */}
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="start">
            <SectionHeading
              id="start"
              title="Start from something HELM understands"
              hint="A generation inherits a finding, a campaign and the brand guidance."
            />

            <div className="s-panel mt-4 p-0">
              <ul className="divide-y divide-line">
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
                          'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
                          active ? 'bg-helm-100/50' : 'hover:bg-surface-subtle',
                        )}
                      >
                        <span className={cn('mt-[2px] shrink-0', active ? 'text-helm-600' : 'text-ink-400')}>
                          {active ? <IconCheck size={16} /> : <IconEvidence size={16} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[14px] leading-[20px] text-ink-950">{point.title}</span>
                          <span className="mt-0.5 block text-[12.5px] leading-[18px] text-ink-500">
                            {point.hint}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {studio.fatiguedCreatives.length ? (
                <div className="border-t border-line px-4 py-3">
                  <p className="micro-label">Creative that is wearing out</p>
                  <ul className="mono mt-2 space-y-1 text-[11.5px] text-ink-500">
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
          </section>

          <section aria-labelledby="brief">
            <SectionHeading
              id="brief"
              title="The brief"
              hint={`${studio.director.name} proposes it. You decide what gets drawn.`}
              action={
                <Button
                  variant="neutral"
                  size="compact"
                  leading={<IconSpark size={15} />}
                  onClick={() => void writeBrief()}
                  pending={writing}
                  pendingLabel="Writing…"
                >
                  Write the brief
                </Button>
              }
            />

            <div className="s-panel mt-4 space-y-4 px-5 py-5">
              <label className="block">
                <span className="micro-label">Ask for something specific (optional)</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Lead with the cold-retention proof"
                  className="mt-1.5 h-11 w-full rounded-field border border-line-strong bg-surface-sunk px-3 text-[14.5px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
                />
              </label>

              {authoredBy ? (
                <p className="mono text-[11px] text-ink-400">Brief written by {authoredBy}</p>
              ) : null}

              <label className="block">
                <span className="micro-label">Headline</span>
                <input
                  value={brief.headline}
                  onChange={(event) => setBrief((value) => ({ ...value, headline: event.target.value }))}
                  placeholder="18 hours cold"
                  className="mt-1.5 h-11 w-full rounded-field border border-line-strong bg-surface-sunk px-3 text-[14.5px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
                />
              </label>

              <label className="block">
                <span className="micro-label">Supporting line</span>
                <input
                  value={brief.subline}
                  onChange={(event) => setBrief((value) => ({ ...value, subline: event.target.value }))}
                  placeholder="Measured, not claimed."
                  className="mt-1.5 h-11 w-full rounded-field border border-line-strong bg-surface-sunk px-3 text-[14.5px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
                />
              </label>

              <fieldset>
                <legend className="micro-label">Art direction</legend>
                <div className="mt-2 grid gap-1.5">
                  {studio.directions.map((direction) => (
                    <button
                      key={direction}
                      type="button"
                      onClick={() => setBrief((value) => ({ ...value, direction }))}
                      aria-pressed={brief.direction === direction}
                      className={cn(
                        'rounded-control border px-3 py-2 text-left text-[13.5px] transition-colors',
                        brief.direction === direction
                          ? 'border-helm-500 bg-helm-50 text-ink-950'
                          : 'border-line text-ink-500 hover:border-line-strong hover:bg-surface-subtle',
                      )}
                    >
                      {DIRECTION_COPY[direction] ?? direction}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block">
                <span className="micro-label">Prompt</span>
                <textarea
                  rows={4}
                  value={brief.prompt}
                  onChange={(event) => setBrief((value) => ({ ...value, prompt: event.target.value }))}
                  placeholder="Write the brief, or describe the image yourself."
                  className="mt-1.5 w-full resize-none rounded-field border border-line-strong bg-surface-sunk px-3 py-2.5 text-[14.5px] leading-[21px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
                />
              </label>

              {brief.rationale ? (
                <p className="rounded-control border border-line bg-surface-subtle px-3 py-2 text-[12.5px] leading-[18px] text-ink-500">
                  {brief.rationale}
                </p>
              ) : null}

              <Disclosure summary="Inherited from the workspace" defaultOpen={false}>
                <dl className="mono space-y-1.5 text-[12px]">
                  {Object.entries(studio.brand).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 border-b border-line/70 pb-1.5">
                      <dt className="capitalize text-ink-400">{key.replace(/([A-Z])/g, ' $1')}</dt>
                      <dd className="text-right text-ink-700">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Disclosure>
            </div>
          </section>

          <section aria-labelledby="format">
            <SectionHeading id="format" title="Format" hint="Platform-aware presets, not arbitrary pixels." />
            <div className="s-panel mt-4 space-y-4 px-5 py-5">
              <div className="grid grid-cols-2 gap-2">
                {studio.presets.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setPreset(entry.id)}
                    aria-pressed={preset === entry.id}
                    className={cn(
                      'rounded-control border px-3 py-2.5 text-left transition-colors',
                      preset === entry.id
                        ? 'border-helm-500 bg-helm-50'
                        : 'border-line hover:border-line-strong hover:bg-surface-subtle',
                    )}
                  >
                    <span className="block text-[13.5px] text-ink-950">{entry.label}</span>
                    <span className="mono block text-[11px] text-ink-400">{entry.spec}</span>
                  </button>
                ))}
              </div>

              <label className="flex items-center justify-between gap-4">
                <span className="text-[13.5px] text-ink-700">Variants</span>
                <span className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setVariants(count)}
                      aria-pressed={variants === count}
                      className={cn(
                        'mono h-9 w-9 rounded-control border text-[13px] transition-colors',
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
          </section>
        </div>

        {/* Results */}
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="results">
            <SectionHeading
              id="results"
              title="This session"
              hint="Nothing here is published. Approving a variant is a separate, human step."
              action={
                results.length ? <StatusBadge tone="info">{results.length} generated</StatusBadge> : undefined
              }
            />

            {notices.map((entry) => (
              <p key={entry} className="mono mt-3 text-[11.5px] text-ink-400">
                {entry}
              </p>
            ))}

            {results.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="Nothing generated yet"
                  description="Write the brief, adjust anything you disagree with, then generate. Each variant keeps the prompt that produced it."
                />
              </div>
            ) : (
              <ul className="mt-4 grid gap-5 sm:grid-cols-2">
                {results.map((artifact) => (
                  <StudioCard key={artifact.id} artifact={artifact} onInspect={() => setInspect(artifact)} />
                ))}
              </ul>
            )}
          </section>

          {studio.recent.length ? (
            <section aria-labelledby="recent">
              <SectionHeading
                id="recent"
                title="Already in the library"
                hint="Generated creative from earlier sessions and from completed runs."
              />
              <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {studio.recent.map((artifact) => (
                  <StudioCard key={artifact.id} artifact={artifact} onInspect={() => setInspect(artifact)} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

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
        The studio never publishes. Rotating a variant into a live campaign stays a human action inside the
        ad platform. Generated {nowIso.slice(0, 10)}.
      </p>
    </div>
  );
}

function StudioCard({ artifact, onInspect }: { artifact: Artifact; onInspect: () => void }) {
  return (
    <li className="s-panel overflow-hidden p-0">
      <button type="button" onClick={onInspect} className="block w-full text-left">
        {artifact.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artifact.imageUrl}
            alt={artifact.title}
            className="block w-full border-b border-line bg-night-900"
          />
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center border-b border-line bg-surface-sunk text-ink-400">
            <IconRefresh size={20} />
          </div>
        )}
        <span className="block px-4 py-3.5">
          <span className="flex items-start justify-between gap-3">
            <span className="text-[14px] font-medium leading-snug text-ink-950">{artifact.title}</span>
            <StatusBadge tone={artifact.status === 'approved' ? 'good' : 'neutral'}>
              {artifact.status.replace(/_/g, ' ')}
            </StatusBadge>
          </span>
          <span className="mono mt-1.5 block truncate text-[11px] text-ink-400">{artifact.createdBy}</span>
          <span className="mono mt-0.5 block text-[11px] text-ink-400">{artifact.format ?? artifact.aspect}</span>
        </span>
      </button>
    </li>
  );
}
