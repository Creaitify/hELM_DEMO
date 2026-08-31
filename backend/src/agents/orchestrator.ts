import { randomUUID } from 'node:crypto';
import { env } from '../env.js';
import type {
  AdAccount,
  AgentInvocation,
  AgentKey,
  Artifact,
  CampaignSummary,
  CreativeSummary,
  DataBasis,
  Evidence,
  Finding,
  FleetAgentHealth,
  FleetSnapshot,
  IntelligenceRun,
  MetricSeries,
  MetricValue,
  Recommendation,
  RunStage,
  RunStageRecord,
  SessionUser,
  WorkflowNode,
  WorkflowNodeId,
  WorkflowNodeState,
  WorkflowOutput,
} from '../domain/types.js';
import { WORKFLOW, blueprintFor, emptyWorkflow } from '../domain/workflow.js';
import { AGENTS, AGENT_ORDER, poweringTheFleet } from './registry.js';
import { fleetBus } from './bus.js';
import { buildEvidencePack, type EvidencePack } from './evidence-pack.js';
import { reasonJson, reasoningMode } from '../providers/anthropic.js';
import { generateImage, imageProviderName } from '../providers/images.js';
import * as repo from '../graph/repository.js';
import { brandBriefing, resolveBrandKit } from '../domain/brand.js';
import { storeStudioAsset } from '../studio/assets.js';
import { scriptedCreative, scriptedFindings, scriptedRecommendations } from './scripted.js';

/**
 * The orchestrator.
 *
 * It walks one workflow:
 *
 *   Input / Data → Analyst → HELM Review → Creative → HELM Review
 *   → Human Approval → Image Generation → Final Output
 *
 * Every transition updates the node the interface is drawing and is emitted on
 * the fleet bus, so the product shows real work in the user's language —
 * "Comparing campaign performance", not a spinner and not a model's private
 * reasoning, which never leaves this module.
 */

const STAGE_LABEL: Record<RunStage, string> = {
  queued: 'Queued',
  collecting_data: 'Collecting data',
  analyzing: 'Analyzing',
  reviewing_analysis: 'HELM review',
  creating: 'Creating',
  reviewing_creative: 'HELM review',
  waiting_for_approval: 'Waiting for your approval',
  generating_images: 'Generating images',
  complete: 'Complete',
  cancelled: 'Cancelled',
  blocked: 'Blocked',
  failed: 'Failed',
};

export type StartRunInput = {
  workspaceId: string;
  workspaceSlug: string;
  user: Pick<SessionUser, 'id' | 'name'>;
  intent: string;
  question?: string;
  scopeId: string;
  scopeLabel: string;
  rangeLabel: string;
  currency: string;
  campaignIds: string[];
  attachBrand: boolean;
  /** Ask the image studio to render the approved directions. */
  generateCreative: boolean;
  accounts: AdAccount[];
  campaigns: CampaignSummary[];
  creatives: CreativeSummary[];
  basis: DataBasis;
};

