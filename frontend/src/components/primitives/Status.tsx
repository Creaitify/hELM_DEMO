import type { ReactNode } from 'react';
import type { ConnectionStatus, SyncState } from '@/contracts';
import { cn } from '@/lib/cn';
import {
  IconAlert,
  IconCheckCircle,
  IconFreshness,
  IconLock,
  IconPaused,
  IconSyncing,
  IconWarning,
} from '@/components/icons';

/**
 * `bad` and `urgent` are not synonyms. `bad` marks a decision-grade finding —
 * something that deserves a person's judgment this week. `urgent` marks a
 * clock: an item that stops being actionable if it waits. Spending `urgent`
 * on anything else spends the one tone that still makes a reader look up.
 */
export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'urgent' | 'info' | 'iris';

const toneClasses: Record<Tone, string> = {
  // A chip is an object, so it gets a ground and an edge rather than borrowing
  // the card's. Semantic tones stay tints — the fill locates the chip, the
  // text colour and label carry the meaning.
  neutral: 'bg-chip-neutral text-ink-700 border-chip-line',
  good: 'bg-good-soft text-good border-good/20',
  warn: 'bg-warn-soft text-warn border-warn/20',
  bad: 'bg-bad-soft text-bad border-bad/25',
  urgent: 'bg-urgent-soft text-urgent border-urgent/35',
  info: 'bg-info-soft text-info border-info/20',
  iris: 'bg-[#F0ECFF] text-iris-500 border-iris-500/20',
};

/** Status always carries icon + label + text. Never colour alone. */
export function StatusBadge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium leading-none',
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Pill({
  children,
  className,
  onNight = false,
}: {
  children: ReactNode;
  className?: string;
  onNight?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] leading-none',
        onNight
          ? 'border-night-line text-night-muted'
          : 'border-chip-line bg-chip-neutral/55 text-ink-500',
        className,
      )}
    >
      {children}
    </span>
  );
}

const syncPresentation: Record<SyncState, { label: string; tone: Tone; icon: ReactNode }> = {
  fresh: { label: 'Healthy', tone: 'good', icon: <IconCheckCircle size={14} /> },
  syncing: { label: 'Syncing', tone: 'info', icon: <IconSyncing size={14} className="anim-spin" /> },
  partial: { label: 'Partial', tone: 'warn', icon: <IconWarning size={14} /> },
  delayed: { label: 'Delayed', tone: 'warn', icon: <IconFreshness size={14} /> },
  stale: { label: 'Stale', tone: 'warn', icon: <IconFreshness size={14} /> },
  paused: { label: 'Paused', tone: 'neutral', icon: <IconPaused size={14} /> },
  needs_reauthorization: { label: 'Needs reauthorization', tone: 'bad', icon: <IconLock size={14} /> },
  failed: { label: 'Failed', tone: 'bad', icon: <IconAlert size={14} /> },
  never_synced: { label: 'Never synced', tone: 'neutral', icon: <IconFreshness size={14} /> },
};

export function SyncBadge({ state, className }: { state: SyncState; className?: string }) {
  const presentation = syncPresentation[state];
  return (
    <StatusBadge tone={presentation.tone} icon={presentation.icon} className={className}>
      {presentation.label}
    </StatusBadge>
  );
}

const connectionPresentation: Record<ConnectionStatus, { label: string; tone: Tone; icon: ReactNode }> = {
  disconnected: { label: 'Not connected', tone: 'neutral', icon: <IconPaused size={14} /> },
  authorizing: { label: 'Authorizing', tone: 'info', icon: <IconSyncing size={14} className="anim-spin" /> },
  connected: { label: 'Connected', tone: 'good', icon: <IconCheckCircle size={14} /> },
  syncing: { label: 'Syncing', tone: 'info', icon: <IconSyncing size={14} className="anim-spin" /> },
  paused: { label: 'Paused', tone: 'neutral', icon: <IconPaused size={14} /> },
  needs_reauthorization: { label: 'Needs reauthorization', tone: 'bad', icon: <IconLock size={14} /> },
  attention: { label: 'Needs attention', tone: 'warn', icon: <IconWarning size={14} /> },
};

export function ConnectionBadge({ status, className }: { status: ConnectionStatus; className?: string }) {
  const presentation = connectionPresentation[status];
  return (
    <StatusBadge tone={presentation.tone} icon={presentation.icon} className={className}>
      {presentation.label}
    </StatusBadge>
  );
}

/** Observed / Calculated / Inferred — never blurred together. */
export function KindMarker({ kind }: { kind: 'observed' | 'calculated' | 'inferred' }) {
  const map = {
    observed: { label: 'Observed', tone: 'neutral' as Tone, hint: 'Directly present in source data' },
    calculated: { label: 'Calculated', tone: 'info' as Tone, hint: 'Derived from a disclosed formula' },
    inferred: { label: 'Inferred', tone: 'iris' as Tone, hint: 'A judgment from multiple signals' },
  };
  const entry = map[kind];
  return (
    <StatusBadge tone={entry.tone} className="font-mono text-[11px] uppercase tracking-[0.08em]">
      <span title={entry.hint}>{entry.label}</span>
    </StatusBadge>
  );
}

export function ConfidenceMarker({ level }: { level: 'high' | 'medium' | 'low' }) {
  const bars = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  const tone = level === 'high' ? 'text-good' : level === 'medium' ? 'text-warn' : 'text-ink-400';
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500">
      <span className="inline-flex items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              'w-[3px] rounded-[1px]',
              index <= bars ? cn('bg-current', tone) : 'bg-line-strong',
            )}
            style={{ height: `${4 + index * 3}px` }}
          />
        ))}
      </span>
      <span>
        {level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low'} confidence
      </span>
    </span>
  );
}

export function DeltaChip({
  text,
  semantic,
  className,
}: {
  text: string;
  semantic: 'favorable' | 'unfavorable' | 'neutral';
  className?: string;
}) {
  const arrow = text.startsWith('+') ? '▲' : text.startsWith('−') || text.startsWith('-') ? '▼' : '■';
  return (
    <span
      className={cn(
        'mono inline-flex items-center gap-1 text-[12px] font-medium',
        semantic === 'favorable' && 'text-good',
        semantic === 'unfavorable' && 'text-bad',
        semantic === 'neutral' && 'text-ink-500',
        className,
      )}
    >
      <span aria-hidden="true" className="text-[8px] leading-none">
        {arrow}
      </span>
      {text}
    </span>
  );
}
