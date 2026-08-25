import type { Metadata } from 'next';
import { HelmWordmark } from '@/components/brand/HelmMark';
import { StatusBadge } from '@/components/primitives/Status';
import { OpsFleet } from '@/features/ops/OpsFleet';
import { getOps } from '@/services/http/queries';
import { NOW_ISO, auditEntries as sampleAudit, runs as sampleRuns, workspaces } from '@/services/mock';
import { formatRelative } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Ops',
  robots: { index: false, follow: false },
};

/**
 * A separately gated operator application. Not linked for ordinary members and
 * deliberately denser than the product shell. Ops vocabulary never leaks into
 * marketing or the normal workspace routes.
 */
export default async function OpsPage() {
  const live = await getOps();

  const runs = live.ok ? live.data.runs : sampleRuns.map((run) => ({ ...run, workspaceSlug: null, completedAt: run.completedAt ?? null }));
  const audit = live.ok ? live.data.audit : sampleAudit;
  const failing = runs.filter((run) => run.stage === 'blocked' || run.stage === 'failed');
  const graph = live.ok ? live.data.graph : null;

  return (
    <div className="min-h-dvh bg-night-950 px-5 py-8 text-night-ink sm:px-8">
      <main id="main" className="mx-auto max-w-[1200px]">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-night-line pb-5">
          <div className="flex flex-wrap items-center gap-5">
            <HelmWordmark tone="dark" size="sm" />
            <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-night-ink">
              Operator console
            </h1>
          </div>
          <p className="mono text-[11.5px] text-night-faint">
            Platform operators only · not linked from the product
          </p>
        </header>

        {!live.ok ? (
          <p className="mono mt-5 rounded-card border border-warn/30 bg-warn/10 px-4 py-3 text-[12px] text-night-muted">
            The HELM API is not reachable — showing the sample record. {live.error.message}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Workspaces', String(live.ok ? live.data.workspaces.length : workspaces.length)],
            ['Active runs', String(runs.filter((run) => !['complete', 'cancelled', 'failed', 'blocked'].includes(run.stage)).length)],
            ['Blocked runs', String(failing.length)],
            ['Graph nodes', graph ? String(graph.nodes) : '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-card border border-night-line bg-night-900/60 px-4 py-4">
              <p className="mono text-[10.5px] uppercase tracking-[0.12em] text-night-faint">{label}</p>
              <p className="mono mt-2 text-[24px] text-night-ink">{value}</p>
            </div>
          ))}
        </div>

        {/* Decision graph and provider configuration */}
        {live.ok ? (
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-card border border-night-line bg-night-900/60 px-4 py-4">
              <h2 className="mono text-[10.5px] uppercase tracking-[0.12em] text-night-faint">
                Decision graph
              </h2>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-night-ink">
                <span className="mono uppercase">{graph?.kind}</span>
                <StatusBadge
                  tone={graph?.ok ? 'good' : 'warn'}
                  className="border-night-line bg-transparent text-night-muted"
                >
                  {graph?.ok ? 'Healthy' : 'Degraded'}
                </StatusBadge>
              </p>
              <p className="mono mt-1 text-[11.5px] text-night-faint">{graph?.detail}</p>
              <p className="mono mt-3 text-[11.5px] text-night-muted">
                {graph?.nodes} nodes · {graph?.relationships} relationships
              </p>
              <ul className="mono mt-3 grid grid-cols-2 gap-x-5 gap-y-0.5 border-t border-night-line pt-3 text-[11px] text-night-faint">
                {Object.entries(graph?.labels ?? {})
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 12)
                  .map(([label, count]) => (
                    <li key={label} className="flex justify-between gap-3">
                      <span>{label}</span>
                      <span className="text-night-muted">{count}</span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="rounded-card border border-night-line bg-night-900/60 px-4 py-4">
              <h2 className="mono text-[10.5px] uppercase tracking-[0.12em] text-night-faint">
                Provider and model configuration
              </h2>
              <ul className="mt-3 divide-y divide-night-line">
                {live.data.providers.map((provider) => (
                  <li key={provider.key} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[13px] text-night-muted">{provider.label}</span>
                    <StatusBadge
                      tone={provider.configured ? 'good' : 'neutral'}
                      className="border-night-line bg-transparent text-night-muted"
                    >
                      {provider.configured ? 'Configured' : 'Not configured'}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
              <ul className="mono mt-3 space-y-1 border-t border-night-line pt-3 text-[11px] text-night-faint">
                {live.data.connections.map((connection) => (
                  <li key={connection.id} className="flex justify-between gap-3">
                    <span>{connection.provider}</span>
                    <span className="text-night-muted">
                      {connection.status}
                      {connection.live ? ' · live grant' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* The fleet, across every workspace */}
        {live.ok ? (
          <section className="mt-8">
            <OpsFleet snapshot={live.data.fleet} nowIso={NOW_ISO} />
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="mono text-[10.5px] uppercase tracking-[0.12em] text-night-faint">
            Cross-workspace run diagnostics
          </h2>
          <ul className="mt-3 divide-y divide-night-line rounded-card border border-night-line">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3">
                <span className="mono w-[150px] shrink-0 truncate text-[11.5px] text-night-faint">{run.id}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-night-muted">{run.title}</span>
                <StatusBadge
                  tone={run.stage === 'blocked' ? 'bad' : run.stage === 'complete' ? 'good' : 'info'}
                  className="border-night-line bg-transparent text-night-muted"
                >
                  {run.stage.replace(/_/g, ' ')}
                </StatusBadge>
                <span className="mono w-[92px] shrink-0 text-right text-[11px] text-night-faint">
                  {formatRelative(run.completedAt ?? run.startedAt, NOW_ISO)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="mono text-[10.5px] uppercase tracking-[0.12em] text-night-faint">
            Provider and sync events
          </h2>
          <ul className="mt-3 divide-y divide-night-line rounded-card border border-night-line">
            {audit.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-4 py-3">
                <span className="mono w-[104px] shrink-0 text-[11px] text-night-faint">
                  {formatRelative(entry.at, NOW_ISO)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-night-ink">
                    {entry.actor} · {entry.action}
                  </span>
                  <span className="mono block truncate text-[11px] text-night-faint">
                    {entry.target} — {entry.context}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