type RunContext = StartRunInput & {
  run: IntelligenceRun;
  pack: EvidencePack;
  nodes: Map<WorkflowNodeId, WorkflowNode>;
  cancelled: boolean;
  findings: Finding[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  directions: { title: string; headline: string; subline: string; rationale: string; direction: string }[];
  artifacts: Artifact[];
  /** Set once the run has been carried past approval, so it happens once. */
  resuming?: boolean;
};

const active = new Map<string, RunContext>();

/**
 * Rehydrations in flight.
 *
 * Rebuilding a context is several round trips, and decisions arrive faster
 * than that. Without this, two of them both see an empty `active`, both
 * rebuild, and the second overwrites the first — discarding whatever the first
 * had already recorded on it.
 */
const rehydrating = new Map<string, Promise<RunContext | null>>();
const invocationLog: AgentInvocation[] = [];

const INTENT_TITLE: Record<string, string> = {
  diagnose: 'Why performance moved',
  weekly: 'Weekly review',
  budget: 'Where the next unit of budget should go',
  fatigue: 'Creative fatigue investigation',
  creative: 'New creative directions',
  custom: 'Investigation',
};

const nowIso = () => new Date().toISOString();
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------- node state -- */

function nodeList(context: RunContext): WorkflowNode[] {
  return WORKFLOW.map((blueprint) => context.nodes.get(blueprint.id)!);
}

/** Writes a node change, pushes it to subscribers, and keeps the run in step. */
function setNode(context: RunContext, id: WorkflowNodeId, patch: Partial<WorkflowNode>) {
  const current = context.nodes.get(id)!;
  const next: WorkflowNode = { ...current, ...patch };

  if (patch.state === 'working' && !current.startedAt) next.startedAt = nowIso();
  if (patch.state === 'completed' || patch.state === 'failed') {
    next.endedAt = nowIso();
    next.progress = patch.state === 'completed' ? 100 : current.progress;
  }
  if (next.startedAt) {
    next.elapsedMs = (next.endedAt ? Date.parse(next.endedAt) : Date.now()) - Date.parse(next.startedAt);
  }

  context.nodes.set(id, next);
  context.run.workflow = nodeList(context);
  fleetBus.emit({ type: 'workflow.node', runId: context.run.id, node: next, at: nowIso() });
}

/** A short, readable update. Never a model's internal reasoning. */
function say(context: RunContext, id: WorkflowNodeId, activity: string, progress?: number) {
  setNode(context, id, {
    activity,
    ...(progress === undefined ? {} : { progress: Math.max(0, Math.min(100, progress)) }),
  });
  const node = context.nodes.get(id)!;
  if (node.agent) {
    fleetBus.emit({ type: 'agent.progress', runId: context.run.id, agent: node.agent, message: activity, at: nowIso() });
  }
}

function graphWrite(context: RunContext, label: string, detail: string) {
  fleetBus.emit({ type: 'graph.write', runId: context.run.id, label, detail, at: nowIso() });
}

/** The stage records the memo timeline renders, derived from the same nodes. */
function stageRecords(context: RunContext): RunStageRecord[] {
  const stateFor = (state: WorkflowNodeState): RunStageRecord['state'] =>
    state === 'completed'
      ? 'done'
      : state === 'failed'
        ? 'failed'
        : state === 'idle' || state === 'queued'
          ? 'pending'
          : 'active';

  return nodeList(context).map((node) => ({
    stage: node.stage,
    label: node.label,
    state: stateFor(node.state),
    detail: node.activity ?? node.role,
    at: node.endedAt ?? node.startedAt,
  }));
}

async function setStage(context: RunContext, stage: RunStage, summary?: string) {
  context.run.stage = stage;
  if (summary) context.run.summary = summary;
  if (stage === 'complete') context.run.completedAt = nowIso();
  context.run.stages = stageRecords(context);
  context.run.workflow = nodeList(context);
  await repo.upsertRun(context.workspaceId, context.run);
  fleetBus.emit({ type: 'run.stage', runId: context.run.id, stage, label: STAGE_LABEL[stage], at: nowIso() });
}

/* ------------------------------------------------------------------ run -- */

export async function startRun(input: StartRunInput): Promise<IntelligenceRun> {
  if (active.size >= env.fleet.maxConcurrentRuns) {
    throw Object.assign(new Error('Too many investigations are already running'), { code: 'rate_limited' });
  }

  const runId = `run_${randomUUID().slice(0, 8)}`;
  const pack = buildEvidencePack({
    scopeLabel: input.scopeLabel,
    rangeLabel: input.rangeLabel,
    currency: input.currency,
    accounts: input.accounts,
    campaigns: input.campaigns,
    creatives: input.creatives,
    basis: input.basis,
    focusCampaignIds: input.campaignIds,
  });

  const nodes = new Map<WorkflowNodeId, WorkflowNode>(
    emptyWorkflow(env.fleet.maxRevisions).map((node) => [node.id, node]),
  );

  const run: IntelligenceRun = {
    id: runId,
    workspaceSlug: input.workspaceSlug,
    title: input.question?.trim() || INTENT_TITLE[input.intent] || 'Investigation',
    intent: input.intent,
    stage: 'queued',
    stages: [],
    workflow: [...nodes.values()],
    startedAt: nowIso(),
    requestedBy: input.user.name,
    scopeLabel: input.scopeLabel,
    rangeLabel: input.rangeLabel,
    findingIds: [],
    recommendationIds: [],
    summary: 'Queued. The fleet is about to collect data.',
  };

  await repo.upsertRun(input.workspaceId, run);

  const context: RunContext = {
    ...input,
    run,
    pack,
    nodes,
    cancelled: false,
    findings: [],
    recommendations: [],
    evidence: [],
    directions: [],
    artifacts: [],
  };
  active.set(runId, context);

  for (const node of WORKFLOW) setNode(context, node.id, { state: 'queued' });

  void execute(context).catch(async (error) => {
    const reason = error instanceof Error ? error.message : String(error);
    context.run.stage = 'failed';
    context.run.summary = `The run stopped: ${reason}`;
    context.run.stages = stageRecords(context);
    await repo.upsertRun(context.workspaceId, context.run);
    fleetBus.emit({ type: 'run.failed', runId, reason, at: nowIso() });
    active.delete(runId);
  });

  return run;
}

async function execute(context: RunContext) {
  await delay(Math.round(env.fleet.stepDelayMs / 2));
  if (context.cancelled) return;

  await runInput(context);
  if (context.cancelled) return;

  await runAnalyst(context);
  if (context.cancelled) return;

  await runCreative(context);
  if (context.cancelled) return;

  await awaitApproval(context);
}

export function isRunActive(runId: string): boolean {
  return active.has(runId);
}

/**
 * The in-memory copy of a run that is still working.
 *
 * Node transitions happen far faster than it is worth writing to the database,
 * so the graph is written on each stage change and this is the authority in
 * between. A reader always prefers it when the run is live.
 */
export function liveRun(runId: string): IntelligenceRun | null {
  const context = active.get(runId);
  if (!context) return null;
  return { ...context.run, workflow: nodeList(context) };
}

export function cancelRun(runId: string): boolean {
  const context = active.get(runId);
  if (!context) return false;
  context.cancelled = true;
  for (const node of nodeList(context)) {
    if (node.state === 'working' || node.state === 'reviewing' || node.state === 'queued') {
      setNode(context, node.id, { state: 'idle', activity: 'Cancelled before this step ran' });
    }
  }
  context.run.stage = 'cancelled';
  context.run.summary = 'Cancelled before completion. Nothing was written to your ad accounts.';
  context.run.stages = stageRecords(context);
  void repo.upsertRun(context.workspaceId, context.run);
  fleetBus.emit({ type: 'run.failed', runId, reason: 'Cancelled by the requester', at: nowIso() });
  active.delete(runId);
  return true;
}

/**
 * Records one specialist call that does not pass through a review gate.
 *
 * The scout and the image studio are gated by what they can physically do —
 * a missing account or a failed render is not a judgement call — but they
 * still belong in the fleet's health numbers, so their work is logged the
 * same way.
 */
async function recordInvocation(
  context: RunContext,
  agent: AgentKey,
  startedAt: number,
  outcome: { ok: boolean; producedIds: string[]; note: string; detail?: string },
) {
  const invocation: AgentInvocation = {
    id: `inv_${randomUUID().slice(0, 8)}`,
    runId: context.run.id,
    workspaceSlug: context.workspaceSlug,
    agent,
    status: outcome.ok ? 'passed' : 'failed',
    revision: 1,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: nowIso(),
    latencyMs: Date.now() - startedAt,
    verdict: outcome.ok ? 'passed' : 'rejected',
    verdictNote: outcome.detail ?? AGENTS[agent].gate,
    producedIds: outcome.producedIds,
    note: outcome.note,
  };
  await repo.upsertInvocation(invocation);
  invocationLog.unshift(invocation);
  fleetBus.emit({ type: 'agent.finished', runId: context.run.id, invocation, at: nowIso() });
}

/* ------------------------------------------------------------ the gates -- */

type StepResult = {
  producedIds: string[];
  /** 0–1. How much of the output traces to the evidence pack. */
  grounding: number;
  /** 0–1. Completeness against the node's stated gate. */
  quality: number;
  tokensIn: number;
  tokensOut: number;
  note: string;
  output: WorkflowOutput;
  /** What the reviewer reads. Structural scores cannot judge prose alone. */
  reviewable?: unknown;
  /**
   * The evidence this step was actually given.
   *
   * A reviewer can only judge whether something is grounded against the
   * ground the author was standing on. Showing it a different slice makes it
   * confidently wrong in one direction: everything the specialist legitimately
   * cited looks invented.
   */
  groundedIn?: unknown;
};

type Verdict = { grounding: number; quality: number; passed: boolean; note: string; reviewedBy: string };

/** Below this a specialist is sent back for a revision. */
const GATE_THRESHOLD = 0.72;

async function reviewAtGate(context: RunContext, agent: AgentKey, result: StepResult): Promise<Verdict> {
  const definition = AGENTS[agent];

  if (!result.reviewable || reasoningMode() !== 'anthropic') {
    return {
      grounding: result.grounding,
      quality: result.quality,
      passed: result.grounding >= GATE_THRESHOLD,
      note: definition.gate,
      reviewedBy: 'deterministic gate',
    };
  }

  const judgement = await reasonJson({
    system:
      'You are HELM reviewing one specialist output before the person who asked ever sees it. You are strict, and you are not the author. Score grounding and quality between 0 and 1. Refuse anything that states a figure absent from the evidence, blends accounts the evidence marks as separated, or promises a certain outcome. Judge only the claims: written copy is the specialist\'s job, so a headline, a subline or a name it was asked to write is not a fabricated fact and must not be scored as one. Answer with the scores and one short sentence — never with your reasoning.',
    prompt: `Specialist: ${definition.name} — ${definition.role}
Gate: ${definition.gate}
Standing instruction: ${definition.setting}

Evidence available to it:
${JSON.stringify(
  result.groundedIn ?? {
    totals: context.pack.totals,
    accounts: context.pack.accounts,
    exclusions: context.pack.exclusions,
  },
  null,
  2,
)}

Its output:
${JSON.stringify(result.reviewable, null, 2)}`,
    shape: '{"grounding": 0.0, "quality": 0.0, "passed": true, "note": "one short sentence"}',
    fallback: {
      grounding: result.grounding,
      quality: result.quality,
      passed: Math.min(result.grounding, result.quality) >= GATE_THRESHOLD,
      note: definition.gate,
    },
    model: env.anthropic.reviewModel,
    maxTokens: 512,
  });

  const value = judgement.value;
  const grounding = Number.isFinite(Number(value.grounding))
    ? Math.max(0, Math.min(1, Number(value.grounding)))
    : result.grounding;
  const quality = Number.isFinite(Number(value.quality))
    ? Math.max(0, Math.min(1, Number(value.quality)))
    : result.quality;

  return {
    // A reviewer may lower a structural score; it may not invent a better one.
    grounding: Math.min(grounding, result.grounding + 0.15),
    quality,
    passed: Boolean(value.passed) && grounding >= GATE_THRESHOLD * 0.9,
    note: String(value.note ?? definition.gate),
    reviewedBy: judgement.live ? judgement.model : 'deterministic gate',
  };
}

/**
 * Runs one specialist node, then its review node.
 *
 * A failing verdict sends the specialist back, up to MAX_AGENT_REVISIONS. The
 * specialist never grades itself and never advances its own work.
 */
async function withGate(
  context: RunContext,
  workNodeId: WorkflowNodeId,
  reviewNodeId: WorkflowNodeId,
  body: (revision: number) => Promise<StepResult>,
): Promise<StepResult> {
  const blueprint = blueprintFor(workNodeId);
  const agent = blueprint.agent!;
  const definition = AGENTS[agent];
  const startedAt = Date.now();
  let revision = 1;

  let invocation: AgentInvocation = {
    id: `inv_${randomUUID().slice(0, 8)}`,
    runId: context.run.id,
    workspaceSlug: context.workspaceSlug,
    agent,
    status: 'running',
    revision,
    startedAt: nowIso(),
    producedIds: [],
    note: definition.role,
  };
  await repo.upsertInvocation(invocation);
  invocationLog.unshift(invocation);
  fleetBus.emit({ type: 'agent.started', runId: context.run.id, invocation, at: nowIso() });

  setNode(context, workNodeId, { state: 'working', revision, progress: 5 });
  let result = await body(revision);

  setNode(context, workNodeId, { state: 'completed', output: result.output, progress: 100 });

  // The review node is HELM's, not the specialist's.
  setNode(context, reviewNodeId, {
    state: 'reviewing',
    task: `Checking the ${definition.role.toLowerCase()}`,
    activity: definition.gate,
    progress: 40,
  });
  await setStage(context, blueprintFor(reviewNodeId).stage);
  await delay(Math.round(env.fleet.stepDelayMs * 0.5));

  let verdict = await reviewAtGate(context, agent, result);

  while (!verdict.passed && revision < Math.max(1, env.fleet.maxRevisions)) {
    revision += 1;

    setNode(context, reviewNodeId, {
      state: 'revision_required',
      activity: verdict.note,
      progress: 60,
      revision,
    });
    setNode(context, workNodeId, {
      state: 'working',
      revision,
      progress: 10,
      activity: `Revising — ${verdict.note}`,
    });

    invocation = { ...invocation, status: 'revised', revision };
    fleetBus.emit({ type: 'agent.review', runId: context.run.id, invocation, at: nowIso() });
    await setStage(context, blueprint.stage);
    await delay(env.fleet.stepDelayMs);

    result = await body(revision);
    setNode(context, workNodeId, { state: 'completed', output: result.output, progress: 100 });
    setNode(context, reviewNodeId, { state: 'reviewing', activity: definition.gate, progress: 70 });
    await setStage(context, blueprintFor(reviewNodeId).stage);
    verdict = await reviewAtGate(context, agent, result);
  }

  const latencyMs = Date.now() - startedAt;
  invocation = {
    ...invocation,
    status: verdict.passed ? 'passed' : 'failed',
    revision,
    endedAt: nowIso(),
    latencyMs,
    verdict: verdict.passed ? 'passed' : 'rejected',
    verdictNote: `${verdict.note} — reviewed by ${verdict.reviewedBy}`,
    qualityScore: Math.round(verdict.quality * 100) / 100,
    groundingScore: Math.round(verdict.grounding * 100) / 100,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    producedIds: result.producedIds,
    note: result.note,
  };
  await repo.upsertInvocation(invocation);
  const index = invocationLog.findIndex((entry) => entry.id === invocation.id);
  if (index >= 0) invocationLog[index] = invocation;
  fleetBus.emit({ type: 'agent.finished', runId: context.run.id, invocation, at: nowIso() });

  setNode(context, reviewNodeId, {
    state: verdict.passed ? 'completed' : 'failed',
    activity: verdict.note,
    progress: 100,
    error: verdict.passed ? undefined : `${definition.name} could not clear this gate after ${revision} attempts.`,
    retryable: !verdict.passed,
    output: {
      kind: 'verdict',
      summary: verdict.passed ? 'Passed' : 'Rejected',
      items: [
        { id: 'gate', title: definition.gate, detail: verdict.note, tone: verdict.passed ? 'good' : 'bad' },
        {
          id: 'scores',
          title: 'Scores',
          detail: `Grounding ${Math.round(verdict.grounding * 100)}% · Quality ${Math.round(verdict.quality * 100)}%`,
          meta: `Reviewed by ${verdict.reviewedBy}`,
        },
        { id: 'revisions', title: 'Attempts', detail: `${revision} of ${env.fleet.maxRevisions}` },
      ],
    },
  });

  if (!verdict.passed) {
    setNode(context, workNodeId, {
      state: 'failed',
      error: `Did not clear the HELM review: ${verdict.note}`,
      retryable: true,
    });
    throw new Error(`${definition.name} could not clear its review gate`);
  }

  return result;
}

/* ------------------------------------------------------- 1. input / data -- */

async function runInput(context: RunContext) {
  await setStage(context, 'collecting_data', 'Reconciling the connected accounts.');
  const id: WorkflowNodeId = 'input';
  const startedAt = Date.now();

  setNode(context, id, {
    state: 'working',
    task: 'Reading the connected accounts',
    activity: 'Opening the resolved account scope',
    progress: 8,
    revision: 1,
  });

  const pack = context.pack;
  say(context, id, `Reading ${pack.accounts.length} connected accounts`, 25);
  await delay(env.fleet.stepDelayMs);

  say(
    context,
    id,
    pack.separatedAccountIds.length
      ? `Separating ${pack.separatedAccountIds.length} account that cannot be blended`
      : 'Every account in scope shares a currency and reporting day',
    55,
  );
  await delay(Math.round(env.fleet.stepDelayMs * 0.7));
  say(context, id, 'Assembling the evidence set', 80);

  const produced: string[] = [];

  const reconciliation: Evidence = {
    id: `ev_${context.run.id}_basis`,
    title: 'Reconciled basis for this run',
    kind: 'observed',
    summary: `${pack.blendedAccountIds.length} accounts blended, ${pack.separatedAccountIds.length} separated, over ${pack.rangeLabel}.`,
    rows: [
      { label: 'Blended spend', value: `${pack.currency} ${pack.totals.spend.toLocaleString('en-IN')}`, mono: true },
      { label: 'Conversions', value: String(pack.totals.conversions), mono: true },
      {
        label: 'Blended cost per conversion',
        value: pack.totals.cpa === null ? 'Not available' : `${pack.currency} ${pack.totals.cpa}`,
        mono: true,
        tone: 'warn',
      },
      {
        label: 'Blended ROAS',
        value: pack.totals.roas === null ? 'Not available' : `${pack.totals.roas}×`,
        mono: true,
      },
      ...pack.accounts.map((account) => ({
        label: account.name,
        value: account.included ? 'Included' : 'Separated',
        detail: account.reason ?? `${account.currency} · ${account.timeZone} · ${account.freshness}`,
        tone: account.included ? ('neutral' as const) : ('warn' as const),
      })),
    ],
    basis: context.basis,
    method: 'Complete reporting days only, in each account’s own timezone. No value is estimated.',
  };
  await repo.upsertEvidence(reconciliation);
  context.evidence.push(reconciliation);
  produced.push(reconciliation.id);
  graphWrite(context, 'Evidence', reconciliation.title);

  const movement: Evidence = {
    id: `ev_${context.run.id}_movement`,
    title: 'Campaign movement in the window',
    kind: 'calculated',
    summary: `The ${pack.movement.length} campaigns whose cost per conversion moved most against the comparison window.`,
    rows: pack.movement.map((row) => ({
      label: row.name,
      value:
        row.deltaCpa === null
          ? 'Cost per conversion not available'
          : `${row.deltaCpa > 0 ? '+' : ''}${Math.round(row.deltaCpa * 1000) / 10}% cost per conversion`,
      detail: `${row.provider === 'google_ads' ? 'Google Ads' : 'Meta Ads'} · ${pack.currency} ${row.spend.toLocaleString('en-IN')} spend · ${row.status}`,
      tone: (row.deltaCpa ?? 0) > 0.1 ? ('bad' as const) : (row.deltaCpa ?? 0) < -0.05 ? ('good' as const) : ('neutral' as const),
      mono: true,
    })),
    // The series is what the finding card draws its trend line from.
    series: await dailyCostSeries(
      context.workspaceId,
      context.basis,
      pack.movement.map((row) => row.campaignId),
    ),
    basis: context.basis,
    method: 'Window versus the previous equivalent window, per campaign, on the same day basis.',
  };
  await repo.upsertEvidence(movement);
  context.evidence.push(movement);
  produced.push(movement.id);
  graphWrite(context, 'Evidence', movement.title);

  if (pack.creativeFatigue.length) {
    const fatigue: Evidence = {
      id: `ev_${context.run.id}_fatigue`,
      title: 'Creative repetition and hook decay',
      kind: 'observed',
      summary: `${pack.creativeFatigue.length} creatives are repeating against the same audience.`,
      rows: pack.creativeFatigue.map((creative) => ({
        label: creative.name,
        value: creative.frequency === null ? 'Frequency not available' : `${creative.frequency}× frequency`,
        detail: creative.note,
        tone: creative.fatigue === 'fatigued' ? ('bad' as const) : ('warn' as const),
        mono: true,
      })),
      basis: context.basis,
      method: 'Provider-reported frequency and 3-second view rate. The hook proxy exposes its formula.',
    };
    await repo.upsertEvidence(fatigue);
    context.evidence.push(fatigue);
    produced.push(fatigue.id);
    graphWrite(context, 'Evidence', fatigue.title);
  }

  await recordInvocation(context, 'scout', startedAt, {
    ok: true,
    producedIds: produced,
    note: `${produced.length} evidence sets from ${pack.accounts.length} accounts`,
  });

  setNode(context, id, {
    state: 'completed',
    task: null,
    activity: `${produced.length} evidence sets from ${pack.accounts.length} accounts`,
    progress: 100,
    output: {
      kind: 'data',
      summary: `${pack.blendedAccountIds.length} accounts blended · ${pack.separatedAccountIds.length} separated · ${pack.rangeLabel}`,
      items: [
        ...pack.accounts.map((account) => ({
          id: account.id,
          title: account.name,
          detail: account.included ? 'Included in the blended basis' : (account.reason ?? 'Separated'),
          meta: `${account.currency} · ${account.timeZone}`,
          tone: account.included ? ('good' as const) : ('warn' as const),
        })),
        ...context.evidence.map((entry) => ({
          id: entry.id,
          title: entry.title,
          detail: entry.summary,
          meta: entry.kind,
        })),
      ],
    },
  });
}

/**
 * The daily cost-per-conversion series behind a run.
 *
 * A finding card draws a trend line next to its leading figure, and it draws
 * it from a series carried on the evidence. The seeded evidence had one and
 * nothing the fleet wrote ever did, so every card the agents produced showed
 * the numbers with no line beside them — 41 evidence records in the graph and
 * 4 with a series, all 4 of them fixtures.
 *
 * This folds the stored daily rows the same way the briefing folds them:
 * spend and conversions summed per reporting day, divided at the end. A day
 * that converted nothing has no cost per conversion and is written as null
 * rather than as a zero, which would draw a line to the floor and read as a
 * collapse in cost.
 */
async function dailyCostSeries(
  workspaceId: string,
  basis: DataBasis,
  campaignIds: string[],
): Promise<MetricSeries | undefined> {
  const rows = await repo.listMetricDays(workspaceId, {
    start: basis.startDateInclusive,
    end: basis.endDateInclusive,
    accountIds: basis.accountIds,
  });
  if (rows.length === 0) return undefined;

  const wanted = campaignIds.length ? new Set(campaignIds) : null;
  const byDay = new Map<string, { spend: number; conversions: number }>();

  for (const row of rows) {
    if (wanted && !wanted.has(row.campaignId)) continue;
    const day = byDay.get(row.date) ?? { spend: 0, conversions: 0 };
    day.spend += row.spend;
    day.conversions += row.conversions;
    byDay.set(row.date, day);
  }
  if (byDay.size < 2) return undefined;

  const points = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, day]) => ({
      date,
      value: day.conversions > 0 ? Math.round((day.spend / day.conversions) * 100) / 100 : null,
    }));

  return points.filter((point) => point.value !== null).length > 1
    ? { metric: 'cpa', points }
    : undefined;
}

