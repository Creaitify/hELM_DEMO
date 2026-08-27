'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { routes } from '@/lib/routes';
import { IconClose, IconSpark } from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * The HELM agent, present on every surface.
 *
 * It sits where the reader left it rather than where the layout wanted it: a
 * fixed panel in the corner covers whatever happens to be in that corner, and
 * on a dense table that is usually the thing you were reading. So it is picked
 * up and put down, and it remembers where.
 *
 * Drag and click are the same gesture until they are not — a press that moves
 * more than a few pixels is a drag and must not also open the panel, or every
 * reposition ends with a panel nobody asked for.
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

  const origin = useRef<{ pointer: Point; orb: Point; moved: boolean } | null>(null);

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

  // The panel closes on Escape, like every other overlay in the product.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  /** Moving to another page is an answer; the panel has served its purpose. */
  useEffect(() => setOpen(false), [pathname]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!position) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      origin.current = {
        pointer: { x: event.clientX, y: event.clientY },
        orb: position,
        moved: false,
      };
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
      setOpen(false);
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
        setPosition((current) => {
          if (current) {
            try {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
            } catch {
              // Not being able to remember where it was put is not a failure
              // worth interrupting anybody over.
            }
          }
          return current;
        });
        return;
      }

      setOpen((value) => !value);
    },
    [],
  );

  if (!position) return null;

  // The panel opens toward whichever side has room, so it is never clipped.
  const openLeft = position.x > window.innerWidth / 2;
  const openUp = position.y > window.innerHeight / 2;

  const actions = [
    { label: 'Start an investigation', href: routes.intelligence(workspaceSlug) },
    { label: 'Write a memo', href: routes.documents(workspaceSlug) },
    { label: 'Open the image studio', href: routes.studio(workspaceSlug) },
    { label: 'See the briefing', href: routes.briefing(workspaceSlug) },
  ];

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60]"
      aria-live="polite"
      // The layer spans the viewport so the panel can position against the orb,
      // but only the orb and the panel themselves take pointer events.
    >
      {open ? (
        <div
          role="dialog"
          aria-label="HELM agent"
          className={cn(
            'pointer-events-auto absolute w-[292px] overflow-hidden rounded-card border border-line bg-surface shadow-overlay',
          )}
          style={{
            left: openLeft ? undefined : position.x,
            right: openLeft ? Math.max(EDGE, window.innerWidth - position.x - ORB) : undefined,
            top: openUp ? undefined : position.y + ORB + 10,
            bottom: openUp ? Math.max(EDGE, window.innerHeight - position.y + 10) : undefined,
          }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-ink-950">HELM agent</p>
              <p className="mono mt-0.5 text-[11px] text-ink-400">Always on this workspace</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the agent"
              className="shrink-0 rounded-control p-1 text-ink-400 transition-colors hover:bg-surface-subtle hover:text-ink-950"
            >
              <IconClose size={15} />
            </button>
          </div>

          <div className="border-b border-line px-4 py-3">
            {activeRun ? (
              <Link
                href={routes.run(workspaceSlug, activeRun.id)}
                className="block rounded-control border border-line px-3 py-2 transition-colors hover:border-helm-500 hover:bg-helm-50"
              >
                <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-ink-400">
                  Running now
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-ink-950">{activeRun.title}</span>
                <span className="mono block text-[11px] text-ink-500">
                  {activeRun.stage.replace(/_/g, ' ')}
                </span>
              </Link>
            ) : (
              <p className="text-[12.5px] leading-[18px] text-ink-500">
                Nothing is running. The fleet reports back here when it is.
              </p>
            )}

            {decisionCount > 0 ? (
              <Link
                href={routes.briefing(workspaceSlug)}
                className="mono mt-2 block text-[11.5px] text-helm-600 hover:underline"
              >
                {decisionCount} {decisionCount === 1 ? 'decision needs' : 'decisions need'} you
              </Link>
            ) : null}
          </div>

          <ul className="py-1">
            {actions.map((action) => (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className="block px-4 py-2 text-[13.5px] text-ink-700 transition-colors hover:bg-surface-subtle hover:text-ink-950"
                >
                  {action.label}
                </Link>
              </li>
            ))}
          </ul>

          <p className="mono border-t border-line px-4 py-2 text-[10.5px] leading-[15px] text-ink-400">
            Drag the orb anywhere. It stays where you put it.
          </p>
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
        <IconSpark size={22} />

        {decisionCount > 0 && !open ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-surface bg-warn px-1 text-[10.5px] font-semibold text-ink-950"
          >
            {decisionCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
