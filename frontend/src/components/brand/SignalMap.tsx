import { publicDemo } from '@/services/mock/public-content';
import { ProviderMark } from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * The signature scene: a semantic topology, not a constellation.
 *
 * Four labelled provider accounts, two platform-reported readings that
 * disagree, one HELM reconciliation core. No unlabelled branches, no ambient
 * particles, nothing that could be mistaken for a neural network.
 *
 * Rendered as SVG geometry plus real HTML labels, so the text stays crisp and
 * translatable, and the whole scene is legible with no JavaScript at all.
 * Data packets travel twice and stop; only slow mist continues.
 */

const NODE_Y = [12, 37, 62, 87];

const CONNECTIONS = [
  { d: 'M41,12 C48,12 46,28 52,28', delay: '0.35s', length: 26 },
  { d: 'M41,37 C48,37 46,28 52,28', delay: '0.5s', length: 22 },
  { d: 'M41,62 C48,62 46,72 52,72', delay: '0.65s', length: 22 },
  { d: 'M41,87 C48,87 46,72 52,72', delay: '0.8s', length: 26, muted: true },
];

const SPINE = [
  { d: 'M52,28 C58,28 58,50 64,50', delay: '1.05s', length: 30 },
  { d: 'M52,72 C58,72 58,50 64,50', delay: '1.15s', length: 30 },
];

