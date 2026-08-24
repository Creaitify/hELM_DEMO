import type { Metadata } from 'next';
import { PageShell } from '@/components/shell/AppShell';
import { WorkspacePlaceholder, isPopulated } from '@/features/briefing/WorkspacePlaceholder';
import { IntelligenceWorkspace } from '@/features/intelligence/IntelligenceWorkspace';
import { formatDateRange } from '@/lib/format';
import { NOW_ISO, WINDOW_END, WINDOW_START, blendedCampaigns, runs } from '@/services/mock';

export const metadata: Metadata = { title: 'Intelligence' };

export default async function IntelligencePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ intent?: string }>;
}) {
  const { workspaceSlug } = await params;
  if (!isPopulated(workspaceSlug)) {
    return <WorkspacePlaceholder slug={workspaceSlug} title="Intelligence" section="intelligence" />;
  }

  const { intent } = await searchParams;

  return (
    <PageShell
      title="Intelligence"
      context={
        <p className="mono text-[12px] text-ink-400">
          6 runs · India · Google + Meta · {formatDateRange(WINDOW_START, WINDOW_END)}
        </p>
      }
    >
      <IntelligenceWorkspace
        runs={runs}
        campaigns={blendedCampaigns}
        workspaceSlug={workspaceSlug}
        scopeLabel="India · Google + Meta"
        rangeLabel={formatDateRange(WINDOW_START, WINDOW_END)}
        freshnessLabel="Synced 8 min ago"
        initialIntent={intent}
        nowIso={NOW_ISO}
      />
    </PageShell>
  );
}
