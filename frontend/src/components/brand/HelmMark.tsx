import { cn } from '@/lib/cn';

/**
 * The HELM instrument mark: a navigation ring with a heading indicator and
 * one decisive bearing. It reads as measurement, not as a wheel or an orb.
 */
export function HelmMark({
  size = 28,
  tone = 'light',
  className,
}: {
  size?: number;
  tone?: 'light' | 'dark' | 'current';
  className?: string;
}) {
  const ring = tone === 'dark' ? 'rgba(255,255,255,.30)' : tone === 'light' ? 'var(--line-strong)' : 'currentColor';
  const ticks = tone === 'dark' ? 'rgba(255,255,255,.44)' : tone === 'light' ? 'var(--ink-400)' : 'currentColor';
  const bearing = tone === 'dark' ? '#A9BDFF' : 'var(--helm-500)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="13.2" stroke={ring} strokeWidth="1.5" />
      <circle cx="16" cy="16" r="7.6" stroke={ticks} strokeWidth="1.1" opacity="0.62" />
      {/* Cardinal measurement ticks */}
      <path d="M16 1.6v3.4M16 27v3.4M1.6 16h3.4M27 16h3.4" stroke={ticks} strokeWidth="1.4" strokeLinecap="round" />
      {/* Intercardinal micro-ticks */}
      <path
        d="m6.2 6.2 1.9 1.9M25.8 6.2l-1.9 1.9M6.2 25.8l1.9-1.9M25.8 25.8l-1.9-1.9"
        stroke={ticks}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* The decisive bearing */}
      <path d="M16 16 24.6 9.2" stroke={bearing} strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.1" fill={bearing} />
    </svg>
  );
}

export function HelmWordmark({
  tone = 'light',
  size = 'md',
  subtitle,
  className,
}: {
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
  className?: string;
}) {
  const markSize = size === 'lg' ? 34 : size === 'sm' ? 22 : 28;
  const textSize = size === 'lg' ? 'text-[22px]' : size === 'sm' ? 'text-[15px]' : 'text-[18px]';

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <HelmMark size={markSize} tone={tone} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            textSize,
            'font-semibold tracking-[0.13em]',
            tone === 'dark' ? 'text-night-ink' : 'text-ink-950',
          )}
        >
          HELM
        </span>
        {subtitle ? (
          <span
            className={cn(
              'mt-1.5 text-[11px] tracking-[0.05em]',
              tone === 'dark' ? 'text-night-faint' : 'text-ink-400',
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
