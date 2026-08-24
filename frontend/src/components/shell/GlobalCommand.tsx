'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Dialog } from '@/components/primitives/Overlay';
import { IconArrowRight, IconIntelligence, IconSearch } from '@/components/icons';
import { INTENTS } from '@/services/mock/intelligence';
import { routes } from '@/lib/routes';

/**
 * One canonical intelligence entry. The command surface collects intent and
 * context, then opens the durable run — it is not a second chat product with
 * its own history.
 */
export function GlobalCommand({
  open,
  onClose,
  workspaceSlug,
  scopeLabel,
  rangeLabel,
  accountCount,
  freshnessLabel,
}: {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  scopeLabel: string;
  rangeLabel: string;
  accountCount: number;
  freshnessLabel: string;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState('');

  const start = (intentId: string) => {
    onClose();
    router.push(`${routes.intelligence(workspaceSlug)}?intent=${intentId}`);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Investigate with HELM"
      description="The run inherits the context below. You can change it before starting."
      className="sm:max-w-[600px]"
    >
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
          <IconSearch size={17} />
        </span>
        <label htmlFor="global-command" className="sr-only">
          Ask about this workspace
        </label>
        <input
          id="global-command"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about spend, efficiency, creative or budget"
          className="h-12 w-full rounded-field border border-line-strong bg-surface-sunk pl-10 pr-3.5 text-[15px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
        />
      </div>

      <dl className="mono mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-400">
        <div className="flex gap-1.5">
          <dt>Scope</dt>
          <dd className="text-ink-700">
            {scopeLabel} · {accountCount} accounts
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Range</dt>
          <dd className="text-ink-700">{rangeLabel}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Freshness</dt>
          <dd className="text-ink-700">{freshnessLabel}</dd>
        </div>
      </dl>

      <p className="micro-label mt-5">Start with an intent</p>
      <ul className="mt-2 divide-y divide-line rounded-control border border-line">
        {INTENTS.map((intent) => (
          <li key={intent.id}>
            <button
              type="button"
              onClick={() => start(intent.id)}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-subtle"
            >
              <span className="shrink-0 text-helm-500">
                <IconIntelligence size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] text-ink-950">{intent.label}</span>
                <span className="block text-[12px] text-ink-500">{intent.detail}</span>
              </span>
              <span className="shrink-0 text-ink-400">
                <IconArrowRight size={16} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
