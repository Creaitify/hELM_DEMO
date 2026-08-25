'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkflowNode, WorkflowNodeState, WorkflowOutputItem } from '@/contracts/fleet';
import { NODE_STATE_LABEL } from '@/contracts/fleet';
import { StatusBadge } from '@/components/primitives/Status';
import { Button } from '@/components/primitives/Button';
import {
  IconAlert,
  IconCheck,
  IconChevronDown,
  IconEvidence,
  IconIntelligence,
  IconRefresh,
  IconScope,
  IconShield,
  IconSpark,
  IconUser,
} from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * The HELM workflow, drawn.
 *
 *   Input / Data → Analyst → HELM Review → Creative → HELM Review
 *   → Human Approval → Image Generation → Final Output
 *
 * Every node answers the same six questions without being opened: what it is,
 * what state it is in, what it is doing, how far along it is, how long it has
 * taken, and what it produced. Motion is used only where it carries meaning —
 * the active node breathes and its connector fills — never as decoration.
 *
 * What is deliberately absent is the model's reasoning. A specialist's private
 * deliberation is not a product surface; the readable update is.
 */

const KIND_ICON = {
  input: IconScope,
  agent: IconIntelligence,
  review: IconShield,
  human: IconUser,
  output: IconEvidence,
} as const;

const AGENT_ICON = {
  scout: IconScope,
  analyst: IconIntelligence,
  creative: IconSpark,
  imager: IconSpark,
} as const;

type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

const STATE_TONE: Record<WorkflowNodeState, Tone> = {
  idle: 'neutral',
  queued: 'neutral',
  working: 'info',
  reviewing: 'info',
  revision_required: 'warn',
  waiting_for_approval: 'warn',
  completed: 'good',
  failed: 'bad',
};

const ACTIVE_STATES: WorkflowNodeState[] = ['working', 'reviewing', 'revision_required'];

function isActive(state: WorkflowNodeState): boolean {
  return ACTIVE_STATES.includes(state);
}

