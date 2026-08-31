import Link from 'next/link';
import type { AgentInvocation, AgentKey, FleetAgentHealth } from '@/contracts/fleet';
import { AGENT_ORDER } from '@/contracts/fleet';
import { StatusBadge } from '@/components/primitives/Status';
import { SectionHeading } from '@/components/primitives/States';
import { Disclosure } from '@/components/primitives/Controls';
import { IconEvidence, IconIntelligence, IconScope, IconSpark } from '@/components/icons';
import { formatRelative } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

/**
 * The fleet, and whether it is actually working.
 *
 * This used to be a cast list with a note saying live state belonged on the
 * run. That was the wrong call for the page the navigation calls Agent Fleet:
 * it meant four paragraphs of description with no evidence any of them had
 * ever run, sitting underneath ten runs they had in fact produced. The health
 * was in the API the whole time and thrown away at the component boundary.
 *
 * So each specialist now carries what it has actually done — how many times it
 * has been called, how often its work cleared the review gate first time, how
 * long it takes, and when it last ran — and says so when it is working right
 * now. The description and the gate are still here, one disclosure down, for
 * somebody meeting the fleet for the first time.
 */

const KIND_ICON = {
  retrieval: IconScope,
  reasoning: IconIntelligence,
  planning: IconEvidence,
  generative: IconSpark,
} as const;

