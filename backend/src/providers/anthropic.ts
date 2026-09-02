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
export type ReasoningHealth = {
  /**
   * `rejected` is permanent for this process: the key is wrong and retrying
   * will not change that. `unavailable` is not — a rate limit, an overloaded
   * API or a network blip says nothing about the key, and the next call may
   * well succeed.
   *
   * Collapsing the two was a real fault: a single 529 while the service was
   * starting downgraded the whole fleet to scripted reasoning for the lifetime
   * of the process, with nothing in the interface to say why.
   */
  state: 'unconfigured' | 'unverified' | 'live' | 'rejected' | 'unavailable';
  detail: string;
};

let health: ReasoningHealth = {
  state: 'unconfigured',
  detail: 'No ANTHROPIC_API_KEY configured.',
};

/**
 * Classifies a failure by what the SDK actually threw.
 *
 * Matching on the text of an error message is guesswork that breaks the first
 * time the wording changes; the SDK raises a distinct class per status, so the
 * distinction that matters here — permanent versus transient — is read from
 * the type rather than inferred from prose.
 */
function classify(error: unknown): ReasoningHealth {
  if (error instanceof Anthropic.AuthenticationError) {
    return {
      state: 'rejected',
      detail:
        'The ANTHROPIC_API_KEY was rejected (401). The fleet is running its deterministic sample reasoning.',
    };
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return {
      state: 'rejected',
      detail: 'The ANTHROPIC_API_KEY is valid but not permitted to use this model (403).',
    };
  }
  if (error instanceof Anthropic.NotFoundError) {
    return {
      state: 'rejected',
      detail: `No such model: ${env.anthropic.model} (404). Check ANTHROPIC_MODEL.`,
    };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { state: 'unavailable', detail: 'Rate limited (429). Reasoning will be retried.' };
  }
  if (error instanceof Anthropic.InternalServerError) {
    return { state: 'unavailable', detail: 'Anthropic is unavailable right now. Reasoning will be retried.' };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { state: 'unavailable', detail: 'Could not reach Anthropic. Reasoning will be retried.' };
  }

  const message = error instanceof Error ? error.message : String(error);
  return { state: 'unavailable', detail: `Anthropic call failed: ${message.slice(0, 160)}` };
}

/**
 * Only a key we know to be wrong stops the attempt.
 *
 * Anything transient still tries, because the alternative is refusing to reason
 * for hours after one bad minute.
 */
function reasoningBlocked(): boolean {
  return health.state === 'rejected';
}

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
    health = classify(error);
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
  /**
   * Whether `value` is the caller's fallback rather than the model's answer.
   *
   * `live` says the API call happened; it does not say the answer was usable.
   * A call that succeeds and returns well-formed JSON of the wrong shape is
   * live and useless, and the two must not be confused: reporting a scripted
   * finding under the model's name is the one failure a reader cannot detect.
   */
  usedFallback: boolean;
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
  /**
   * The shape the answer must actually satisfy, checked before it is returned.
   *
   * `shape` asks; this enforces. Without it every field arrives as `as T` and
   * a renamed or renested key becomes a default value far downstream, where it
   * reads as something the model decided rather than something it never said.
   * A first answer that fails is sent back once with the specific validation
   * errors, because a model told exactly what was wrong usually fixes it.
   */
  schema?: { safeParse: (input: unknown) => { success: boolean; data?: T; error?: unknown } };
};

