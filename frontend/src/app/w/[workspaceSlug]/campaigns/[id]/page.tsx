import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/shell/AppShell';
import {
  CampaignDetail,
  CampaignHeaderMetrics,
  CampaignIdentity,
} from '@/features/campaigns/CampaignDetail';
import { StatusBadge } from '@/components/primitives/Status';
import { IconChevronLeft } from '@/components/icons';
import { routes } from '@/lib/routes';
import { formatDateRange } from '@/lib/format';
import {
  WINDOW_DATES,
  WINDOW_END,
  WINDOW_START,
  blendedCampaigns,
  campaignById,
  creativesForCampaign,
  decisionStorySeries,
  evidence,
  findings,
  recommendations,
  runs,
} from '@/services/mock';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const campaign = campaignById(id);
  return { title: campaign ? campaign.name : 'Campaign not found' };
}

/**
 * Which pages exist in a static export.
 *
 * `output: 'export'` has no server, so every dynamic route has to be named at
 * build time or the build fails. The list comes from the sample fixtures —
 * which is also the only data the exported site has, since there is no API
 * behind it to ask for a real one.
 */
export function generateStaticParams() {
  return blendedCampaigns.map((campaign) => ({ id: campaign.id }));
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const campaign = campaignById(id);
  if (!campaign) notFound();

  const campaignFindings = findings.filter((finding) => finding.affectedCampaignIds.includes(id));

  /** Which run produced each finding, so "investigate" reopens it. */
  const runIdByFinding: Record<string, string> = {};
  for (const run of runs) {
    for (const findingId of run.findingIds) runIdByFinding[findingId] ??= run.id;
  }

  /** Daily spend reconstructed from the stored shape so the chart has real geometry. */
  const total = campaign.dailySpend.reduce((sum, value) => sum + value, 0);
  const spendSeries = WINDOW_DATES.map((date, index) => ({
    date,
    value: Math.round((campaign.dailySpend[index] / total) * campaign.spend),
  }));

  const storySeries =
    id === 'cmp_m_broad_04'
      ? decisionStorySeries[0].points
      : id === 'cmp_g_high_intent'
        ? decisionStorySeries[1].points
        : spendSeries.map((point) => ({
            date: point.date,
            value: Math.round(campaign.cpa ?? 0),
          }));

  return (
    <PageShell
      wide
      title={campaign.name}
      context={
        <div className="space-y-3">
          <CampaignIdentity campaign={campaign} workspaceSlug={workspaceSlug} />
          <CampaignHeaderMetrics campaign={campaign} />
        </div>
      }
      actions={
        <>
          <StatusBadge tone={campaign.status === 'limited' ? 'warn' : campaign.status === 'learning' ? 'info' : 'good'}>
            {campaign.status === 'limited'
              ? 'Limited by budget'
              : campaign.status === 'learning'
                ? 'Learning'
                : 'Active'}
          </StatusBadge>
          <span className="mono text-[11.5px] text-ink-400">
            {formatDateRange(WINDOW_START, WINDOW_END)}
          </span>
        </>
      }
    >
      <Link
        href={routes.campaigns(workspaceSlug)}
        className="mb-5 inline-flex items-center gap-1 text-[13.5px] text-ink-500 transition-colors hover:text-ink-950"
      >
        <IconChevronLeft size={16} />
        All campaigns
      </Link>

      <CampaignDetail
        campaign={campaign}
        creatives={creativesForCampaign(id)}
        findings={campaignFindings}
        recommendations={recommendations}
        evidence={evidence}
        spendSeries={spendSeries}
        cpaSeries={storySeries}
        workspaceSlug={workspaceSlug}
        runIdByFinding={runIdByFinding}
      />
    </PageShell>
  );
}