/* ----------------------------------------------------------- 2. analyst -- */

/**
 * The figures a finding is actually about.
 *
 * Derived from the evidence pack rather than asked of the model. The pack is
 * what the analysis was computed on, so deriving them is the only way the
 * numbers on the card are guaranteed to be the numbers the finding was
 * reasoned from. Asking a model to restate figures back is precisely the step
 * at which one gets rounded, transposed or invented — and the analyst's own
 * instruction is never to state a value that is not present.
 *
 * A previous value is recovered from the movement rather than stored: a delta
 * of +31% on a CPA of 2,449 means the previous CPA was 2,449 / 1.31. That is
 * arithmetic on reported figures, not an estimate.
 */
export function highlightsFor(pack: EvidencePack, campaignIds: string[]): MetricValue[] {
  const { currency } = pack;
  const before = (value: number | null, delta: number | null | undefined): number | null => {
    if (value === null || delta === null || delta === undefined || delta <= -1) return null;
    return value / (1 + delta);
  };

  const named = pack.movement.filter((row) => campaignIds.includes(row.campaignId));
  const lead = [...named].sort((a, b) => b.spend - a.spend)[0];

  if (lead) {
    const highlights: MetricValue[] = [];

    if (lead.cpa !== null) {
      highlights.push({
        key: 'cpa',
        value: lead.cpa,
        currency,
        previousValue: before(lead.cpa, lead.deltaCpa),
        deltaRatio: lead.deltaCpa ?? null,
      });
    }

    highlights.push({
      key: 'spend',
      value: lead.spend,
      currency,
      previousValue: before(lead.spend, lead.deltaSpend),
      deltaRatio: lead.deltaSpend ?? null,
    });

    // Cost leads, and the asset's own figures follow it. The card draws its
    // trend line beside the first metric in the strip, and the only series
    // these findings have is a cost series — so putting the hook rate first
    // would caption a CPA line with a view rate.
    const worn = pack.creativeFatigue.find((entry) => campaignIds.includes(entry.campaignId));
    if (worn?.hookRate !== null && worn?.hookRate !== undefined) {
      highlights.push({ key: 'hook_rate', value: worn.hookRate, deltaRatio: null });
    }
    if (worn?.frequency !== null && worn?.frequency !== undefined) {
      highlights.push({ key: 'frequency', value: worn.frequency, deltaRatio: null });
    }

    return highlights.slice(0, 3);
  }

  // A finding about the account rather than a campaign — an excluded account,
  // a basis problem — is about the blended totals.
  const { totals } = pack;
  return [
    { key: 'spend', value: totals.spend, currency, deltaRatio: null },
    ...(totals.cpa === null ? [] : [{ key: 'cpa' as const, value: totals.cpa, currency, deltaRatio: null }]),
    ...(totals.roas === null ? [] : [{ key: 'roas' as const, value: totals.roas, deltaRatio: null }]),
  ];
}

