import type { AgentKey, RunStage } from './types.js';

/**
 * The HELM workflow.
 *
 * One legible spine that the product draws directly:
 *
 *   Input / Data → Analyst → HELM Review → Creative → HELM Review
 *   → Human Approval → Image Generation → Final Output
 *
 * Four specialists do the work; HELM holds the two review gates and the person
 * holds the approval. A node is the unit the interface renders, so what the
 * user sees and what the orchestrator executes cannot drift apart.
 */

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
  /** Present on the four specialist nodes. */
  agent?: AgentKey;
  stage: RunStage;
  state: WorkflowNodeState;
  /** What this node is doing right now, in the user's language. */
  task: string | null;
  /** The most recent readable update. Never internal reasoning. */
  activity: string | null;
  /** 0–100 for this node alone. */
  progress: number;
  startedAt?: string;
  endedAt?: string;
  elapsedMs?: number;
  revision: number;
  maxRevisions: number;
  /** The result the user can expand inline once the node has produced one. */
  output?: WorkflowOutput;
  error?: string;
  /** True when a failed node can be run again without restarting the run. */
  retryable: boolean;
};

export const WORKFLOW_NODE_IDS = [
  'input',
  'analyst',
  'review_analysis',
  'creative',
  'review_creative',
  'approval',
  'images',
  'output',
] as const;

export type WorkflowNodeId = (typeof WORKFLOW_NODE_IDS)[number];

type Blueprint = {
  id: WorkflowNodeId;
  label: string;
  role: string;
  kind: WorkflowNodeKind;
  agent?: AgentKey;
  stage: RunStage;
};

export const WORKFLOW: Blueprint[] = [
  {
    id: 'input',
    label: 'Input / Data',
    role: 'Reconciles the connected accounts',
    kind: 'input',
    agent: 'scout',
    stage: 'collecting_data',
  },
  {
    id: 'analyst',
    label: 'Analyst',
    role: 'Explains what moved and what to do',
    kind: 'agent',
    agent: 'analyst',
    stage: 'analyzing',
  },
  {
    id: 'review_analysis',
    label: 'HELM Review',
    role: 'Checks the analysis before it advances',
    kind: 'review',
    stage: 'reviewing_analysis',
  },
  {
    id: 'creative',
    label: 'Creative',
    role: 'Writes replacement directions',
    kind: 'agent',
    agent: 'creative',
    stage: 'creating',
  },
  {
    id: 'review_creative',
    label: 'HELM Review',
    role: 'Checks the direction against the brief',
    kind: 'review',
    stage: 'reviewing_creative',
  },
  {
    id: 'approval',
    label: 'Human Approval',
    role: 'You decide what proceeds',
    kind: 'human',
    stage: 'waiting_for_approval',
  },
  {
    id: 'images',
    label: 'Image Generation',
    role: 'Renders the approved directions',
    kind: 'agent',
    agent: 'imager',
    stage: 'generating_images',
  },
  {
    id: 'output',
    label: 'Final Output',
    role: 'The decision memo and its assets',
    kind: 'output',
    stage: 'complete',
  },
];

export function blueprintFor(id: WorkflowNodeId): Blueprint {
  return WORKFLOW.find((node) => node.id === id) as Blueprint;
}

/** A fresh, unstarted workflow — what the UI draws before a run begins. */
export function emptyWorkflow(maxRevisions: number): WorkflowNode[] {
  return WORKFLOW.map((node) => ({
    ...node,
    state: 'idle' as WorkflowNodeState,
    task: null,
    activity: null,
    progress: 0,
    revision: 0,
    maxRevisions,
    retryable: false,
  }));
}
