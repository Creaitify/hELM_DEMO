'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdAccount, Connection, ConnectorDefinition, ProviderKey } from '@/contracts';
import { Button } from '@/components/primitives/Button';
import { Checkbox } from '@/components/primitives/Controls';
import { ConnectionBadge, StatusBadge, SyncBadge } from '@/components/primitives/Status';
import { Dialog, Drawer } from '@/components/primitives/Overlay';
import { InlineNotice } from '@/components/primitives/States';
import { IconCheck, IconLock, IconRefresh, IconTrash, ProviderMark, providerLabel } from '@/components/icons';
import { api, describeError } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type AdProvider = 'google_ads' | 'meta_ads';
type Flow = null | { kind: 'preflight' | 'accounts' | 'disconnect' | 'delete'; provider: AdProvider };

type Portfolio = { id: string; name: string };

export type ProviderConfiguration = Record<AdProvider, { live: boolean; note: string }>;

/**
 * A ledger, not a marketplace wall of glossy logo cards.
 *
 * Connect and disconnect are explicit verbs with consequences, never a casual
 * toggle. The sequence is the same whether a provider app is configured or
 * not: authorize, choose a portfolio when there is more than one, choose ad
 * accounts, confirm the scope, sync. Only the grant behind it differs, and the
 * surface says which one it is using.
 */
