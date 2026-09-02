/**
 * The wait.
 *
 * Two rules govern this file. It must match the geometry of the page it stands
 * in for, so nothing jumps when the data lands. And it must not look like a
 * page that has failed — a grid of grey blocks pulsing in unison is what a
 * broken screen looks like, which is why the old one made every tab switch
 * feel like a fault rather than a step.
 *
 * So the blocks sweep instead of blinking, in reading order, and the sweep is
 * warm — it reads as a page being set, not as content that is missing. The
 * masthead says which page is being set, because knowing the briefing is on
 * its way is worth more than another grey rectangle where its title will be.
 */
export default function WorkspaceLoading() {
  return (
    <div
      className="mx-auto w-full max-w-shell px-4 py-6 sm:px-6 sm:py-8"
      role="status"
      aria-label="Loading"
    >
      <div className="flex items-end justify-between gap-6 border-b border-line pb-5">
        <div className="min-w-0">
          {/* Three rules finding their level: the scoreline being drawn. */}
          <div className="flex h-5 items-end gap-1" aria-hidden="true">
            <span className="track-bar h-2 w-7 rounded-full bg-action-400/70" />
            <span className="track-bar track-d1 h-3.5 w-7 rounded-full bg-ink-950/25" />
            <span className="track-bar track-d2 h-2.5 w-7 rounded-full bg-ink-950/15" />
          </div>
          <p className="mono mt-3 text-[11.5px] uppercase tracking-[0.12em] text-ink-400">
            Reconciling accounts
          </p>
        </div>
        <div className="shimmer shimmer-d1 h-9 w-[190px] rounded-control" />
      </div>

      {/* The scoreline. Five columns, exactly where five will land. */}
      <div className="s-panel mt-7 grid gap-px overflow-hidden bg-line p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="bg-surface px-5 py-4">
            <div className="shimmer h-3 w-16 rounded" />
            <div className="shimmer shimmer-d1 mt-3 h-6 w-24 rounded" />
            <div className="shimmer shimmer-d2 mt-3 h-3 w-20 rounded" />
          </div>
        ))}
      </div>

      <div className="shimmer shimmer-d1 mt-8 h-[220px] w-full rounded-card" />
      <div className="shimmer shimmer-d2 mt-5 h-[180px] w-full rounded-card" />

      <span className="sr-only">Loading this workspace</span>
    </div>
  );
}