/**
 * What the finding costs if nothing changes.
 *
 * Sized here rather than taken from the model. Asked for minor units the model
 * returned major ones — a campaign carrying INR 7,64,000 came back as INR
 * 7,640 of exposure, a hundredfold error stated with full confidence — and it
 * returned the same figure for the low and the high, which is not a range at
 * all. The arithmetic is four operations and every input is already in the
 * pack, so it is done here where it can be checked.
 *
 * A finding whose campaign did not get more expensive has no exposure to size,
 * and gets none. An absent figure is honest; a fabricated one is not.
 */
export function exposureFor(pack: EvidencePack, campaignIds: string[]): Finding['exposure'] {
  const named = pack.movement.filter((row) => campaignIds.includes(row.campaignId));
  const lead = [...named].sort((a, b) => (b.deltaCpa ?? 0) - (a.deltaCpa ?? 0))[0];
  if (!lead || (lead.deltaCpa ?? 0) <= 0) return undefined;

  // The extra cost of holding the current conversion volume at the new cost
  // per conversion, floored so a small movement on a large spend still reads.
  const central = lead.spend * Math.max(0.05, lead.deltaCpa ?? 0.1);

  return {
    low: { currency: pack.currency, minorUnits: String(Math.round(central * 100 * 0.7)) },
    high: { currency: pack.currency, minorUnits: String(Math.round(central * 100 * 1.25)) },
    note: `Sized as the extra cost of holding ${lead.name}'s current conversion volume at its new cost per conversion, over the next 14 days.`,
  };
}

const FINDING_SHAPE = `{
  "findings": [{
    "title": "one precise sentence",
    "observation": "two or three sentences naming the metric, the movement and the window",
    "kind": "observed" | "calculated" | "inferred",
    "severity": "decision" | "watch" | "stable",
    "_severity_meaning": "decision = costs real money this week and a person must choose; watch = directional, real but not yet worth a budget change; stable = checked and behaving, reported so nobody has to look. Most windows produce one or two decision-grade findings, not four.",
    "confidence": "high" | "medium" | "low",
    "confidenceNote": "why this confidence and not another",
    "affectedCampaignIds": ["campaign id from the pack"],
    "recommendedNextStep": "one sentence"
  }],
  "recommendations": [{
    "findingIndex": 0,
    "action": "imperative sentence naming the exact move",
    "rationale": "why this move follows from the finding",
    "assumptions": ["..."],
    "risks": ["..."],
    "expectedDirection": "increase" | "decrease" | "protect" | "investigate",
    "expectedRange": "a range, never a single fabricated number",
    "capMinorUnits": "string of minor units, or null",
    "horizon": "e.g. 14 days",
    "stopConditions": ["..."],
    "effort": "low" | "medium" | "high",
    "urgency": "today" | "this_week" | "this_month"
  }]
}`;

