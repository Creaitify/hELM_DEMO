'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BrandKit } from '@/contracts';
import { Button } from '@/components/primitives/Button';
import { StatusBadge } from '@/components/primitives/Status';
import { IconLock } from '@/components/icons';
import { api, describeError } from '@/lib/api';
import { cn } from '@/lib/cn';

/**
 * The brand kit.
 *
 * This is what the creative director is told before it writes anything, so it
 * is edited here in plain language rather than hidden in a config file. The
 * house rules travel verbatim into the prompt — which is the point of showing
 * them: "on brand" is a judgement nobody can make against guidance they have
 * never read.
 */

const FIELDS: { key: keyof BrandKit; label: string; hint: string; placeholder: string }[] = [
  { key: 'name', label: 'Kit name', hint: 'How you refer to it', placeholder: 'Northstar — Arc Bottle' },
  { key: 'advertiser', label: 'Advertiser', hint: 'Whose account this is', placeholder: 'Northstar Hydration' },
  { key: 'product', label: 'Product', hint: 'What is being sold', placeholder: 'Arc Bottle' },
  {
    key: 'campaignLine',
    label: 'Campaign line',
    hint: 'The claim the work is built around',
    placeholder: 'Still cold at the summit',
  },
  {
    key: 'palette',
    label: 'Palette',
    hint: 'Named colours, not hex — the model reads words',
    placeholder: 'Graphite, frost, deep cobalt, one warm coral annotation',
  },
  { key: 'audience', label: 'Audience', hint: 'Who it is aimed at', placeholder: 'Broad prospecting · India' },
  { key: 'objective', label: 'Objective', hint: 'What it is for', placeholder: 'Sales · purchase' },
];

const INPUT_CLASS =
  'mt-1.5 h-10 w-full rounded-field border border-line-strong bg-surface-sunk px-3 text-[14px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface disabled:opacity-60';

export function BrandKitEditor({
  workspaceSlug,
  kits,
  canEdit,
}: {
  workspaceSlug: string;
  kits: BrandKit[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(kits[0]?.id ?? '');
  const [draft, setDraft] = useState<BrandKit | null>(kits[0] ?? null);
  const [guardrailText, setGuardrailText] = useState((kits[0]?.guardrails ?? []).join('\n'));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const select = (id: string) => {
    const kit = kits.find((entry) => entry.id === id);
    setSelectedId(id);
    setDraft(kit ?? null);
    setGuardrailText((kit?.guardrails ?? []).join('\n'));
    setSaved(null);
  };

  const startNew = () => {
    setSelectedId('');
    setDraft({
      id: '',
      workspaceId: '',
      name: '',
      advertiser: '',
      product: '',
      campaignLine: '',
      palette: '',
      audience: '',
      objective: '',
      guardrails: [],
      isDefault: kits.length === 0,
      updatedAt: new Date().toISOString(),
    });
    setGuardrailText('');
    setSaved(null);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setProblem(null);
    setSaved(null);
    try {
      const guardrails = guardrailText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const response = await api.put<{ kit: BrandKit }>(`/api/workspaces/${workspaceSlug}/brand-kits`, {
        ...draft,
        id: draft.id || undefined,
        guardrails,
      });
      setSaved(`${response.kit.name} saved. Every generation from now inherits it.`);
      setSelectedId(response.kit.id);
      router.refresh();
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <p className="text-[13.5px] text-ink-500">
        No brand kit is defined for this workspace yet.{' '}
        {canEdit ? (
          <button type="button" onClick={startNew} className="text-helm-600 hover:underline">
            Create one
          </button>
        ) : (
          'An admin or owner can create one.'
        )}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-0 flex-1">
          <span className="micro-label">Brand kit</span>
          <select
            value={selectedId}
            onChange={(event) => (event.target.value ? select(event.target.value) : startNew())}
            className="mt-1.5 h-10 w-full max-w-sm rounded-field border border-line-strong bg-surface-sunk px-3 text-[13.5px] text-ink-950 outline-none focus:border-helm-500 focus:bg-surface"
          >
            {kits.map((kit) => (
              <option key={kit.id} value={kit.id}>
                {kit.name}
                {kit.isDefault ? ' · default' : ''}
              </option>
            ))}
            <option value="">+ New brand kit</option>
          </select>
        </label>

        {draft.isDefault ? <StatusBadge tone="info">Inherited by default</StatusBadge> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className={cn(field.key === 'campaignLine' && 'sm:col-span-2')}>
            <span className="micro-label">{field.label}</span>
            <input
              value={String(draft[field.key] ?? '')}
              onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
              placeholder={field.placeholder}
              disabled={!canEdit}
              className={INPUT_CLASS}
            />
            <span className="mono mt-1 block text-[11px] text-ink-400">{field.hint}</span>
          </label>
        ))}
      </div>

      <label className="block">
        <span className="micro-label">House rules</span>
        <textarea
          rows={5}
          value={guardrailText}
          onChange={(event) => setGuardrailText(event.target.value)}
          placeholder={'One rule per line.\nNever state a retention figure the testing has not measured.\nOne accent colour per frame.'}
          disabled={!canEdit}
          className="mt-1.5 w-full resize-y rounded-field border border-line-strong bg-surface-sunk px-3 py-2.5 text-[14px] leading-[21px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface disabled:opacity-60"
        />
        <span className="mono mt-1 block text-[11px] text-ink-400">
          One per line. Sent verbatim to the creative director with every brief.
        </span>
      </label>

      <label className="flex items-center gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={draft.isDefault}
          disabled={!canEdit}
          onClick={() => setDraft({ ...draft, isDefault: !draft.isDefault })}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60',
            draft.isDefault ? 'bg-helm-600' : 'bg-line-strong',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
              draft.isDefault ? 'left-[18px]' : 'left-0.5',
            )}
          />
        </button>
        <span className="text-[13.5px] text-ink-700">
          Inherit this kit by default
          <span className="mono ml-2 text-[11px] text-ink-400">
            exactly one kit can hold this
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button variant="action" onClick={() => void save()} disabled={!canEdit} pending={saving} pendingLabel="Saving…">
          {draft.id ? 'Save the kit' : 'Create the kit'}
        </Button>

        {!canEdit ? (
          <p className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-500">
            <IconLock size={13} />
            Changing brand guidance changes every image the workspace makes next, so it needs admin or
            owner.
          </p>
        ) : null}
      </div>

      <div aria-live="polite" className="min-h-[20px]">
        {problem ? <p className="text-[13px] text-bad">{problem}</p> : null}
        {saved ? <p className="text-[13px] text-good">{saved}</p> : null}
      </div>
    </div>
  );
}
