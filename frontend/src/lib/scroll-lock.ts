'use client';

import { useEffect } from 'react';

/**
 * Hold the page still while something is open over it.
 *
 * Counted rather than set-and-restore, because overlays stack. Each one used
 * to snapshot `body.style.overflow` on open and write that snapshot back on
 * close — which is correct exactly as long as only one is ever open. Open the
 * console, open the palette over it, then close them in that order and the
 * palette restores the value it read while the console had the page locked.
 * The page stays frozen with nothing on top of it, and the only way out is a
 * reload.
 *
 * So the first lock records the real page state and the last release puts it
 * back. Everything in between only moves the counter.
 */

let depth = 0;
let restore: { overflow: string; paddingRight: string } | null = null;

function lock() {
  if (depth === 0) {
    restore = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };
    // Removing the scrollbar reflows the page under the overlay unless its
    // width is handed back as padding.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
  }
  depth += 1;
}

function release() {
  depth = Math.max(0, depth - 1);
  if (depth === 0 && restore) {
    document.body.style.overflow = restore.overflow;
    document.body.style.paddingRight = restore.paddingRight;
    restore = null;
  }
}

/** Locks page scroll for as long as `active` is true. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return release;
  }, [active]);
}
