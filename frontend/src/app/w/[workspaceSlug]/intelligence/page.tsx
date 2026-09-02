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

export const metadata: Metadata = { title: 'Agent Fleet' };

export default async function IntelligencePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  if (!isPopulated(workspaceSlug)) {
    return <WorkspacePlaceholder slug={workspaceSlug} title="Agent Fleet" section="intelligence" />;
  }

  // Read from the URL by IntelligenceWorkspace; no server here to do it.
  const intent = undefined;
  const live = await getIntelligence(workspaceSlug);

  const runs = live.ok ? live.data.runs : sampleRuns;
  const campaigns = live.ok ? live.data.campaigns : blendedCampaigns;
  const fleet = live.ok ? live.data.fleet : FALLBACK_FLEET;
  const intents = live.ok ? live.data.intents : INTENTS;
  const offline = fleetNotice(live.ok, live.ok ? undefined : live.error);

  return (
    <PageShell
      // The navigation calls this the Agent Fleet, so the page does too. A page
      // whose title disagrees with the link that reached it reads as a wrong turn.
      title="Agent Fleet"
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

      {/*
        The fleet first. It is what the page is about, and what it is doing
        right now is the thing somebody arriving here wants to know before they
        decide whether to ask it for anything else.
      */}
      <FleetRoster
        agents={fleet.agents}
        powering={fleet.powering}
        mode={fleet.mode}
        invocations={fleet.invocations}
        activeRunId={fleet.activeRunId}
        activeSummary={fleet.activeSummary}
        workspaceSlug={workspaceSlug}
        nowIso={NOW_ISO}
      />

      <div className="mt-10" />

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

    </PageShell>
  );
}