async function runAnalyst(context: RunContext) {
  await setStage(context, 'analyzing', 'Explaining what moved, and sizing what it costs.');
  const id: WorkflowNodeId = 'analyst';

  await withGate(context, 'analyst', 'review_analysis', async (revision) => {
    setNode(context, id, {
      task: revision === 1 ? 'Comparing campaign performance' : 'Reworking the analysis',
      activity: revision === 1 ? 'Comparing campaign performance' : 'Reworking the analysis against the review',
      progress: 15,
    });
    await delay(env.fleet.stepDelayMs);

    say(context, id, 'Reviewing CPA and ROAS trends', 35);
    await delay(Math.round(env.fleet.stepDelayMs * 0.8));
    say(context, id, 'Finding high-cost campaigns', 55);

    const fallbackFindings = scriptedFindings(context.pack);
    const result = await reasonJson({
      system:
        'You are the Diagnostic Analyst inside HELM, a paid-media decision instrument. You never address the user; you return findings and capped proposals for HELM to review. Every claim must trace to the supplied evidence pack. Never estimate a value that is not present. Never blend accounts the pack marks as separated. Never expose your reasoning — return only the structured result.',
      prompt: `Account scope: ${context.pack.scopeLabel}. Window: ${context.pack.rangeLabel}. Reporting currency: ${context.pack.currency}.
The requester asked: ${context.run.title}
${context.question ? `Additional context: ${context.question}` : ''}

Evidence pack:
${JSON.stringify(context.pack, null, 2)}

Write two to four findings, worst-cost first, and one capped proposal for each decision-grade finding.

Grade them honestly. A finding is decision-grade only when it carries real money this week and a person has to choose something. A real but directional signal is "watch". Something you checked and found behaving is "stable", and reporting it is useful because it saves someone looking. A set where everything is decision-grade tells the reader nothing about what to open first.`,
      shape: FINDING_SHAPE,
      fallback: {
        findings: fallbackFindings,
        recommendations: [] as ReturnType<typeof scriptedRecommendations>,
      },
      model: AGENTS.analyst.model,
    });

    say(context, id, 'Sizing the financial exposure', 72);
    await delay(Math.round(env.fleet.stepDelayMs * 0.5));

    // A revision replaces the previous attempt rather than appending to it.
    context.findings = [];
    context.recommendations = [];

    const produced: string[] = [];
    const rows = Array.isArray(result.value.findings) ? result.value.findings : fallbackFindings;
    const validCampaignIds = new Set(context.campaigns.map((campaign) => campaign.id));

    for (const [index, row] of rows.slice(0, 4).entries()) {
      const affected = (row.affectedCampaignIds ?? []).filter((entry: string) => validCampaignIds.has(entry));
      // A decision-grade finding is a claim that money is at stake. If the
      // campaign it names did not get more expensive there is no exposure to
      // size, and the claim is not supportable however the model graded it —
      // so it drops to watch. This is a floor on the wording, not a rewrite of
      // the judgement: nothing is ever promoted here.
      const exposure = exposureFor(context.pack, affected);
      const claimed = (['decision', 'watch', 'stable'].includes(row.severity) ? row.severity : 'watch') as Finding['severity'];
      const severity: Finding['severity'] = claimed === 'decision' && !exposure ? 'watch' : claimed;

      const finding: Finding = {
        id: `fnd_${context.run.id}_${index + 1}`,
        title: String(row.title ?? 'Finding'),
        observation: String(row.observation ?? ''),
        kind: (['observed', 'calculated', 'inferred'].includes(row.kind) ? row.kind : 'calculated') as Finding['kind'],
        severity,
        confidence: (['high', 'medium', 'low'].includes(row.confidence) ? row.confidence : 'medium') as Finding['confidence'],
        confidenceNote: String(row.confidenceNote ?? 'Confidence follows the completeness of the window.'),
        exposure,
        evidenceIds: context.evidence.map((entry) => entry.id),
        basis: context.basis,
        recommendedNextStep: row.recommendedNextStep ? String(row.recommendedNextStep) : undefined,
        affectedCampaignIds: affected,
        metricHighlights: highlightsFor(context.pack, affected),
        sourceAccountIds: context.pack.blendedAccountIds,
        authoredBy: 'analyst',
      };

      await repo.upsertFinding(context.run.id, finding);
      context.findings.push(finding);
      produced.push(finding.id);
      graphWrite(context, 'Finding', finding.title);
      fleetBus.emit({ type: 'run.finding', runId: context.run.id, finding, at: nowIso() });
    }

    say(context, id, 'Writing capped proposals', 88);

    const proposalRows =
      Array.isArray(result.value.recommendations) && result.value.recommendations.length
        ? result.value.recommendations
        : scriptedRecommendations(context.pack, context.findings);

    for (const [index, row] of proposalRows.slice(0, 3).entries()) {
      const finding = context.findings[Number(row.findingIndex) || 0] ?? context.findings[0];
      if (!finding) break;

      const recommendation: Recommendation = {
        id: `rec_${context.run.id}_${index + 1}`,
        findingId: finding.id,
        action: String(row.action ?? 'Investigate further before moving budget'),
        rationale: String(row.rationale ?? finding.observation),
        assumptions: Array.isArray(row.assumptions) ? row.assumptions.map(String) : [],
        risks: Array.isArray(row.risks) ? row.risks.map(String) : [],
        affectedAccountIds: finding.sourceAccountIds,
        affectedCampaignIds: finding.affectedCampaignIds,
        expectedDirection: (['increase', 'decrease', 'protect', 'investigate'].includes(row.expectedDirection)
          ? row.expectedDirection
          : 'investigate') as Recommendation['expectedDirection'],
        expectedRange: String(row.expectedRange ?? 'Direction only — the window is too short for a range.'),
        cap: row.capMinorUnits ? { currency: context.pack.currency, minorUnits: String(row.capMinorUnits) } : undefined,
        horizon: String(row.horizon ?? '14 days'),
        stopConditions: Array.isArray(row.stopConditions) ? row.stopConditions.map(String) : [],
        effort: (['low', 'medium', 'high'].includes(row.effort) ? row.effort : 'medium') as Recommendation['effort'],
        urgency: (['today', 'this_week', 'this_month'].includes(row.urgency)
          ? row.urgency
          : 'this_week') as Recommendation['urgency'],
        status: 'proposed',
        authoredBy: 'analyst',
      };

      await repo.upsertRecommendation(recommendation);
      context.recommendations.push(recommendation);
      produced.push(recommendation.id);
      graphWrite(context, 'Recommendation', recommendation.action);
      fleetBus.emit({ type: 'run.recommendation', runId: context.run.id, recommendation, at: nowIso() });
    }

    context.run.findingIds = context.findings.map((finding) => finding.id);
    context.run.recommendationIds = context.recommendations.map((entry) => entry.id);
    await repo.upsertRun(context.workspaceId, context.run);

    const cited = rows.reduce(
      (total: number, row: { affectedCampaignIds?: string[] }) =>
        total + (row.affectedCampaignIds ?? []).filter((entry: string) => validCampaignIds.has(entry)).length,
      0,
    );
    const claimed = rows.reduce(
      (total: number, row: { affectedCampaignIds?: string[] }) => total + (row.affectedCampaignIds ?? []).length,
      0,
    );
    const complete = context.recommendations.filter(
      (entry) => entry.horizon && entry.stopConditions.length > 0 && entry.risks.length > 0,
    ).length;

    return {
      producedIds: produced,
      grounding: claimed === 0 ? 0.75 : Math.min(1, 0.45 + 0.55 * (cited / claimed)),
      quality: context.recommendations.length
        ? 0.5 + 0.5 * (complete / context.recommendations.length)
        : Math.min(1, 0.5 + context.findings.length * 0.12),
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      note: result.live
        ? `${context.findings.length} findings and ${context.recommendations.length} proposals from ${result.model}`
        : `${context.findings.length} findings and ${context.recommendations.length} proposals from HELM sample reasoning`,
      output: {
        kind: 'findings',
        summary: `${context.findings.length} findings · ${context.recommendations.length} capped proposals`,
        items: [
          ...context.findings.map((finding) => ({
            id: finding.id,
            title: finding.title,
            detail: finding.observation,
            meta: `${finding.severity} · ${finding.confidence} confidence`,
            tone:
              finding.severity === 'decision'
                ? ('bad' as const)
                : finding.severity === 'watch'
                  ? ('warn' as const)
                  : ('neutral' as const),
          })),
          ...context.recommendations.map((entry) => ({
            id: entry.id,
            title: entry.action,
            detail: entry.rationale,
            meta: `${entry.horizon} · ${entry.urgency.replace(/_/g, ' ')}`,
          })),
        ],
      },
      // The analyst reasoned over the whole pack, so the gate judges it
      // against the whole pack rather than a slice of it.
      groundedIn: context.pack,
      reviewable: {
        findings: context.findings.map((finding) => ({
          title: finding.title,
          observation: finding.observation,
          kind: finding.kind,
          confidence: finding.confidence,
          affectedCampaignIds: finding.affectedCampaignIds,
        })),
        recommendations: context.recommendations.map((entry) => ({
          action: entry.action,
          expectedRange: entry.expectedRange,
          risks: entry.risks,
          stopConditions: entry.stopConditions,
          horizon: entry.horizon,
        })),
      },
    };
  });
}

