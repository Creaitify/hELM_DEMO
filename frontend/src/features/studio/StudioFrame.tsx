'use client';

import { cn } from '@/lib/cn';

/**
 * The frame you are about to fill.
 *
 * An image studio with no image in it is a settings page. Before anything has
 * been generated this draws the canvas at the real aspect ratio with the real
 * headline and supporting line set into it, in the palette the studio renderer
 * actually uses — so choosing a format is choosing a shape, and typing a
 * headline has a visible consequence instead of disappearing into a field.
 *
 * The palettes and the composition are kept deliberately in step with the
 * server-side renderer in `providers/images.ts`. This is a preview of that
 * output, not a different design that happens to sit next to it.
 */

type Palette = { base: string; deep: string; lift: string; ink: string; muted: string; accent: string };

const PALETTES: Record<string, Palette> = {
  'product-proof': { base: '#0C2050', deep: '#08132F', lift: '#12306E', ink: '#F2F6FF', muted: '#8DA4CE', accent: '#F7AA8E' },
  'field-use': { base: '#101826', deep: '#070B14', lift: '#1D2C44', ink: '#EEF3FB', muted: '#93A6C4', accent: '#F7AA8E' },
  typographic: { base: '#E8EDF6', deep: '#CFD9EA', lift: '#FFFFFF', ink: '#0A1330', muted: '#5A6C90', accent: '#C8623C' },
  evidence: { base: '#0A1330', deep: '#050A1C', lift: '#16255A', ink: '#EAF0FF', muted: '#8698C4', accent: '#7FA0E8' },
};

export const ASPECT_RATIO: Record<string, string> = {
  '1:1': '1 / 1',
  '4:5': '4 / 5',
  '9:16': '9 / 16',
  '16:9': '16 / 9',
};

/**
 * Breaks a headline the way the renderer does: on words, never mid-word, into
 * lines short enough to set large. The last line takes the accent colour, so
 * the break is a typographic decision and not just overflow.
 */
function wrap(headline: string, perLine = 14): string[] {
  const words = headline.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > perLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export function StudioFrame({
  aspect,
  direction,
  headline,
  subline,
  brand,
  spec,
  placeholder = false,
  className,
}: {
  aspect: string;
  direction: string;
  headline: string;
  subline: string;
  brand: string;
  spec?: string;
  /** True when nothing has been written yet, so the type reads as a prompt. */
  placeholder?: boolean;
  className?: string;
}) {
  const palette = PALETTES[direction] ?? PALETTES['product-proof'];
  const lines = wrap(headline || '18 hours cold');

  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-card border border-line', className)}
      style={{
        aspectRatio: ASPECT_RATIO[aspect] ?? '4 / 5',
        // Sizes below are in container-query units so the composition holds its
        // proportions at any canvas width, exactly as the SVG does.
        containerType: 'inline-size',
        background: `linear-gradient(157deg, ${palette.lift} 0%, ${palette.base} 55%, ${palette.deep} 100%)`,
      }}
    >
      {/* The renderer lifts the left third; without it the type sits on nothing. */}
      <div className="absolute inset-y-0 left-0 w-[34%] bg-white/[0.04]" />

      <div className="absolute inset-0 flex flex-col justify-between p-[7%]">
        <div className={cn(placeholder && 'opacity-45')}>
          {lines.map((line, index) => (
            <p
              key={`${line}-${index}`}
              style={{ color: index === lines.length - 1 ? palette.accent : palette.ink }}
              className="text-[clamp(15px,7.6cqw,52px)] font-bold leading-[1.02] tracking-[-0.02em]"
            >
              {line}
            </p>
          ))}

          <div
            style={{ background: palette.accent }}
            className="mt-[4.5%] h-[max(2px,0.4cqw)] w-[11%] rounded-full"
          />

          <p
            style={{ color: palette.muted }}
            className="mt-[3.5%] text-[clamp(8px,2.6cqw,17px)] leading-[1.3]"
          >
            {subline || 'Your supporting line'}
          </p>
        </div>

        <div className="flex items-end justify-between gap-3">
          <span
            style={{ color: palette.muted }}
            className="mono truncate text-[clamp(6px,1.5cqw,11px)] uppercase tracking-[0.14em]"
          >
            {brand}
          </span>
          <span
            style={{ color: palette.muted }}
            className="mono shrink-0 text-[clamp(6px,1.3cqw,10px)] tracking-[0.1em]"
          >
            {aspect}
            {spec ? ` · ${spec}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The shape of a format, drawn at its real proportions. */
export function AspectShape({ aspect, active }: { aspect: string; active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block rounded-[3px] border-2 transition-colors',
        active ? 'border-helm-600 bg-helm-500/25' : 'border-ink-400/60 bg-transparent',
      )}
      style={{
        aspectRatio: ASPECT_RATIO[aspect] ?? '4 / 5',
        // Bound by height so a 9:16 and a 16:9 read as the same "amount" of ink.
        height: aspect === '16:9' ? 16 : 26,
      }}
    />
  );
}
