import type { Metadata } from 'next';
import { PageShell } from '@/components/shell/AppShell';
import { InlineNotice } from '@/components/primitives/States';
import { WorkspacePlaceholder, isPopulated } from '@/features/briefing/WorkspacePlaceholder';
import { IntelligenceWorkspace } from '@/features/intelligence/IntelligenceWorkspace';
import { FleetRoster } from '@/features/intelligence/FleetRoster';
import { FALLBACK_FLEET, fleetNotice } from '@/features/intelligence/fleet-fallback';
import { formatDateRange } from '@/lib/format';
import { getIntelligence } from '@/services/http/queries';
import { NOW_ISO, WINDOW_END, WINDOW_START, blendedCampaigns, runs as sampleRuns } from '@/services/mock';
import { INTENTS } from '@/services/mock/intelligence';

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
  const live = await getIntelligence(workspaceSlug);

  const runs = live.ok ? live.data.runs : sampleRuns;
  const campaigns = live.ok ? live.data.campaigns : blendedCampaigns;
  const fleet = live.ok ? live.data.fleet : FALLBACK_FLEET;
  const intents = live.ok ? live.data.intents : INTENTS;
  const offline = fleetNotice(live.ok, live.ok ? undefined : live.error);

  return (
    <PageShell
      title="Intelligence"
      context={
        <p className="mono text-[12px] text-ink-400">
          {runs.length} runs · India · Google + Meta · {formatDateRange(WINDOW_START, WINDOW_END)}
        </p>
      }
    >
      {offline ? (
        <InlineNotice tone="warn" title={offline.title} className="mb-6">
          {offline.body}
        </InlineNotice>
      ) : null}

      <IntelligenceWorkspace
        runs={runs}
        campaigns={campaigns}
        intents={intents}
        workspaceSlug={workspaceSlug}
        scopeLabel="India · Google + Meta"
        rangeLabel={formatDateRange(WINDOW_START, WINDOW_END)}
        freshnessLabel="Synced 8 min ago"
        initialIntent={intent}
        nowIso={NOW_ISO}
        canRun={live.ok ? live.data.canRun : false}
        live={live.ok}
      />

      {/* The cast that will run it, before it is called */}
      <div className="mt-10">
        <FleetRoster agents={fleet.agents} powering={fleet.powering} mode={fleet.mode} />
      </div>
    </PageShell>
  );
}
