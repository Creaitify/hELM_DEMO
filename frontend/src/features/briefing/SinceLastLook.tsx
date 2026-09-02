'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { TimelineEvent } from '@/contracts';
import { StatusBadge } from '@/components/primitives/Status';
import { Disclosure } from '@/components/primitives/Controls';
import { AskAbout } from '@/features/agent/AskAbout';
import { IconArrowRight } from '@/components/icons';
import { formatRelative } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';

/**
 * Since you last looked — meaning it, this time.
 *
 * This section already carried the heading. What it did not carry was any
 * notion of when you were last here: it listed the same events in the same
 * order every morning and called them new. That is the kind of claim that
 * makes a product feel written rather than built, and it is worth fixing
 * before anything cosmetic.
 *
 * The marker is the workspace's own clock, not the browser's. Events are
 * stamped on the account's timeline, so comparing them against wall-clock time
 * would be comparing two different calendars — and would break the moment the
 * workspace was being reviewed against a fixed analysis window.
 *
 * What was new is captured into state on the first render after mount, before
 * the marker moves forward. Otherwise reloading the page would erase the very
 * thing you came back to read.
 */

function storageKey(slug: string) {
  return `helm.lastLook.${slug}`;
}

export function SinceLastLook({
  workspaceSlug,
  moved,
  rest,
  nowIso,
}: {
  workspaceSlug: string;
  /** Events that changed a figure on this page. */
  moved: TimelineEvent[];
  /** Everything else, behind the disclosure. */
  rest: TimelineEvent[];
  /** The workspace's clock, which is also the clock the events are stamped on. */
  nowIso: string;
}) {
  /*
   * `null` until the first client render.
   *
   * The marker lives in localStorage, which the server cannot read, so
   * rendering the resolved state on the server would guarantee a hydration
   * mismatch on the one section whose entire job is to be correct.
   */
  const [lastLook, setLastLook] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey(workspaceSlug));
    } catch {
      // A private window. Everything simply reads as already seen.
    }
    setLastLook(stored);

    // Move the marker up only when the workspace clock has actually advanced.
    // Writing it unconditionally would mean a workspace under review against a
    // fixed window recorded a visit that changed nothing.
    try {
      if (!stored || stored < nowIso) {
        window.localStorage.setItem(storageKey(workspaceSlug), nowIso);
      }
    } catch {
      // Not remembering the visit is not worth interrupting anybody over.
    }
  }, [nowIso, workspaceSlug]);

  const fresh = useMemo(() => {
    if (!lastLook) return new Set<string>();
    return new Set(
      [...moved, ...rest].filter((event) => event.at > lastLook).map((event) => event.id),
    );
  }, [lastLook, moved, rest]);

  const settled = lastLook !== undefined;
  const firstVisit = settled && lastLook === null;
  const newCount = fresh.size;

  return (
    <section aria-labelledby="since" className="scroll-mt-24">
      <div className="rule-heavy pt-4">
        <div className="ask-host flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="micro-label">Since you last looked</p>
            <h2 id="since" className="text-section mt-1.5 flex items-center gap-2 text-ink-950">
              {/*
                Three states, and the quiet one is not a failure. "Nothing
                moved" is a real answer to the question this section asks, and
                it is the answer a healthy account gives most mornings.
              */}
              {!settled ? (
                <span className="shimmer inline-block h-6 w-[220px] rounded" aria-hidden="true" />
              ) : firstVisit ? (
                'Everything here is new to you'
              ) : newCount > 0 ? (
                <>
                  {newCount} {newCount === 1 ? 'thing' : 'things'} moved
                </>
              ) : (
                'Nothing has moved'
              )}
              {settled ? (
                <AskAbout
                  subject="what changed"
                  question="What has changed on this account since yesterday, and does any of it need me today?"
                />
              ) : null}
            </h2>
            <p className="text-aside mt-1 text-[15px]">
              {!settled
                ? ' '
                : firstVisit
                  ? 'From now on this only shows what arrived while you were away.'
                  : newCount > 0
                    ? `You were last here ${formatRelative(lastLook, nowIso)}.`
                    : `Nothing has landed since ${formatRelative(lastLook, nowIso)}. The log below is the standing record.`}
            </p>
          </div>

          <Link
            href={routes.settings(workspaceSlug, 'audit')}
            className="mono inline-flex shrink-0 items-center gap-1.5 text-[12px] text-action-deep underline-offset-2 hover:underline"
          >
            Open the full audit
            <IconArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="s-panel mt-5 px-5 sm:px-6">
        <ol className="divide-y divide-line">
          {moved.map((event) => (
            <TimelineRow key={event.id} event={event} nowIso={nowIso} fresh={fresh.has(event.id)} />
          ))}
        </ol>
        {rest.length > 0 ? (
          <Disclosure
            summary={`${rest.length} more events that changed nothing above`}
            className="border-t border-line"
          >
            <ol className="divide-y divide-line">
              {rest.map((event) => (
                <TimelineRow key={event.id} event={event} nowIso={nowIso} fresh={fresh.has(event.id)} />
              ))}
            </ol>
          </Disclosure>
        ) : null}
      </div>
    </section>
  );
}

function TimelineRow({
  event,
  nowIso,
  fresh,
}: {
  event: TimelineEvent;
  nowIso: string;
  fresh: boolean;
}) {
  return (
    <li
      className={cn(
        'ask-host relative flex flex-wrap items-start gap-x-4 gap-y-1 py-3',
        // A rule in the margin rather than a highlighted row: it marks the
        // line without repainting content that is otherwise unchanged.
        fresh && 'pl-3 before:absolute before:inset-y-2.5 before:left-0 before:w-[2px] before:rounded-full before:bg-action-400',
      )}
    >
      <span className="mono w-[104px] shrink-0 text-[11.5px] text-ink-400">
        {formatRelative(event.at, nowIso)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-medium text-ink-950">{event.title}</span>
          <StatusBadge
            tone={
              event.tone === 'good'
                ? 'good'
                : event.tone === 'warn'
                  ? 'warn'
                  : event.tone === 'bad'
                    ? 'bad'
                    : 'neutral'
            }
            className="capitalize"
          >
            {event.kind}
          </StatusBadge>
          {fresh ? (
            <span className="mono rounded-full bg-action-400 px-1.5 py-px text-[9.5px] uppercase tracking-[0.1em] text-action-ink">
              New
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[13px] leading-[19px] text-ink-500">{event.detail}</span>
      </span>
      <AskAbout
        subject={event.title}
        question={`${event.title} — ${event.detail}. What caused this and does it need a decision?`}
        className="mt-0.5"
      />
    </li>
  );
}
