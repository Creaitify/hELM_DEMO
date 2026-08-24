'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Lifted object: a popover is one of the few surfaces that earns a shadow.
 * Closes on outside pointer, Escape, and returns focus to its trigger.
 */
export function Popover({
  trigger,
  children,
  align = 'start',
  placement = 'bottom',
  width = 'w-[320px]',
  open: controlledOpen,
  onOpenChange,
  className,
  panelClassName,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  align?: 'start' | 'end' | 'center';
  placement?: 'bottom' | 'top';
  width?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  panelClassName?: string;
  label?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen(!open), ref: triggerRef })}
      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            'anim-scale-in absolute z-50 rounded-card border border-line bg-surface shadow-lift-lg',
            placement === 'bottom' ? 'top-full mt-2 origin-top' : 'bottom-full mb-2 origin-bottom',
            align === 'end' && 'right-0',
            align === 'start' && 'left-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            width,
            panelClassName,
          )}
        >
          {children({ close: () => { setOpen(false); triggerRef.current?.focus(); } })}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  selected = false,
  danger = false,
  hint,
  leading,
}: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  danger?: boolean;
  hint?: string;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[14px] transition-colors duration-[110ms]',
        danger ? 'text-bad hover:bg-bad-soft' : 'text-ink-700 hover:bg-surface-sunk hover:text-ink-950',
        selected && 'bg-helm-100/60 text-ink-950',
      )}
    >
      {leading ? <span className="shrink-0 text-ink-400">{leading}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint ? <span className="mono shrink-0 text-[11px] text-ink-400">{hint}</span> : null}
    </button>
  );
}

export function MenuSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="border-b border-line py-1.5 last:border-b-0">
      {label ? (
        <p className="micro-label px-3 pb-1 pt-1.5">{label}</p>
      ) : null}
      <div role="menu">{children}</div>
    </div>
  );
}