/* ---------------------------------------------------------- 3. creative -- */

async function runCreative(context: RunContext) {
  await setStage(context, 'creating', 'Writing replacement creative directions.');
  const id: WorkflowNodeId = 'creative';

  await withGate(context, 'creative', 'review_creative', async (revision) => {
    setNode(context, id, {
      task: revision === 1 ? 'Creating three new creative directions' : 'Redrafting the directions',
      activity: revision === 1 ? 'Reading the fatigue evidence' : 'Redrafting against the review',
      progress: 20,
    });
    await delay(env.fleet.stepDelayMs);
    say(context, id, 'Checking creative alignment with the brand guidance', 50);

    const fallback = scriptedCreative(context.pack);

    // The workspace's own kit, not a literal. attachBrand is honoured here
    // rather than ignored: a run that did not ask for the brand still gets the
    // campaign line, but not the house rules it never opted into.
    const kit = await resolveBrandKit(context.workspaceId);
    const brandGuidance = context.attachBrand
      ? brandBriefing(kit)
      : `Brand: ${kit.advertiser} · ${kit.product}. Campaign line: ${kit.campaignLine}.`;

    const result = await reasonJson({
      system:
        'You are the Creative Director inside HELM. You write replacement creative directions grounded in fatigue evidence and the brand guidance you are given. Headlines are short enough to set large in a paid-social still. You never address the user and never expose your reasoning.',
      prompt: `Fatigue evidence:
${JSON.stringify(context.pack.creativeFatigue, null, 2)}

Findings this creative has to answer:
${JSON.stringify(context.findings.map((finding) => finding.title), null, 2)}

${brandGuidance}

Write three replacement directions.`,
      shape: `{"directions": [{"title": "...", "headline": "SHORT LINE", "subline": "...", "rationale": "...", "direction": "product-proof" | "field-use" | "typographic" | "evidence"}]}`,
      fallback,
      model: AGENTS.creative.model,
    });

    say(context, id, 'Writing the briefs', 78);
    await delay(Math.round(env.fleet.stepDelayMs * 0.6));

    const rows = Array.isArray(result.value.directions) ? result.value.directions : fallback.directions;
    context.directions = rows.slice(0, 3).map((row) => ({
      title: String(row.title ?? 'Creative direction'),
      headline: String(row.headline ?? ''),
      subline: String(row.subline ?? ''),
      rationale: String(row.rationale ?? ''),
      direction: ['product-proof', 'field-use', 'typographic', 'evidence'].includes(String(row.direction))
        ? String(row.direction)
        : 'product-proof',
    }));

    const produced: string[] = [];
    for (const [index, direction] of context.directions.entries()) {
      const artifact: Artifact = {
        id: `art_${context.run.id}_dir_${index + 1}`,
        title: direction.title,
        type: 'creative_direction',
        mode: 'creative',
        updatedAt: nowIso(),
        createdBy: `${AGENTS.creative.name} · ${result.live ? result.model : 'HELM sample direction'}`,
        status: 'draft',
        linkedRunId: context.run.id,
        summary: direction.rationale,
        tags: ['Arc Bottle', 'Replacement', 'Awaiting approval'],
        prompt: `${direction.headline} — ${direction.subline}`,
      };
      await repo.upsertArtifact(context.workspaceId, artifact);
      context.artifacts.push(artifact);
      produced.push(artifact.id);
      graphWrite(context, 'Artifact', artifact.title);
      fleetBus.emit({ type: 'run.artifact', runId: context.run.id, artifact, at: nowIso() });
    }

    const grounded = context.directions.filter((entry) => entry.headline && entry.rationale).length;

    return {
      producedIds: produced,
      grounding: context.directions.length ? 0.55 + 0.45 * (grounded / context.directions.length) : 0.4,
      quality: Math.min(1, 0.5 + context.directions.length * 0.18),
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      note: result.live
        ? `${context.directions.length} directions from ${result.model}`
        : `${context.directions.length} directions from HELM sample reasoning`,
      output: {
        kind: 'directions',
        summary: `${context.directions.length} replacement directions`,
        items: context.directions.map((direction, index) => ({
          id: `dir_${index}`,
          title: direction.headline || direction.title,
          detail: direction.rationale,
          meta: direction.direction,
        })),
      },
      reviewable: context.directions,
      // Exactly what the Creative Director was handed. Without this the gate
      // reviewed creative work against account totals, found none of the
      // creative names in it, and failed the run three times for inventing
      // things it had in fact been given.
      groundedIn: {
        creativeFatigue: context.pack.creativeFatigue,
        findings: context.findings.map((finding) => finding.title),
        brandGuidance,
      },
    };
  });
}

/* --------------------------------------------------- 4. human approval -- */

async function awaitApproval(context: RunContext) {
  const proposals = context.recommendations.filter((entry) => entry.status === 'proposed');

  if (proposals.length === 0) {
    setNode(context, 'approval', {
      state: 'completed',
      activity: 'Nothing needed a decision',
      progress: 100,
    });
    await finish(context);
    return;
  }

  setNode(context, 'approval', {
    state: 'waiting_for_approval',
    task: 'Waiting for your approval',
    activity: `${proposals.length} proposal${proposals.length === 1 ? '' : 's'} need your decision`,
    progress: 50,
    output: {
      kind: 'recommendations',
      summary: `${proposals.length} awaiting your decision`,
      items: proposals.map((entry) => ({
        id: entry.id,
        title: entry.action,
        detail: entry.rationale,
        meta: `${entry.horizon} · ${entry.urgency.replace(/_/g, ' ')}`,
        tone: 'warn' as const,
      })),
    },
  });

  await setStage(
    context,
    'waiting_for_approval',
    `${context.findings.length} findings and ${proposals.length} proposals. Waiting for your approval.`,
  );
}

export function markRecommendationDecided(
  runId: string,
  recommendationId: string,
  status: Recommendation['status'],
) {
  const context = active.get(runId);
  if (!context) return;
  const recommendation = context.recommendations.find((entry) => entry.id === recommendationId);
  if (recommendation) recommendation.status = status;
}

/**
 * Everything needed to pick a run back up that this process did not start.
 *
 * The caller assembles it exactly the way the start route assembles a run, so
 * a resumed run reads the same accounts, campaigns and basis a fresh one would.
 * It lives here rather than being fetched inside the orchestrator because the
 * basis resolver belongs to the HTTP layer, and the agents layer should not
 * reach back up into it.
 */
export type ResumeInput = {
  workspaceId: string;
  workspaceSlug: string;
  user: { id: string; name: string };
  scopeId: string;
  scopeLabel: string;
  rangeLabel: string;
  currency: string;
  accounts: AdAccount[];
  campaigns: CampaignSummary[];
  creatives: CreativeSummary[];
  basis: DataBasis;
  /** Render the approved directions. A resumed run defaults to doing so. */
  generateCreative: boolean;
  attachBrand: boolean;
};

/**
 * Rebuilds a run's working context from the decision graph.
 *
 * `active` only ever held runs this process started. A seeded run, or one that
 * was in flight when the server restarted, has everything it needs in the graph
 * and nothing in memory — so approving it did nothing at all: the decision and
 * the audit entry were written, and then `resumeAfterDecision` returned on the
 * missing map entry and the run sat at "waiting for your approval" forever.
 *
 * Rehydrating lets the fleet pick a run up from wherever it was left. Two
 * things cannot be recovered and are handled rather than faked: a direction's
 * subline is not persisted on the node output, and the image studio already
 * treats it as optional; and a run seeded without a workflow has no node
 * states, so they are inferred from what the run actually produced.
 */
export async function rehydrate(runId: string, input: ResumeInput): Promise<RunContext | null> {
  const existing = active.get(runId);
  if (existing) return existing;

  const inFlight = rehydrating.get(runId);
  if (inFlight) return inFlight;

  const work = buildContext(runId, input).finally(() => rehydrating.delete(runId));
  rehydrating.set(runId, work);
  return work;
}

