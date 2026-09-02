'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { AccountGroup, AdAccount, AccountScope } from '@/contracts';
import { ProviderMark, IconChevronDown, IconPlus, IconSearch, IconWarning } from '@/components/icons';
import { Button } from '@/components/primitives/Button';
import { SyncBadge } from '@/components/primitives/Status';
import { Sheet } from '@/components/primitives/Overlay';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';

/**
 * Account scope is a frequent analytic control, deliberately unlike the
 * workspace switcher. Checking rows edits a local draft; Apply commits one
 * resolved scope and causes exactly one atomic data refresh.
 */
export function AccountScopeCommand({
  accounts,
  scopes,
  groups,
  recentScopeIds,
  currentScopeId,
  nowIso,
  workspaceSlug,
}: {
  accounts: AdAccount[];
  scopes: AccountScope[];
  groups: AccountGroup[];
  recentScopeIds: string[];
  currentScopeId: string;
  nowIso: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * A workspace with nothing connected has no scope to be in.
   *
   * `scopes[0]` is undefined there, and every read of `current` below threw —
   * taking the whole shell down with it, because this control renders in the
   * bar above every screen. A workspace someone has just created is the most
   * ordinary state there is, so the empty case is a label rather than a crash:
   * there is nothing to switch between until an account is connected, and the
   * control says so instead of offering a picker over an empty list.
   */
  const current = scopes.find((scope) => scope.id === currentScopeId) ?? scopes[0] ?? null;
  /*
   * Memoised because the empty fallback is a fresh array on every render, and
   * `dirty` below compares against it — without this the comparison re-runs on
   * every keystroke in the search field for a value that has not changed.
   */
  const currentAccountIds = useMemo(() => current?.accountIds ?? [], [current]);
  const currentLabel = current?.label ?? 'No accounts connected';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string[]>(currentAccountIds);
  const [committing, setCommitting] = useState<string | null>(null);

  const googleAccounts = accounts.filter((account) => account.provider === 'google_ads');
  const metaAccounts = accounts.filter((account) => account.provider === 'meta_ads');

  const matches = (account: AdAccount) => {
    if (!query.trim()) return true;
    const needle = query.toLowerCase();
    return (
      account.name.toLowerCase().includes(needle) ||
      account.nativeId.toLowerCase().includes(needle) ||
      (account.parentLabel ?? '').toLowerCase().includes(needle)
    );
  };

  const dirty = useMemo(() => {
    const a = [...draft].sort().join('|');
    const b = [...currentAccountIds].sort().join('|');
    return a !== b;
  }, [draft, currentAccountIds]);

  /** The frontend preflights the obvious cases; the backend stays authoritative. */
  const compatibility = useMemo(() => {
    const selected = accounts.filter((account) => draft.includes(account.id));
    const currencies = new Set(selected.map((account) => account.currency));
    const zones = new Set(selected.map((account) => account.timeZone));
    const reasons: string[] = [];
    if (currencies.size > 1) reasons.push(`Mixed currencies: ${[...currencies].join(', ')}`);
    if (zones.size > 1) reasons.push(`Mixed reporting days: ${[...zones].join(', ')}`);
    return reasons;
  }, [accounts, draft]);

  const openCommand = () => {
    setDraft(currentAccountIds);
    setQuery('');
    setOpen(true);
  };

  const resolveScopeId = (ids: string[]): string => {
    const key = [...ids].sort().join('|');
    const match = scopes.find((scope) => [...scope.accountIds].sort().join('|') === key);
    return match?.id ?? 'scp_staged_selection';
  };

  const applyScope = (ids: string[]) => {
    const nextScope = resolveScopeId(ids);
    setCommitting(currentLabel);
    const params = new URLSearchParams(searchParams.toString());
    params.set('scope', nextScope);
    setOpen(false);
    router.push(`${pathname}?${params.toString()}`);
    window.setTimeout(() => setCommitting(null), 420);
  };

  const toggle = (id: string) => {
    setDraft((value) => (value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id]));
  };

  const draftAccounts = accounts.filter((account) => draft.includes(account.id));
  const providersInDraft = new Set(draftAccounts.map((account) => account.provider));
  const currentAccounts = accounts.filter((account) => currentAccountIds.includes(account.id));
  const currentProviders = new Set(currentAccounts.map((account) => account.provider));
  const attention = currentAccounts.filter((account) => account.health.state !== 'fresh').length;

  /**
   * The currency the scope actually reports in, read from the accounts in it.
   *
   * This line said INR for every workspace regardless of what its accounts
   * were denominated in — so a GBP workspace announced Indian rupees directly
   * above figures that were pounds. Scopes that mix currencies cannot be
   * blended at all (the check above refuses them), so a single name is always
   * the right answer when there is one.
   */
  const currencies = [...new Set(currentAccounts.map((account) => account.currency))];
  const currencyLabel = currencies.length === 1 ? ` · ${currencies[0]}` : '';

  return (
    <>
      <button
        type="button"
        onClick={openCommand}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'group flex h-10 max-w-full items-center gap-2.5 rounded-control border border-line-strong bg-surface px-3 text-left transition-colors duration-[110ms] hover:border-ink-400/70 hover:bg-surface-subtle',
          committing && 'opacity-70',
        )}
      >
        <span className="flex shrink-0 -space-x-1">
          {currentProviders.has('google_ads') ? <ProviderMark provider="google_ads" size={16} /> : null}
          {currentProviders.has('meta_ads') ? <ProviderMark provider="meta_ads" size={16} /> : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium leading-tight text-ink-950">
            {committing ? `Updating from ${committing}…` : currentLabel}
          </span>
          <span className="mono block truncate text-[10.5px] leading-tight text-ink-400">
            {currentAccountIds.length} accounts{currencyLabel}
            {attention > 0 ? ` · ${attention} needs attention` : ''}
          </span>
        </span>
        <span className="shrink-0 text-ink-400">
          <IconChevronDown size={16} />
        </span>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Account scope"
        description="Check the accounts to include, then apply once."
        className="sm:mx-auto sm:mb-6 sm:max-w-[580px] sm:rounded-card"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] text-ink-700">
                {draft.length} selected
                {compatibility.length > 0 ? ' · cannot be blended' : ''}
              </p>
              {compatibility.length > 0 ? (
                <p className="mt-0.5 text-[11.5px] text-warn">{compatibility.join(' · ')}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="quiet" size="compact" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="indigo"
                size="compact"
                disabled={!dirty || draft.length === 0}
                onClick={() => applyScope(draft)}
              >
                Apply scope
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="relative">
            <label htmlFor="scope-search" className="sr-only">
              Search accounts and groups
            </label>
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
              <IconSearch size={17} />
            </span>
            <input
              id="scope-search"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search accounts and groups"
              className="h-11 w-full rounded-field border border-line-strong bg-surface-sunk pl-10 pr-3.5 text-[15px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
            />
          </div>

          {!query.trim() ? (
            <>
              <section>
                <p className="micro-label">Recent scopes</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recentScopeIds.map((id) => {
                    const scope = scopes.find((entry) => entry.id === id);
                    if (!scope) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => applyScope(scope.accountIds)}
                        className="rounded-full border border-line bg-surface-subtle px-3 py-1.5 text-[12.5px] text-ink-700 transition-colors hover:border-line-strong hover:text-ink-950"
                      >
                        {scope.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <p className="micro-label">Saved account groups</p>
                <ul className="mt-2 space-y-1.5">
                  {groups.map((group) => (
                    <li key={group.id}>
                      <button
                        type="button"
                        onClick={() => setDraft(group.accountIds)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-control border px-3 py-2.5 text-left transition-colors',
                          [...group.accountIds].sort().join('|') === [...draft].sort().join('|')
                            ? 'border-helm-500 bg-helm-100/50'
                            : 'border-line hover:border-line-strong hover:bg-surface-subtle',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-ink-950">
                            {group.label}
                          </span>
                          <span className="block truncate text-[11.5px] text-ink-400">
                            Created by {group.createdBy}
                          </span>
                        </span>
                        <span className="mono shrink-0 text-[11.5px] text-ink-500">
                          {group.accountIds.length} accounts
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}

          <AccountGroupList
            label="Google Ads accounts"
            provider="google_ads"
            accounts={googleAccounts.filter(matches)}
            draft={draft}
            onToggle={toggle}
            nowIso={nowIso}
          />
          <AccountGroupList
            label="Meta Ads accounts"
            provider="meta_ads"
            accounts={metaAccounts.filter(matches)}
            draft={draft}
            onToggle={toggle}
            nowIso={nowIso}
          />

          {providersInDraft.size > 1 && compatibility.length === 0 ? (
            <p className="rounded-control bg-good-soft px-3 py-2 text-[12.5px] text-good">
              These accounts share INR and an Asia/Kolkata reporting day, so they can be blended.
            </p>
          ) : null}

          {compatibility.length > 0 ? (
            <div className="flex items-start gap-2.5 rounded-control bg-warn-soft px-3 py-2.5">
              <span className="mt-[2px] shrink-0 text-warn">
                <IconWarning size={16} />
              </span>
              <p className="text-[12.5px] leading-[19px] text-ink-700">
                HELM will show these accounts side by side rather than producing a blended total. A combined
                figure needs a named exchange-rate basis, which this workspace does not have.
              </p>
            </div>
          ) : null}

          <section className="border-t border-line pt-4">
            <p className="micro-label">Connections</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="neutral"
                size="compact"
                leading={<IconPlus size={16} />}
                onClick={() => {
                  setOpen(false);
                  router.push(routes.connections(workspaceSlug));
                }}
              >
                Connect another source
              </Button>
              <Button
                variant="quiet"
                size="compact"
                onClick={() => {
                  setOpen(false);
                  router.push(routes.connections(workspaceSlug));
                }}
              >
                Manage connections
              </Button>
            </div>
          </section>
        </div>
      </Sheet>
    </>
  );
}

function AccountGroupList({
  label,
  provider,
  accounts,
  draft,
  onToggle,
  nowIso,
}: {
  label: string;
  provider: 'google_ads' | 'meta_ads';
  accounts: AdAccount[];
  draft: string[];
  onToggle: (id: string) => void;
  nowIso: string;
}) {
  if (accounts.length === 0) return null;

  return (
    <section>
      <p className="micro-label flex items-center gap-2">
        <ProviderMark provider={provider} size={14} />
        {label}
      </p>
      <ul className="mt-2 divide-y divide-line rounded-control border border-line">
        {accounts.map((account) => {
          const checked = draft.includes(account.id);
          return (
            <li key={account.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-3 transition-colors hover:bg-surface-subtle">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(account.id)}
                  className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-[color:var(--helm-500)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink-950">{account.name}</span>
                  <span className="mono block truncate text-[11px] text-ink-400">
                    {account.nativeId} · {account.currency} · {account.timeZone}
                  </span>
                  {account.parentLabel ? (
                    <span className="block truncate text-[11px] text-ink-400">{account.parentLabel}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <SyncBadge state={account.health.state} />
                  <span className="mono text-[10.5px] text-ink-400">
                    {formatRelative(account.lastSyncedAt, nowIso)}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
