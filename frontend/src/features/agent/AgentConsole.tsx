'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelmMark } from '@/components/brand/HelmMark';
import { IconArrowRight, IconClose, IconEvidence, IconIntelligence, IconSpark } from '@/components/icons';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { useScrollLock } from '@/lib/scroll-lock';
import { useAgent, type AgentTurn } from './AgentProvider';

/**
 * The console the orb opens.
 *
 * A 340px panel wedged into a corner is a chat widget — the shape of a support
 * bubble, which is the wrong promise for something that reads the whole
 * workspace before it answers. This is a place you go instead: the page behind
 * it blurs out of the way, the console takes the middle of the screen, and the
 * conversation gets room to be read.
 *
 * It is deliberately not a route. The answer is almost always about what you
 * were just looking at, so navigating away from it to ask would throw away the
 * context that makes the question worth asking. Escape and the backdrop both
 * return you to exactly where you were.
 */

const OPENERS: { label: string; prompt: string; hint: string }[] = [
  {
    label: 'Where is the money going',
    prompt: 'Where is spend concentrated right now, and is that where it should be?',
    hint: 'Spend against outcome, by campaign',
  },
  {
    label: "What changed this week",
    prompt: 'What moved most in the last seven days, and what caused it?',
    hint: 'Movement with its cause attached',
  },
  {
    label: 'Why is CPA up',
    prompt: 'CPA has moved against us. Walk me through what is driving it.',
    hint: 'Traces the figure back to a campaign',
  },
  {
    label: 'Write this up',
    prompt: 'Write a short memo on the last investigation I can send to the client.',
    hint: 'A memo from the evidence on file',
  },
];

/**
 * The one piece of Markdown the agent actually reaches for.
 *
 * It emphasises campaign names constantly, and rendering `**Broad 04**` as
 * literal asterisks makes the answer look like a debug dump. This handles bold
 * and nothing else — a full Markdown renderer would be a dependency and an
 * attack surface for one pair of asterisks.
 */
function withEmphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={index} className="font-semibold text-ink-950">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