/** Latency reads in the unit the number actually lives in. */
function latency(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function FleetRoster({
  agents,
  powering,
  mode,
  invocations = [],
  activeRunId,
  activeSummary,
  workspaceSlug,
  nowIso,
}: {
  agents: FleetAgentHealth[];
  powering: { label: string; value: string; note: string }[];
  mode: { reasoning: 'anthropic' | 'scripted'; images: string };
  /** The work log. The most recent calls, newest first. */
  invocations?: AgentInvocation[];
  activeRunId?: string | null;
  activeSummary?: string | null;
  workspaceSlug: string;
  nowIso: string;
}) {
  const ordered = AGENT_ORDER.map((key) => agents.find((agent) => agent.key === key)).filter(
    Boolean,
  ) as FleetAgentHealth[];

  const working = new Set(
    invocations.filter((entry) => entry.status === 'running' || entry.status === 'review').map((entry) => entry.agent),
  );

  const nameOf = (key: AgentKey) => agents.find((agent) => agent.key === key)?.name ?? key;
  const totalRuns = ordered.reduce((sum, agent) => sum + agent.runs, 0);

  return (
    <section aria-labelledby="roster" className="scroll-mt-24">
      <SectionHeading
        id="roster"
        title="The fleet"
        hint="Four specialists, called in a fixed order. HELM holds a review gate after each one, and a specialist never grades its own work."
        action={
          <div className="flex items-center gap-2">
            {activeRunId ? (
              <StatusBadge tone="warn">Working now</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Idle</StatusBadge>
            )}
            <StatusBadge tone={mode.reasoning === 'anthropic' ? 'good' : 'neutral'}>
              {mode.reasoning === 'anthropic' ? 'Model reasoning' : 'Sample reasoning'}
            </StatusBadge>
          </div>
        }
      />

      {/* What the fleet is doing this second, when it is doing anything. */}
      {activeRunId ? (
        <Link
          href={routes.run(workspaceSlug, activeRunId)}
          className="s-panel mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-l-action-400 px-5 py-3.5 transition-colors hover:bg-surface-subtle"
        >
          <span className="anim-working h-2 w-2 shrink-0 rounded-full bg-action-400" aria-hidden="true" />
          <span className="text-[13.5px] font-medium text-ink-950">A run is in flight</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink-500">{activeSummary ?? 'Working'}</span>
          <span className="mono shrink-0 text-[11.5px] text-helm-600">Watch it →</span>
        </Link>
      ) : null}

      <ol className="s-panel mt-5 grid gap-px overflow-hidden bg-line p-0 sm:grid-cols-2 xl:grid-cols-4">
        {ordered.map((agent) => {
          const Icon = KIND_ICON[agent.kind];
          const busy = working.has(agent.key);
          return (
            <li key={agent.key} className="bg-surface px-5 py-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="mono text-[11px] text-ink-400">
                    {String(agent.order).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-control border transition-colors',
                      busy
                        ? 'border-action-400 bg-action-200/40 text-ink-950'
                        : 'border-line bg-surface-subtle text-ink-500',
                    )}
                  >
                    <Icon size={15} />
                  </span>
                </div>
                {busy ? (
                  <span className="mono inline-flex items-center gap-1.5 text-[10.5px] text-ink-950">
                    <span className="anim-working h-1.5 w-1.5 rounded-full bg-action-400" aria-hidden="true" />
                    Working
                  </span>
                ) : agent.runs === 0 ? (
                  <span className="mono text-[10.5px] text-ink-400">Never called</span>
                ) : null}
              </div>

              <p className="mt-3 text-[14.5px] font-medium text-ink-950">{agent.name}</p>
              <p className="mono mt-0.5 text-[11.5px] text-ink-400">{agent.role}</p>

              {/*
                What it has actually done. A pass rate is the number worth
                having: it is how often this specialist's work cleared the gate
                without being sent back, which is the only measure of it that
                does not depend on the specialist's own opinion.
              */}
              <dl className="mono mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3 text-[11px]">
                <div>
                  <dt className="text-ink-400">Calls</dt>
                  <dd data-metric className="mt-0.5 text-[13px] font-medium text-ink-950">
                    {agent.runs}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-400">Cleared first time</dt>
                  <dd
                    data-metric
                    className={cn(
                      'mt-0.5 text-[13px] font-medium',
                      agent.passRate === null
                        ? 'text-ink-400'
                        : agent.passRate >= 0.9
                          ? 'text-good'
                          : agent.passRate >= 0.6
                            ? 'text-warn'
                            : 'text-bad',
                    )}
                  >
                    {agent.passRate === null ? '—' : `${Math.round(agent.passRate * 100)}%`}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-400">Typical time</dt>
                  <dd data-metric className="mt-0.5 text-[13px] font-medium text-ink-950">
                    {latency(agent.avgLatencyMs)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-400">Last called</dt>
                  <dd className="mt-0.5 text-[12px] text-ink-700">
                    {agent.lastRunAt ? formatRelative(agent.lastRunAt, nowIso) : 'Never'}
                  </dd>
                </div>
              </dl>

              <p className="mono mt-3 truncate border-t border-line pt-2.5 text-[10.5px] text-ink-400" title={agent.model}>
                {agent.model}
              </p>

              <Disclosure summary="What it does" className="mt-1">
                <p className="text-[12.5px] leading-[18px] text-ink-500">{agent.summary}</p>
                <p className="mono mt-2.5 text-[11px] leading-[16px] text-ink-400">
                  <span className="uppercase tracking-[0.1em]">Gate</span>
                  <br />
                  {agent.gate}
                </p>
                <p className="mt-2 text-[11.5px] leading-[16px] text-ink-400">{agent.setting}</p>
              </Disclosure>
            </li>
          );
        })}
      </ol>

      {/*
        The work log. Every call the fleet has made, with the verdict the gate
        returned — including the ones it sent back, which is the part that shows
        the review is real rather than decorative.
      */}
      {invocations.length ? (
        <div className="s-panel mt-4 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="micro-label">Recent calls</p>
            <p className="mono text-[11px] text-ink-400">
              {totalRuns} in total across the fleet
            </p>
          </div>
          <ol className="mt-3 divide-y divide-line">
            {invocations.slice(0, 8).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="mono w-[92px] shrink-0 text-[11px] text-ink-400">
                  {formatRelative(entry.startedAt, nowIso)}
                </span>
                <span className="min-w-0 flex-1 text-[13px] text-ink-950">
                  {nameOf(entry.agent)}
                  {entry.revision > 1 ? (
                    <span className="mono ml-2 text-[11px] text-warn">revision {entry.revision}</span>
                  ) : null}
                  {entry.note ? (
                    <span className="ml-2 text-[12px] text-ink-500">{entry.note}</span>
                  ) : null}
                </span>
                {entry.latencyMs ? (
                  <span className="mono shrink-0 text-[11px] text-ink-400">{latency(entry.latencyMs)}</span>
                ) : null}
                <StatusBadge
                  tone={
                    entry.status === 'failed'
                      ? 'bad'
                      : entry.status === 'revised'
                        ? 'warn'
                        : entry.status === 'passed'
                          ? 'good'
                          : 'neutral'
                  }
                >
                  {entry.status}
                </StatusBadge>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {powering.length ? (
        <div className="s-panel-subtle mt-4 px-5 py-4">
          <p className="micro-label">What is powering the fleet</p>
          <ul className="mono mt-2.5 grid gap-x-8 gap-y-2 text-[11.5px] sm:grid-cols-2">
            {powering.map((entry) => (
              <li key={entry.label} className="border-b border-line/70 pb-2">
                <span className="flex justify-between gap-4">
                  <span className="text-ink-400">{entry.label}</span>
                  <span className="text-right text-ink-700">{entry.value}</span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-[16px] text-ink-400">{entry.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