async function buildContext(runId: string, input: ResumeInput): Promise<RunContext | null> {
  const run = await repo.getRun(runId);
  if (!run) return null;

  const [findings, recommendations, workspaceArtifacts] = await Promise.all([
    Promise.all(run.findingIds.map((id) => repo.getFinding(id))),
    Promise.all(run.recommendationIds.map((id) => repo.getRecommendation(id))),
    repo.listArtifacts(input.workspaceId),
  ]);

  const liveFindings = findings.filter((entry): entry is Finding => Boolean(entry));
  const liveRecommendations = recommendations.filter((entry): entry is Recommendation => Boolean(entry));

  const evidence = (
    await Promise.all(liveFindings.flatMap((finding) => finding.evidenceIds.map((id) => repo.getEvidence(id))))
  ).filter((entry): entry is Evidence => Boolean(entry));

  const pack = buildEvidencePack({
    scopeLabel: run.scopeLabel || input.scopeLabel,
    rangeLabel: run.rangeLabel || input.rangeLabel,
    currency: input.currency,
    accounts: input.accounts,
    campaigns: input.campaigns,
    creatives: input.creatives,
    basis: input.basis,
    focusCampaignIds: [...new Set(liveFindings.flatMap((finding) => finding.affectedCampaignIds))],
  });

  // A stored workflow is the truth when there is one. A run seeded without one
  // gets a workflow whose completed steps are the ones whose output exists.
  const stored = run.workflow ?? [];
  const nodes = new Map<WorkflowNodeId, WorkflowNode>(
    emptyWorkflow(env.fleet.maxRevisions).map((node) => [node.id, node]),
  );
  for (const node of stored) if (nodes.has(node.id)) nodes.set(node.id, node);

  const directions = recoverDirections(stored);

  if (!stored.length) {
    const done = (id: WorkflowNodeId, activity: string) => {
      const node = nodes.get(id)!;
      nodes.set(id, { ...node, state: 'completed', task: null, activity, progress: 100 });
    };
    done('input', `${pack.accounts.filter((account) => account.included).length} accounts read`);
    if (liveFindings.length) done('analyst', `${liveFindings.length} findings`);
    if (liveFindings.length) done('review_analysis', 'Basis and confidence checked');
    if (directions.length) done('creative', `${directions.length} directions`);
    if (directions.length) done('review_creative', 'Directions checked against the brief');
  }

  const context: RunContext = {
    ...input,
    run,
    pack,
    nodes,
    cancelled: false,
    intent: run.intent,
    question: run.title,
    campaignIds: [...new Set(liveFindings.flatMap((finding) => finding.affectedCampaignIds))],
    findings: liveFindings,
    recommendations: liveRecommendations,
    evidence,
    directions,
    artifacts: workspaceArtifacts.filter((artifact) => artifact.linkedRunId === run.id),
  };

  active.set(runId, context);
  return context;
}

/**
 * Reads creative directions back off the stored node output.
 *
 * The directions themselves are not a persisted entity — they live on the
 * creative node's output, which is what the interface draws. That output keeps
 * the headline, the rationale and the direction kind, which is everything the
 * image studio needs bar the subline it treats as optional.
 */
function recoverDirections(stored: WorkflowNode[]): RunContext['directions'] {
  const creative = stored.find((node) => node.id === 'creative');
  if (creative?.output?.kind !== 'directions') return [];
  return creative.output.items.map((item) => ({
    title: item.title,
    headline: item.title,
    subline: '',
    rationale: item.detail ?? '',
    direction: item.meta ?? 'product-proof',
  }));
}

/**
 * Resumes a paused run once every proposal has been decided.
 *
 * `resume` is what makes this work for a run this process did not start. Given
 * it, a run that only exists in the graph is rebuilt and carried forward;
 * without it the call is still a no-op, which is the right behaviour for the
 * internal callers that already hold a live context.
 */
export async function resumeAfterDecision(runId: string, resume?: ResumeInput) {
  const context = active.get(runId) ?? (resume ? await rehydrate(runId, resume) : null);
  if (!context) return;
  if (context.run.stage !== 'waiting_for_approval') return;

  /*
   * The statuses are re-read from the graph rather than trusted from memory.
   *
   * Deciding several proposals in quick succession fires several of these, and
   * each one is started without waiting for the last. Two can find no context
   * in `active` and both rehydrate; the one that finishes second reads a
   * recommendation list from before the other decision was written, and the
   * run waits forever on a proposal that was in fact already approved.
   *
   * Re-reading makes the check below authoritative whatever order they land
   * in. It is one round trip per proposal, on a path that runs once per
   * decision.
   */
  await Promise.all(
    context.recommendations.map(async (recommendation) => {
      const stored = await repo.getRecommendation(recommendation.id);
      if (stored) recommendation.status = stored.status;
    }),
  );

  if (context.recommendations.some((entry) => entry.status === 'proposed')) {
    const remaining = context.recommendations.filter((entry) => entry.status === 'proposed').length;
    setNode(context, 'approval', {
      activity: `${remaining} proposal${remaining === 1 ? '' : 's'} still need your decision`,
      progress: 50 + Math.round(50 * (1 - remaining / Math.max(1, context.recommendations.length))),
    });
    return;
  }

  // Two decisions landing together can both reach this line. The run is only
  // carried forward once.
  if (context.resuming) return;
  context.resuming = true;

  const approved = context.recommendations.filter((entry) => entry.status === 'approved').length;
  setNode(context, 'approval', {
    state: 'completed',
    task: null,
    activity: `${approved} approved, ${context.recommendations.length - approved} declined`,
    progress: 100,
  });

  void carryOn(context, approved).catch(async (error) => {
    const reason = error instanceof Error ? error.message : String(error);
    setNode(context, 'output', { state: 'failed', error: reason, retryable: true });
    await setStage(context, 'failed', `The run stopped after approval: ${reason}`);
    fleetBus.emit({ type: 'run.failed', runId: context.run.id, reason, at: nowIso() });
    active.delete(context.run.id);
  });
}

/**
 * What happens after the person decides.
 *
 * Approving something is supposed to put the fleet back to work, and for a run
 * that was resumed from the graph there is usually nothing drawn yet — the
 * creative step never ran, or ran in a process that has since exited. So an
 * approval with work to show for it and no directions to render sends the
 * creative specialist in first, through the same review gate a fresh run uses.
 * Nothing was approved, or nothing to draw, and it goes straight to the memo.
 */
async function carryOn(context: RunContext, approved: number) {
  if (approved > 0 && context.generateCreative && context.directions.length === 0) {
    await runCreative(context);
  }
  await finish(context);
}

/* -------------------------------------------------- 5. image generation -- */

