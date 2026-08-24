import { cn } from '@/lib/cn';

/**
 * Mist: weather behind the page, never an opaque layer over content.
 * Three real variants. The measurement grid is masked away at the edges and
 * peach is a rare warm event rather than a permanent gradient corner.
 */
export function MistField({
  tone = 'dark',
  warm = false,
  grid = true,
  className,
}: {
  tone?: 'dark' | 'light' | 'static';
  warm?: boolean;
  grid?: boolean;
  className?: string;
}) {
  const isDark = tone === 'dark';

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      {/* Base field */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 120% 90% at 18% 8%, #131829 0%, #0B0E1A 44%, #070A12 100%)'
            : 'radial-gradient(ellipse 110% 90% at 22% 4%, #F4F8FF 0%, #EAF1FC 48%, #E5EDFA 100%)',
        }}
      />

      {/* Slow iris wash */}
      <div
        className={cn('absolute -left-[18%] -top-[26%] h-[78%] w-[74%] rounded-full blur-[120px]', tone !== 'static' && 'anim-mist')}
        style={{
          background: isDark
            ? 'radial-gradient(circle, rgba(124,91,255,.20) 0%, rgba(61,91,214,.11) 42%, transparent 72%)'
            : 'radial-gradient(circle, rgba(124,91,255,.13) 0%, rgba(61,91,214,.09) 44%, transparent 74%)',
        }}
      />

      {/* Indigo depth low-right */}
      <div
        className={cn(
          'absolute -bottom-[34%] -right-[14%] h-[74%] w-[64%] rounded-full blur-[130px]',
          tone !== 'static' && 'anim-mist',
        )}
        style={{
          animationDelay: '-14s',
          background: isDark
            ? 'radial-gradient(circle, rgba(61,91,214,.20) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(61,91,214,.12) 0%, transparent 72%)',
        }}
      />

      {/* Rare warm event */}
      {warm ? (
        <div
          className="absolute right-[6%] top-[34%] h-[30%] w-[26%] rounded-full blur-[96px]"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(255,221,208,.15) 0%, transparent 68%)'
              : 'radial-gradient(circle, rgba(247,170,142,.16) 0%, transparent 70%)',
          }}
        />
      ) : null}

      {/* Measurement grid */}
      {grid ? (
        <div
          className="grid-mesh absolute inset-0"
          style={
            {
              '--mesh-color': isDark ? 'rgba(255,255,255,.055)' : 'rgba(61,91,214,.075)',
              '--mesh-size': '56px',
            } as React.CSSProperties
          }
        />
      ) : null}

      {/* Edge settle so text always has a stable ground */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'linear-gradient(to bottom, rgba(7,10,18,0) 52%, rgba(7,10,18,.72) 100%)'
            : 'linear-gradient(to bottom, rgba(229,237,250,0) 60%, rgba(229,237,250,.6) 100%)',
        }}
      />
    </div>
  );
}
