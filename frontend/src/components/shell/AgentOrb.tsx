'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { routes } from '@/lib/routes';
import { api, describeError } from '@/lib/api';
import { IconArrowRight, IconClose, IconSpark } from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * The agent you talk to, present on every surface.
 *
 * It is dragged rather than docked, because a fixed corner panel covers
 * whatever is in that corner and on a dense table that is usually the thing
 * being read. It remembers where it was put.
 *
 * Drag and click are the same gesture until a press moves more than a few
 * pixels — without that threshold every reposition ends with a panel nobody
 * asked for.
 *
 * The conversation lives here rather than on the server. A panel in the corner
 * of a screen that remembered last Tuesday would be a surprise, not a feature,
 * and holding it client-side means the backend stays stateless.
 */

const STORAGE_KEY = 'helm.agent.orb';
const ORB = 46;
const EDGE = 18;
/** Beyond this a press is a drag, not a click. Roughly a fingertip's wobble. */
const DRAG_THRESHOLD = 4;

type Point = { x: number; y: number };
type Action = { tool: string; summary: string; href?: string };
type Turn = {
  role: 'user' | 'assistant';
  content: string;
  actions?: Action[];
  failed?: boolean;
};

const OPENERS = [
  'How is the account doing?',
  'What needs my attention?',
  'Investigate why CPA went up',
  'Write up the last investigation',
];

/**
 * The one piece of Markdown the agent actually reaches for.
 *
 * It emphasises campaign names constantly, and rendering `**Broad 04**` as
 * literal asterisks makes the answer look like a debug dump. This handles bold
 * and nothing else — a full Markdown renderer in a corner panel would be a
 * dependency and an attack surface for one pair of asterisks.
 */
function withEmphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={index} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

function clampToViewport(point: Point): Point {
  if (typeof window === 'undefined') return point;
  return {
    x: Math.min(Math.max(point.x, EDGE), Math.max(EDGE, window.innerWidth - ORB - EDGE)),
    y: Math.min(Math.max(point.y, EDGE), Math.max(EDGE, window.innerHeight - ORB - EDGE)),
  };
}