function Turn({ turn }: { turn: AgentTurn }) {
  if (turn.role === 'user') {
    return (
      <div className="anim-turn flex justify-end">
        <div className="max-w-[78%]">
          {turn.subject ? (
            <p className="mono mb-1 text-right text-[10.5px] uppercase tracking-[0.1em] text-ink-400">
              on {turn.subject}
            </p>
          ) : null}
          <div className="rounded-editorial rounded-br-md bg-ink-950 px-4 py-2.5 text-[14.5px] leading-[21px] text-surface">
            <p className="whitespace-pre-wrap">{turn.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-turn">
      <div
        className={cn(
          'max-w-[92%] rounded-editorial rounded-bl-md border px-4 py-3',
          turn.failed ? 'border-bad/30 bg-bad-soft' : 'border-line bg-surface-subtle',
        )}
      >
        <p className="whitespace-pre-wrap text-[14.5px] leading-[23px] text-ink-700">
          {withEmphasis(turn.content)}
        </p>

        {turn.actions?.length ? (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-2.5">
            {turn.actions.map((action) => (
              <li key={action.tool + action.summary}>
                {action.href ? (
                  <Link
                    href={action.href}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-action-deep hover:underline"
                  >
                    <IconEvidence size={13} />
                    {action.summary}
                    <IconArrowRight size={12} />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-500">
                    <IconEvidence size={13} />
                    {action.summary}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function AgentConsole({
  workspaceSlug,
  activeRun,
  decisionCount = 0,
}: {
  workspaceSlug: string;
  activeRun?: { id: string; title: string; stage: string } | null;
  decisionCount?: number;
}) {
  const {
    open,
    turns,
    thinking,
    draft,
    subject,
    setDraft,
    setSubject,
    closeConsole,
    clear,
    send,
  } = useAgent();

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const threadEnd = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useScrollLock(open);

  /* Escape closes, and focus comes back to whatever opened this on exit. */
  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeConsole();
        return;
      }
      if (event.key !== 'Tab') return;

      // Tab stays inside the console while it owns the screen.
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      const list = Array.from(nodes ?? []).filter((node) => node.offsetParent !== null);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      openerRef.current?.focus?.();
    };
  }, [open, closeConsole]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    threadEnd.current?.scrollIntoView({ block: 'end', behavior: turns.length ? 'smooth' : 'auto' });
  }, [open, turns, thinking]);

  if (!open || typeof document === 'undefined') return null;

  const empty = turns.length === 0;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6">
      {/*
        The scrim.

        Heavy blur rather than a dark wash: the workspace stays legible enough
        behind the console that you can see the thing you are asking about,
        which is the whole reason for asking here rather than on another page.
      */}
      <button
        type="button"
        aria-label="Close the console"
        tabIndex={-1}
        onClick={closeConsole}
        className="anim-scrim absolute inset-0 cursor-default bg-canvas/55 backdrop-blur-2xl"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="HELM console"
        className="anim-console relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-editorial border border-line bg-surface shadow-console sm:max-h-[min(760px,86vh)] sm:max-w-[860px] sm:rounded-editorial"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4 sm:px-7 sm:py-5">
          <span className="relative mt-0.5 shrink-0">
            <HelmMark size={30} />
            {thinking ? (
              <span
                aria-hidden="true"
                className="orb-halo absolute inset-0 rounded-full ring-2 ring-action-400"
              />
            ) : null}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-section text-ink-950">HELM</h2>
            <p className="mono mt-0.5 truncate text-[11px] text-ink-500">
              {activeRun
                ? `Running — ${activeRun.stage}`
                : 'Reads the workspace before it answers'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {turns.length ? (
              <button
                type="button"
                onClick={clear}
                className="mono rounded-control px-2.5 py-1.5 text-[11px] uppercase tracking-[0.08em] text-ink-400 transition-colors hover:bg-surface-sunk hover:text-ink-950"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeConsole}
              aria-label="Close the console"
              className="rounded-control p-1.5 text-ink-400 transition-colors hover:bg-surface-sunk hover:text-ink-950"
            >
              <IconClose size={18} />
            </button>
          </div>
        </header>

        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {empty ? (
            <div className="settle">
              <div>
                <p className="micro-label">Console</p>
                <h3 className="text-page mt-2 max-w-[19ch] text-ink-950">
                  What do you want to know?
                </h3>
                <p className="text-aside mt-2 max-w-prose text-[16px]">
                  Ask about any account in this workspace, or give it a job — it can start an
                  investigation and write the memo at the end of one.
                </p>
              </div>

              {activeRun || decisionCount > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {activeRun ? (
                    <Link
                      href={routes.run(workspaceSlug, activeRun.id)}
                      className="inline-flex items-center gap-2 rounded-control border border-line bg-surface-subtle px-3 py-2 text-[13px] text-ink-700 transition-colors hover:border-line-strong hover:bg-surface-sunk"
                    >
                      <span className="anim-working h-1.5 w-1.5 rounded-full bg-action-400" />
                      <span className="truncate">{activeRun.title}</span>
                      <IconArrowRight size={13} className="text-ink-400" />
                    </Link>
                  ) : null}
                  {decisionCount > 0 ? (
                    <Link
                      href={routes.briefing(workspaceSlug)}
                      className="inline-flex items-center gap-2 rounded-control border border-action-400/50 bg-helm-50 px-3 py-2 text-[13px] text-action-deep transition-colors hover:bg-helm-100"
                    >
                      <IconIntelligence size={14} />
                      {decisionCount} {decisionCount === 1 ? 'decision needs' : 'decisions need'} you
                      <IconArrowRight size={13} />
                    </Link>
                  ) : null}
                </div>
              ) : null}

              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {OPENERS.map((opener) => (
                  <li key={opener.label}>
                    <button
                      type="button"
                      onClick={() => send(opener.prompt)}
                      className="group h-full w-full rounded-field border border-line bg-surface px-4 py-3.5 text-left transition-[border-color,background-color,transform] duration-150 ease-out hover:-translate-y-px hover:border-action-400/60 hover:bg-surface-subtle"
                    >
                      <span className="flex items-center gap-2">
                        <IconSpark
                          size={14}
                          className="shrink-0 text-ink-400 transition-colors group-hover:text-action-deep"
                        />
                        <span className="text-[14.5px] font-medium text-ink-950">{opener.label}</span>
                      </span>
                      <span className="mono mt-1.5 block text-[11px] leading-[15px] text-ink-400">
                        {opener.hint}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              {turns.map((turn, index) => (
                <Turn key={index} turn={turn} />
              ))}

              {thinking ? (
                <div className="flex items-center gap-2 text-ink-400" aria-live="polite">
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="think-dot h-1.5 w-1.5 rounded-full bg-ink-400" />
                    <span className="think-dot think-d1 h-1.5 w-1.5 rounded-full bg-ink-400" />
                    <span className="think-dot think-d2 h-1.5 w-1.5 rounded-full bg-ink-400" />
                  </span>
                  <span className="mono text-[11.5px]">Reading the workspace</span>
                </div>
              ) : null}

              <div ref={threadEnd} />
            </div>
          )}
        </div>

        <div className="safe-b shrink-0 border-t border-line bg-surface-subtle px-5 py-3.5 sm:px-7 sm:py-4">
          {subject ? (
            <div className="mb-2.5 flex items-center gap-2">
              <span className="mono inline-flex items-center gap-1.5 rounded-full border border-action-400/50 bg-helm-50 px-2.5 py-1 text-[10.5px] uppercase tracking-[0.08em] text-action-deep">
                on {subject}
                <button
                  type="button"
                  onClick={() => setSubject(null)}
                  aria-label="Ask about the whole workspace instead"
                  className="text-action-deep/70 transition-colors hover:text-action-deep"
                >
                  <IconClose size={11} />
                </button>
              </span>
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <label htmlFor="agent-console-input" className="sr-only">
              Ask HELM
            </label>
            <textarea
              id="agent-console-input"
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              placeholder={subject ? `Ask about ${subject}…` : 'Ask, or tell it to do something'}
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-field border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] leading-[22px] text-ink-950 outline-none transition-colors placeholder:text-ink-400 focus:border-action-400"
            />
            <button
              type="button"
              onClick={() => send(draft)}
              disabled={!draft.trim() || thinking}
              aria-label="Send"
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-control bg-ink-950 text-surface transition-colors hover:bg-action-400 hover:text-action-ink disabled:opacity-35 disabled:hover:bg-ink-950 disabled:hover:text-surface"
            >
              <IconArrowRight size={17} />
            </button>
          </div>
          <p className="mono mt-2 text-[10.5px] text-ink-400">
            Enter to send · Shift+Enter for a new line · Esc to close
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
