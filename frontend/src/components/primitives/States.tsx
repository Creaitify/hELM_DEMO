import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconAlert, IconInfo, IconLock, IconWarning } from '@/components/icons';
import { LinkButton } from './Button';

export function InlineNotice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'warn' | 'bad' | 'good';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const map = {
    info: { bg: 'bg-info-soft border-info/20', fg: 'text-info', icon: <IconInfo size={17} /> },
    warn: { bg: 'bg-warn-soft border-warn/25', fg: 'text-warn', icon: <IconWarning size={17} /> },
    bad: { bg: 'bg-bad-soft border-bad/25', fg: 'text-bad', icon: <IconAlert size={17} /> },
    good: { bg: 'bg-good-soft border-good/25', fg: 'text-good', icon: <IconInfo size={17} /> },
  }[tone];

  return (
    <div className={cn('flex gap-3 rounded-field border px-4 py-3.5', map.bg, className)}>
      <span className={cn('mt-[1px] shrink-0', map.fg)}>{map.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink-950">{title}</p>
        {children ? <div className="mt-1 text-[14px] leading-[22px] text-ink-700">{children}</div> : null}
        {action ? <div className="mt-3 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

/** Empty states explain value and offer exactly one next action. */
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
  className,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('s-panel-subtle flex flex-col items-start gap-3 px-6 py-10', className)}>
      {icon ? <span className="text-ink-400">{icon}</span> : null}
      <h3 className="text-[17px] font-semibold text-ink-950">{title}</h3>
      <p className="max-w-prose text-[15px] leading-[23px] text-ink-500">{description}</p>
      {actionLabel && actionHref ? (
        <LinkButton href={actionHref} variant="indigo" size="compact" className="mt-1">
          {actionLabel}
        </LinkButton>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = 'This section could not load',
  description,
  detail,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  detail?: string;
  onRetry?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('s-panel border-bad/25 bg-bad-soft/40 px-6 py-8', className)}>
      <div className="flex items-start gap-3">
        <span className="mt-[2px] text-bad">
          <IconAlert size={19} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-ink-950">{title}</h3>
          <p className="mt-1.5 max-w-prose text-[14px] leading-[22px] text-ink-700">{description}</p>
          {detail ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-[13px] text-ink-500 hover:text-ink-950">
                Support detail
              </summary>
              <p className="mono mt-2 rounded-control bg-surface-sunk px-3 py-2 text-[12px] text-ink-700">
                {detail}
              </p>
            </details>
          ) : null}
          {onRetry ? <div className="mt-4">{onRetry}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function PermissionState({
  what,
  who,
  className,
}: {
  what: string;
  who: string;
  className?: string;
}) {
  return (
    <div className={cn('s-panel-subtle flex items-start gap-3 px-5 py-5', className)}>
      <span className="mt-[2px] text-ink-400">
        <IconLock size={18} />
      </span>
      <div>
        <p className="text-[14px] font-semibold text-ink-950">{what}</p>
        <p className="mt-1 text-[14px] text-ink-500">{who}</p>
      </div>
    </div>
  );
}

/** Geometry-matched skeleton. Never a spinner where content will land. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-control bg-surface-sunk', className)} />;
}

export function SectionHeading({
  title,
  hint,
  action,
  id,
  className,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-section text-ink-950">
          {title}
        </h2>
        {hint ? <p className="mt-1.5 text-[14px] leading-[21px] text-ink-500">{hint}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
