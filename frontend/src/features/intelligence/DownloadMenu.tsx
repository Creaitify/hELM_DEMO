'use client';

import { useEffect, useRef, useState } from 'react';
import { IconChevronDown, IconDownload } from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * Report downloads.
 *
 * A decision somebody was asked to make has to be able to leave the product —
 * into a deck, an email, a board pack. Each format is a plain link so the
 * browser handles the save itself and the file arrives with the basis it was
 * decided on attached.
 */

export type DownloadFormat = { format: string; label: string; hint: string };

export const REPORT_FORMATS: DownloadFormat[] = [
  { format: 'md', label: 'Markdown', hint: 'For writing and pasting' },
  { format: 'html', label: 'HTML', hint: 'Formatted, opens in a browser' },
  { format: 'csv', label: 'CSV', hint: 'Findings and proposals as rows' },
  { format: 'json', label: 'JSON', hint: 'The whole record, for anything downstream' },
];

export function DownloadMenu({
  href,
  label = 'Download',
  formats = REPORT_FORMATS,
  className,
}: {
  /** Base export path. The chosen format is appended as ?format=. */
  href: string;
  label?: string;
  formats?: DownloadFormat[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const separator = href.includes('?') ? '&' : '?';

  return (
    <div ref={container} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line-strong px-3 text-[13.5px] font-medium text-ink-950 transition-colors hover:bg-surface-subtle"
      >
        <IconDownload size={15} />
        {label}
        <IconChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-[248px] overflow-hidden rounded-card border border-line bg-surface shadow-lift"
        >
          {formats.map((entry) => (
            <a
              key={entry.format}
              role="menuitem"
              href={`${href}${separator}format=${entry.format}`}
              download
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2.5 transition-colors hover:bg-surface-subtle"
            >
              <span className="block text-[13.5px] text-ink-950">{entry.label}</span>
              <span className="block text-[11.5px] text-ink-400">{entry.hint}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