/** The validation complaints, flattened into something worth re-prompting on. */
function describeIssues(error: unknown): string {
  const issues = (error as { issues?: { path?: (string | number)[]; message?: string }[] })?.issues;
  if (!Array.isArray(issues)) return 'the answer did not match the required shape';
  return issues
    .slice(0, 12)
    .map((issue) => `- ${(issue.path ?? []).join('.') || '(root)'}: ${issue.message ?? 'invalid'}`)
    .join('\n');
}

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

  if (!sdk || reasoningBlocked()) {
    return {
      value: options.fallback,
      live: false,
      tokensIn: 0,
      tokensOut: 0,
      model: 'scripted',
      error: reasoningBlocked() ? health.detail : undefined,
      usedFallback: true,
    };
  }

  const instruction = options.shape
    ? `${options.prompt}\n\nReturn only JSON matching this shape, with no commentary:\n${options.shape}`
    : `${options.prompt}\n\nReturn only JSON, with no commentary.`;

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: instruction },
  ];

  let tokensIn = 0;
  let tokensOut = 0;
  let lastError = 'The model did not return usable JSON.';

  // Two attempts at most: the answer, and one correction naming what was wrong
  // with it. A third would be guessing rather than correcting.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await sdk.messages.create({
        model,
        max_tokens: options.maxTokens ?? env.anthropic.maxTokens,
        system: options.system,
        messages,
      });

      const text = response.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('\n')
        .trim();

      tokensIn += response.usage.input_tokens;
      tokensOut += response.usage.output_tokens;

      // A call that worked is the best evidence there is that the key is good,
      // so a run recovers the health a transient failure took away.
      health = { state: 'live', detail: `Anthropic reachable — ${model}` };

      // A truncated answer is not a short answer. Its JSON is cut mid-structure,
      // so whatever survives parsing is a fragment presented as the whole.
      if (response.stop_reason === 'max_tokens') {
        lastError = `The model was cut off at ${options.maxTokens ?? env.anthropic.maxTokens} tokens.`;
        messages.push(
          { role: 'assistant', content: text.slice(0, 2000) },
          {
            role: 'user',
            content: `That answer was cut off before it finished. Return the same result more concisely so it fits, as complete JSON.`,
          },
        );
        continue;
      }

      const parsed = extractJson(text);

      if (!options.schema) {
        return { value: parsed as T, live: true, tokensIn, tokensOut, model, usedFallback: false };
      }

      const checked = options.schema.safeParse(parsed);
      if (checked.success) {
        return {
          value: checked.data as T,
          live: true,
          tokensIn,
          tokensOut,
          model,
          usedFallback: false,
        };
      }

      lastError = `The model's answer did not match the required shape.`;
      messages.push(
        { role: 'assistant', content: text.slice(0, 4000) },
        {
          role: 'user',
          content: `That did not match the required shape:\n${describeIssues(checked.error)}\n\nReturn the corrected JSON only.`,
        },
      );
    } catch (error) {
      // An unparseable body is the model's answer being unusable, not the
      // connection being unwell, and must not mark the API unhealthy.
      if (error instanceof Anthropic.APIError) {
        health = classify(error);
        return {
          value: options.fallback,
          live: false,
          tokensIn,
          tokensOut,
          model,
          error: health.detail,
          usedFallback: true,
        };
      }

      lastError = 'The model did not return usable JSON.';
      messages.push({
        role: 'user',
        content: 'That was not valid JSON. Return only the JSON object, with no commentary.',
      });
    }
  }

  return {
    value: options.fallback,
    live: true,
    tokensIn,
    tokensOut,
    model,
    error: lastError,
    usedFallback: true,
  };
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
  if (!sdk || reasoningBlocked()) {
    return { value: options.fallback, live: false, tokensIn: 0, tokensOut: 0, model: 'scripted', usedFallback: true };
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
      usedFallback: !text,
    };
  } catch (error) {
    return {
      value: options.fallback,
      live: false,
      tokensIn: 0,
      tokensOut: 0,
      model,
      error: error instanceof Error ? error.message : String(error),
      usedFallback: true,
    };
  }
}

/**
 * What the fleet will actually use. A configured but rejected key reports
 * scripted, because that is what the run will do.
 */
export function reasoningMode(): 'anthropic' | 'scripted' {
  if (!env.anthropic.apiKey) return 'scripted';
  return reasoningBlocked() ? 'scripted' : 'anthropic';
}
