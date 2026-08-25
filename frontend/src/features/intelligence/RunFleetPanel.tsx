'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IntelligenceRun } from '@/contracts';
import type { WorkflowNode } from '@/contracts/fleet';
import { WorkflowFleet } from './WorkflowFleet';
import { useRunStream } from './useRunStream';
import { api, describeError } from '@/lib/api';

/**
 * Binds one run's live workflow to the surface that draws it.
 *
 * The run page renders from the server first, so the whole record is present
 * without JavaScript. This island adds the live layer on top and asks the
 * route to re-read once the run settles, so the server copy replaces the
 * streamed one rather than the two disagreeing.
 */
export function RunFleetPanel({
  workspaceSlug,
  run,
  workflow,
  canRun,
  powering,
}: {
  workspaceSlug: string;
  run: IntelligenceRun;
  /** The server's copy of the eight nodes, used until the stream speaks. */
  workflow: WorkflowNode[];
  canRun: boolean;
  powering?: { label: string; value: string; note: string }[];
}) {
  const router = useRouter();
  const settled = ['complete', 'cancelled', 'blocked', 'failed'].includes(run.stage);

  const stream = useRunStream(workspaceSlug, run.id, { enabled: !settled });
  const [retrying, setRetrying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const refreshed = useRef(false);
  useEffect(() => {
    if (refreshed.current) return;
    if (stream.run || stream.failure) {
      refreshed.current = true;
      router.refresh();
    }
  }, [stream.run, stream.failure, router]);

  const nodes = stream.workflow ?? workflow;

  const retry = async () => {
    setRetrying(true);
    setProblem(null);
    try {
      await api.post(`/api/workspaces/${workspaceSlug}/intelligence/${run.id}/retry`);
      router.refresh();
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setRetrying(false);
    }
  };

  /** Approval lives further down the same page; never navigate away for it. */
  const scrollToApproval = () => {
    document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (nodes.length === 0) return null;

  return (
    <div className="space-y-3">
      <WorkflowFleet
        nodes={nodes}
        connected={stream.connected}
        onRetry={canRun ? () => void retry() : undefined}
        onApprove={scrollToApproval}
        retrying={retrying}
      />

      <div aria-live="polite">
        {problem ? <p className="text-[13px] text-bad">{problem}</p> : null}
      </div>

      {powering?.length ? (
        <details className="s-panel-subtle px-5 py-3.5">
          <summary className="cursor-pointer text-[12.5px] text-ink-500 hover:text-ink-950">
            What is powering the fleet
          </summary>
          <ul className="mono mt-3 grid gap-x-8 gap-y-2 text-[11.5px] sm:grid-cols-2">
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
        </details>
      ) : null}
    </div>
  );
}
