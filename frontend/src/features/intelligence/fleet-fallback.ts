import type { HelmError } from '@/contracts';
import type { AgentDefinition } from '@/contracts/fleet';

/**
 * The fleet's shape when the API cannot be reached.
 *
 * The cast is a product fact, not a server response, so the surface still
 * explains who does what. What it will not do is invent activity: with no API
 * there are no invocations, and the page says so rather than showing a
 * plausible-looking run that never happened.
 */
export const FALLBACK_AGENTS: AgentDefinition[] = [
  {
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
    model: 'unavailable',
    setting: 'Reads only complete days. Never estimates a missing value.',
  },
  {
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
    model: 'unavailable',
    setting: 'Refuses to blend incompatible accounts. Proposes only — never acts.',
  },
  {
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
    model: 'unavailable',
    setting: 'Writes direction. Never publishes to a channel.',
  },
  {
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
    model: 'unavailable',
    setting: 'Runs only on approved directions. Never publishes to a channel.',
  },
];

export const FALLBACK_FLEET = {
  agents: FALLBACK_AGENTS,
  powering: [] as { label: string; value: string; note: string }[],
  mode: { reasoning: 'scripted' as const, images: 'studio-render' },
};

/**
 * One honest notice, shown wherever a surface has fallen back to fixtures.
 *
 * It names the actual reason rather than assuming the backend is down: a
 * permission refusal and an unreachable API are different problems and lead
 * the reader somewhere different.
 */
export function fleetNotice(live: boolean, error?: HelmError): { title: string; body: string } | null {
  if (live) return null;

  if (error?.code === 'unauthorized') {
    return {
      title: 'Showing the sample record — your role cannot read this',
      body: `${error.message} Ask a workspace admin if you need access.`,
    };
  }

  if (error && error.code !== 'network_unavailable' && error.code !== 'service_unavailable') {
    return { title: 'Showing the sample record', body: error.message };
  }

  return {
    title: 'Showing the sample record — the HELM API is not reachable',
    body:
      'Everything below is the typed sample workspace. Start the backend to run the fleet live, write to the decision graph, and generate creative.',
  };
}
