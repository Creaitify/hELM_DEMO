import type { Artifact, Finding, IntelligenceRun, Recommendation, RunStage } from './index';

/**
 * The HELM workflow and the fleet that walks it.
 *
 *   Input / Data → Analyst → HELM Review → Creative → HELM Review
 *   → Human Approval → Image Generation → Final Output
 *
 * Four specialists do the work; HELM holds the two review gates and the person
 * holds the approval. The interface draws these nodes directly, so what is
 * rendered and what the orchestrator executes cannot drift apart.
 */

export type AgentKey = 'scout' | 'analyst' | 'creative' | 'imager';

export type AgentDefinition = {
  key: AgentKey;
  name: string;
  role: string;
  kind: 'retrieval' | 'reasoning' | 'planning' | 'generative';
  summary: string;
  reads: string[];
  writes: string[];
  /** The review gate its output must clear before the run advances. */
  gate: string;
  order: number;
  model: string;
  setting: string;
};

export type WorkflowNodeId =
  | 'input'
  | 'analyst'
  | 'review_analysis'
  | 'creative'
  | 'review_creative'
  | 'approval'
  | 'images'
  | 'output';

export type WorkflowNodeKind = 'input' | 'agent' | 'review' | 'human' | 'output';

export type WorkflowNodeState =
  | 'idle'
  | 'queued'
  | 'working'
  | 'reviewing'
  | 'revision_required'
  | 'waiting_for_approval'
  | 'completed'
  | 'failed';

export type WorkflowOutputItem = {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
  imageUrl?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
};

export type WorkflowOutput = {
  kind: 'data' | 'findings' | 'recommendations' | 'verdict' | 'directions' | 'images' | 'memo';
  summary: string;
  items: WorkflowOutputItem[];
};

export type WorkflowNode = {
  id: WorkflowNodeId;
  label: string;
  role: string;
  kind: WorkflowNodeKind;
  agent?: AgentKey;
  stage: RunStage;
  state: WorkflowNodeState;
  /** What this node is doing right now, in the user's language. */
  task: string | null;
  /** The most recent readable update. Never internal reasoning. */
  activity: string | null;
  progress: number;
  startedAt?: string;
  endedAt?: string;
  elapsedMs?: number;
  revision: number;
  maxRevisions: number;
  output?: WorkflowOutput;
  error?: string;
  retryable: boolean;
};

export type AgentInvocationStatus = 'queued' | 'running' | 'review' | 'passed' | 'revised' | 'failed';

export type AgentInvocation = {
  id: string;
  runId: string;
  workspaceSlug: string;
  agent: AgentKey;
  status: AgentInvocationStatus;
  revision: number;
  startedAt: string;
  endedAt?: string;
  latencyMs?: number;
  verdict?: 'passed' | 'revision_requested' | 'rejected';
  verdictNote?: string;
  qualityScore?: number;
  groundingScore?: number;
  tokensIn?: number;
  tokensOut?: number;
  producedIds: string[];
  note?: string;
};

export type FleetAgentHealth = AgentDefinition & {
  live: boolean;
  runs: number;
  avgLatencyMs: number | null;
  lastRunAt: string | null;
  passRate: number | null;
};

export type FleetSnapshot = {
  agents: FleetAgentHealth[];
  powering: { label: string; value: string; note: string }[];
  activeRunId: string | null;
  activeSummary: string | null;
  activeProgress: number | null;
  invocations: AgentInvocation[];
};

export type FleetEvent =
  | { type: 'run.stage'; runId: string; stage: RunStage; label: string; at: string }
  | { type: 'workflow.node'; runId: string; node: WorkflowNode; at: string }
  | { type: 'agent.started'; runId: string; invocation: AgentInvocation; at: string }
  | { type: 'agent.progress'; runId: string; agent: AgentKey; message: string; at: string }
  | { type: 'agent.review'; runId: string; invocation: AgentInvocation; at: string }
  | { type: 'agent.finished'; runId: string; invocation: AgentInvocation; at: string }
  | { type: 'graph.write'; runId: string; label: string; detail: string; at: string }
  | { type: 'run.finding'; runId: string; finding: Finding; at: string }
  | { type: 'run.recommendation'; runId: string; recommendation: Recommendation; at: string }
  | { type: 'run.artifact'; runId: string; artifact: Artifact; at: string }
  | { type: 'run.completed'; runId: string; run: IntelligenceRun; at: string }
  | { type: 'run.failed'; runId: string; reason: string; at: string };

export const AGENT_ORDER: AgentKey[] = ['scout', 'analyst', 'creative', 'imager'];

export const WORKFLOW_ORDER: WorkflowNodeId[] = [
  'input',
  'analyst',
  'review_analysis',
  'creative',
  'review_creative',
  'approval',
  'images',
  'output',
];

export const NODE_STATE_LABEL: Record<WorkflowNodeState, string> = {
  idle: 'Idle',
  queued: 'Queued',
  working: 'Working',
  reviewing: 'Reviewing',
  revision_required: 'Revision required',
  waiting_for_approval: 'Waiting for approval',
  completed: 'Completed',
  failed: 'Failed',
};
