'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AdAccount } from '@/contracts';
import {
  IconArrowRight,
  IconBriefing,
  IconCampaigns,
  IconConnection,
  IconEvidence,
  IconIntelligence,
  IconLibrary,
  IconSearch,
  IconSettings,
  IconSpark,
} from '@/components/icons';
import { useAgent } from '@/features/agent/AgentProvider';
import { INTENTS } from '@/services/mock/intelligence';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { useScrollLock } from '@/lib/scroll-lock';

/**
 * One place to type at.
 *
 * This used to be a form for starting an investigation, which meant the only
 * thing ⌘K could do was the one thing you were least likely to want at any
 * given moment. Everything else — going to a campaign, checking a connection,
 * asking a question — was a trip through the rail.
 *
 * Now it is the spine: navigation, accounts, investigations and the agent all
 * answer to the same field, ranked by what you typed. The rail is still there
 * for people who want to point at things, but nobody has to.
 *
 * The matcher is a subsequence test with a small score, not a fuzzy-search
 * dependency. On a list this size the difference is unmeasurable, and it keeps
 * a keystroke-latency path free of a library.
 */

const RECENTS_KEY = 'helm.command.recents';
const MAX_RECENTS = 4;

type Command = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  keywords?: string;
  run: () => void;
};

/**
 * Subsequence match with a bias toward prefixes and word starts.
 * Returns null when the query does not appear at all.
 */
function score(haystack: string, needle: string): number | null {
  if (!needle) return 0;
  const text = haystack.toLowerCase();
  const query = needle.toLowerCase();

  if (text.startsWith(query)) return 1000;
  const direct = text.indexOf(query);
  if (direct === 0) return 900;
  if (direct > 0) return 700 - direct;

  // Fall back to letters in order, rewarding runs and word beginnings.
  let cursor = 0;
  let points = 0;
  let streak = 0;
  for (const character of query) {
    const found = text.indexOf(character, cursor);
    if (found === -1) return null;
    streak = found === cursor ? streak + 1 : 0;
    points += streak * 4;
    if (found === 0 || text[found - 1] === ' ' || text[found - 1] === '/') points += 8;
    cursor = found + 1;
  }
  return points;
}

