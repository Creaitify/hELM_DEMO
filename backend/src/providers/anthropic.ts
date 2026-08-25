import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';

/**
 * The reasoning provider behind the fleet.
 *
 * With ANTHROPIC_API_KEY set, specialists reason over the evidence actually
 * present in the decision graph. Without it, every call resolves to the
 * caller's supplied fallback so the whole product still runs end to end and
 * the UI reports `scripted` rather than pretending a model answered.
 */

let client: Anthropic | null = null;

/**
 * Whether the configured key actually works.
 *
 * A key being present in .env is not the same as a key being accepted. The
 * service probes it once at boot so the product reports what the fleet will
 * really do, instead of promising model reasoning and quietly falling back on
 * every run.
 */
let health: { state: 'unconfigured' | 'unverified' | 'live' | 'rejected'; detail: string } = {
  state: 'unconfigured',
  detail: 'No ANTHROPIC_API_KEY configured.',
};

function anthropic(): Anthropic | null {
  if (!env.anthropic.apiKey) return null;
  if (!client) client = new Anthropic({ apiKey: env.anthropic.apiKey });
  return client;
}

export async function verifyAnthropic(): Promise<typeof health> {
  const sdk = anthropic();
  if (!sdk) {
    health = { state: 'unconfigured', detail: 'No ANTHROPIC_API_KEY configured.' };
    return health;
  }

  try {
    await sdk.messages.create({
      model: env.anthropic.fastModel,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'ok' }],
    });
    health = { state: 'live', detail: `Anthropic reachable — ${env.anthropic.model}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    health = {
      state: 'rejected',
      detail: message.includes('authentication_error')
        ? 'The ANTHROPIC_API_KEY was rejected (401). The fleet is running its deterministic sample reasoning.'
        : `Anthropic call failed: ${message.slice(0, 160)}`,
    };
  }
  return health;
}

export function anthropicHealth() {
  return health;
}

export type ReasonResult<T> = {
  value: T;
  live: boolean;
  tokensIn: number;
  tokensOut: number;
  model: string;
  error?: string;
};

export type ReasonOptions<T> = {
  system: string;
  prompt: string;
  /** Used verbatim when no key is configured or the call fails. */
  fallback: T;
  model?: string;
  maxTokens?: number;
  /** Shown to the model as the exact JSON shape to return. */
  shape?: string;
};

/** Pulls the first balanced JSON object or array out of a model response. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();

  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error('No JSON found in response');

  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < candidate.length; index += 1) {
    const char = candidate[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return JSON.parse(candidate.slice(start, index + 1));
    }
  }
  throw new Error('Unterminated JSON in response');
}

export async function reasonJson<T>(options: ReasonOptions<T>): Promise<ReasonResult<T>> {
  const model = options.model ?? env.anthropic.model;
  const sdk = anthropic();

  if (!sdk || health.state === 'rejected') {
    return {
      value: options.fallback,
      live: false,
      tokensIn: 0,
      tokensOut: 0,
      model: 'scripted',
      error: health.state === 'rejected' ? health.detail : undefined,
    };
  }

  const instruction = options.shape
    ? `${options.prompt}\n\nReturn only JSON matching this shape, with no commentary:\n${options.shape}`
    : `${options.prompt}\n\nReturn only JSON, with no commentary.`;

  try {
    const response = await sdk.messages.create({
      model,
      max_tokens: options.maxTokens ?? env.anthropic.maxTokens,
      system: options.system,
      messages: [{ role: 'user', content: instruction }],
    });

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n')
      .trim();

    return {
      value: extractJson(text) as T,
      live: true,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      model,
    };
  } catch (error) {
    return {
      value: options.fallback,
      live: false,
      tokensIn: 0,
      tokensOut: 0,
      model,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function reasonText(options: {
  system: string;
  prompt: string;
  fallback: string;
  model?: string;
  maxTokens?: number;
}): Promise<ReasonResult<string>> {
  const model = options.model ?? env.anthropic.model;
  const sdk = anthropic();
  if (!sdk || health.state === 'rejected') {
    return { value: options.fallback, live: false, tokensIn: 0, tokensOut: 0, model: 'scripted' };
  }
  try {
    const response = await sdk.messages.create({
      model,
      max_tokens: options.maxTokens ?? 1024,
      system: options.system,
      messages: [{ role: 'user', content: options.prompt }],
    });
    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n')
      .trim();
    return {
      value: text || options.fallback,
      live: true,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      model,
    };
  } catch (error) {
    return {
      value: options.fallback,
      live: false,
      tokensIn: 0,
      tokensOut: 0,
      model,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * What the fleet will actually use. A configured but rejected key reports
 * scripted, because that is what the run will do.
 */
export function reasoningMode(): 'anthropic' | 'scripted' {
  if (!env.anthropic.apiKey) return 'scripted';
  return health.state === 'rejected' ? 'scripted' : 'anthropic';
}
