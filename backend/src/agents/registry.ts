import { env } from '../env.js';
import { anthropicHealth } from '../providers/anthropic.js';
import { imageModelName } from '../providers/images.js';
import type { AgentDefinition, AgentKey } from '../domain/types.js';

/**
 * The fleet.
 *
 * Four specialists, called in a fixed order along the HELM workflow. HELM
 * holds the review gate between them and speaks to the user; the specialists
 * never do. Each one reads a defined slice of the decision graph and writes a
 * defined slice back.
 */

export const AGENTS: Record<AgentKey, AgentDefinition> = {
  scout: {
    key: 'scout',
    name: 'Signal Scout',
    role: 'Input and data',
    kind: 'retrieval',
    order: 1,
    summary:
      'Reconciles every connected account over the resolved window and separates what cannot be blended, so the rest of the fleet reasons over one trustworthy set of numbers.',
    reads: ['AdAccount', 'Campaign', 'Creative'],
    writes: ['Evidence'],
    gate: 'Every figure traces to a source account and a complete reporting day',
    model: env.anthropic.fastModel,
    setting: 'Reads only complete days. Never estimates a missing value.',
  },
  analyst: {
    key: 'analyst',
    name: 'Diagnostic Analyst',
    role: 'Analysis and proposals',
    kind: 'reasoning',
    order: 2,
    summary:
      'Explains what moved and why, sizes the exposure, and turns each decision-grade finding into a capped, reversible proposal with a stop condition.',
    reads: ['Evidence', 'Campaign', 'AdAccount'],
    writes: ['Finding', 'Recommendation'],
    gate: 'Each finding cites evidence, and each proposal carries a cap, a horizon and a stop condition',
    model: env.anthropic.model,
    setting: 'Refuses to blend incompatible accounts. Proposes only — never acts.',
  },
  creative: {
    key: 'creative',
    name: 'Creative Director',
    role: 'Creative direction',
    kind: 'generative',
    order: 3,
    summary:
      'Reads the fatigue evidence and the brand guidance, then writes replacement directions and platform-aware briefs for the work that needs replacing.',
    reads: ['Creative', 'Finding', 'Artifact'],
    writes: ['Artifact'],
    gate: 'Direction is grounded in the fatigue evidence and stays inside brand guidance',
    model: env.anthropic.model,
    setting: 'Writes direction. Never publishes to a channel.',
  },
  imager: {
    key: 'imager',
    name: 'Image Studio',
    role: 'Image generation',
    kind: 'generative',
    order: 4,
    summary:
      'Renders the approved directions at platform-aware sizes and files each result in the library with the prompt and model that produced it.',
    reads: ['Artifact'],
    writes: ['Artifact'],
    gate: 'Every rendered asset keeps its prompt, format and provenance',
    model: imageModelName(),
    setting: 'Runs only on approved directions. Never publishes to a channel.',
  },
};

export const AGENT_ORDER: AgentKey[] = (Object.values(AGENTS) as AgentDefinition[])
  .sort((a, b) => a.order - b.order)
  .map((agent) => agent.key);

export function agentDefinition(key: AgentKey): AgentDefinition {
  return AGENTS[key];
}

/** What is powering the fleet — resolved from the environment, not hard-coded. */
export function poweringTheFleet() {
  const live = anthropicHealth().state === 'live';
  const reasoning = live ? env.anthropic.model : 'HELM sample reasoning';
  const review = live ? env.anthropic.reviewModel : 'deterministic gate';

  return [
    {
      label: 'Reasoning model',
      value: reasoning,
      note: live
        ? 'Anthropic Messages API. Used by the analyst and the creative director.'
        : anthropicHealth().detail,
    },
    {
      label: 'Review gate',
      value: review,
      note: `HELM reviews every specialist output. Up to ${env.fleet.maxRevisions} revisions before a run stops.`,
    },
    {
      label: 'Decision graph',
      // What the reader needs is that the reasoning is traceable, not which
      // engine stores it. Naming the datastore here put an infrastructure
      // detail on a product screen, where it tells the reader nothing they can
      // act on and quietly advertises how the deployment is wired.
      value: 'Connected',
      note: 'Every finding, recommendation and decision is a node with traceable edges.',
    },
    {
      label: 'Image studio',
      value: imageModelName(),
      note: 'Every generated asset is filed against the run that produced it.',
    },
  ];
}
