import type { AgentDefinition } from '@/contracts/fleet';
import { AGENT_ORDER } from '@/contracts/fleet';
import { StatusBadge } from '@/components/primitives/Status';
import { SectionHeading } from '@/components/primitives/States';
import { IconEvidence, IconIntelligence, IconScope, IconSpark } from '@/components/icons';

/**
 * The cast, before a run calls it.
 *
 * Shown under the composer so the person starting an investigation knows who
 * will work on it, in what order, and what each one is not allowed to do.
 * There is no live state here — that belongs on the run itself.
 */

const KIND_ICON = {
  retrieval: IconScope,
  reasoning: IconIntelligence,
  planning: IconEvidence,
  generative: IconSpark,
} as const;

export function FleetRoster({
  agents,
  powering,
  mode,
}: {
  agents: AgentDefinition[];
  powering: { label: string; value: string; note: string }[];
  mode: { reasoning: 'anthropic' | 'scripted'; images: string };
}) {
  const ordered = AGENT_ORDER.map((key) => agents.find((agent) => agent.key === key)).filter(
    Boolean,
  ) as AgentDefinition[];

  return (
    <section aria-labelledby="roster">
      <SectionHeading
        id="roster"
        title="Who works on a run"
        hint="A fixed cast, called in a fixed order. HELM holds the review gate between each one."
        action={
          <StatusBadge tone={mode.reasoning === 'anthropic' ? 'good' : 'neutral'}>
            {mode.reasoning === 'anthropic' ? 'Model reasoning' : 'Sample reasoning'}
          </StatusBadge>
        }
      />

      <ol className="s-panel mt-5 grid gap-px overflow-hidden bg-line p-0 sm:grid-cols-2 xl:grid-cols-4">
        {ordered.map((agent) => {
          const Icon = KIND_ICON[agent.kind];
          return (
            <li key={agent.key} className="bg-surface px-5 py-5">
              <div className="flex items-center gap-2.5">
                <span className="mono text-[11px] text-ink-400">{String(agent.order).padStart(2, '0')}</span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-control border border-line bg-surface-subtle text-ink-500">
                  <Icon size={15} />
                </span>
              </div>
              <p className="mt-3 text-[14.5px] font-medium text-ink-950">{agent.name}</p>
              <p className="mono mt-0.5 text-[11.5px] text-ink-400">{agent.role}</p>
              <p className="mt-2.5 text-[13px] leading-[19px] text-ink-500">{agent.summary}</p>
              <p className="mono mt-3 border-t border-line pt-2.5 text-[11px] leading-[16px] text-ink-400">
                <span className="uppercase tracking-[0.1em]">Gate</span>
                <br />
                {agent.gate}
              </p>
            </li>
          );
        })}
      </ol>

      {powering.length ? (
        <div className="s-panel-subtle mt-4 px-5 py-4">
          <p className="micro-label">What is powering the fleet</p>
          <ul className="mono mt-2.5 grid gap-x-8 gap-y-2 text-[11.5px] sm:grid-cols-2">
            {powering.map((entry) => (
              <li key={entry.label} className="border-b border-line/70 pb-2">
                <span className="flex justify-between gap-4">
                  <span className="text-ink-400">{entry.label}</span>
                  <span className="text-right text-ink-700">{entry.value}</span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-[16px] text-ink-400">{entry.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
