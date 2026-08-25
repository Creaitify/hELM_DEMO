'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CampaignSummary, IntelligenceRun } from '@/contracts';
import { Checkbox, Disclosure } from '@/components/primitives/Controls';
import { StatusBadge } from '@/components/primitives/Status';
import { SectionHeading } from '@/components/primitives/States';
import { IconArrowRight, IconIntelligence, IconLock, ProviderMark } from '@/components/icons';
import { api, describeError } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

const STAGE_TONE: Record<string, 'good' | 'warn' | 'bad' | 'info' | 'neutral'> = {
  queued: 'neutral',
  collecting_data: 'info',
  analyzing: 'info',
  reviewing_analysis: 'info',
  creating: 'info',
  reviewing_creative: 'info',
  waiting_for_approval: 'warn',
  generating_images: 'info',
  complete: 'good',
  blocked: 'bad',
  failed: 'bad',
  cancelled: 'neutral',
};

const STAGE_LABEL: Record<string, string> = {
  queued: 'Queued',
  collecting_data: 'Collecting data',
  analyzing: 'Analyzing',
  reviewing_analysis: 'HELM review',
  creating: 'Creating',
  reviewing_creative: 'HELM review',
  waiting_for_approval: 'Waiting for your approval',
  generating_images: 'Generating images',
  complete: 'Complete',
  blocked: 'Blocked',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/**
 * Intelligence does not begin with an empty chatbot. It begins with purposeful
 * intents and the context the run will inherit, adjustable in place.
 */
export function IntelligenceWorkspace({
  runs,
  campaigns,
  intents,
  workspaceSlug,
  scopeLabel,
  rangeLabel,
  freshnessLabel,
  initialIntent,
  nowIso,
  canRun = false,
  live = false,
}: {
  runs: IntelligenceRun[];
  campaigns: CampaignSummary[];
  intents: readonly { id: string; label: string; detail: string }[];
  workspaceSlug: string;
  scopeLabel: string;
  rangeLabel: string;
  freshnessLabel: string;
  initialIntent?: string;
  nowIso: string;
  /** Viewers read investigations; they do not start them. */
  canRun?: boolean;
  live?: boolean;
}) {
  const router = useRouter();
  const [intent, setIntent] = useState<string>(initialIntent ?? 'diagnose');
  const [question, setQuestion] = useState('');
  const [selected, setSelected] = useState<string[]>(['cmp_m_broad_04', 'cmp_g_high_intent']);
  const [attachBrand, setAttachBrand] = useState(true);
  const [generateCreative, setGenerateCreative] = useState(true);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const decisionCampaigns = campaigns.filter((campaign) => campaign.intelligence !== 'none');

  /**
   * Starts the run and follows it.
   *
   * The API answers as soon as the run exists, not when it finishes, so the
   * route change lands on a run page that is already streaming the fleet.
   */
  const start = async () => {
    setStarting(true);
    setProblem(null);
    try {
      const { run } = await api.post<{ run: IntelligenceRun }>(
        `/api/workspaces/${workspaceSlug}/intelligence`,
        {
          intent,
          question: question.trim() || undefined,
          campaignIds: selected,
          attachBrand,
          generateCreative,
        },
      );
      router.push(routes.run(workspaceSlug, run.id));
    } catch (error) {
      setProblem(describeError(error));
      setStarting(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Composer */}
      <section aria-labelledby="composer">
        <SectionHeading
          id="composer"
          title="Start an investigation"
          hint="Pick what you are trying to work out. The run inherits the context below."
        />

        <div className="s-panel mt-5 overflow-hidden p-0">
          <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {intents.map((entry) => {
              const active = entry.id === intent;
              return (
                <li key={entry.id} className="bg-surface">
                  <button
                    type="button"
                    onClick={() => setIntent(entry.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex h-full w-full items-start gap-3 px-4 py-4 text-left transition-colors',
                      active ? 'bg-helm-100/60' : 'bg-surface hover:bg-surface-subtle',
                    )}
                  >
                    <span className={cn('mt-[2px] shrink-0', active ? 'text-helm-600' : 'text-ink-400')}>
                      <IconIntelligence size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-medium text-ink-950">{entry.label}</span>
                      <span className="mt-0.5 block text-[12.5px] leading-[18px] text-ink-500">
                        {entry.detail}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-line px-5 py-5">
            <label htmlFor="intel-question" className="mb-2 block text-[13px] font-medium text-ink-700">
              {intent === 'custom' ? 'What do you want to know?' : 'Anything to add?'}
            </label>
            <textarea
              id="intel-question"
              rows={3}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={
                intent === 'diagnose'
                  ? 'Why did blended cost per purchase rise last week?'
                  : 'Optional. The intent above is enough to start.'
              }
              className="w-full resize-none rounded-field border border-line-strong bg-surface-sunk px-3.5 py-3 text-[15px] leading-[23px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
            />

            {/* Inherited context, adjustable without leaving the page */}
            <div className="mt-5 rounded-field border border-line bg-surface-subtle px-4 py-4">
              <p className="micro-label">Context this run will use</p>
              <dl className="mono mt-3 grid gap-x-6 gap-y-2 text-[12px] sm:grid-cols-2">
                {[
                  ['Workspace', 'Northstar Group'],
                  ['Account scope', `${scopeLabel} · 4 accounts`],
                  ['Range', rangeLabel],
                  ['Comparison', 'Previous 30 days'],
                  ['Freshness', freshnessLabel],
                  ['Currency', 'INR · Asia/Kolkata'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-line/70 py-1">
                    <dt className="text-ink-400">{label}</dt>
                    <dd className="text-right text-ink-700">{value}</dd>
                  </div>
                ))}
              </dl>

              <Disclosure summary={`Selected campaigns (${selected.length})`} className="mt-2" defaultOpen>
                <ul className="space-y-2">
                  {decisionCampaigns.map((campaign) => (
                    <li key={campaign.id}>
                      <Checkbox
                        checked={selected.includes(campaign.id)}
                        onChange={(checked) =>
                          setSelected((value) =>
                            checked ? [...value, campaign.id] : value.filter((id) => id !== campaign.id),
                          )
                        }
                        label={
                          <span className="inline-flex items-center gap-2">
                            <ProviderMark provider={campaign.provider} size={14} />
                            {campaign.name}
                          </span>
                        }
                        description={campaign.accountName}
                      />
                    </li>
                  ))}
                </ul>
              </Disclosure>

              <div className="mt-2 space-y-2 border-t border-line pt-3">
                <Checkbox
                  checked={attachBrand}
                  onChange={setAttachBrand}
                  label="Attach the Arc Bottle creative direction"
                  description="Northstar Hydration brand guidance and the approved campaign line."
                />
                <Checkbox
                  checked={generateCreative}
                  onChange={setGenerateCreative}
                  label="Let the creative director render replacement visuals"
                  description="Renders in the image studio and files the result in the library. Nothing is published to a channel."
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {canRun && live ? (
                <button
                  type="button"
                  onClick={() => void start()}
                  disabled={starting}
                  className="inline-flex h-11 items-center gap-2 rounded-control bg-action-200 px-4 text-[15px] font-medium text-action-ink transition-colors hover:bg-action-400 disabled:opacity-70"
                >
                  {starting ? 'Calling the fleet\u2026' : 'Start investigation'}
                  {starting ? (
                    <span
                      className="anim-working inline-flex h-1.5 w-1.5 rounded-full bg-action-ink"
                      aria-hidden="true"
                    />
                  ) : (
                    <IconArrowRight size={17} />
                  )}
                </button>
              ) : live ? (
                <p className="inline-flex items-center gap-2 text-[13px] text-ink-500">
                  <IconLock size={15} />
                  Starting an investigation needs the analyst role or above.
                </p>
              ) : (
                <Link
                  href={routes.run(workspaceSlug, runs[0]?.id ?? 'run_0824_cpa')}
                  className="inline-flex h-11 items-center gap-2 rounded-control bg-action-200 px-4 text-[15px] font-medium text-action-ink transition-colors hover:bg-action-400"
                >
                  Open the sample investigation
                  <IconArrowRight size={17} />
                </Link>
              )}
              <p className="text-[12.5px] text-ink-400">
                Runs continue if you navigate away. Nothing is written to your ad accounts.
              </p>
            </div>
            <div aria-live="polite" className="min-h-[20px]">
              {problem ? <p className="mt-2 text-[13px] text-bad">{problem}</p> : null}
            </div>
          </div>
        </div>
      </section>

      {/* History */}
      <section aria-labelledby="history">
        <SectionHeading
          id="history"
          title="Investigations"
          hint="Every completed run is a durable decision record with its own link."
          action={<StatusBadge tone="info">{runs.length} runs</StatusBadge>}
        />

        <ul className="s-panel mt-5 divide-y divide-line p-0">
          {runs.map((run) => {
            const activeStage = run.stages.find((stage) => stage.state === 'active');
            return (
              <li key={run.id}>
                <Link
                  href={routes.run(workspaceSlug, run.id)}
                  className="flex flex-wrap items-start gap-x-5 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-subtle sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-medium text-ink-950">{run.title}</span>
                      <StatusBadge tone={STAGE_TONE[run.stage] ?? 'neutral'}>
                        {STAGE_LABEL[run.stage] ?? run.stage}
                      </StatusBadge>
                      {run.stage === 'analyzing' ? (
                        <span className="anim-working inline-flex h-1.5 w-1.5 rounded-full bg-info" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="mt-1 block max-w-prose text-[13.5px] leading-[20px] text-ink-500">
                      {run.summary}
                    </span>
                    <span className="mono mt-1.5 block text-[11.5px] text-ink-400">
                      {run.intent} · {run.scopeLabel} · {run.rangeLabel}
                    </span>
                    {activeStage ? (
                      <span className="mono mt-1 block text-[11.5px] text-info">{activeStage.label}…</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="mono block text-[11.5px] text-ink-400">
                      {formatRelative(run.completedAt ?? run.startedAt, nowIso)}
                    </span>
                    <span className="mono block text-[11.5px] text-ink-400">{run.requestedBy}</span>
                    <span className="mono mt-1 block text-[11.5px] text-ink-400">
                      {run.findingIds.length} findings · {run.recommendationIds.length} recommendations
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