/** Counts up while a node is live, so elapsed time never looks frozen. */
function useElapsed(node: WorkflowNode): string | null {
  const [, tick] = useState(0);
  const live = isActive(node.state) || node.state === 'waiting_for_approval';

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [live]);

  if (!node.startedAt) return null;
  const end = node.endedAt ? Date.parse(node.endedAt) : Date.now();
  const seconds = Math.max(0, Math.round((end - Date.parse(node.startedAt)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export function WorkflowFleet({
  nodes,
  connected,
  onRetry,
  onApprove,
  retrying = false,
  headerNote,
}: {
  nodes: WorkflowNode[];
  connected: boolean;
  /** Re-runs the failed step. Absent when the caller cannot start runs. */
  onRetry?: () => void;
  /** Scrolls to the approval controls rather than navigating away. */
  onApprove?: () => void;
  retrying?: boolean;
  headerNote?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const completed = nodes.filter((node) => node.state === 'completed').length;
  const failedNode = nodes.find((node) => node.state === 'failed');
  const currentNode = nodes.find((node) => isActive(node.state) || node.state === 'waiting_for_approval');
  const finished = completed === nodes.length && nodes.length > 0;

  // Open the node that needs a person, so the thing waiting is never hidden.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current) return;
    const attention = nodes.find((node) => node.state === 'failed' || node.state === 'waiting_for_approval');
    if (attention) {
      setOpenId(attention.id);
      autoOpened.current = true;
    }
  }, [nodes]);

  const whatNext = useMemo(() => {
    if (failedNode) return `${failedNode.label} failed. Retry that step, or cancel the run.`;
    if (currentNode?.state === 'waiting_for_approval') return 'Your approval is the next step.';
    if (currentNode) {
      const next = nodes[nodes.indexOf(currentNode) + 1];
      return next ? `${currentNode.label} is working. ${next.label} is next.` : `${currentNode.label} is working.`;
    }
    if (finished) return 'Complete. The decision memo is ready to read and download.';
    return 'Waiting to start.';
  }, [currentNode, failedNode, finished, nodes]);

  return (
    <section aria-labelledby="workflow" className="s-panel overflow-hidden p-0">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="workflow" className="text-[15px] font-semibold text-ink-950">
            HELM workflow
          </h2>
          <p className="mt-1 max-w-prose text-[13px] leading-[19px] text-ink-500">
            {headerNote ??
              'A fixed cast, called in a fixed order. HELM reviews every specialist output before the run advances, and nothing reaches an ad account without your approval.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {connected && !finished ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-info/25 bg-info-soft px-2.5 py-1">
              <span className="anim-working inline-flex h-1.5 w-1.5 rounded-full bg-info" aria-hidden="true" />
              <span className="mono text-[11px] text-info">Live</span>
            </span>
          ) : null}
          <StatusBadge tone={failedNode ? 'bad' : finished ? 'good' : 'info'}>
            {completed} of {nodes.length} steps
          </StatusBadge>
        </div>
      </header>

      {/* What happens next, stated once, at the top */}
      <p
        aria-live="polite"
        className={cn(
          'flex items-center gap-2 border-b px-5 py-2.5 text-[13px] sm:px-6',
          failedNode
            ? 'border-bad/20 bg-bad-soft text-ink-950'
            : currentNode?.state === 'waiting_for_approval'
              ? 'border-warn/20 bg-warn-soft text-ink-950'
              : 'border-line bg-surface-subtle text-ink-700',
        )}
      >
        {failedNode ? (
          <IconAlert size={15} />
        ) : currentNode?.state === 'waiting_for_approval' ? (
          <IconUser size={15} />
        ) : finished ? (
          <IconCheck size={15} />
        ) : (
          <span className="anim-working inline-flex h-1.5 w-1.5 rounded-full bg-info" aria-hidden="true" />
        )}
        {whatNext}
        {failedNode && onRetry ? (
          <Button
            variant="neutral"
            size="compact"
            className="ml-auto"
            leading={<IconRefresh size={14} />}
            onClick={onRetry}
            pending={retrying}
            pendingLabel="Retrying…"
          >
            Retry {failedNode.label}
          </Button>
        ) : null}
        {currentNode?.state === 'waiting_for_approval' && onApprove ? (
          <Button variant="action" size="compact" className="ml-auto" onClick={onApprove}>
            Review the proposals
          </Button>
        ) : null}
      </p>

      <ol className="divide-y divide-line">
        {nodes.map((node, index) => (
          <WorkflowRow
            key={node.id}
            node={node}
            index={index}
            isLast={index === nodes.length - 1}
            open={openId === node.id}
            onToggle={() => setOpenId((current) => (current === node.id ? null : node.id))}
          />
        ))}
      </ol>
    </section>
  );
}

function WorkflowRow({
  node,
  index,
  isLast,
  open,
  onToggle,
}: {
  node: WorkflowNode;
  index: number;
  isLast: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const elapsed = useElapsed(node);
  const active = isActive(node.state);
  const attention = node.state === 'waiting_for_approval' || node.state === 'failed';
  const Icon = node.agent ? AGENT_ICON[node.agent] : KIND_ICON[node.kind];
  const expandable = Boolean(node.output?.items.length || node.error);

  return (
    <li
      className={cn(
        'relative transition-colors',
        active && 'bg-info-soft/30',
        node.state === 'failed' && 'bg-bad-soft/30',
        node.state === 'waiting_for_approval' && 'bg-warn-soft/30',
      )}
    >
      <div className="flex gap-3 px-5 py-4 sm:gap-4 sm:px-6">
        {/* Connector: a filled rule for done, a travelling signal for active */}
        <div className="relative flex w-7 shrink-0 flex-col items-center">
          <span
            className={cn(
              'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
              node.state === 'completed'
                ? 'border-good bg-good text-white'
                : node.state === 'failed'
                  ? 'border-bad bg-bad text-white'
                  : active
                    ? 'border-info bg-info-soft text-info'
                    : node.state === 'waiting_for_approval'
                      ? 'border-warn bg-warn-soft text-warn'
                      : 'border-line-strong bg-surface text-ink-400',
            )}
          >
            {node.state === 'completed' ? (
              <IconCheck size={13} strokeWidth={3} />
            ) : node.state === 'failed' ? (
              <IconAlert size={13} />
            ) : (
              <Icon size={14} />
            )}
            {active ? (
              <span
                aria-hidden="true"
                className="anim-working absolute inset-0 rounded-full border border-info/50"
              />
            ) : null}
          </span>

          {!isLast ? (
            <span aria-hidden="true" className="relative mt-1 w-px flex-1 overflow-hidden bg-line">
              <span
                className={cn(
                  'absolute inset-x-0 top-0 transition-[height] duration-500',
                  node.state === 'completed' ? 'h-full bg-good/50' : active ? 'h-1/2 bg-info/60' : 'h-0',
                )}
              />
              {active ? (
                <span className="anim-signal absolute inset-x-0 h-3 rounded-full bg-info" />
              ) : null}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="mono text-[11px] text-ink-400">{String(index + 1).padStart(2, '0')}</span>
                <span className="text-[14.5px] font-medium text-ink-950">{node.label}</span>
                {node.revision > 1 ? (
                  <span className="mono text-[11px] text-warn">
                    revision {node.revision} of {node.maxRevisions}
                  </span>
                ) : null}
              </p>
              <p className="mono mt-0.5 text-[11.5px] text-ink-400">{node.role}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {elapsed ? <span className="mono text-[11px] text-ink-400">{elapsed}</span> : null}
              <StatusBadge tone={STATE_TONE[node.state]}>{NODE_STATE_LABEL[node.state]}</StatusBadge>
            </div>
          </div>

          {/* The readable update — never internal reasoning */}
          {node.activity || node.task ? (
            <p
              className={cn(
                'mt-2 flex items-center gap-2 text-[13.5px] leading-[20px]',
                attention ? 'text-ink-950' : 'text-ink-700',
              )}
            >
              {active ? (
                <span className="anim-working inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-info" aria-hidden="true" />
              ) : null}
              {node.activity ?? node.task}
            </p>
          ) : null}

          {node.error ? <p className="mt-2 text-[13px] leading-[19px] text-bad">{node.error}</p> : null}

          {/* Progress, only while it means something */}
          {node.state !== 'idle' && node.state !== 'queued' && node.state !== 'completed' ? (
            <div
              className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuenow={node.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${node.label} progress`}
            >
              <span
                className={cn(
                  'block h-full rounded-full transition-[width] duration-500 ease-out',
                  node.state === 'failed' ? 'bg-bad' : node.state === 'waiting_for_approval' ? 'bg-warn' : 'bg-info',
                )}
                style={{ width: `${Math.max(4, node.progress)}%` }}
              />
            </div>
          ) : null}

          {expandable ? (
            <>
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-helm-600 transition-colors hover:text-ink-950"
              >
                <IconChevronDown
                  size={14}
                  className={cn('transition-transform duration-200', open && 'rotate-180')}
                />
                {open ? 'Hide' : node.output ? node.output.summary : 'Details'}
              </button>

              {open ? (
                <div className="mt-3 rounded-field border border-line bg-surface px-4 py-3.5">
                  {node.output ? <OutputPanel items={node.output.items} /> : null}
                  {node.error ? (
                    <p className="mono mt-2 text-[11.5px] leading-[17px] text-bad">{node.error}</p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function OutputPanel({ items }: { items: WorkflowOutputItem[] }) {
  const images = items.filter((item) => item.imageUrl);
  const rows = items.filter((item) => !item.imageUrl);

  return (
    <div className="space-y-3">
      {images.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-control border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={item.title} className="block w-full bg-night-900" />
              <span className="block px-2.5 py-2">
                <span className="block truncate text-[12.5px] text-ink-950">{item.title}</span>
                {item.meta ? <span className="mono block text-[10.5px] text-ink-400">{item.meta}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {rows.length ? (
        <ul className="divide-y divide-line/70">
          {rows.map((item) => (
            <li key={item.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full',
                  item.tone === 'good'
                    ? 'bg-good'
                    : item.tone === 'warn'
                      ? 'bg-warn'
                      : item.tone === 'bad'
                        ? 'bg-bad'
                        : 'bg-ink-400',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] leading-[19px] text-ink-950">{item.title}</span>
                {item.detail ? (
                  <span className="mt-0.5 block text-[12.5px] leading-[18px] text-ink-500">{item.detail}</span>
                ) : null}
              </span>
              {item.meta ? (
                <span className="mono shrink-0 text-[11px] text-ink-400">{item.meta}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