export function GlobalCommand({
  open,
  onClose,
  workspaceSlug,
  scopeLabel,
  rangeLabel,
  accountCount,
  freshnessLabel,
  accounts = [],
}: {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  scopeLabel: string;
  rangeLabel: string;
  accountCount: number;
  freshnessLabel: string;
  accounts?: AdAccount[];
}) {
  const router = useRouter();
  const { ask } = useAgent();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    inputRef.current?.focus();
    try {
      const raw = window.localStorage.getItem(RECENTS_KEY);
      setRecents(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setRecents([]);
    }
  }, [open]);

  /* Background does not scroll while the palette owns the screen. */
  useScrollLock(open);

  const remember = (id: string) => {
    try {
      const next = [id, ...recents.filter((entry) => entry !== id)].slice(0, MAX_RECENTS);
      window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      // A palette that forgets what you used last is still a working palette.
    }
  };

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };

    const navigation: Command[] = [
      {
        id: 'nav:briefing',
        label: 'Briefing',
        hint: 'What needs you this morning',
        group: 'Go to',
        icon: <IconBriefing size={16} />,
        keywords: 'home dashboard today',
        run: go(routes.briefing(workspaceSlug)),
      },
      {
        id: 'nav:campaigns',
        label: 'Campaigns',
        hint: 'Every campaign in scope',
        group: 'Go to',
        icon: <IconCampaigns size={16} />,
        keywords: 'ads adsets performance table',
        run: go(routes.campaigns(workspaceSlug)),
      },
      {
        id: 'nav:intelligence',
        label: 'Agent Fleet',
        hint: 'Runs, findings and decisions',
        group: 'Go to',
        icon: <IconIntelligence size={16} />,
        keywords: 'runs investigations agents fleet',
        run: go(routes.intelligence(workspaceSlug)),
      },
      {
        id: 'nav:studio',
        label: 'Studio',
        hint: 'Make creative from a finding',
        group: 'Go to',
        icon: <IconSpark size={16} />,
        keywords: 'image creative generate',
        run: go(routes.studio(workspaceSlug)),
      },
      {
        id: 'nav:library',
        label: 'Assets',
        hint: 'Everything the fleet has made',
        group: 'Go to',
        icon: <IconLibrary size={16} />,
        keywords: 'library images',
        run: go(routes.library(workspaceSlug)),
      },
      {
        id: 'nav:documents',
        label: 'Documents',
        hint: 'Memos and exports',
        group: 'Go to',
        icon: <IconEvidence size={16} />,
        keywords: 'memo report pdf',
        run: go(routes.documents(workspaceSlug)),
      },
      {
        id: 'nav:connections',
        label: 'Integrations',
        hint: 'Connected ad accounts',
        group: 'Go to',
        icon: <IconConnection size={16} />,
        keywords: 'connections google meta sync',
        run: go(routes.connections(workspaceSlug)),
      },
      {
        id: 'nav:settings',
        label: 'Settings',
        group: 'Go to',
        icon: <IconSettings size={16} />,
        keywords: 'team activity brand preferences',
        run: go(routes.settings(workspaceSlug)),
      },
    ];

    const accountCommands: Command[] = accounts.slice(0, 12).map((account) => ({
      id: `account:${account.id}`,
      label: account.name,
      hint: `${account.provider === 'google_ads' ? 'Google Ads' : 'Meta Ads'} · ${account.nativeId}`,
      group: 'Accounts',
      icon: <IconConnection size={16} />,
      keywords: `${account.nativeId} ${account.parentLabel ?? ''}`,
      run: go(routes.connections(workspaceSlug)),
    }));

    const investigations: Command[] = INTENTS.map((intent) => ({
      id: `intent:${intent.id}`,
      label: intent.label,
      hint: intent.detail,
      group: 'Start an investigation',
      icon: <IconIntelligence size={16} />,
      run: go(`${routes.intelligence(workspaceSlug)}?intent=${intent.id}`),
    }));

    return [...navigation, ...accountCommands, ...investigations];
  }, [accounts, onClose, router, workspaceSlug]);

  /* Anything typed is also a question you can just ask. */
  const askCommand = useMemo<Command | null>(() => {
    const asked = query.trim();
    if (asked.length < 3) return null;
    return {
      id: 'ask',
      label: `Ask HELM: “${asked}”`,
      hint: 'Reads the workspace and answers here',
      group: 'Ask',
      icon: <IconSpark size={16} />,
      run: () => {
        onClose();
        ask(asked);
      },
    };
  }, [ask, onClose, query]);

  const results = useMemo(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      const recentSet = recents
        .map((id) => commands.find((command) => command.id === id))
        .filter((command): command is Command => Boolean(command))
        .map((command) => ({ ...command, group: 'Recent' }));

      const seen = new Set(recentSet.map((command) => command.id));
      return [...recentSet, ...commands.filter((command) => !seen.has(command.id))];
    }

    const ranked = commands
      .map((command) => ({
        command,
        rank: score(`${command.label} ${command.keywords ?? ''}`, trimmed),
      }))
      .filter((entry): entry is { command: Command; rank: number } => entry.rank !== null)
      .sort((a, b) => b.rank - a.rank)
      .map((entry) => entry.command);

    return askCommand ? [...ranked, askCommand] : ranked;
  }, [askCommand, commands, query, recents]);

  useEffect(() => setCursor(0), [query]);

  /* Keep the highlighted row inside the scroll port as the cursor moves. */
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor, open, results.length]);

  if (!open || typeof document === 'undefined') return null;

  const runAt = (index: number) => {
    const command = results[index];
    if (!command) return;
    if (command.id !== 'ask') remember(command.id);
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => (results.length ? (value + 1) % results.length : 0));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => (results.length ? (value - 1 + results.length) % results.length : 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      runAt(cursor);
    }
  };

  let lastGroup = '';

  return createPortal(
    <div className="fixed inset-0 z-[115] flex items-start justify-center p-0 pt-0 sm:p-6 sm:pt-[10vh]">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="anim-scrim absolute inset-0 cursor-default bg-canvas/55 backdrop-blur-2xl"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="anim-console relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-surface shadow-console sm:max-h-[560px] sm:max-w-[620px] sm:rounded-editorial"
      >
        <div className="relative shrink-0 border-b border-line">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400">
            <IconSearch size={17} />
          </span>
          <label htmlFor="global-command" className="sr-only">
            Search, navigate, or ask
          </label>
          <input
            id="global-command"
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Go somewhere, start something, or just ask"
            autoComplete="off"
            spellCheck={false}
            className="h-14 w-full bg-transparent pl-11 pr-4 text-[16px] text-ink-950 outline-none placeholder:text-ink-400"
          />
        </div>

        <ul ref={listRef} className="thin-scrollbar min-h-0 flex-1 overflow-y-auto py-2">
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center">
              <p className="text-[14px] text-ink-500">Nothing matches “{query}”.</p>
              <p className="mono mt-1 text-[11.5px] text-ink-400">
                Type at least three characters to ask HELM instead.
              </p>
            </li>
          ) : (
            results.map((command, index) => {
              const newGroup = command.group !== lastGroup;
              lastGroup = command.group;
              const active = index === cursor;

              return (
                <li key={command.id}>
                  {newGroup ? (
                    <p className="micro-label px-4 pb-1 pt-3 first:pt-1">{command.group}</p>
                  ) : null}
                  <button
                    type="button"
                    data-index={index}
                    onMouseMove={() => setCursor(index)}
                    onClick={() => runAt(index)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75',
                      active ? 'bg-helm-50' : 'hover:bg-surface-subtle',
                    )}
                  >
                    <span className={cn('shrink-0', active ? 'text-action-deep' : 'text-ink-400')}>
                      {command.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] text-ink-950">{command.label}</span>
                      {command.hint ? (
                        <span className="block truncate text-[12px] text-ink-500">{command.hint}</span>
                      ) : null}
                    </span>
                    {active ? (
                      <span className="shrink-0 text-action-deep">
                        <IconArrowRight size={15} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <footer className="safe-b flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-surface-subtle px-4 py-2.5">
          <p className="mono truncate text-[11px] text-ink-400">
            {scopeLabel} · {accountCount} {accountCount === 1 ? 'account' : 'accounts'} · {rangeLabel} ·{' '}
            {freshnessLabel}
          </p>
          <p className="mono flex shrink-0 items-center gap-2 text-[11px] text-ink-400">
            <span>↑↓ move</span>
            <span>⏎ open</span>
            <span>esc close</span>
          </p>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
