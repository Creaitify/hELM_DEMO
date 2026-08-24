'use client';

import { useState } from 'react';
import type { AdAccount, Connection, ConnectorDefinition } from '@/contracts';
import { Button } from '@/components/primitives/Button';
import { Checkbox } from '@/components/primitives/Controls';
import { ConnectionBadge, StatusBadge, SyncBadge } from '@/components/primitives/Status';
import { Dialog, Drawer } from '@/components/primitives/Overlay';
import { InlineNotice } from '@/components/primitives/States';
import { IconCheck, IconLock, IconRefresh, IconTrash, ProviderMark, providerLabel } from '@/components/icons';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type Flow = null | { kind: 'preflight' | 'accounts' | 'disconnect' | 'delete'; provider: 'google_ads' | 'meta_ads' };

/**
 * A ledger, not a marketplace wall of glossy logo cards. Connect and
 * disconnect are explicit verbs with consequences, never a casual toggle.
 */
export function ConnectionLedger({
  connections,
  connectors,
  accounts,
  nowIso,
}: {
  connections: Connection[];
  connectors: ConnectorDefinition[];
  accounts: AdAccount[];
  nowIso: string;
}) {
  const [flow, setFlow] = useState<Flow>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>(
    accounts.filter((account) => account.id !== 'acct_g_us').map((account) => account.id),
  );
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const totalSelected = connections.reduce((sum, connection) => sum + connection.selectedAccounts, 0);
  const attention = accounts.filter((account) => account.health.state !== 'fresh').length;
  const lastSync = connections
    .map((connection) => connection.lastSyncAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop();

  const definition = (key: string) => connectors.find((connector) => connector.key === key);
  const flowConnector = flow ? definition(flow.provider) : undefined;
  const flowAccounts = flow ? accounts.filter((account) => account.provider === flow.provider) : [];

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

      <div aria-live="polite">
        {notice ? (
          <InlineNotice tone="good" title="Done">
            {notice}
          </InlineNotice>
        ) : null}
      </div>

      {/* Provider rows */}
      <ul className="s-panel divide-y divide-line p-0">
        {connections.map((connection) => {
          const connector = definition(connection.provider);
          const providerAccounts = accounts.filter(
            (account) => connection.provider !== 'upload' && account.provider === connection.provider,
          );

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
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {connection.status === 'disconnected' ? (
                    <Button
                      variant="indigo"
                      size="compact"
                      onClick={() =>
                        setFlow({ kind: 'preflight', provider: connection.provider === 'upload' ? 'google_ads' : connection.provider })
                      }
                    >
                      Connect {providerLabel(connection.provider)}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="neutral"
                        size="compact"
                        onClick={() =>
                          setFlow({ kind: 'accounts', provider: connection.provider as 'google_ads' | 'meta_ads' })
                        }
                      >
                        Select accounts
                      </Button>
                      <Button
                        variant="quiet"
                        size="compact"
                        leading={<IconRefresh size={15} />}
                        onClick={() => setNotice(`${providerLabel(connection.provider)} sync started.`)}
                      >
                        Sync now
                      </Button>
                      <Button
                        variant="quiet"
                        size="compact"
                        onClick={() => setNotice(`Scheduled sync paused for ${providerLabel(connection.provider)}.`)}
                      >
                        Pause sync
                      </Button>
                      <Button
                        variant="danger"
                        size="compact"
                        onClick={() =>
                          setFlow({ kind: 'disconnect', provider: connection.provider as 'google_ads' | 'meta_ads' })
                        }
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
        <Button
          variant="danger"
          size="compact"
          className="mt-3.5"
          leading={<IconTrash size={15} />}
          onClick={() => setFlow({ kind: 'delete', provider: 'meta_ads' })}
        >
          Delete stored Meta Ads data
        </Button>
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
              onClick={() => flow && setFlow({ kind: 'accounts', provider: flow.provider })}
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
          </div>
        ) : null}
      </Drawer>

      {/* Account selection */}
      <Drawer
        open={flow?.kind === 'accounts'}
        onClose={() => setFlow(null)}
        title={`Choose ${flow ? providerLabel(flow.provider) : ''} accounts`}
        description={
          flow?.provider === 'meta_ads'
            ? 'Northstar Hydration portfolio · 4 accessible ad accounts'
            : 'Northstar Group MCC · 9 accessible client accounts'
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-ink-500">{selection.length} selected</p>
            <div className="flex gap-2">
              <Button variant="quiet" size="compact" onClick={() => setFlow(null)}>
                Cancel
              </Button>
              <Button
                variant="indigo"
                size="compact"
                onClick={() => {
                  setFlow(null);
                  setNotice('Account selection saved. Initial sync has begun and continues if you leave.');
                }}
              >
                Save selection
              </Button>
            </div>
          </div>
        }
      >
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
              <div className="mt-2.5 flex items-center gap-2 pl-8">
                <SyncBadge state={account.health.state} />
                {account.currency !== 'INR' ? (
                  <StatusBadge tone="warn">Cannot be blended with INR accounts</StatusBadge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
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
              onClick={() => {
                const label = flow ? providerLabel(flow.provider) : '';
                setFlow(null);
                setNotice(`${label} disconnected. Stored history was kept and no reports were changed.`);
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
            '2 ad accounts stop receiving new data.',
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
        description="This permanently removes the reporting history HELM has collected for both Meta accounts. It cannot be undone."
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
              onClick={() => {
                setFlow(null);
                setDeleteConfirm('');
                setNotice(
                  'Stored Meta Ads data was deleted. The connection remains, and new syncs will start rebuilding history.',
                );
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <dl className="mono space-y-2 rounded-control bg-bad-soft px-3.5 py-3 text-[12.5px]">
          {[
            ['Accounts affected', '2385-DEMO-2110, 2385-DEMO-2911'],
            ['Days of history', '412'],
            ['Campaigns', '9'],
            ['Creative records', '4'],
            ['Reports that keep their figures', '5'],
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
