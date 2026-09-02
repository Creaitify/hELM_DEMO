'use client';

import { IconSpark } from '@/components/icons';
import { useAgent } from './AgentProvider';
import { cn } from '@/lib/cn';

/**
 * Ask about this particular thing.
 *
 * A dashboard that can only be read is a report. The difference between a
 * report and an instrument is whether you can point at a number on it and get
 * an answer about that number — so every figure that has a story behind it
 * carries one of these.
 *
 * It is intentionally almost invisible at rest. Drawn at full strength on
 * every metric it would turn the scoreline into a row of buttons and bury the
 * figures it is supposed to serve; the parent's `.ask-host` reveals it on
 * hover and keyboard focus, and touch devices — which have no hover to reveal
 * anything — simply always show it.
 *
 * Put `ask-host` on whichever ancestor should be the hover target.
 */
export function AskAbout({
  subject,
  question,
  label,
  className,
}: {
  /** The chip the console shows: "on CPA", "on Broad 04". Keep it short. */
  subject: string;
  /** The question actually sent. Written as the user would ask it. */
  question: string;
  /** Overrides the screen-reader label where "Ask about X" reads badly. */
  label?: string;
  className?: string;
}) {
  const { ask } = useAgent();

  return (
    <button
      type="button"
      onClick={() => ask(question, subject)}
      aria-label={label ?? `Ask HELM about ${subject}`}
      title={label ?? `Ask HELM about ${subject}`}
      className={cn(
        'ask-trigger inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-control',
        'text-ink-400 hover:bg-helm-50 hover:text-action-deep',
        className,
      )}
    >
      <IconSpark size={13} />
    </button>
  );
}
