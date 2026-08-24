import Link from 'next/link';
import { MistField } from '@/components/brand/MistField';
import { SignalMap } from '@/components/brand/SignalMap';
import { DecisionSpine } from '@/components/brand/DecisionSpine';
import { LinkButton } from '@/components/primitives/Button';
import { GoogleAdsMark, IconArrowRight, MetaAdsMark } from '@/components/icons';
import { publicDemo } from '@/services/mock/public-content';
import { routes } from '@/lib/routes';

const RAIL = [
  { label: 'Sample workspace', value: 'Northstar Group' },
  { label: 'Range', value: '25 Jul – 23 Aug 2026', detail: '30 complete days · Asia/Kolkata' },
  { label: 'Sources', value: 'Google Ads + Meta Ads', detail: '4 accounts · 1 excluded' },
  { label: 'Currency', value: 'INR' },
  { label: 'Mode', value: 'Read-only intelligence' },
];

/**
 * Asymmetric, art-directed hero. The signal scene is co-primary with the
 * headline rather than an illustration placed beside it.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-[100px] sm:pb-20 lg:pb-24 lg:pt-[112px]">
      <MistField tone="dark" warm />

      <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="grid gap-x-10 gap-y-10 xl:grid-cols-[168px_minmax(0,5fr)_minmax(0,6fr)]">
          {/* Outer context rail */}
          <aside className="order-2 xl:order-1 xl:border-r xl:border-night-line xl:pr-6">
            <dl className="flex flex-wrap gap-x-8 gap-y-4 xl:block xl:space-y-5">
              {RAIL.map((item) => (
                <div key={item.label}>
                  <dt className="mono text-[10px] uppercase tracking-[0.15em] text-night-faint">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-[12.5px] leading-[17px] text-night-muted">
                    {item.value}
                    {item.detail ? (
                      <span className="mono block text-[10.5px] leading-[15px] text-night-faint">
                        {item.detail}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>

          {/* Headline column */}
          <div className="order-1 xl:order-2 xl:pt-2">
            <p className="pub-eyebrow anim-fade flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Paid-media intelligence</span>
              <span aria-hidden="true" className="text-night-line">
                /
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GoogleAdsMark size={14} />
                <MetaAdsMark size={14} />
                Google + Meta
              </span>
            </p>

            <h1 className="pub-display anim-rise act-1 mt-5 text-night-ink">
              See what moved.
              <br />
              <span className="text-[#C7D2F5]">Know what to move next.</span>
            </h1>

            <p className="pub-lede anim-rise act-1 mt-6 max-w-[42ch] text-pretty">
              HELM reconciles every connected ad account, finds the decisions hiding in the movement, and
              shows the evidence before you move budget.
            </p>

            <div className="anim-rise act-2 mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="#decision-layer" variant="action" size="lg" onNight trailing={<IconArrowRight size={18} />}>
                View the decision layer
              </LinkButton>
              <LinkButton href={routes.signin()} variant="neutral" size="lg" onNight>
                Sign in
              </LinkButton>
            </div>

            <p className="anim-fade act-2 mt-6 max-w-[46ch] text-[13.5px] leading-[20px] text-night-faint">
              Read-only connections by default. Every recommendation shows its work.
            </p>

            <div className="anim-fade act-3 mt-9 hidden border-t border-night-line pt-6 xl:block">
              <p className="text-[13px] leading-[20px] text-night-muted">
                The scene beside this headline is one morning in a sample workspace: four connected accounts,
                two platform readings that disagree, and the single decision that came out of it.
              </p>
              <Link
                href="#product"
                className="mono mt-3 inline-flex items-center gap-1.5 text-[11.5px] uppercase tracking-[0.1em] text-[#A9BDFF] transition-colors hover:text-night-ink"
              >
                Follow the trail
                <IconArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Signal scene */}
          <div className="order-3 min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-night-line pb-3">
              <p className="mono text-[10.5px] uppercase tracking-[0.11em] text-night-faint">
                {publicDemo.workspaceLabel}
              </p>
              <p className="mono text-[10.5px] text-night-faint">{publicDemo.rangeLabel}</p>
            </div>

            <SignalMap />

            <DecisionSpine compact className="mt-6" />
          </div>
        </div>
      </div>
    </section>
  );
}
