import type { Metadata } from 'next';
import { PageShell } from '@/components/shell/AppShell';
import { WorkspacePlaceholder, isPopulated } from '@/features/briefing/WorkspacePlaceholder';
import { CampaignExplorer } from '@/features/campaigns/CampaignExplorer';
import { formatDateRange } from '@/lib/format';
import { getCampaigns } from '@/services/http/queries';
import { WINDOW_END, WINDOW_START, campaigns as sampleCampaigns } from '@/services/mock';

export const metadata: Metadata = { title: 'Campaigns' };

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  if (!isPopulated(workspaceSlug)) {
    return <WorkspacePlaceholder slug={workspaceSlug} title="Campaigns" section="campaigns" />;
  }

  const live = await getCampaigns(workspaceSlug);
  const campaigns = live.ok ? live.data.campaigns : sampleCampaigns;

  return (
    <PageShell
      wide
      title="Campaigns"
      context={
        <p className="mono text-[12px] text-ink-400">
          {campaigns.length} campaigns · India · Google + Meta · {formatDateRange(WINDOW_START, WINDOW_END)} vs
          previous 30 days
        </p>
      }
    >
      <CampaignExplorer
        campaigns={campaigns}
        workspaceSlug={workspaceSlug}
        excludedAccountId="acct_m_retarget"
      />
    </PageShell>
  );
}