export function SignalMap({ className }: { className?: string }) {
  const demo = publicDemo;

  return (
    <div className={cn('relative', className)}>
      {/* Desktop and tablet: horizontal topology */}
      <div className="relative hidden aspect-[16/9] w-full sm:block lg:aspect-[16/7.6]">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {CONNECTIONS.map((connection) => (
            <path
              key={connection.d}
              d={connection.d}
              fill="none"
              stroke={connection.muted ? 'rgba(255,255,255,.16)' : 'rgba(164,192,189,.42)'}
              strokeWidth={1.1}
              strokeDasharray={connection.muted ? '2 2.5' : undefined}
              vectorEffect="non-scaling-stroke"
              className="draw-line"
              style={
                { '--draw-length': connection.length, animationDelay: connection.delay } as React.CSSProperties
              }
            />
          ))}
          {SPINE.map((segment) => (
            <path
              key={segment.d}
              d={segment.d}
              fill="none"
              stroke="rgba(23,140,138,.62)"
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
              className="draw-line"
              style={{ '--draw-length': segment.length, animationDelay: segment.delay } as React.CSSProperties}
            />
          ))}

          {/* Measured data travelling the spine. Two passes, then still. */}
          <g className="packet-layer">
            {[...CONNECTIONS.slice(0, 3), ...SPINE].map((path, index) => (
              <circle key={`packet-${path.d}`} r={0.9} fill="var(--night-accent)" opacity={0}>
                <animateMotion
                  dur="1.9s"
                  begin={`${0.8 + index * 0.16}s`}
                  repeatCount="2"
                  path={path.d}
                  fill="freeze"
                />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.12;0.86;1"
                  dur="1.9s"
                  begin={`${0.8 + index * 0.16}s`}
                  repeatCount="2"
                  fill="freeze"
                />
              </circle>
            ))}
          </g>
        </svg>

        {/* Source account nodes */}
        {demo.nodes.map((node, index) => (
          <div
            key={node.id}
            className="anim-rise absolute left-0 w-[41%] -translate-y-1/2"
            style={{ top: `${NODE_Y[index]}%`, animationDelay: `${0.1 + index * 0.09}s` }}
          >
            <div
              className={cn(
                'flex items-center gap-2.5 rounded-control border border-night-line bg-night-900/70 px-3 py-2.5 backdrop-blur-sm',
                index === 3 && 'opacity-65',
              )}
            >
              <ProviderMark provider={node.provider} size={17} />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium leading-tight text-night-ink">
                  {node.label}
                </span>
                <span className="mono block truncate text-[10.5px] leading-tight text-night-faint">
                  {node.detail}
                </span>
              </span>
            </div>
          </div>
        ))}

        {/* Platform-reported readings that disagree */}
        <div
          className="anim-rise act-2 absolute w-[20%] -translate-x-1/2 -translate-y-full text-center"
          style={{ left: '52%', top: '26%' }}
        >
          <p className="mono text-[10.5px] uppercase tracking-[0.09em] text-night-faint">Google reads</p>
          <p className="mono text-[15px] font-medium text-night-ink">1,356</p>
        </div>
        <div
          className="anim-rise act-2 absolute w-[20%] -translate-x-1/2 text-center"
          style={{ left: '52%', top: '75%' }}
        >
          <p className="mono text-[10.5px] uppercase tracking-[0.09em] text-night-faint">Meta reads</p>
          <p className="mono text-[15px] font-medium text-night-ink">1,104</p>
        </div>

        {/* Junction dots */}
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-night-accent"
          style={{ left: '52%', top: '28%' }}
          aria-hidden="true"
        />
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-night-accent"
          style={{ left: '52%', top: '72%' }}
          aria-hidden="true"
        />

        {/* Reconciliation core */}
        <div
          className="anim-rise act-3 absolute w-[36%] -translate-y-1/2"
          style={{ left: '64%', top: '50%' }}
        >
          <div className="rounded-card border border-[rgba(23,140,138,.34)] bg-night-800/80 p-3.5 backdrop-blur-sm">
            <p className="mono text-[10.5px] uppercase tracking-[0.1em] text-[#6BB3AD]">
              {demo.core.label}
            </p>
            <p className="mt-2 text-[26px] font-semibold leading-none text-night-ink tnum">2,268</p>
            <p className="mt-1.5 text-[11.5px] leading-[16px] text-night-muted">
              purchases on one mapped basis
            </p>
            <p className="mono mt-2.5 border-t border-night-line pt-2 text-[10.5px] leading-[15px] text-night-faint">
              {demo.discrepancy.basis}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile: the same story as a vertical signal path */}
      <div className="sm:hidden">
        <ol className="relative space-y-2.5 pl-6">
          <span
            className="absolute bottom-4 left-[7px] top-3 w-px bg-gradient-to-b from-[rgba(164,192,189,.4)] via-[rgba(23,140,138,.5)] to-[rgba(23,140,138,.2)]"
            aria-hidden="true"
          />
          {demo.nodes.map((node, index) => (
            <li key={node.id} className="relative">
              <span
                className="absolute -left-6 top-3.5 h-[7px] w-[7px] rounded-full border border-night-line bg-night-800"
                aria-hidden="true"
              />
              <div
                className={cn(
                  'flex items-center gap-2.5 rounded-control border border-night-line bg-night-900/70 px-3 py-2.5',
                  index === 3 && 'opacity-65',
                )}
              >
                <ProviderMark provider={node.provider} size={16} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium leading-tight text-night-ink">
                    {node.label}
                  </span>
                  <span className="mono block truncate text-[10.5px] leading-tight text-night-faint">
                    {node.detail}
                  </span>
                </span>
              </div>
            </li>
          ))}
          <li className="relative pt-1">
            <span
              className="absolute -left-6 top-5 h-[9px] w-[9px] rounded-full bg-night-accent"
              aria-hidden="true"
            />
            <div className="rounded-card border border-[rgba(23,140,138,.34)] bg-night-800/80 p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="mono text-[10.5px] uppercase tracking-[0.1em] text-[#6BB3AD]">
                  {demo.core.label}
                </p>
                <p className="text-[24px] font-semibold leading-none text-night-ink tnum">2,268</p>
              </div>
              <dl className="mono mt-3 space-y-1 border-t border-night-line pt-2.5 text-[11px] text-night-faint">
                <div className="flex justify-between gap-3">
                  <dt>Google reads</dt>
                  <dd className="text-night-muted">1,356</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Meta reads</dt>
                  <dd className="text-night-muted">1,104</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Mapped basis</dt>
                  <dd className="text-night-muted">7-day click</dd>
                </div>
              </dl>
            </div>
          </li>
        </ol>
      </div>

      {/* One concise equivalent for assistive technology. */}
      <p className="sr-only">
        Sample workspace signal map. Four connected ad accounts — Northstar India Search and Performance Max
        on Google Ads, Northstar India Prospecting and Retargeting on Meta Ads — feed two platform-reported
        readings that disagree: Google reads 1,356 purchases and Meta reads 1,104. HELM reconciles them to
        2,268 purchases on one mapped 7-day click basis. Retargeting is shown faded because its sync is
        delayed and it is excluded from the total.
      </p>
    </div>
  );
}
