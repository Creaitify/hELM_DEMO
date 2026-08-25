'use client';

import { useEffect, useState } from 'react';
import type { FleetEvent, FleetSnapshot } from '@/contracts/fleet';
import { StatusBadge } from '@/components/primitives/Status';
import { formatRelative } from '@/lib/format';

/**
 * The fleet, seen from the operator side.
 *
 * The product surface answers "what is HELM doing about my account". This one
 * answers "is the fleet healthy": per-agent throughput, latency, and the
 * proportion of outputs that cleared their review gate, plus a live tail of
 * every run in the process.
 */
export function OpsFleet({ snapshot, nowIso }: { snapshot: FleetSnapshot; nowIso: string }) {
  const [tail, setTail] = useState<FleetEvent[]>([]);

  useEffect(() => {
    const source = new EventSource('/api/ops/stream', { withCredentials: true });
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as FleetEvent;
        setTail((current) => [event, ...current].slice(0, 40));
      } catch {
        /* ignore a malformed frame */
      }
    };
    return () => source.close();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="mono text-[10.5px] uppercase tracking-[0.12em] text-night-faint">Agent fleet</h2>
        {snapshot.activeSummary ? (
          <p className="mono flex items-center gap-2 text-[11.5px] text-night-muted">
            <span className="anim-working inline-flex h-1.5 w-1.5 rounded-full bg-info" aria-hidden="true" />
            {snapshot.activeSummary}
            {snapshot.activeProgress !== null ? ` · ${snapshot.activeProgress}%` : ''}
          </p>
        ) : (
          <p className="mono text-[11.5px] text-night-faint">Idle</p>
        )}
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.agents.map((agent) => (
          <li key={agent.key} className="rounded-card border border-night-line bg-night-900/60 px-4 py-4">
            <p className="flex items-center justify-between gap-2">
              <span className="text-[13.5px] font-medium text-night-ink">{agent.name}</span>
              {agent.live ? (
                <span className="anim-working inline-flex h-1.5 w-1.5 rounded-full bg-info" aria-hidden="true" />
              ) : null}
            </p>
            <p className="mono mt-0.5 text-[11px] text-night-faint">{agent.model}</p>
            <dl className="mono mt-3 space-y-1 text-[11.5px]">
              {[
                ['Runs', String(agent.runs)],
                ['Avg latency', agent.avgLatencyMs === null ? '—' : `${(agent.avgLatencyMs / 1000).toFixed(1)}s`],
                ['Gate pass rate', agent.passRate === null ? '—' : `${Math.round(agent.passRate * 100)}%`],
                ['Last run', agent.lastRunAt ? formatRelative(agent.lastRunAt, nowIso) : 'Never'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-night-faint">{label}</dt>
                  <dd className="text-night-muted">{value}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-night-line bg-night-900/60 px-4 py-4">
          <h3 className="mono text-[10.5px] uppercase tracking-[0.12em] text-night-faint">
            Recent invocations
          </h3>
          <ul className="mt-3 divide-y divide-night-line">
            {snapshot.invocations.slice(0, 12).map((invocation) => (
              <li key={invocation.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <span className="mono w-[92px] shrink-0 text-[11px] text-night-muted">{invocation.agent}</span>
                <StatusBadge
                  tone={invocation.verdict === 'passed' ? 'good' : invocation.verdict ? 'bad' : 'info'}
                  className="border-night-line bg-transparent text-night-muted"
                >
                  {invocation.verdict ?? invocation.status}
                </StatusBadge>
                <span className="mono w-[46px] shrink-0 text-[11px] text-night-faint">
                  r{invocation.revision}
                </span>
                <span className="mono w-[56px] shrink-0 text-[11px] text-night-faint">
                  {invocation.latencyMs ? `${(invocation.latencyMs / 1000).toFixed(1)}s` : '—'}
                </span>
                <span className="mono w-[46px] shrink-0 text-[11px] text-night-faint">
                  {invocation.qualityScore === undefined ? '—' : `${Math.round(invocation.qualityScore * 100)}`}
                </span>
                <span className="mono w-[46px] shrink-0 text-[11px] text-night-faint">
                  {invocation.groundingScore === undefined
                    ? '—'
                    : `${Math.round(invocation.groundingScore * 100)}`}
                </span>
                <span className="mono ml-auto shrink-0 text-[11px] text-night-faint">
                  {formatRelative(invocation.startedAt, nowIso)}
                </span>
              </li>
            ))}
            {snapshot.invocations.length === 0 ? (
              <li className="py-3 text-[12.5px] text-night-faint">
                No invocations yet. Start an investigation in any workspace.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-card border border-night-line bg-night-900/60 px-4 py-4">
          <h3 className="mono text-[10.5px] uppercase tracking-[0.12em] text-night-faint">
            Live event tail
          </h3>
          <ul className="mono mt-3 max-h-[300px] space-y-1 overflow-y-auto text-[11px]">
            {tail.map((event, index) => (
              <li key={`${event.at}-${index}`} className="flex gap-3 text-night-faint">
                <span className="w-[64px] shrink-0">{event.at.slice(11, 19)}</span>
                <span className="w-[120px] shrink-0 truncate text-night-muted">{event.type}</span>
                <span className="min-w-0 flex-1 truncate">{event.runId}</span>
              </li>
            ))}
            {tail.length === 0 ? <li className="text-night-faint">Waiting for fleet activity…</li> : null}
          </ul>
        </div>
      </div>

      {snapshot.powering.length ? (
        <ul className="mono grid gap-x-8 gap-y-1.5 rounded-card border border-night-line bg-night-900/60 px-4 py-4 text-[11.5px] sm:grid-cols-2">
          {snapshot.powering.map((entry) => (
            <li key={entry.label} className="flex justify-between gap-4 border-b border-night-line pb-1.5">
              <span className="text-night-faint">{entry.label}</span>
              <span className="truncate text-right text-night-muted" title={entry.note}>
                {entry.value}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
