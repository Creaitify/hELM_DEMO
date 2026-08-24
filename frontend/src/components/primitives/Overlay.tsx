'use client';

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';
import { IconClose } from '@/components/icons';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Shared overlay behaviour: focus trapped, background scroll locked,
 * Escape closes when safe, focus restored to the opener on close.
 */
function useOverlayBehaviour(open: boolean, onClose: () => void, closeOnEscape: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement as HTMLElement | null;

    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const first = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? containerRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const list = Array.from(nodes).filter((node) => node.offsetParent !== null);
      if (list.length === 0) return;
      const firstNode = list[0];
      const lastNode = list[list.length - 1];
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      openerRef.current?.focus?.();
    };
  }, [open, onClose, closeOnEscape]);

  return containerRef;
}

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeOnEscape?: boolean;
  className?: string;
};

/** Desktop: right-side drawer. Mobile: full-height sheet. */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeOnEscape = true,
  className,
}: OverlayProps) {
  const titleId = useId();
  const descriptionId = useId();
  const ref = useOverlayBehaviour(open, onClose, closeOnEscape);
  const handleBackdrop = useCallback(() => onClose(), [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={handleBackdrop}
        className="anim-fade absolute inset-0 cursor-default bg-night-950/38 backdrop-blur-[2px]"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'anim-drawer-in absolute inset-x-0 bottom-0 top-0 flex flex-col bg-surface shadow-lift-lg outline-none',
          'sm:left-auto sm:right-0 sm:w-[min(560px,94vw)] sm:border-l sm:border-line',
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[18px] font-semibold leading-tight text-ink-950">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-[13px] leading-[19px] text-ink-500">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
            <IconClose size={19} />
          </IconButton>
        </header>
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <footer className="safe-b border-t border-line bg-surface-subtle px-5 py-4 sm:px-6">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}

/** Bottom sheet for mobile filters and pickers. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeOnEscape = true,
  className,
}: OverlayProps) {
  const titleId = useId();
  const descriptionId = useId();
  const ref = useOverlayBehaviour(open, onClose, closeOnEscape);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95]">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="anim-fade absolute inset-0 cursor-default bg-night-950/42 backdrop-blur-[2px]"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'anim-sheet-up absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-editorial bg-surface shadow-lift-lg outline-none',
          className,
        )}
      >
        <div className="flex justify-center pt-3">
          <span className="h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
        </div>
        <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-semibold text-ink-950">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-[13px] text-ink-500">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
            <IconClose size={19} />
          </IconButton>
        </header>
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto border-t border-line px-5 py-4">
          {children}
        </div>
        {footer ? <footer className="safe-b border-t border-line bg-surface-subtle px-5 py-4">{footer}</footer> : null}
      </div>
    </div>
  );
}

/** Centred dialog for confirmations. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeOnEscape = true,
  className,
}: OverlayProps) {
  const titleId = useId();
  const descriptionId = useId();
  const ref = useOverlayBehaviour(open, onClose, closeOnEscape);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="anim-fade absolute inset-0 cursor-default bg-night-950/46 backdrop-blur-[2px]"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'anim-scale-in relative w-full max-w-[520px] rounded-t-editorial bg-surface p-6 shadow-lift-lg outline-none sm:rounded-card',
          className,
        )}
      >
        <h2 id={titleId} className="pr-8 text-[19px] font-semibold leading-snug text-ink-950">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-2 text-[14px] leading-[22px] text-ink-700">
            {description}
          </p>
        ) : null}
        <IconButton label="Close" onClick={onClose} size="sm" className="absolute right-4 top-4">
          <IconClose size={18} />
        </IconButton>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Responsive helper: drawer on desktop, sheet below the sm breakpoint. */
export function useIsMobile(breakpoint = 640) {
  const ref = useRef(false);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    ref.current = query.matches;
  }, [breakpoint]);
  return ref.current;
}
