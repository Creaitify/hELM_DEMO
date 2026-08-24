import { publicDemo } from '@/services/mock/public-content';
import { IconArrowRight, IconLock, MetaAdsMark, GoogleAdsMark } from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * Where the spine ends: one recommendation with its evidence, its cap, and a
 * human control. Explicitly proposed, never presented as executed.
 */
export function DecisionSpine({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { recommendation, evidence } = publicDemo;

  return (
    <div className={cn('anim-rise act-3', className)}>
      <div className="rounded-editorial border border-night-line bg-night-900/72 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-night-line px-5 py-3.5">
          <span className="mono inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.11em] text-[#FFC9B2]">
            <span className="h-1.5 w-1.5 rounded-full bg-action-400" aria-hidden="true" />
            {recommendation.kicker}
          </span>
          <span className="mono inline-flex items-center gap-1.5 text-[10.5px] text-night-faint">
            <IconLock size={13} />
            Read-only. Nothing is executed.
          </span>
        </div>

        <div className="px-5 py-5">
          <h3 className="text-[clamp(20px,2.1vw,27px)] font-semibold leading-[1.15] tracking-[-0.02em] text-night-ink">
            {recommendation.headline}
          </h3>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
            <span className="inline-flex items-center gap-2 rounded-control border border-night-line px-2.5 py-1.5 text-night-muted">
              <MetaAdsMark size={15} />
              {recommendation.from}
            </span>
            <span className="text-night-faint" aria-hidden="true">
              <IconArrowRight size={17} />
            </span>
            <span className="inline-flex items-center gap-2 rounded-control border border-[rgba(169,189,255,.32)] bg-[rgba(61,91,214,.14)] px-2.5 py-1.5 text-night-ink">
              <GoogleAdsMark size={15} />
              {recommendation.to}
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-night-line pt-4 sm:grid-cols-3">
            <div>
              <dt className="mono text-[10.5px] uppercase tracking-[0.09em] text-night-faint">Cap</dt>
              <dd className="mono mt-1 text-[15px] text-night-ink">{recommendation.cap}</dd>
            </div>
            <div>
              <dt className="mono text-[10.5px] uppercase tracking-[0.09em] text-night-faint">Horizon</dt>
              <dd className="mono mt-1 text-[15px] text-night-ink">{recommendation.horizon}</dd>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <dt className="mono text-[10.5px] uppercase tracking-[0.09em] text-night-faint">
                Modelled exposure
              </dt>
              <dd className="mono mt-1 text-[15px] text-action-200">{recommendation.exposure}</dd>
            </div>
          </dl>

          <p className="mt-3 text-[11.5px] leading-[17px] text-night-faint">
            {recommendation.exposureNote}
          </p>
        </div>

        <ul className="border-t border-night-line">
          {evidence.map((row) => (
            <li
              key={row.label}
              className="flex items-baseline justify-between gap-4 border-b border-night-line px-5 py-3 last:border-b-0"
            >
              <span className="min-w-0">
                <span className="block text-[13px] text-night-ink">{row.label}</span>
                <span className="block text-[11.5px] leading-[16px] text-night-faint">{row.detail}</span>
              </span>
              <span
                className={cn(
                  'mono shrink-0 text-[14px] font-medium',
                  row.tone === 'bad' && 'text-[#FF9BAE]',
                  row.tone === 'warn' && 'text-[#F5C88A]',
                  row.tone === 'good' && 'text-[#7BDCB5]',
                  row.tone === 'neutral' && 'text-night-muted',
                )}
              >
                {row.value}
              </span>
            </li>
          ))}
        </ul>

        {!compact ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-night-line px-5 py-3.5">
            <span className="mono text-[10.5px] uppercase tracking-[0.09em] text-night-faint">Stops if</span>
            {recommendation.stopConditions.map((condition) => (
              <span
                key={condition}
                className="rounded-full border border-night-line px-2.5 py-1 text-[11.5px] text-night-muted"
              >
                {condition}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
