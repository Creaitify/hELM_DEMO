import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/shell/AppShell';
import { DecisionMemo } from '@/features/intelligence/DecisionMemo';
import { RunFleetPanel } from '@/features/intelligence/RunFleetPanel';
import { DownloadMenu } from '@/features/intelligence/DownloadMenu';
import { StatusBadge } from '@/components/primitives/Status';
import { InlineNotice } from '@/components/primitives/States';
import { IconChevronLeft } from '@/components/icons';
import { routes } from '@/lib/routes';
import { formatRelative } from '@/lib/format';
import { getIntelligence, getRun } from '@/services/http/queries';
import {
  NOW_ISO,
  accounts as sampleAccounts,
  artifactById,
  decisions as sampleDecisions,
  evidence as sampleEvidence,
  findingById,
  recommendationById,
  runById,
  runs,
} from '@/services/mock';
import { FALLBACK_FLEET, fleetNotice } from '@/features/intelligence/fleet-fallback';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}): Promise<Metadata> {
  const { workspaceSlug, id } = await params;
  const live = await getRun(workspaceSlug, id);
  if (live.ok) return { title: live.data.run.title };
  const run = runById(id);
  return { title: run ? run.title : 'Run not found' };
}

const STAGE_LABEL: Record<string, string> = {
  queued: 'Queued',
  collecting_data: 'Collecting data',
  analyzing: 'Analyzing',
  reviewing_analysis: 'HELM review',
  creating: 'Creating',
  reviewing_creative: 'HELM review',
  waiting_for_approval: 'Waiting for your approval',
  generating_images: 'Generating images',
  complete: 'Complete',
  blocked: 'Blocked',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/**
 * Which pages exist in a static export.
 *
 * `output: 'export'` has no server, so every dynamic route has to be named at
 * build time or the build fails. The list comes from the sample fixtures —
 * which is also the only data the exported site has, since there is no API
 * behind it to ask for a real one.
 */
export function generateStaticParams() {
  return runs.map((run) => ({ id: run.id }));
}

export default async function RunPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;

  const [live, intelligence] = await Promise.all([getRun(workspaceSlug, id), getIntelligence(workspaceSlug)]);

  // The whole record renders from the server. The live workflow layer is added
  // on top by a client island, so the page is complete without JavaScript.
  const record = live.ok
    ? {
        run: live.data.run,
        findings: live.data.findings,
        recommendations: live.data.recommendations,
        evidence: live.data.evidence,
        decisions: live.data.decisions,
        artifact: live.data.artifact ?? undefined,
        accounts: live.data.accounts,
        canApprove: live.data.canApprove,
      }
    : (() => {
        const run = runById(id);
        if (!run) return null;
        return {
          run,
          findings: run.findingIds.map(findingById).filter((f) => Boolean(f)).map((f) => f!),
          recommendations: run.recommendationIds
            .map(recommendationById)
            .filter((r) => Boolean(r))
            .map((r) => r!),
          evidence: sampleEvidence,
          decisions: sampleDecisions.filter((decision) => decision.runId === run.id),
          artifact: run.artifactId ? artifactById(run.artifactId) : undefined,
          accounts: sampleAccounts,
          canApprove: true,
        };
      })();

  if (!record) notFound();

  const { run } = record;
  const fleet = intelligence.ok ? intelligence.data.fleet : FALLBACK_FLEET;
  const offline = fleetNotice(live.ok, live.ok ? undefined : live.error);
  const exportHref = `/api/workspaces/${workspaceSlug}/intelligence/${run.id}/export`;

  return (
    <PageShell
      wide
      title={run.title}
      context={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusBadge
            tone={
              run.stage === 'complete'
                ? 'good'
                : run.stage === 'waiting_for_approval'
                  ? 'warn'
                  : run.stage === 'blocked' || run.stage === 'failed'
                    ? 'bad'
                    : 'info'
            }
          >
            {STAGE_LABEL[run.stage] ?? run.stage}
          </StatusBadge>
          <span className="mono text-[12px] text-ink-400">
            {run.intent} · {run.scopeLabel} · {run.rangeLabel}
          </span>
          <span className="mono text-[12px] text-ink-400">
            {formatRelative(run.completedAt ?? run.startedAt, NOW_ISO)} · {run.requestedBy}
          </span>
        </div>
      }
      actions={live.ok ? <DownloadMenu href={exportHref} label="Download report" /> : undefined}
    >
      <Link
        href={routes.intelligence(workspaceSlug)}
        className="mb-5 inline-flex items-center gap-1 text-[13.5px] text-ink-500 transition-colors hover:text-ink-950"
      >
        <IconChevronLeft size={16} />
        All investigations
      </Link>

      {offline ? (
        <InlineNotice tone="warn" title={offline.title} className="mb-6">
          {offline.body}
        </InlineNotice>
      ) : null}

      {/* The workflow, working */}
      {live.ok && run.workflow?.length ? (
        <div className="mb-8">
          <RunFleetPanel
            workspaceSlug={workspaceSlug}
            run={run}
            workflow={run.workflow}
            canRun={intelligence.ok ? intelligence.data.canRun : false}
            powering={fleet.powering}
          />
        </div>
      ) : null}

      <DecisionMemo
        run={run}
        findings={record.findings}
        recommendations={record.recommendations}
        evidence={record.evidence}
        decisions={record.decisions}
        accounts={record.accounts}
        artifact={record.artifact}
        workspaceSlug={workspaceSlug}
        nowIso={NOW_ISO}
        canApprove={record.canApprove}
        live={live.ok}
        exportHref={live.ok ? exportHref : undefined}
      />
    </PageShell>
  );
}
