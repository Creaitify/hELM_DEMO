import type { Metadata } from 'next';
import { PageShell } from '@/components/shell/AppShell';
import { WorkspacePlaceholder, isPopulated } from '@/features/briefing/WorkspacePlaceholder';
import { CampaignExplorer } from '@/features/campaigns/CampaignExplorer';
import { formatDateRange } from '@/lib/format';
import { WINDOW_END, WINDOW_START, campaigns } from '@/services/mock';

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


  return (
    <PageShell
      wide
      title="Campaigns"
      context={
        <p className="mono text-[12px] text-ink-400">
          11 campaigns · India · Google + Meta · {formatDateRange(WINDOW_START, WINDOW_END)} vs previous 30 days
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
