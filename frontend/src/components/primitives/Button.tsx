import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * One primary-action rule.
 *   action   — pale peach. Inside the product it means "take the proposed action".
 *              On the dark marketing site it is the single main CTA.
 *   indigo   — selection, navigation, inspect, connect, continue.
 *   neutral  — a real alternative that is not the proposed action.
 *   quiet    — low-emphasis, still a real control.
 *   danger   — destructive, deliberately unlike the primary action.
 *   provider — authentication only. Never peach and never indigo.
 */
export type ButtonVariant = 'action' | 'indigo' | 'neutral' | 'quiet' | 'danger' | 'provider';
export type ButtonSize = 'md' | 'compact' | 'lg';

const base =
  'relative inline-flex items-center justify-center gap-2 rounded-control font-medium ' +
  'transition-[background-color,border-color,color,box-shadow] duration-[110ms] ease-out ' +
  'disabled:cursor-not-allowed disabled:opacity-55 select-none whitespace-nowrap';

const sizes: Record<ButtonSize, string> = {
  md: 'h-11 px-4 text-[15px]',
  // Compact is only used where the same action has a larger mobile target.
  compact: 'h-11 px-3.5 text-[14px] md:h-9',
  lg: 'h-12 px-6 text-[16px]',
};

const variants: Record<ButtonVariant, string> = {
  action:
    'bg-action-200 text-action-ink border border-action-400/60 hover:bg-action-400/90 hover:border-action-400 active:bg-action-400',
  // Near-black at rest, amber on contact. The ink flips with it: white on
  // #f59e0b fails contrast, dark ink on it clears 8:1.
  indigo:
    'bg-helm-500 text-white border border-helm-500 hover:bg-helm-700 hover:text-action-ink hover:border-helm-700 active:bg-helm-700',
  neutral:
    'bg-surface text-ink-950 border border-line-strong hover:bg-surface-subtle hover:border-ink-400/60',
  quiet:
    'bg-transparent text-ink-700 border border-transparent hover:bg-surface-sunk hover:text-ink-950',
  danger:
    'bg-transparent text-bad border border-bad/40 hover:bg-bad-soft hover:border-bad/70',
  provider:
    'bg-white text-ink-950 border border-line-strong hover:bg-surface-subtle hover:border-ink-400/60',
};

const darkVariants: Partial<Record<ButtonVariant, string>> = {
  action:
    'bg-action-200 text-action-ink border border-transparent hover:bg-white active:bg-action-400',
  neutral:
    'bg-transparent text-night-ink border border-night-line hover:border-white/32 hover:bg-white/[.06]',
  quiet: 'bg-transparent text-night-muted border border-transparent hover:text-night-ink hover:bg-white/[.06]',
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onNight?: boolean;
  block?: boolean;
  className?: string;
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function buttonClasses({
  variant = 'neutral',
  size = 'md',
  onNight = false,
  block = false,
  className,
}: Omit<CommonProps, 'children'>) {
  return cn(
    base,
    sizes[size],
    (onNight && darkVariants[variant]) || variants[variant],
    block && 'w-full',
    className,
  );
}

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    pending?: boolean;
    pendingLabel?: string;
  };

export function Button({
  variant = 'neutral',
  size = 'md',
  onNight,
  block,
  className,
  children,
  leading,
  trailing,
  pending = false,
  pendingLabel,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClasses({ variant, size, onNight, block, className })}
    >
      {/* Content stays in flow while pending so the button never changes width. */}
      <span className={cn('inline-flex items-center gap-2', pending && 'invisible')}>
        {leading}
        {children}
        {trailing}
      </span>
      {pending ? (
        <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
          <Spinner />
          <span className="text-[14px]">{pendingLabel ?? 'Working'}</span>
        </span>
      ) : null}
    </button>
  );
}

type LinkButtonProps = CommonProps & {
  href: string;
  prefetch?: boolean;
  'aria-label'?: string;
};

export function LinkButton({
  href,
  variant = 'neutral',
  size = 'md',
  onNight,
  block,
  className,
  children,
  leading,
  trailing,
  ...props
}: LinkButtonProps) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, onNight, block, className })} {...props}>
      {leading}
      {children}
      {trailing}
    </Link>
  );
}

export function IconButton({
  label,
  children,
  onNight,
  className,
  size = 'md',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
  label: string;
  children: ReactNode;
  onNight?: boolean;
  className?: string;
  size?: 'md' | 'sm';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control border transition-colors duration-[110ms]',
        size === 'md' ? 'h-11 w-11' : 'h-9 w-9',
        onNight
          ? 'border-night-line text-night-muted hover:border-white/30 hover:bg-white/[.06] hover:text-night-ink'
          : 'border-transparent text-ink-500 hover:bg-surface-sunk hover:text-ink-950',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('anim-spin', className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" opacity="0.26" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
