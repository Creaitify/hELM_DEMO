'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import type { AccountGroup, AccountScope, AdAccount, Workspace } from '@/contracts';
import { AppRail } from './AppRail';
import { AgentOrb } from './AgentOrb';
import { MobileNavigation, ScopeBar } from './ScopeBar';
import { GlobalCommand } from './GlobalCommand';
import { AccountScopeCommand } from '@/components/scope/AccountScopeCommand';
import { HelmMark } from '@/components/brand/HelmMark';
import { IconCommand, IconFreshness, IconMore } from '@/components/icons';
import { Sheet } from '@/components/primitives/Overlay';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

export function AppShell({
  workspace,
  workspaces,
  accounts,
  scopes,
  groups,
  recentScopeIds,
  scopeId,
  scopeLabel,
  range,
  compare,
  rangeLabel,
  freshnessLabel,
  attentionCount,
  decisionCount,
  nowIso,
  user,
  activeRun,
  query,
  children,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
  accounts: AdAccount[];
  scopes: AccountScope[];
  groups: AccountGroup[];
  recentScopeIds: string[];
  scopeId: string;
  scopeLabel: string;
  range: string;
  compare: string;
  rangeLabel: string;
  freshnessLabel: string;
  attentionCount: number;
  decisionCount: number;
  nowIso: string;
  user: { name: string; email: string; title: string };
  /**
   * The run in flight, if there is one.
   *
   * A stage rather than a whole record, because the only thing the banner
   * needs is what it is doing — and taking the record invited the caller to
   * hand over a fixture that said "analyzing" forever.
   */
  activeRun: { id: string; title: string; stage: string } | null;
  query: string;
  children: ReactNode;
}) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const scopeAccountCount = scopes.find((scope) => scope.id === scopeId)?.accountIds.length ?? 0;

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* The rail reads the tab from the URL, so it needs its own boundary
          or the whole route below loading.tsx de-opts to client rendering. */}
      <Suspense fallback={<div className="hidden w-[228px] shrink-0 border-r border-rail-line bg-rail lg:block" />}>
        <AppRail
          workspace={workspace}
          workspaces={workspaces}
          query={query}
          attentionCount={attentionCount}
          decisionCount={decisionCount}
          user={user}
        />
      </Suspense>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur-md lg:hidden">
          <Link href={routes.briefing(workspace.slug)} aria-label="HELM — Briefing" className="shrink-0">
            <HelmMark size={24} />
          </Link>
          <div className="min-w-0 flex-1">
            {/* useSearchParams needs a boundary so prerendered routes do not bail out */}
            <Suspense fallback={<div className="h-10 rounded-control border border-line bg-surface-sunk" />}>
              <AccountScopeCommand
                accounts={accounts}
                scopes={scopes}
                groups={groups}
                recentScopeIds={recentScopeIds}
                currentScopeId={scopeId}
                nowIso={nowIso}
                workspaceSlug={workspace.slug}
              />
            </Suspense>
          </div>
          <button
            type="button"
            aria-label="More"
            onClick={() => setMoreOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line text-ink-500"
          >
            <IconMore size={18} />
          </button>
        </div>

        {/* Desktop scope bar */}
        <div className="hidden lg:block">
          <Suspense
            fallback={<div className="h-[62px] border-b border-line bg-surface" aria-hidden="true" />}
          >
            <ScopeBar
              workspace={workspace}
              accounts={accounts}
              scopes={scopes}
              groups={groups}
              recentScopeIds={recentScopeIds}
              scopeId={scopeId}
              range={range}
              compare={compare}
              freshnessLabel={freshnessLabel}
              nowIso={nowIso}
              onOpenCommand={() => setCommandOpen(true)}
            />
          </Suspense>
        </div>

        {/* Background work: named stage, navigable, never a blocking spinner */}
        {activeRun ? (
          <Link
            href={routes.run(workspace.slug, activeRun.id)}
            className="flex items-center gap-3 border-b border-info/20 bg-info-soft px-4 py-2 transition-colors hover:bg-info-soft/70 sm:px-6"
          >
            <span className="anim-working inline-flex h-2 w-2 shrink-0 rounded-full bg-info" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-700">
              <span className="font-medium text-ink-950">{activeRun.title}</span>
              {' — '}
              {activeRun.stage}
            </span>
            <span className="mono hidden shrink-0 text-[11.5px] text-ink-500 sm:block">View run</span>
          </Link>
        ) : null}

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>

        <MobileNavigation workspaceSlug={workspace.slug} query={query} />
      </div>

      <AgentOrb
        workspaceSlug={workspace.slug}
        decisionCount={decisionCount}
        activeRun={activeRun}
      />

      <GlobalCommand
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        workspaceSlug={workspace.slug}
        scopeLabel={scopeLabel}
        rangeLabel={rangeLabel}
        accountCount={scopeAccountCount}
        freshnessLabel={freshnessLabel}
      />

      {/* Settings, connections and account live in the mobile More sheet */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="space-y-1">
          {[
            { href: routes.settings(workspace.slug), label: 'Settings' },
            { href: routes.connections(workspace.slug), label: 'Connections' },
            { href: routes.library(workspace.slug), label: 'Library' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className="block rounded-control px-3 py-3.5 text-[15px] text-ink-950 transition-colors hover:bg-surface-sunk"
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              setCommandOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-control px-3 py-3.5 text-left text-[15px] text-ink-950 transition-colors hover:bg-surface-sunk"
          >
            <IconCommand size={17} />
            Investigate with HELM
          </button>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="micro-label">Workspace</p>
          <div className="mt-2 space-y-1">
            {workspaces.map((entry) => (
              <Link
                key={entry.id}
                href={routes.briefing(entry.slug)}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-control px-3 py-3 transition-colors hover:bg-surface-sunk',
                  entry.slug === workspace.slug && 'bg-helm-100/50',
                )}
              >
                <span className="text-[14.5px] text-ink-950">{entry.name}</span>
                <span className="mono text-[11.5px] text-ink-400">{entry.role}</span>
              </Link>
            ))}
          </div>
        </div>

        <p className="mono mt-5 flex items-center gap-1.5 border-t border-line pt-4 text-[11.5px] text-ink-400">
          <IconFreshness size={14} />
          {freshnessLabel}
        </p>
      </Sheet>
    </div>
  );
}

/** Consistent page container across every product route. */
export function PageShell({
  title,
  context,
  actions,
  children,
  wide = false,
  dense = false,
}: {
  title: string;
  context?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /**
   * A working surface, not a report.
   *
   * A page you read wants a title with air around it. A page you operate wants
   * the controls near the top, because every pixel the masthead takes is a
   * pixel the work does not get. Dense keeps the same heading — it is still
   * the page's name and its landmark — at the size a tool bar deserves.
   */
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6',
        wide ? 'max-w-canvas' : 'max-w-shell',
        dense ? 'py-4 sm:py-5' : 'py-6 sm:py-8',
      )}
    >
      <header
        className={cn(
          'flex flex-wrap items-end justify-between gap-x-6 border-b border-line',
          dense ? 'gap-y-2 pb-3' : 'gap-y-3 pb-5',
        )}
      >
        <div className="min-w-0">
          <h1 className={cn(dense ? 'text-section' : 'text-page', 'text-ink-950')}>{title}</h1>
          {context ? <div className={dense ? 'mt-1' : 'mt-2.5'}>{context}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className={dense ? 'mt-5' : 'mt-8'}>{children}</div>
    </div>
  );
}
