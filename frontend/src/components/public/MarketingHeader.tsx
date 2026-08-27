'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HelmWordmark } from '@/components/brand/HelmMark';
import { IconClose, IconMenu } from '@/components/icons';
import { LinkButton } from '@/components/primitives/Button';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#method', label: 'Method' },
  { href: '#security', label: 'Security' },
];

/**
 * A navy surface from the first pixel, with the hairline arriving on scroll.
 *
 * The bar used to be transparent until 16px of scroll, which left the topmost
 * strip reading as a slightly different shade than the hero directly under it —
 * a seam across the top of the page at rest, which is where a visitor spends
 * the longest looking. The height never changes, so nothing below it shifts.
 */
export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 h-[68px] border-b bg-night-950 transition-colors duration-[180ms] ease-out',
        // Only the hairline still depends on scroll: it separates the bar from
        // content passing beneath it, and at rest there is nothing to separate.
        scrolled ? 'border-night-line' : 'border-transparent',
      )}
    >
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="rounded-control" aria-label="HELM — home">
          <HelmWordmark tone="dark" size="sm" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-control px-3.5 py-2.5 text-[14px] text-night-muted transition-colors duration-[110ms] hover:text-night-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href={routes.signin()}
            className="rounded-control px-3.5 py-2.5 text-[14px] text-night-muted transition-colors duration-[110ms] hover:text-night-ink"
          >
            Sign in
          </Link>
          <LinkButton href="#decision-layer" variant="action" size="compact" onNight>
            View the decision layer
          </LinkButton>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <Link
            href={routes.signin()}
            className="rounded-control px-3 py-2.5 text-[14px] text-night-muted transition-colors hover:text-night-ink"
          >
            Sign in
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-night-line text-night-ink"
          >
            {menuOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
          </button>
        </div>
      </div>

      {/* Compact dark sheet, not a full-width generic drawer. */}
      {menuOpen ? (
        <div className="anim-scale-in absolute inset-x-4 top-[76px] origin-top rounded-card border border-night-line bg-night-900/97 p-2 shadow-lift-dark backdrop-blur-md md:hidden">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-control px-4 py-3.5 text-[17px] text-night-ink transition-colors hover:bg-white/[.06]"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-1 border-t border-night-line pt-2">
            <LinkButton href="#decision-layer" variant="action" onNight block>
              View the decision layer
            </LinkButton>
          </div>
        </div>
      ) : null}
    </header>
  );
}