export function AgentOrb({
  workspaceSlug,
  decisionCount = 0,
  activeRun,
}: {
  workspaceSlug: string;
  decisionCount?: number;
  activeRun?: { id: string; title: string; stage: string } | null;
}) {
  const pathname = usePathname();
  const [position, setPosition] = useState<Point | null>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);

  const origin = useRef<{ pointer: Point; orb: Point; moved: boolean } | null>(null);
  const threadEnd = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Placed after mount, because the resting corner depends on a viewport the
  // server cannot know. Rendering nothing until then avoids a jump.
  useEffect(() => {
    let restored: Point | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Point;
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') restored = parsed;
      }
    } catch {
      // A private window, or storage the browser refuses. The default corner
      // is a perfectly good answer.
    }

    setPosition(
      clampToViewport(
        restored ?? { x: window.innerWidth - ORB - EDGE, y: window.innerHeight - ORB - EDGE },
      ),
    );
  }, []);

  // A window that shrinks must not strand the orb outside it.
  useEffect(() => {
    const onResize = () => setPosition((current) => (current ? clampToViewport(current) : current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  /** Following a link the agent offered is an answer; the panel steps aside. */
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (open) {
      threadEnd.current?.scrollIntoView({ block: 'end' });
      inputRef.current?.focus();
    }
  }, [open, turns, thinking]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || thinking) return;

      const next: Turn[] = [...turns, { role: 'user', content: question }];
      setTurns(next);
      setDraft('');
      setThinking(true);

      try {
        const response = await api.post<{ reply: string; actions: Action[] }>(
          `/api/workspaces/${workspaceSlug}/agent`,
          { messages: next.map(({ role, content }) => ({ role, content })) },
        );
        setTurns((current) => [
          ...current,
          { role: 'assistant', content: response.reply, actions: response.actions },
        ]);
      } catch (error) {
        setTurns((current) => [
          ...current,
          { role: 'assistant', content: describeError(error), failed: true },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [turns, thinking, workspaceSlug],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!position) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      origin.current = { pointer: { x: event.clientX, y: event.clientY }, orb: position, moved: false };
    },
    [position],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const start = origin.current;
    if (!start) return;

    const dx = event.clientX - start.pointer.x;
    const dy = event.clientY - start.pointer.y;

    if (!start.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!start.moved) {
      start.moved = true;
      setDragging(true);
    }

    setPosition(clampToViewport({ x: start.orb.x + dx, y: start.orb.y + dy }));
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const start = origin.current;
    origin.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!start) return;

    if (start.moved) {
      setDragging(false);
      setPosition((current) => {
        if (current) {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
          } catch {
            // Not remembering where it was put is not worth interrupting anybody over.
          }
        }
        return current;
      });
      return;
    }

    setOpen((value) => !value);
  }, []);

  if (!position) return null;

  const openLeft = position.x > window.innerWidth / 2;
  const openUp = position.y > window.innerHeight / 2;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {open ? (
        <div
          role="dialog"
          aria-label="HELM agent"
          className="pointer-events-auto absolute flex max-h-[min(560px,78vh)] w-[340px] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-overlay"
          style={{
            left: openLeft ? undefined : position.x,
            right: openLeft ? Math.max(EDGE, window.innerWidth - position.x - ORB) : undefined,
            top: openUp ? undefined : position.y + ORB + 10,
            bottom: openUp ? Math.max(EDGE, window.innerHeight - position.y + 10) : undefined,
          }}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-ink-950">HELM</p>
              <p className="mono mt-0.5 truncate text-[11px] text-ink-400">
                {activeRun ? `Running — ${activeRun.stage}` : 'Ask about the account, or give it a job'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {turns.length ? (
                <button
                  type="button"
                  onClick={() => setTurns([])}
                  className="mono rounded-control px-2 py-1 text-[11px] text-ink-400 transition-colors hover:bg-surface-subtle hover:text-ink-950"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close the agent"
                className="rounded-control p-1 text-ink-400 transition-colors hover:bg-surface-subtle hover:text-ink-950"
              >
                <IconClose size={15} />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {turns.length === 0 ? (
              <div className="space-y-3">
                {activeRun ? (
                  <Link
                    href={routes.run(workspaceSlug, activeRun.id)}
                    className="block rounded-control border border-line px-3 py-2 transition-colors hover:border-helm-500 hover:bg-helm-50"
                  >
                    <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-ink-400">
                      Running now
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-ink-950">
                      {activeRun.title}
                    </span>
                  </Link>
                ) : null}

                {decisionCount > 0 ? (
                  <Link
                    href={routes.briefing(workspaceSlug)}
                    className="mono block text-[11.5px] text-helm-600 hover:underline"
                  >
                    {decisionCount} {decisionCount === 1 ? 'decision needs' : 'decisions need'} you
                  </Link>
                ) : null}

                <p className="text-[12.5px] leading-[18px] text-ink-500">
                  I read the workspace before I answer, and I can start an investigation or write a
                  memo when you ask.
                </p>

                <ul className="space-y-1.5">
                  {OPENERS.map((opener) => (
                    <li key={opener}>
                      <button
                        type="button"
                        onClick={() => void send(opener)}
                        className="w-full rounded-control border border-line px-3 py-2 text-left text-[13px] text-ink-700 transition-colors hover:border-line-strong hover:bg-surface-subtle hover:text-ink-950"
                      >
                        {opener}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                {turns.map((turn, index) => (
                  <div key={index} className={cn(turn.role === 'user' && 'flex justify-end')}>
                    <div
                      className={cn(
                        'max-w-[92%] rounded-card px-3 py-2 text-[13px] leading-[19px]',
                        turn.role === 'user'
                          ? 'bg-helm-600 text-white'
                          : turn.failed
                            ? 'border border-bad/25 bg-bad-soft text-ink-950'
                            : 'border border-line bg-surface-subtle text-ink-800',
                      )}
                    >
                      <p className="whitespace-pre-wrap">{withEmphasis(turn.content)}</p>

                      {turn.actions?.length ? (
                        <ul className="mt-2 space-y-1 border-t border-line pt-2">
                          {turn.actions.map((action) => (
                            <li key={action.tool + action.summary}>
                              {action.href ? (
                                <Link
                                  href={action.href}
                                  className="inline-flex items-center gap-1 text-[12px] font-medium text-helm-600 hover:underline"
                                >
                                  {action.summary}
                                  <IconArrowRight size={12} />
                                </Link>
                              ) : (
                                <span className="text-[12px] text-ink-500">{action.summary}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                ))}

                {thinking ? (
                  <p className="mono text-[11.5px] text-ink-400">Reading the workspace…</p>
                ) : null}
                <div ref={threadEnd} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-line p-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
                placeholder="Ask, or tell it to do something"
                className="max-h-24 min-h-[38px] flex-1 resize-none rounded-field border border-line-strong bg-surface-sunk px-3 py-2 text-[13.5px] leading-[19px] text-ink-950 outline-none placeholder:text-ink-400 focus:border-helm-500 focus:bg-surface"
              />
              <button
                type="button"
                onClick={() => void send(draft)}
                disabled={!draft.trim() || thinking}
                aria-label="Send"
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-control bg-helm-600 text-white transition-colors hover:bg-helm-700 disabled:opacity-40"
              >
                <IconArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={open ? 'Close the HELM agent' : 'Open the HELM agent'}
        aria-expanded={open}
        className={cn(
          'pointer-events-auto absolute flex items-center justify-center rounded-full text-white shadow-overlay',
          'bg-helm-600 transition-[background-color,transform] hover:bg-helm-700',
          dragging ? 'scale-105 cursor-grabbing' : 'cursor-grab',
          open && 'bg-helm-700',
        )}
        style={{ left: position.x, top: position.y, width: ORB, height: ORB, touchAction: 'none' }}
      >
        <IconSpark size={19} />

        {decisionCount > 0 && !open ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-warn px-1 text-[10px] font-semibold text-ink-950"
          >
            {decisionCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
