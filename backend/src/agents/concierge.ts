import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { AGENTS } from './registry.js';

/**
 * The agent you talk to.
 *
 * Every other agent in HELM is a specialist that runs inside a fleet run and
 * never addresses a person. This one is the opposite: it is the surface the
 * workspace speaks through. It answers from the decision graph rather than
 * from memory, and when it is asked to do something it calls the same code
 * paths the interface does — so an investigation it starts is the same
 * investigation the Agent Fleet page shows, not a simulation of one.
 *
 * It reads freely and writes deliberately. Reads are how it answers; writes
 * cost money or create records, so each one is reported back in the response
 * and written to the audit ledger by the executor that performs it.
 *
 * The loop here is deliberately hand-written rather than delegated to a helper:
 * the cap on iterations, the refusal to loop forever on a model that keeps
 * asking for tools, and the exact shape of what comes back are the parts that
 * matter, and they are clearer in ten lines than behind an abstraction.
 */

export type ConciergeMessage = { role: 'user' | 'assistant'; content: string };

/** What the agent did, so the interface can say so plainly. */
export type ConciergeAction = { tool: string; summary: string; href?: string };

export type ConciergeResult = {
  reply: string;
  actions: ConciergeAction[];
  live: boolean;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

export type ToolExecutor = (
  name: string,
  input: Record<string, unknown>,
) => Promise<{ result: unknown; action?: ConciergeAction }>;

/**
 * The tools, described the way the model has to understand them.
 *
 * Descriptions say when *not* to use a tool as well as when to, because the
 * expensive mistakes here are starting an investigation nobody asked for and
 * inventing a number instead of reading one.
 */
export const CONCIERGE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'workspace_status',
    description:
      'The state of the workspace right now: connected accounts and their sync health, investigations in flight, and how many decisions are waiting for a human. Call this for any question about what is happening, what needs attention, or what has changed.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'performance_summary',
    description:
      'Blended spend, attributed value, ROAS, CPA and conversions for the current window, with the comparison against the previous window, plus the per-platform split. Call this for any question about how the account is doing or what the numbers are. Never state a figure that did not come from this tool.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_findings',
    description:
      'Findings the fleet has produced, newest first, with severity and the recommended next step. Use this to answer what the problems are or what needs deciding.',
    input_schema: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          enum: ['decision', 'watch', 'stable'],
          description: 'Optional filter. Omit for everything.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_campaigns',
    description:
      'Campaigns in the current scope with spend, CPA, ROAS and their delta against the previous window. Use this when asked which campaign is responsible for something, or to rank campaigns.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_investigations',
    description:
      'Investigations the fleet has run, with their stage and how many findings each produced. Use this before starting a new one, so you do not duplicate work that has already been done.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'start_investigation',
    description:
      'Starts a real fleet run: the scout collects evidence, the analyst writes findings and capped proposals, the creative director drafts replacements, and a review gate checks each one. This costs money and takes about a minute. Only call it when the person has clearly asked for an investigation, an analysis, or for the fleet to look into something. Never call it to answer a question you could answer by reading.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question the run should answer, in the requester’s own terms.',
        },
        intent: {
          type: 'string',
          enum: ['diagnose', 'creative', 'opportunity'],
          description: 'diagnose for what went wrong, creative for replacement creative, opportunity for where to move budget.',
        },
      },
      required: ['question'],
      additionalProperties: false,
    },
  },
  {
    name: 'write_memo',
    description:
      'Writes a decision memo from a finished investigation and files it in Documents, where it can be downloaded as PDF or Word. Call list_investigations first to choose the run. Only call this when asked for a memo, a write-up, or a document.',
    input_schema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'The investigation to write up.' },
      },
      required: ['runId'],
      additionalProperties: false,
    },
  },
];

export function conciergeSystemPrompt(context: {
  workspaceName: string;
  userName: string;
  scopeLabel: string;
  rangeLabel: string;
  currency: string;
}): string {
  return [
    `You are HELM, the agent for the ${context.workspaceName} workspace. You are speaking with ${context.userName}.`,
    '',
    'You coordinate a fleet of specialists — a signal scout, a diagnostic analyst, and a creative director — each checked by a review gate before its work is shown to anyone. You are the only one of them who talks to a person.',
    '',
    `The reader is looking at ${context.scopeLabel} over ${context.rangeLabel}, reported in ${context.currency}.`,
    '',
    'How you work:',
    '- Read before you answer. Every figure you state must have come from a tool call in this conversation. If you do not have a number, say so and offer to fetch it — never estimate one.',
    '- Answer in two or three sentences unless asked for more. This is a panel in the corner of a screen, not a report.',
    '- Say what is true, including when it is unwelcome. A degraded sync or an unavailable metric is information, not something to smooth over.',
    '- Starting an investigation costs money and takes a minute. Do it when asked; do not do it to answer something you could look up.',
    '- Never promise an outcome. The fleet proposes and a person decides.',
    '- You are not a chatbot with a personality. Plain sentences, no preamble, no "Great question!", no emoji.',
  ].join('\n');
}

/** Reads the plain text out of a response, ignoring tool blocks. */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

const MAX_TOOL_TURNS = 6;

/**
 * One exchange: the model may call tools repeatedly before it answers.
 *
 * The iteration cap exists because a model that keeps asking for tools without
 * ever answering would otherwise spend the workspace's money in a loop. When
 * the cap is hit the last text is returned rather than an error, so the person
 * gets whatever the agent had worked out.
 */
export async function converse(options: {
  system: string;
  messages: ConciergeMessage[];
  execute: ToolExecutor;
}): Promise<ConciergeResult> {
  const model = env.anthropic.model;

  if (!env.anthropic.apiKey) {
    return {
      reply:
        'I am not connected to a reasoning model, so I can only show you the workspace as it stands. Set ANTHROPIC_API_KEY and I can answer properly.',
      actions: [],
      live: false,
      model: 'scripted',
      tokensIn: 0,
      tokensOut: 0,
    };
  }

  const client = new Anthropic({ apiKey: env.anthropic.apiKey });
  const history: Anthropic.MessageParam[] = options.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const actions: ConciergeAction[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let lastText = '';

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn += 1) {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: options.system,
      tools: CONCIERGE_TOOLS,
      messages: history,
    });

    tokensIn += response.usage.input_tokens;
    tokensOut += response.usage.output_tokens;
    lastText = textOf(response) || lastText;

    if (response.stop_reason !== 'tool_use') {
      return { reply: lastText, actions, live: true, model, tokensIn, tokensOut };
    }

    const calls = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    history.push({ role: 'assistant', content: response.content });

    // Every tool result goes back in one user message. Splitting them teaches
    // the model to stop asking for tools in parallel.
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls) {
      try {
        const outcome = await options.execute(call.name, (call.input ?? {}) as Record<string, unknown>);
        if (outcome.action) actions.push(outcome.action);
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(outcome.result),
        });
      } catch (error) {
        // A failed tool is reported to the model, not swallowed — it can say
        // what went wrong rather than answering as if the call had worked.
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          is_error: true,
          content: error instanceof Error ? error.message : 'The tool failed.',
        });
      }
    }

    history.push({ role: 'user', content: results });
  }

  return {
    reply:
      lastText ||
      'I kept needing to look things up and ran out of steps before I could answer. Ask me something narrower and I will get there.',
    actions,
    live: true,
    model,
    tokensIn,
    tokensOut,
  };
}

export const CONCIERGE_NAME = 'HELM';
export const CONCIERGE_FLEET = Object.values(AGENTS).map((agent) => agent.name);
