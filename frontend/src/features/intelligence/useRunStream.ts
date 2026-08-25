'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AgentKey, FleetEvent, WorkflowNode, WorkflowNodeId } from '@/contracts/fleet';
import { WORKFLOW_ORDER } from '@/contracts/fleet';
import type { Artifact, Finding, IntelligenceRun, Recommendation, RunStage } from '@/contracts';

/**
 * Subscribes to one run's live workflow.
 *
 * The server replays the run's buffered events before following live, so a
 * client that opens the page halfway through still sees the whole story rather
 * than joining a stream already in progress.
 *
 * The connection closes itself once the run settles — there is nothing further
 * to hear, and an idle EventSource would keep retrying.
 */

export type RunStreamState = {
  connected: boolean;
  stage: RunStage | null;
  stageLabel: string | null;
  /** The eight workflow nodes in order, or null before the first event. */
  workflow: WorkflowNode[] | null;
  /** Newest first. What the fleet did, in the user's language. */
  activity: { id: string; at: string; agent: AgentKey | null; message: string; kind: FleetEvent['type'] }[];
  findings: Finding[];
  recommendations: Recommendation[];
  artifacts: Artifact[];
  run: IntelligenceRun | null;
  failure: string | null;
};

const AGENT_LABEL: Record<AgentKey, string> = {
  scout: 'Signal Scout',
  analyst: 'Diagnostic Analyst',
  creative: 'Creative Director',
  imager: 'Image Studio',
};

function describe(event: FleetEvent): { agent: AgentKey | null; message: string } | null {
  switch (event.type) {
    case 'run.stage':
      return { agent: null, message: `HELM — ${event.label}` };
    case 'workflow.node':
      return event.node.activity ? { agent: event.node.agent ?? null, message: event.node.activity } : null;
    case 'agent.started':
      return { agent: event.invocation.agent, message: `${AGENT_LABEL[event.invocation.agent]} called` };
    case 'agent.progress':
      return { agent: event.agent, message: event.message };
    case 'agent.review':
      return {
        agent: event.invocation.agent,
        message:
          event.invocation.status === 'revised'
            ? `HELM asked for revision ${event.invocation.revision}`
            : 'At the HELM review',
      };
    case 'agent.finished':
      return {
        agent: event.invocation.agent,
        message:
          event.invocation.verdict === 'passed'
            ? `Cleared the review — ${event.invocation.note ?? 'output accepted'}`
            : `Rejected at the review — ${event.invocation.verdictNote ?? 'output not accepted'}`,
      };
    case 'graph.write':
      return { agent: null, message: `Saved ${event.label} — ${event.detail}` };
    case 'run.finding':
      return { agent: 'analyst', message: `Finding: ${event.finding.title}` };
    case 'run.recommendation':
      return { agent: 'analyst', message: `Proposal: ${event.recommendation.action}` };
    case 'run.artifact':
      return { agent: 'creative', message: `Artifact: ${event.artifact.title}` };
    case 'run.completed':
      return { agent: null, message: 'HELM — Complete' };
    case 'run.failed':
      return { agent: null, message: `Run stopped — ${event.reason}` };
    default:
      return null;
  }
}

export function useRunStream(
  workspaceSlug: string,
  runId: string,
  options: { enabled?: boolean } = {},
): RunStreamState {
  const enabled = options.enabled ?? true;
  const [events, setEvents] = useState<FleetEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource(`/api/workspaces/${workspaceSlug}/intelligence/${runId}/stream`, {
      withCredentials: true,
    });

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as FleetEvent;
        setEvents((current) => [...current, event]);
        if (event.type === 'run.completed' || event.type === 'run.failed') {
          source.close();
          setConnected(false);
        }
      } catch {
        /* a malformed frame is not worth tearing the stream down for */
      }
    };

    return () => source.close();
  }, [enabled, workspaceSlug, runId]);

  return useMemo(() => {
    const nodes = new Map<WorkflowNodeId, WorkflowNode>();
    const findings = new Map<string, Finding>();
    const recommendations = new Map<string, Recommendation>();
    const artifacts = new Map<string, Artifact>();

    let stage: RunStage | null = null;
    let stageLabel: string | null = null;
    let run: IntelligenceRun | null = null;
    let failure: string | null = null;
    const activity: RunStreamState['activity'] = [];

    for (const [index, event] of events.entries()) {
      if (event.type === 'run.stage') {
        stage = event.stage;
        stageLabel = event.label;
      }
      if (event.type === 'workflow.node') nodes.set(event.node.id, event.node);
      if (event.type === 'run.finding') findings.set(event.finding.id, event.finding);
      if (event.type === 'run.recommendation') recommendations.set(event.recommendation.id, event.recommendation);
      if (event.type === 'run.artifact') artifacts.set(event.artifact.id, event.artifact);
      if (event.type === 'run.completed') {
        run = event.run;
        stage = event.run.stage;
        for (const node of event.run.workflow ?? []) nodes.set(node.id, node);
      }
      if (event.type === 'run.failed') failure = event.reason;

      const described = describe(event);
      if (described) {
        const last = activity[0];
        // Collapse an update that only repeats the previous line.
        if (!last || last.message !== described.message) {
          activity.unshift({
            id: `${event.at}-${index}`,
            at: event.at,
            agent: described.agent,
            message: described.message,
            kind: event.type,
          });
        }
      }
    }

    const workflow = nodes.size
      ? (WORKFLOW_ORDER.map((id) => nodes.get(id)).filter(Boolean) as WorkflowNode[])
      : null;

    return {
      connected,
      stage,
      stageLabel,
      workflow,
      activity,
      findings: [...findings.values()],
      recommendations: [...recommendations.values()],
      artifacts: [...artifacts.values()],
      run,
      failure,
    };
  }, [events, connected]);
}

export { AGENT_LABEL };