export function ConnectionLedger({
  connections,
  connectors,
  accounts,
  nowIso,
  workspaceSlug,
  canManage = false,
  canDeleteData = false,
  providerConfiguration,
  live = false,
  callbackStatus,
  callbackProvider,
}: {
  connections: Connection[];
  connectors: ConnectorDefinition[];
  accounts: AdAccount[];
  nowIso: string;
  workspaceSlug: string;
  /** Connecting and disconnecting is an admin or owner permission. */
  canManage?: boolean;
  /** Deleting stored provider history is owner-only. */
  canDeleteData?: boolean;
  providerConfiguration?: ProviderConfiguration;
  live?: boolean;
  /** Carried back on the provider callback: authorized | cancelled | failed. */
  callbackStatus?: string;
  callbackProvider?: string;
}) {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // Populated by the authorize step, so selection always reflects what the
  // grant can actually reach rather than what is already stored.
  const [reachable, setReachable] = useState<AdAccount[] | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolio, setPortfolio] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [grantNote, setGrantNote] = useState<string | null>(null);

  const totalSelected = connections.reduce((sum, connection) => sum + connection.selectedAccounts, 0);
  const attention = accounts.filter((account) => account.health.state !== 'fresh').length;
  const lastSync = connections
    .map((connection) => connection.lastSyncAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop();

  const definition = (key: ProviderKey) => connectors.find((connector) => connector.key === key);
  const flowConnector = flow ? definition(flow.provider) : undefined;
  const flowAccounts = flow
    ? (reachable ?? accounts.filter((account) => account.provider === flow.provider))
    : [];

  const loadAccounts = useCallback(
    async (provider: AdProvider, forPortfolio?: string) => {
      const search = forPortfolio ? `?portfolio=${encodeURIComponent(forPortfolio)}` : '';
      const response = await api.get<{
        live: boolean;
        portfolios: Portfolio[];
        accounts: AdAccount[];
      }>(`/api/workspaces/${workspaceSlug}/connections/${provider}/accounts${search}`);
      setPortfolios(response.portfolios ?? []);
      setReachable(response.accounts ?? []);
      setSelection(
        (response.accounts ?? [])
          .filter((account) => account.status === 'active')
          .map((account) => account.id),
      );
      return response;
    },
    [workspaceSlug],
  );

  // Returning from a provider consent screen lands here with a status. Pick
  // the sequence back up at the account step rather than making the user
  // start over.
  useEffect(() => {
    if (!callbackStatus || !callbackProvider) return;
    if (callbackStatus === 'authorized') {
      const provider = callbackProvider as AdProvider;
      setFlow({ kind: 'accounts', provider });
      void loadAccounts(provider).catch((error) => setProblem(describeError(error)));
    } else if (callbackStatus === 'cancelled') {
      setProblem('Authorization was cancelled. Nothing was connected.');
    } else if (callbackStatus === 'failed') {
      setProblem('The provider rejected the authorization. Try again, or check the app configuration.');
    }
  }, [callbackStatus, callbackProvider, loadAccounts]);

  const authorize = async (provider: AdProvider) => {
    setBusy(`authorize:${provider}`);
    setProblem(null);
    try {
      const response = await api.post<{
        mode: 'redirect' | 'sample';
        authorizeUrl?: string;
        portfolios?: Portfolio[];
        note?: string;
      }>(`/api/workspaces/${workspaceSlug}/connections/${provider}/authorize`, {
        returnTo: `/w/${workspaceSlug}/connections`,
      });

      if (response.mode === 'redirect' && response.authorizeUrl) {
        window.location.href = response.authorizeUrl;
        return;
      }

      setGrantNote(response.note ?? null);
      setPortfolios(response.portfolios ?? []);
      setFlow({ kind: 'accounts', provider });
      await loadAccounts(provider);
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setBusy(null);
    }
  };

  const commitSelection = async (provider: AdProvider) => {
    setBusy('select');
    setProblem(null);
    try {
      await api.post(`/api/workspaces/${workspaceSlug}/connections/${provider}/select`, {
        accountIds: selection,
        portfolio: portfolio ?? undefined,
      });
      setFlow(null);
      setReachable(null);
      setNotice('Account selection saved. Initial sync has begun and continues if you leave.');
      router.refresh();
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setBusy(null);
    }
  };

  const act = async (
    provider: AdProvider,
    action: 'sync' | 'pause' | 'disconnect',
    message: string,
    body?: unknown,
  ) => {
    setBusy(`${action}:${provider}`);
    setProblem(null);
    try {
      await api.post(`/api/workspaces/${workspaceSlug}/connections/${provider}/${action}`, body);
      setNotice(message);
      router.refresh();
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setBusy(null);
    }
  };

  const deleteStoredData = async (provider: AdProvider) => {
    setBusy('delete');
    setProblem(null);
    try {
      const response = await api.post<{ deleted: number }>(
        `/api/workspaces/${workspaceSlug}/connections/${provider}/delete-data`,
        { confirm: providerLabel(provider) },
      );
      setFlow(null);
      setDeleteConfirm('');
      setNotice(
        `Stored ${providerLabel(provider)} data was deleted for ${response.deleted} account${response.deleted === 1 ? '' : 's'}. The connection remains, and new syncs will rebuild history.`,
      );
      router.refresh();
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setBusy(null);
    }
  };

  const metaAccounts = accounts.filter((account) => account.provider === 'meta_ads');

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="s-panel grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {[
          ['Connected providers', `${connections.filter((c) => c.status !== 'disconnected').length} of 3`],
          ['Selected ad accounts', String(totalSelected)],
          ['Most recent sync', lastSync ? formatRelative(lastSync, nowIso) : 'Never'],
          ['Needs attention', attention > 0 ? `${attention} account` : 'None'],
        ].map(([label, value], index) => (
          <div key={label} className="px-5 py-4">
            <p className="micro-label">{label}</p>
            <p
              className={cn(
                'mono mt-1.5 text-[17px] text-ink-950',
                index === 3 && attention > 0 && 'text-warn',
              )}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div aria-live="polite" className="space-y-3">
        {problem ? (
          <InlineNotice tone="warn" title="That did not go through">
            {problem}
          </InlineNotice>
        ) : null}
        {notice ? (
          <InlineNotice tone="good" title="Done">
            {notice}
          </InlineNotice>
        ) : null}
      </div>

      {!canManage && live ? (
        <InlineNotice tone="info" title="You can read connections but not change them">
          Connecting, disconnecting and choosing accounts needs the admin or owner role.
        </InlineNotice>
      ) : null}

      {/* Provider rows */}
      <ul className="s-panel divide-y divide-line p-0">
        {connections.map((connection) => {
          const connector = definition(connection.provider);
          const providerAccounts = accounts.filter(
            (account) => connection.provider !== 'upload' && account.provider === connection.provider,
          );
          const provider = (connection.provider === 'upload' ? 'google_ads' : connection.provider) as AdProvider;
          const configuration = providerConfiguration?.[provider];

          return (
            <li key={connection.id} className="px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-[3px] shrink-0">
                    <ProviderMark provider={connection.provider} size={22} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-[16px] font-semibold text-ink-950">
                        {providerLabel(connection.provider)}
                      </h3>
                      <ConnectionBadge status={connection.status} />
                      {connection.live ? <StatusBadge tone="good">Live grant</StatusBadge> : null}
                    </div>
                    <p className="mono mt-1 text-[12px] text-ink-500">{connection.identityLabel}</p>
                    {connection.status !== 'disconnected' ? (
                      <p className="mono mt-1 text-[11.5px] text-ink-400">
                        {connection.selectedAccounts} of {connection.accessibleAccounts} accessible accounts
                        selected · last sync {formatRelative(connection.lastSyncAt, nowIso)}
                      </p>
                    ) : null}
                    {connection.message ? (
                      <p className="mt-1.5 text-[12.5px] text-warn">{connection.message}</p>
                    ) : null}
                    {connection.provider !== 'upload' && configuration && !configuration.live ? (
                      <p className="mono mt-1.5 text-[11px] leading-[16px] text-ink-400">
                        {configuration.note}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {connection.status === 'disconnected' ? (
                    <Button
                      variant="indigo"
                      size="compact"
                      disabled={!canManage || connection.provider === 'upload'}
                      pending={busy === `authorize:${provider}`}
                      pendingLabel="Opening…"
                      onClick={() => setFlow({ kind: 'preflight', provider })}
                    >
                      Connect {providerLabel(connection.provider)}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="neutral"
                        size="compact"
                        disabled={!canManage}
                        onClick={() => {
                          setFlow({ kind: 'accounts', provider });
                          if (live) void loadAccounts(provider).catch((error) => setProblem(describeError(error)));
                        }}
                      >
                        Select accounts
                      </Button>
                      <Button
                        variant="quiet"
                        size="compact"
                        disabled={!canManage}
                        pending={busy === `sync:${provider}`}
                        pendingLabel="Syncing…"
                        leading={<IconRefresh size={15} />}
                        onClick={() =>
                          live
                            ? void act(provider, 'sync', `${providerLabel(provider)} sync started.`)
                            : setNotice(`${providerLabel(provider)} sync started.`)
                        }
                      >
                        Sync now
                      </Button>
                      <Button
                        variant="quiet"
                        size="compact"
                        disabled={!canManage}
                        onClick={() =>
                          live
                            ? void act(
                                provider,
                                'pause',
                                connection.status === 'paused'
                                  ? `Scheduled sync resumed for ${providerLabel(provider)}.`
                                  : `Scheduled sync paused for ${providerLabel(provider)}.`,
                                { paused: connection.status !== 'paused' },
                              )
                            : setNotice(`Scheduled sync paused for ${providerLabel(provider)}.`)
                        }
                      >
                        {connection.status === 'paused' ? 'Resume sync' : 'Pause sync'}
                      </Button>
                      <Button
                        variant="danger"
                        size="compact"
                        disabled={!canManage}
                        onClick={() => setFlow({ kind: 'disconnect', provider })}
                      >
                        Disconnect
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {connector && connection.status !== 'disconnected' ? (
                <div className="mt-4 grid gap-x-8 gap-y-4 border-t border-line pt-4 lg:grid-cols-2">
                  <div>
                    <p className="micro-label">What HELM can read</p>
                    <ul className="mt-2 space-y-1.5">
                      {connection.grantedReads.map((item) => (
                        <li key={item} className="flex gap-2 text-[13px] leading-[19px] text-ink-700">
                          <span className="mt-[2px] shrink-0 text-good">
                            <IconCheck size={14} />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="micro-label">What it never does</p>
                    <ul className="mt-2 space-y-1.5">
                      {connector.neverDoes.map((item) => (
                        <li key={item} className="flex gap-2 text-[13px] leading-[19px] text-ink-500">
                          <span className="mt-[2px] shrink-0 text-ink-400">
                            <IconLock size={14} />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {providerAccounts.length > 0 ? (
                <ul className="mt-4 divide-y divide-line rounded-control border border-line">
                  {providerAccounts.map((account) => (
                    <li key={account.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-ink-950">{account.name}</span>
                        <span className="mono block truncate text-[11px] text-ink-400">
                          {account.nativeId} · {account.currency} · {account.timeZone}
                          {account.parentLabel ? ` · ${account.parentLabel}` : ''}
                        </span>
                      </span>
                      <SyncBadge state={account.health.state} />
                      <span className="mono w-[92px] shrink-0 text-right text-[11px] text-ink-400">
                        {formatRelative(account.lastSyncedAt, nowIso)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {connection.provider === 'meta_ads' ? (
                <p className="mt-3 text-[12.5px] leading-[19px] text-ink-400">
                  Page, Instagram identity, pixel and catalogue access are not requested in this read-only
                  performance connection.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Deleting stored data is separate from disconnecting */}
      <div className="s-panel-subtle border-bad/25 px-5 py-5 sm:px-6">
        <h3 className="text-[15px] font-semibold text-ink-950">Delete stored data</h3>
        <p className="mt-1.5 max-w-prose text-[13.5px] leading-[21px] text-ink-500">
          Disconnecting stops future syncs but keeps the history HELM has already collected. Deleting that
          history is a separate action and cannot be undone.
        </p>
        {canDeleteData ? (
          <Button
            variant="danger"
            size="compact"
            className="mt-3.5"
            leading={<IconTrash size={15} />}
            onClick={() => setFlow({ kind: 'delete', provider: 'meta_ads' })}
          >
            Delete stored Meta Ads data
          </Button>
        ) : (
          <p className="mono mt-3 flex items-center gap-2 text-[12px] text-ink-400">
            <IconLock size={14} />
            Only an owner can delete stored provider history.
          </p>
        )}
      </div>

      {/* Preflight */}
      <Drawer
        open={flow?.kind === 'preflight'}
        onClose={() => setFlow(null)}
        title={`Connect ${flow ? providerLabel(flow.provider) : ''}`}
        description="Read-only. Nothing in your ad account changes."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="quiet" size="compact" onClick={() => setFlow(null)}>
              Cancel
            </Button>
            <Button
              variant="indigo"
              size="compact"
              pending={Boolean(busy?.startsWith('authorize'))}
              pendingLabel="Opening…"
              onClick={() => {
                if (!flow) return;
                if (live) void authorize(flow.provider);
                else setFlow({ kind: 'accounts', provider: flow.provider });
              }}
            >
              Continue to {flow ? providerLabel(flow.provider) : ''}
            </Button>
          </div>
        }
      >
        {flowConnector ? (
          <div className="space-y-6">
            <div>
              <p className="micro-label">HELM will read</p>
              <ul className="mt-2 space-y-2">
                {flowConnector.readsPlainLanguage.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[14px] leading-[21px] text-ink-700">
                    <span className="mt-[2px] shrink-0 text-good">
                      <IconCheck size={15} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="micro-label">HELM will never</p>
              <ul className="mt-2 space-y-2">
                {flowConnector.neverDoes.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[14px] leading-[21px] text-ink-500">
                    <span className="mt-[2px] shrink-0 text-ink-400">
                      <IconLock size={15} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="micro-label">Steps</p>
              <ol className="mt-2 space-y-2">
                {flowConnector.setupSteps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-[14px] text-ink-700">
                    <span className="mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-[11px] text-ink-500">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            {flow && providerConfiguration?.[flow.provider] && !providerConfiguration[flow.provider].live ? (
              <InlineNotice tone="info" title="Sample authorization">
                {providerConfiguration[flow.provider].note}
              </InlineNotice>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      {/* Account selection */}
      <Drawer
        open={flow?.kind === 'accounts'}
        onClose={() => {
          setFlow(null);
          setReachable(null);
        }}
        title={`Choose ${flow ? providerLabel(flow.provider) : ''} accounts`}
        description={
          portfolios.length
            ? `${portfolios.length} ${flow?.provider === 'meta_ads' ? 'business portfolio' : 'manager account'}${portfolios.length === 1 ? '' : 's'} · ${flowAccounts.length} accessible ad accounts`
            : `${flowAccounts.length} accessible ad accounts`
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-ink-500">{selection.length} selected</p>
            <div className="flex gap-2">
              <Button
                variant="quiet"
                size="compact"
                onClick={() => {
                  setFlow(null);
                  setReachable(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="indigo"
                size="compact"
                disabled={selection.length === 0}
                pending={busy === 'select'}
                pendingLabel="Starting sync…"
                onClick={() => {
                  if (!flow) return;
                  if (live) void commitSelection(flow.provider);
                  else {
                    setFlow(null);
                    setNotice('Account selection saved. Initial sync has begun and continues if you leave.');
                  }
                }}
              >
                Confirm scope and sync
              </Button>
            </div>
          </div>
        }
      >
        {grantNote ? (
          <InlineNotice tone="info" title="Sample portfolio" className="mb-4">
            {grantNote}
          </InlineNotice>
        ) : null}

        {/* The portfolio step is skipped when only one valid option exists */}
        {portfolios.length > 1 && flow ? (
          <div className="mb-5">
            <p className="micro-label">
              {flow.provider === 'meta_ads' ? 'Business portfolio' : 'Manager account'}
            </p>
            <div className="mt-2 grid gap-1.5">
              {portfolios.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setPortfolio(entry.id);
                    if (live) void loadAccounts(flow.provider, entry.id).catch(() => undefined);
                  }}
                  aria-pressed={portfolio === entry.id}
                  className={cn(
                    'rounded-control border px-3 py-2.5 text-left text-[14px] transition-colors',
                    portfolio === entry.id
                      ? 'border-helm-500 bg-helm-50 text-ink-950'
                      : 'border-line text-ink-700 hover:bg-surface-subtle',
                  )}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ul className="space-y-3">
          {flowAccounts.map((account) => (
            <li key={account.id} className="rounded-control border border-line px-3.5 py-3">
              <Checkbox
                checked={selection.includes(account.id)}
                onChange={(checked) =>
                  setSelection((value) =>
                    checked ? [...value, account.id] : value.filter((id) => id !== account.id),
                  )
                }
                label={account.name}
                description={`${account.nativeId} · ${account.currency} · ${account.timeZone}${account.parentLabel ? ` · ${account.parentLabel}` : ''}`}
              />
              <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-8">
                <SyncBadge state={account.health.state} />
                {account.status === 'disabled' ? (
                  <StatusBadge tone="bad">Disabled by the provider</StatusBadge>
                ) : null}
                {account.currency !== 'INR' ? (
                  <StatusBadge tone="warn">Cannot be blended with INR accounts</StatusBadge>
                ) : null}
              </div>
              {account.health.message ? (
                <p className="mt-2 pl-8 text-[12.5px] leading-[18px] text-ink-500">{account.health.message}</p>
              ) : null}
            </li>
          ))}
        </ul>

        {flowAccounts.length === 0 ? (
          <p className="text-[13.5px] text-ink-500">
            No ad accounts are reachable with this grant. Check the account has been shared with the
            authorizing identity inside the provider.
          </p>
        ) : null}
      </Drawer>

      {/* Disconnect — one confirmation, and it does not delete data */}
      <Dialog
        open={flow?.kind === 'disconnect'}
        onClose={() => setFlow(null)}
        title={`Disconnect ${flow ? providerLabel(flow.provider) : ''}?`}
        description="Future syncs will stop. Stored history remains available until you delete it separately. Existing reports keep their source labels and last-updated date."
        footer={
          <>
            <Button variant="neutral" size="compact" onClick={() => setFlow(null)}>
              Keep connected
            </Button>
            <Button
              variant="danger"
              size="compact"
              pending={Boolean(busy?.startsWith('disconnect'))}
              pendingLabel="Disconnecting…"
              onClick={() => {
                if (!flow) return;
                const label = providerLabel(flow.provider);
                if (live) {
                  void act(
                    flow.provider,
                    'disconnect',
                    `${label} disconnected. Stored history was kept and no reports were changed.`,
                  ).then(() => setFlow(null));
                } else {
                  setFlow(null);
                  setNotice(`${label} disconnected. Stored history was kept and no reports were changed.`);
                }
              }}
            >
              Disconnect
            </Button>
          </>
        }
      >
        <ul className="space-y-2">
          {[
            'Scheduled syncs stop immediately.',
            `${flow ? accounts.filter((account) => account.provider === flow.provider).length : 0} ad accounts stop receiving new data.`,
            'Reports built before now keep their figures and source labels.',
          ].map((item) => (
            <li key={item} className="flex gap-2 text-[13.5px] leading-[20px] text-ink-700">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-400" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </Dialog>

      {/* Delete stored data — stronger confirmation, exact impact */}
      <Dialog
        open={flow?.kind === 'delete'}
        onClose={() => {
          setFlow(null);
          setDeleteConfirm('');
        }}
        title="Delete all stored Meta Ads data?"
        description="This permanently removes the reporting history HELM has collected for the Meta accounts. It cannot be undone."
        footer={
          <>
            <Button
              variant="neutral"
              size="compact"
              onClick={() => {
                setFlow(null);
                setDeleteConfirm('');
              }}
            >
              Keep the data
            </Button>
            <Button
              variant="danger"
              size="compact"
              disabled={deleteConfirm !== 'DELETE'}
              pending={busy === 'delete'}
              pendingLabel="Deleting…"
              onClick={() => {
                if (live) void deleteStoredData('meta_ads');
                else {
                  setFlow(null);
                  setDeleteConfirm('');
                  setNotice('Stored Meta Ads data was deleted.');
                }
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <dl className="mono space-y-2 rounded-control bg-bad-soft px-3.5 py-3 text-[12.5px]">
          {[
            ['Accounts affected', metaAccounts.map((account) => account.nativeId).join(', ') || 'None'],
            ['Ad accounts', String(metaAccounts.length)],
            ['Reports that keep their figures', 'All existing reports'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-ink-500">{label}</dt>
              <dd className="text-right text-ink-950">{value}</dd>
            </div>
          ))}
        </dl>
        <label htmlFor="delete-confirm" className="mt-4 block text-[13px] font-medium text-ink-700">
          Type DELETE to confirm
        </label>
        <input
          id="delete-confirm"
          value={deleteConfirm}
          onChange={(event) => setDeleteConfirm(event.target.value)}
          className="mono mt-1.5 h-11 w-full rounded-field border border-line-strong bg-surface-sunk px-3.5 text-[15px] text-ink-950 outline-none focus:border-bad"
        />
      </Dialog>
    </div>
  );
}
