'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IconClose, IconSpark } from '@/components/icons';
import { useAgent } from '@/features/agent/AgentProvider';
import { cn } from '@/lib/cn';

/**
 * The agent you talk to, present on every surface.
 *
 * It is dragged rather than docked, because a fixed corner panel covers
 * whatever is in that corner and on a dense table that is usually the thing
 * being read. It remembers where it was put.
 *
 * Drag and click are the same gesture until a press moves more than a few
 * pixels — without that threshold every reposition ends with a console nobody
 * asked for.
 *
 * At rest it breathes. That is not decoration: a button that sits perfectly
 * still in the corner of a dashboard reads as furniture, and nobody presses
 * furniture. When there is something waiting — a decision, a run in flight —
 * the halo pulses out of it instead, which is the difference between "I am
 * here" and "I have something for you".
 *
 * The conversation itself lives in AgentProvider, so a metric cell can point
 * this at a subject without going through the orb at all.
 */

const STORAGE_KEY = 'helm.agent.orb';
const ORB = 52;
const EDGE = 20;
/** Beyond this a press is a drag, not a click. Roughly a fingertip's wobble. */
const DRAG_THRESHOLD = 4;

type Point = { x: number; y: number };

function clampToViewport(point: Point): Point {
  if (typeof window === 'undefined') return point;
  return {
    x: Math.min(Math.max(point.x, EDGE), Math.max(EDGE, window.innerWidth - ORB - EDGE)),
    y: Math.min(Math.max(point.y, EDGE), Math.max(EDGE, window.innerHeight - ORB - EDGE)),
  };
}

/** The corner it comes to rest in when nobody has moved it. */
function restingCorner(): Point {
  return {
    x: window.innerWidth - ORB - EDGE,
    y: window.innerHeight - ORB - EDGE,
  };
}

export function AgentOrb({
  decisionCount = 0,
  activeRun,
}: {
  decisionCount?: number;
  activeRun?: { id: string; title: string; stage: string } | null;
}) {
  const { open, toggleConsole, openConsole, thinking } = useAgent();
  const [position, setPosition] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hinted, setHinted] = useState(false);

  const origin = useRef<{ pointer: Point; orb: Point; moved: boolean } | null>(null);

  /*
   * Whether a person put it there.
   *
   * This is the difference between a position that must be preserved and one
   * that is only a default. It matters because the orb can mount before the
   * document has been laid out — a background tab, an embedded frame, the beat
   * before hydration settles — and at zero width every corner clamps to the
   * top left. Clamping alone can never undo that: (20, 20) is a legal position
   * in a 1440px window, so the orb stayed in the wrong corner for the rest of
   * the session.
   *
   * An orb nobody has moved therefore recomputes its resting corner whenever
   * the viewport changes; one that was dragged or restored is only ever
   * clamped back inside.
   */
  const placed = useRef(false);

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

    placed.current = restored !== null;
    setPosition(clampToViewport(restored ?? restingCorner()));
  }, []);

  // A window that shrinks must not strand the orb outside it — and one that
  // grows must let an unplaced orb find its corner again.
  useEffect(() => {
    const onResize = () =>
      setPosition((current) => {
        if (!current) return current;
        return clampToViewport(placed.current ? current : restingCorner());
      });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* Cmd/Ctrl + / opens the console from the keyboard. ⌘K is the palette. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        openConsole();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openConsole]);

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

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const start = origin.current;
      origin.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (!start) return;

      if (start.moved) {
        setDragging(false);
        placed.current = true;
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

      toggleConsole();
    },
    [toggleConsole],
  );

  if (!position) return null;

  const waiting = decisionCount > 0 || Boolean(activeRun);
  /* The label unfurls toward the middle of the screen, never off the edge. */
  const labelOnLeft = position.x > window.innerWidth / 2;

  return (
    <div className="pointer-events-none fixed inset-0 z-[110]">
      <div
        className="absolute"
        style={{ left: position.x, top: position.y, width: ORB, height: ORB }}
      >
        {/*
          The halo. It pulses out of the orb only when something is actually
          waiting, so an idle workspace has a still corner and a busy one does
          not have to be discovered.
        */}
        {waiting && !open && !dragging ? (
          <span
            aria-hidden="true"
            className="orb-halo absolute inset-0 rounded-full bg-action-400/45"
          />
        ) : null}

        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerEnter={() => setHinted(true)}
          onPointerLeave={() => setHinted(false)}
          onFocus={() => setHinted(true)}
          onBlur={() => setHinted(false)}
          aria-label={open ? 'Close the HELM console' : 'Open the HELM console'}
          aria-expanded={open}
          aria-keyshortcuts="Meta+/ Control+/"
          className={cn(
            'pointer-events-auto relative flex h-full w-full items-center justify-center overflow-hidden rounded-full',
            'border border-ink-950/10 shadow-lift outline-offset-4',
            'transition-[background-color,color,transform,box-shadow] duration-200 ease-entrance',
            open
              ? 'bg-action-400 text-action-ink'
              : 'bg-ink-950 text-surface hover:bg-action-400 hover:text-action-ink',
            dragging ? 'scale-110 cursor-grabbing shadow-lift-lg' : 'cursor-grab hover:scale-105',
            // Breathing stops the moment it is being used for anything.
            !open && !dragging && !hinted && 'orb-breathe',
          )}
          style={{ touchAction: 'none' }}
        >
          {/* A slow sheen across the face, so the orb reads as an object with
              a surface rather than a flat filled circle. */}
          {!open ? (
            <span
              aria-hidden="true"
              className="orb-sheen pointer-events-none absolute inset-y-[-40%] left-0 w-1/3 bg-surface/18 blur-[3px]"
            />
          ) : null}

          <span className="relative">
            {open ? (
              <IconClose size={20} />
            ) : thinking ? (
              // Mid-answer with the console closed: the mark keeps working so
              // the reply is not a surprise when it lands.
              <span className="flex gap-[3px]" aria-hidden="true">
                <span className="think-dot h-1 w-1 rounded-full bg-current" />
                <span className="think-dot think-d1 h-1 w-1 rounded-full bg-current" />
                <span className="think-dot think-d2 h-1 w-1 rounded-full bg-current" />
              </span>
            ) : (
              <IconSpark size={21} />
            )}
          </span>
        </button>

        {decisionCount > 0 && !open ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-1 -top-1 flex h-[20px] min-w-[20px] items-center justify-center rounded-full border-2 border-canvas bg-urgent px-1 text-[10.5px] font-semibold text-white"
          >
            {decisionCount}
          </span>
        ) : null}

        {/* The affordance. An unlabelled circle is a mystery; it says what it
            is on approach and then gets out of the way. */}
        {hinted && !open && !dragging ? (
          <span
            aria-hidden="true"
            className={cn(
              'anim-fade pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-control border border-line bg-surface px-3 py-1.5 shadow-lift',
              labelOnLeft ? 'right-[calc(100%+10px)]' : 'left-[calc(100%+10px)]',
            )}
          >
            <span className="text-[13px] font-medium text-ink-950">Ask HELM</span>
            <kbd className="mono rounded border border-line bg-surface-sunk px-1.5 py-px text-[10px] text-ink-500">
              ⌘/
            </kbd>
          </span>
        ) : null}
      </div>
    </div>
  );
}
