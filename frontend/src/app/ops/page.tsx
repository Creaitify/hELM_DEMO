import type { Metadata } from 'next';
import { HelmWordmark } from '@/components/brand/HelmMark';
import { StatusBadge } from '@/components/primitives/Status';
import { NOW_ISO, auditEntries, runs, workspaces } from '@/services/mock';
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
export default function OpsPage() {
  const failing = runs.filter((run) => run.stage === 'blocked' || run.stage === 'failed');

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

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Workspaces', String(workspaces.length)],
            ['Active runs', String(runs.filter((run) => run.stage === 'analyzing').length)],
            ['Blocked runs', String(failing.length)],
            ['Provider incidents', '1'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-card border border-night-line bg-night-900/60 px-4 py-4">
              <p className="mono text-[10.5px] uppercase tracking-[0.12em] text-night-faint">{label}</p>
              <p className="mono mt-2 text-[24px] text-night-ink">{value}</p>
            </div>
          ))}
        </div>

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
            {auditEntries.map((entry) => (
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
