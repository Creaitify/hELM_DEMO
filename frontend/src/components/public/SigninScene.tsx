import { ProviderMark } from '@/components/icons';
import { signinDemo } from '@/services/mock/public-content';

/**
 * The sign-in scene tells a different story from the landing page: labelled
 * accounts converging into one selected workspace and account scope. No
 * discrepancy, no recommendation, no repeat of the feature list.
 */
export function SigninScene() {
  return (
    <div className="relative w-full max-w-[440px]">
      <div className="relative aspect-[5/4] w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {[
            { d: 'M46,10 C66,10 62,50 78,50', delay: '0.35s' },
            { d: 'M46,36 C66,36 66,50 78,50', delay: '0.45s' },
            { d: 'M46,62 C66,62 66,50 78,50', delay: '0.55s' },
            { d: 'M46,88 C66,88 62,50 78,50', delay: '0.65s' },
          ].map((path) => (
            <path
              key={path.d}
              d={path.d}
              fill="none"
              stroke="rgba(164,192,189,.34)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              className="draw-line"
              style={{ '--draw-length': 40, animationDelay: path.delay } as React.CSSProperties}
            />
          ))}
          <g className="packet-layer">
            {['M46,10 C66,10 62,50 78,50', 'M46,62 C66,62 66,50 78,50'].map((path, index) => (
              <circle key={path} r={0.9} fill="var(--night-accent)" opacity={0}>
                <animateMotion dur="2.1s" begin={`${0.9 + index * 0.4}s`} repeatCount="2" path={path} fill="freeze" />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.12;0.86;1"
                  dur="2.1s"
                  begin={`${0.9 + index * 0.4}s`}
                  repeatCount="2"
                  fill="freeze"
                />
              </circle>
            ))}
          </g>
        </svg>

        {signinDemo.accounts.map((account, index) => (
          <div
            key={account.detail}
            className="anim-rise absolute left-0 w-[46%] -translate-y-1/2"
            style={{ top: `${[10, 36, 62, 88][index]}%`, animationDelay: `${0.12 + index * 0.08}s` }}
          >
            <div className="flex items-center gap-2.5 rounded-control border border-night-line bg-night-900/70 px-3 py-2.5">
              <ProviderMark provider={account.provider} size={16} />
              <span className="min-w-0">
                <span className="block truncate text-[12px] leading-tight text-night-ink">{account.label}</span>
                <span className="mono block truncate text-[10px] leading-tight text-night-faint">
                  {account.detail}
                </span>
              </span>
            </div>
          </div>
        ))}

        <div className="anim-rise act-2 absolute right-0 top-1/2 w-[42%] -translate-y-1/2">
          <div className="rounded-card border border-[rgba(23,140,138,.32)] bg-night-800/80 p-4">
            <p className="mono text-[10px] uppercase tracking-[0.12em] text-[#6BB3AD]">Workspace</p>
            <p className="mt-1.5 text-[16px] font-semibold leading-tight text-night-ink">
              {signinDemo.workspaceLabel}
            </p>
            <p className="mono mt-3 border-t border-night-line pt-2.5 text-[10.5px] uppercase tracking-[0.1em] text-night-faint">
              Account scope
            </p>
            <p className="mt-1 text-[12.5px] text-night-muted">{signinDemo.scopeLabel}</p>
            <p className="mono mt-1 text-[10.5px] text-night-faint">4 accounts</p>
          </div>
        </div>
      </div>

      <p className="sr-only">
        Four labelled sample ad accounts — two Google Ads and two Meta Ads — converge into one selected
        workspace, Northstar Group, with the account scope India · Google + Meta.
      </p>
    </div>
  );
}