async function finish(context: RunContext) {
  const approved = context.recommendations.filter((entry) => entry.status === 'approved');
  const id: WorkflowNodeId = 'images';

  if (!context.generateCreative || context.directions.length === 0) {
    setNode(context, id, {
      state: 'completed',
      activity: context.generateCreative
        ? 'No directions to render'
        : 'Image generation was not requested for this run',
      progress: 100,
    });
  } else {
    await setStage(context, 'generating_images', 'Rendering the approved directions.');
    const startedAt = Date.now();
    setNode(context, id, {
      state: 'working',
      task: 'Generating campaign visuals',
      activity: `Rendering ${context.directions.length} directions`,
      progress: 10,
      revision: 1,
    });

    const rendered: Artifact[] = [];
    for (const [index, direction] of context.directions.entries()) {
      if (context.cancelled) return;
      say(
        context,
        id,
        `Generating campaign visuals — ${index + 1} of ${context.directions.length}`,
        10 + Math.round((index / context.directions.length) * 80),
      );

      try {
        const image = await generateImage({
          prompt: `${direction.title}. ${direction.rationale}`,
          aspect: '4:5',
          headline: direction.headline || direction.title,
          subline: direction.subline || undefined,
          brand: 'Northstar Hydration · Arc Bottle',
          direction: direction.direction as 'product-proof',
          seed: `${context.run.id}:${index}`,
        });
        const asset = await storeStudioAsset(image);

        const artifact: Artifact = {
          id: `art_${context.run.id}_img_${index + 1}`,
          title: direction.headline || direction.title,
          type: 'generated_image',
          mode: 'creative',
          updatedAt: nowIso(),
          createdBy: `${AGENTS.imager.name} · ${image.model}`,
          status: 'draft',
          linkedRunId: context.run.id,
          summary: direction.rationale,
          tags: ['Arc Bottle', '4:5', image.provider === 'studio-render' ? 'Studio render' : 'Model generated'],
          imageUrl: asset.url,
          aspect: '4:5',
          prompt: `${direction.headline} — ${direction.subline}`,
          format: `${image.width} × ${image.height}`,
        };

        await repo.upsertArtifact(context.workspaceId, artifact);
        rendered.push(artifact);
        context.artifacts.push(artifact);
        graphWrite(context, 'Artifact', artifact.title);
        fleetBus.emit({ type: 'run.artifact', runId: context.run.id, artifact, at: nowIso() });
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : 'The image studio could not render this direction.';
        await recordInvocation(context, 'imager', startedAt, {
          ok: false,
          producedIds: rendered.map((artifact) => artifact.id),
          note: `Failed after ${rendered.length} of ${context.directions.length}`,
          detail,
        });
        setNode(context, id, { state: 'failed', error: detail, retryable: true });
        throw error;
      }
    }

    await recordInvocation(context, 'imager', startedAt, {
      ok: true,
      producedIds: rendered.map((artifact) => artifact.id),
      note: `${rendered.length} visuals rendered by ${imageProviderName()}`,
    });

    setNode(context, id, {
      state: 'completed',
      task: null,
      activity: `${rendered.length} visuals rendered and filed in the library`,
      progress: 100,
      output: {
        kind: 'images',
        summary: `${rendered.length} rendered · ${imageProviderName()}`,
        items: rendered.map((artifact) => ({
          id: artifact.id,
          title: artifact.title,
          detail: artifact.summary,
          meta: artifact.format,
          imageUrl: artifact.imageUrl,
        })),
      },
    });
  }

  /* ------------------------------------------------------ 6. final output -- */

  const memo: Artifact = {
    id: `art_${context.run.id}_memo`,
    title: context.run.title,
    type: 'decision_memo',
    mode: 'reports',
    updatedAt: nowIso(),
    createdBy: `HELM · requested by ${context.user.name}`,
    status: approved.length ? 'approved' : 'in_review',
    linkedRunId: context.run.id,
    summary: `${context.findings.length} findings, ${context.recommendations.length} proposals, ${approved.length} approved. Basis: ${context.pack.scopeLabel} over ${context.pack.rangeLabel}.`,
    tags: [
      ...new Set(
        context.pack.accounts
          .filter((account) => account.included)
          .map((account) => (account.provider === 'google_ads' ? 'Google Ads' : 'Meta Ads')),
      ),
      'Decision memo',
    ],
  };
  await repo.upsertArtifact(context.workspaceId, memo);
  context.run.artifactId = memo.id;
  graphWrite(context, 'Artifact', memo.title);
  fleetBus.emit({ type: 'run.artifact', runId: context.run.id, artifact: memo, at: nowIso() });

  setNode(context, 'output', {
    state: 'completed',
    task: null,
    activity: 'The decision memo is ready to read and download',
    progress: 100,
    output: {
      kind: 'memo',
      summary: memo.summary,
      items: [
        { id: memo.id, title: memo.title, detail: 'Decision memo', meta: 'Download as Markdown, HTML or JSON' },
        ...context.artifacts
          .filter((artifact) => artifact.imageUrl)
          .map((artifact) => ({
            id: artifact.id,
            title: artifact.title,
            detail: 'Rendered variant',
            meta: artifact.format,
            imageUrl: artifact.imageUrl,
          })),
      ],
    },
  });

  await setStage(
    context,
    'complete',
    `${context.findings.length} findings, ${context.recommendations.length} proposals, ${approved.length} approved. The decision memo is in the library.`,
  );
  fleetBus.emit({ type: 'run.completed', runId: context.run.id, run: context.run, at: nowIso() });
  active.delete(context.run.id);
}

/* --------------------------------------------------------------- repair -- */

/**
 * Recomputes the figures on findings that were written without them.
 *
 * Findings produced before the analyst derived its own numbers carry an empty
 * metric strip and, where the model was asked to size the exposure itself, a
 * range whose low and high are the same hundredfold-wrong figure. They are
 * still perfectly good findings — the observation, the confidence and the
 * evidence behind them are untouched — so they are repaired rather than
 * discarded.
 *
 * It is safe to run repeatedly. A finding whose figures already derive from
 * the pack recomputes to the same values.
 */
export async function repairFindingFigures(
  workspaceId: string,
  pack: EvidencePack,
): Promise<{ scanned: number; repaired: number }> {
  const findings = await repo.listFindings(workspaceId);
  let repaired = 0;

  for (const finding of findings) {
    const highlights = highlightsFor(pack, finding.affectedCampaignIds);
    const exposure = exposureFor(pack, finding.affectedCampaignIds);

    // A stored exposure whose low equals its high is not a range and was never
    // meant to be one. An absent one on a campaign whose cost rose is the same
    // problem wearing different clothes: two findings about the same campaign
    // showing different amounts of money is exactly the inconsistency this is
    // here to remove. Both are replaced by the derivation, which is also what
    // the analyst now writes, so stored and new findings are treated alike.
    const degenerate =
      Boolean(finding.exposure) &&
      finding.exposure!.low.minorUnits === finding.exposure!.high.minorUnits;
    const missingExposure = !finding.exposure && Boolean(exposure);
    const needsFigures = finding.metricHighlights.length === 0;

    if (!needsFigures && !degenerate && !missingExposure) continue;

    await repo.updateFinding({
      ...finding,
      metricHighlights: needsFigures ? highlights : finding.metricHighlights,
      exposure: degenerate || missingExposure ? exposure : finding.exposure,
    });
    repaired += 1;
  }

  return { scanned: findings.length, repaired };
}

/* ---------------------------------------------------------------- retry -- */

/**
 * Re-runs a failed node without restarting the whole workflow.
 *
 * Only the specialist nodes can be retried; a review node is retried by
 * re-running the specialist it reviews.
 */
export async function retryRun(runId: string): Promise<boolean> {
  const context = active.get(runId);
  if (!context) return false;

  const failed = nodeList(context).find((node) => node.state === 'failed');
  if (!failed) return false;

  const target: WorkflowNodeId =
    failed.id === 'review_analysis' ? 'analyst' : failed.id === 'review_creative' ? 'creative' : failed.id;

  setNode(context, target, { state: 'queued', error: undefined, retryable: false, progress: 0 });

  void (async () => {
    try {
      if (target === 'input') await runInput(context);
      if (target === 'input' || target === 'analyst') await runAnalyst(context);
      if (target === 'input' || target === 'analyst' || target === 'creative') await runCreative(context);
      if (target === 'images') await finish(context);
      else await awaitApproval(context);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      fleetBus.emit({ type: 'run.failed', runId, reason, at: nowIso() });
    }
  })();

  return true;
}

/* -------------------------------------------------------------- snapshot -- */

export async function fleetSnapshot(workspaceSlug?: string): Promise<FleetSnapshot> {
  const stored = await repo.listInvocations();
  const invocations = (stored.length ? stored : invocationLog).filter(
    (entry) => !workspaceSlug || entry.workspaceSlug === workspaceSlug,
  );

  const agents: FleetAgentHealth[] = AGENT_ORDER.map((key) => {
    const mine = invocations.filter((entry) => entry.agent === key);
    const finished = mine.filter((entry) => typeof entry.latencyMs === 'number');
    const passed = mine.filter((entry) => entry.verdict === 'passed').length;
    return {
      ...AGENTS[key],
      live: mine.some((entry) => entry.status === 'running' || entry.status === 'review'),
      runs: mine.length,
      avgLatencyMs: finished.length
        ? Math.round(finished.reduce((total, entry) => total + (entry.latencyMs ?? 0), 0) / finished.length)
        : null,
      lastRunAt: mine[0]?.startedAt ?? null,
      passRate: mine.length ? Math.round((passed / mine.length) * 100) / 100 : null,
    };
  });

  const running = [...active.values()].filter(
    (context) => !workspaceSlug || context.workspaceSlug === workspaceSlug,
  );
  const current = running[0] ?? null;
  const done = current ? nodeList(current).filter((node) => node.state === 'completed').length : 0;

  return {
    agents,
    powering: poweringTheFleet(),
    activeRunId: current?.run.id ?? null,
    activeSummary: current ? `${current.run.title} · ${STAGE_LABEL[current.run.stage]}` : null,
    activeProgress: current ? Math.round((done / WORKFLOW.length) * 100) : null,
    invocations: invocations.slice(0, 40),
  };
}

export function fleetMode() {
  return { reasoning: reasoningMode(), images: imageProviderName() };
}

export { STAGE_LABEL };
