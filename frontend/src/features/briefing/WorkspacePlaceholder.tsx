import { PageShell } from '@/components/shell/AppShell';
import { EmptyState, InlineNotice, PermissionState } from '@/components/primitives/States';
import { StatusBadge } from '@/components/primitives/Status';
import { IconConnection, IconLock } from '@/components/icons';
import { routes } from '@/lib/routes';

/**
 * Northstar Group is the populated sample workspace. The other two exist so
 * workspace switching is real, and they show the honest states a fresh or
 * restricted workspace actually produces rather than borrowing Northstar's data.
 */
export const SAMPLE_WORKSPACE_SLUG = 'northstar-group';

export function isPopulated(slug: string): boolean {
  return slug === SAMPLE_WORKSPACE_SLUG;
}

export function WorkspacePlaceholder({
  slug,
  title,
  section,
}: {
  slug: string;
  title: string;
  section: 'briefing' | 'campaigns' | 'intelligence' | 'library' | 'settings';
}) {
  /* Meridian Labs: healthy but nothing connected yet. */
  if (slug === 'meridian-labs') {
    return (
      <PageShell
        title={title}
        context={<p className="mono text-[12px] text-ink-400">Meridian Labs · no ad accounts connected</p>}
      >
        <EmptyState
          icon={<IconConnection size={22} />}
          title="No ad accounts are connected to Meridian Labs"
          description={
            section === 'briefing'
              ? 'Connect Google Ads or Meta Ads to build the first Briefing. The first complete reporting day is available the following morning.'
              : `Connect Google Ads or Meta Ads to populate ${title}. Nothing is read until you choose the accounts.`
          }
          actionLabel="Connect a source"
          actionHref={routes.connections(slug)}
        />
      </PageShell>
    );
  }

  /* Harbour & Co: a viewer whose Meta connection needs reauthorization. */
  return (
    <PageShell
      title={title}
      context={
        <div className="flex flex-wrap items-center gap-2">
          <p className="mono text-[12px] text-ink-400">Harbour &amp; Co · GBP · Europe/London</p>
          <StatusBadge tone="neutral" icon={<IconLock size={13} />}>
            Viewer
          </StatusBadge>
        </div>
      }
    >
      <div className="space-y-5">
        <InlineNotice tone="bad" title="Meta Ads needs reauthorization">
          The stored access for this connection has expired, so no new data is arriving. Existing reports keep
          their figures and last-updated date.
        </InlineNotice>
        <PermissionState
          what={`${title} is unavailable while the connection is expired, and your role cannot reauthorize it.`}
          who="Ask an owner or admin of Harbour & Co to reauthorize Meta Ads."
        />
      </div>
    </PageShell>
  );
}
