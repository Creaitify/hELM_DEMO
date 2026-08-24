import { cn } from '@/lib/cn';

/**
 * Northstar Hydration — Arc Bottle.
 *
 * Original code-drawn poster assets in the campaign's own language: graphite,
 * frost, deep cobalt and one warm coral annotation; hard editorial crops, a low
 * horizon, purposeful negative space, and condensed proof statements.
 */

export type PosterVariant = 'product-proof' | 'field-use' | 'typographic';

function BottleSilhouette({ fill, opacity = 1 }: { fill: string; opacity?: number }) {
  return (
    <g opacity={opacity}>
      <path d="M38 2h24a4 4 0 0 1 4 4v12H34V6a4 4 0 0 1 4-4Z" fill={fill} />
      <path
        d="M40 20h20c0 10 22 12 22 34v176a20 20 0 0 1-20 20H38a20 20 0 0 1-20-20V54c0-22 22-24 22-34Z"
        fill={fill}
      />
    </g>
  );
}

export function ArcBottlePoster({
  variant,
  className,
  label,
}: {
  variant: PosterVariant;
  className?: string;
  label: string;
}) {
  if (variant === 'product-proof') {
    return (
      <svg viewBox="0 0 320 400" className={cn('block h-full w-full', className)} role="img" aria-label={label}>
        <defs>
          <linearGradient id="apo-cobalt" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#12306E" />
            <stop offset="58%" stopColor="#0C2050" />
            <stop offset="100%" stopColor="#08132F" />
          </linearGradient>
          <linearGradient id="apo-light" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#DCE8FF" stopOpacity="0.95" />
            <stop offset="42%" stopColor="#9DB4DE" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#3E5686" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <rect width="320" height="400" fill="url(#apo-cobalt)" />
        {/* Precise side light */}
        <rect x="0" y="0" width="112" height="400" fill="#FFFFFF" opacity="0.045" />
        <g transform="translate(112 84) scale(1.14)">
          <BottleSilhouette fill="url(#apo-light)" />
          {/* Condensation */}
          {[
            [30, 90, 3.2], [52, 70, 2.1], [66, 116, 2.6], [38, 140, 1.8], [58, 168, 3],
            [26, 190, 2.2], [70, 206, 1.9], [44, 224, 2.7], [62, 60, 1.6], [34, 116, 1.5],
          ].map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#FFFFFF" opacity="0.5" />
          ))}
        </g>
        {/* Evidence-led hook */}
        <text x="26" y="58" fill="#F2F6FF" fontSize="30" fontWeight="700" letterSpacing="-0.02em">
          18 HOURS
        </text>
        <text x="26" y="88" fill="#7FA0E8" fontSize="30" fontWeight="700" letterSpacing="-0.02em">
          COLD
        </text>
        <rect x="26" y="104" width="44" height="2" fill="#F7AA8E" />
        <text x="26" y="372" fill="#8DA4CE" fontSize="10" letterSpacing="0.14em">
          NORTHSTAR HYDRATION · ARC BOTTLE
        </text>
      </svg>
    );
  }

  if (variant === 'field-use') {
    return (
      <svg viewBox="0 0 320 400" className={cn('block h-full w-full', className)} role="img" aria-label={label}>
        <defs>
          <linearGradient id="afu-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93A9C9" />
            <stop offset="52%" stopColor="#6E86A8" />
            <stop offset="100%" stopColor="#4C6183" />
          </linearGradient>
          <linearGradient id="afu-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A4A63" />
            <stop offset="100%" stopColor="#232E42" />
          </linearGradient>
        </defs>
        <rect width="320" height="400" fill="url(#afu-sky)" />
        {/* Low horizon */}
        <rect y="292" width="320" height="108" fill="url(#afu-ground)" />
        <path d="M0 292h320" stroke="#8FA6C6" strokeWidth="1" opacity="0.5" />
        {/* Distant ridge */}
        <path d="M0 292 62 262l38 16 44-26 52 22 46-14 78 32Z" fill="#4E6183" opacity="0.75" />
        {/* Cropped runner, no stock-photo pose */}
        <g fill="#1B2436" opacity="0.92" transform="translate(196 118)">
          <circle cx="44" cy="22" r="15" />
          <path d="M30 44h26l14 66-16 6-10-38-8 42-18-4Z" />
          <path d="M40 116l-6 60 14 4 12-58Z" />
          <path d="M58 118l14 54-13 8-16-56Z" />
          <path d="M28 52 6 84l12 10 20-28Z" />
        </g>
        {/* The bottle is the anchor */}
        <g transform="translate(38 150) scale(0.92)">
          <BottleSilhouette fill="#E3ECFB" />
          <rect x="18" y="128" width="64" height="26" fill="#0C2050" opacity="0.88" />
          <text x="50" y="146" fill="#DCE8FF" fontSize="13" fontWeight="700" textAnchor="middle">
            ARC
          </text>
        </g>
        <rect x="26" y="330" width="30" height="2" fill="#F7AA8E" />
        <text x="26" y="356" fill="#E8EFFB" fontSize="14" fontWeight="600">
          Cold, long after the road warms.
        </text>
        <text x="26" y="378" fill="#B7C6DE" fontSize="10" letterSpacing="0.14em">
          NORTHSTAR HYDRATION
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 320 400" className={cn('block h-full w-full', className)} role="img" aria-label={label}>
      <rect width="320" height="400" fill="#20242B" />
      {/* Oversized numeral, built as a poster rather than a product render */}
      <text
        x="-6"
        y="286"
        fill="#E9EDF4"
        fontSize="270"
        fontWeight="700"
        letterSpacing="-0.06em"
        opacity="0.96"
      >
        18
      </text>
      <g transform="translate(196 74) scale(0.86)" opacity="0.94">
        <BottleSilhouette fill="#5C6B85" />
      </g>
      {/* One peach registration mark */}
      <g stroke="#F7AA8E" strokeWidth="1.4" fill="none">
        <circle cx="272" cy="52" r="12" />
        <path d="M272 34v36M254 52h36" />
      </g>
      <rect x="24" y="306" width="150" height="1" fill="#4A5468" />
      <text x="24" y="332" fill="#C6CEDC" fontSize="13" fontWeight="600" letterSpacing="0.02em">
        HOURS COLD. MEASURED.
      </text>
      <text x="24" y="356" fill="#7C8798" fontSize="10.5" letterSpacing="0.14em">
        ARC BOTTLE · NORTHSTAR HYDRATION
      </text>
      <text x="24" y="378" fill="#5C6473" fontSize="9.5" letterSpacing="0.1em">
        RETIRED 22 AUG · VIEW RATE 24%
      </text>
    </svg>
  );
}
