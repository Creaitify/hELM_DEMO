'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AdAccount } from '@/contracts';
import { HelmWordmark } from '@/components/brand/HelmMark';
import { Button } from '@/components/primitives/Button';
import { Checkbox, Select, TextField } from '@/components/primitives/Controls';
import { StatusBadge, SyncBadge } from '@/components/primitives/Status';
import { IconArrowRight, IconCheck, IconLock, ProviderMark } from '@/components/icons';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

const STEPS = ['Workspace', 'Connect data', 'Select accounts', 'Ready'] as const;

/** A short product setup, not an auth redirect maze. */
export function OnboardingFlow({ accounts, workspaceSlug }: { accounts: AdAccount[]; workspaceSlug: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('Northstar Group');
  const [currency, setCurrency] = useState('INR');
  const [connected, setConnected] = useState<string[]>([]);
  const [selection, setSelection] = useState<string[]>([
    'acct_g_search',
    'acct_g_pmax',
    'acct_m_prospect',
    'acct_m_retarget',
  ]);

  const selectable = accounts.filter((account) => connected.includes(account.provider));

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 py-10 sm:px-8 sm:py-16">
      <HelmWordmark size="md" subtitle="Paid-media intelligence" />

      {/* Discrete stages, no invented percentage */}
      <ol className="mt-9 flex flex-wrap gap-x-2 gap-y-2">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border text-[11px]',
                index < step && 'border-good bg-good text-white',
                index === step && 'border-helm-500 bg-helm-500 text-white',
                index > step && 'border-line-strong text-ink-400',
              )}
              aria-hidden="true"
            >
              {index < step ? <IconCheck size={12} strokeWidth={3} /> : index + 1}
            </span>
            <span className={cn('text-[13px]', index === step ? 'font-medium text-ink-950' : 'text-ink-400')}>
              {label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="mx-1 h-px w-5 bg-line sm:w-8" aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="s-panel mt-8 px-6 py-7">
        {step === 0 ? (
          <>
            <h1 className="text-[24px] font-semibold tracking-[-0.022em] text-ink-950">
              Name your workspace
            </h1>
            <p className="mt-2 max-w-prose text-[15px] leading-[23px] text-ink-500">
              A workspace holds one set of connected ad accounts and the people who can see them.
            </p>
            <div className="mt-6 space-y-5">
              <TextField
                label="Workspace name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                hint="You can change this later. The address stays the same."
              />
              <Select
                label="Display currency (optional)"
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: 'INR', label: 'INR — Indian rupee' },
                  { value: 'USD', label: 'USD — US dollar' },
                  { value: 'GBP', label: 'GBP — Pound sterling' },
                ]}
                className="max-w-[300px]"
              />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 className="text-[24px] font-semibold tracking-[-0.022em] text-ink-950">Connect your data</h1>
            <p className="mt-2 max-w-prose text-[15px] leading-[23px] text-ink-500">
              Connect one provider and continue. You do not need both to get a first Briefing.
            </p>
            <ul className="mt-6 space-y-3">
              {(['google_ads', 'meta_ads'] as const).map((provider) => {
                const isConnected = connected.includes(provider);
                return (
                  <li
                    key={provider}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-line px-4 py-4"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <ProviderMark provider={provider} size={22} />
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium text-ink-950">
                          {provider === 'google_ads' ? 'Google Ads' : 'Meta Ads'}
                        </span>
                        <span className="block text-[12.5px] text-ink-500">
                          Read-only access to reporting. Nothing in your account changes.
                        </span>
                      </span>
                    </span>
                    {isConnected ? (
                      <StatusBadge tone="good" icon={<IconCheck size={14} />}>
                        Connected
                      </StatusBadge>
                    ) : (
                      <Button
                        variant="indigo"
                        size="compact"
                        onClick={() => setConnected((value) => [...value, provider])}
                      >
                        Connect {provider === 'google_ads' ? 'Google Ads' : 'Meta Ads'}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 flex items-start gap-2.5 text-[13px] leading-[20px] text-ink-500">
              <span className="mt-[2px] shrink-0 text-ink-400">
                <IconLock size={15} />
              </span>
              HELM never changes budgets, bids, status or creative. You can disconnect at any time.
            </p>
            <button
              type="button"
              onClick={() => {
                setConnected(['google_ads', 'meta_ads']);
                setStep(3);
              }}
              className="mt-4 text-[13.5px] text-helm-600 underline-offset-2 hover:underline"
            >
              Skip for now and use the sample workspace
            </button>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="text-[24px] font-semibold tracking-[-0.022em] text-ink-950">
              Choose the accounts to include
            </h1>
            <p className="mt-2 max-w-prose text-[15px] leading-[23px] text-ink-500">
              Only the accounts you pick are read. You can change this later without reconnecting.
            </p>
            {selectable.length === 0 ? (
              <p className="mt-6 rounded-field border border-line bg-surface-subtle px-4 py-4 text-[14px] text-ink-500">
                Connect a provider on the previous step to choose accounts.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {selectable.map((account) => (
                  <li key={account.id} className="rounded-field border border-line px-4 py-3.5">
                    <Checkbox
                      checked={selection.includes(account.id)}
                      onChange={(checked) =>
                        setSelection((value) =>
                          checked ? [...value, account.id] : value.filter((id) => id !== account.id),
                        )
                      }
                      label={
                        <span className="inline-flex items-center gap-2">
                          <ProviderMark provider={account.provider} size={15} />
                          {account.name}
                        </span>
                      }
                      description={`${account.nativeId} · ${account.currency} · ${account.timeZone}`}
                    />
                    {account.currency !== 'INR' ? (
                      <p className="mt-2 pl-8 text-[12px] text-warn">
                        Reports in {account.currency}. It cannot be blended with your INR accounts.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="text-[24px] font-semibold tracking-[-0.022em] text-ink-950">You are ready</h1>
            <p className="mt-2 max-w-prose text-[15px] leading-[23px] text-ink-500">
              The first sync is running. Your Briefing will fill in as complete days arrive.
            </p>
            <dl className="mono mt-6 space-y-2.5 rounded-field border border-line bg-surface-subtle px-4 py-4 text-[12.5px]">
              {[
                ['Workspace', name],
                ['Currency', currency],
                ['Account scope', `${selection.length} accounts · Google + Meta`],
                ['First complete day', 'Available tomorrow morning'],
                ['Mode', 'Sample workspace'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-line/70 pb-2 last:border-b-0 last:pb-0">
                  <dt className="text-ink-400">{label}</dt>
                  <dd className="text-right text-ink-950">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5">
              <p className="micro-label">Initial sync</p>
              <ul className="mt-2 space-y-2">
                {[
                  { label: 'Google Ads · 187-DEM-9021', state: 'fresh' as const },
                  { label: 'Google Ads · 605-DEM-7740', state: 'fresh' as const },
                  { label: 'Meta Ads · 2385-DEMO-2110', state: 'syncing' as const },
                  { label: 'Meta Ads · 2385-DEMO-2911', state: 'delayed' as const },
                ].map((entry) => (
                  <li key={entry.label} className="flex items-center justify-between gap-3">
                    <span className="mono text-[12.5px] text-ink-700">{entry.label}</span>
                    <SyncBadge state={entry.state} />
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          {step > 0 ? (
            <Button variant="quiet" onClick={() => setStep((value) => value - 1)}>
              Back
            </Button>
          ) : null}

          {step < 3 ? (
            <Button
              variant="action"
              className="ml-auto"
              trailing={<IconArrowRight size={17} />}
              disabled={step === 1 && connected.length === 0}
              onClick={() => setStep((value) => value + 1)}
            >
              {step === 0 ? 'Connect data' : step === 1 ? 'Choose accounts' : 'Finish setup'}
            </Button>
          ) : (
            <Link
              href={routes.briefing(workspaceSlug)}
              className="ml-auto inline-flex h-11 items-center gap-2 rounded-control bg-action-200 px-4 text-[15px] font-medium text-action-ink transition-colors hover:bg-action-400"
            >
              Open Briefing
              <IconArrowRight size={17} />
            </Link>
          )}
        </div>
      </div>

      <p className="mono mt-6 text-center text-[11.5px] text-ink-400">
        Illustrative sample workspace. No customer data is shown.
      </p>
    </div>
  );
}
