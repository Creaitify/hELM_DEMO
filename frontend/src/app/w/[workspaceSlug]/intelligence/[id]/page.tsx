import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/shell/AppShell';
import { DecisionMemo } from '@/features/intelligence/DecisionMemo';
import { StatusBadge } from '@/components/primitives/Status';
import { InlineNotice } from '@/components/primitives/States';
import { IconChevronLeft } from '@/components/icons';
import { routes } from '@/lib/routes';
import { formatRelative } from '@/lib/format';
import {
  NOW_ISO,
  accounts,
  artifactById,
  decisions,
  evidence,
  findingById,
  recommendationById,
  runById,
} from '@/services/mock';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const run = runById(id);
  return { title: run ? run.title : 'Run not found' };
}

const STAGE_LABEL: Record<string, string> = {
  complete: 'Complete',
  waiting_for_decision: 'Waiting for your decision',
  analyzing: 'Analyzing',
  blocked: 'Blocked',
};

export default async function RunPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const run = runById(id);
  if (!run) notFound();

  const runFindings = run.findingIds.map(findingById).filter((f) => Boolean(f)).map((f) => f!);
  const runRecommendations = run.recommendationIds
    .map(recommendationById)
    .filter((r) => Boolean(r))
    .map((r) => r!);
  const runDecisions = decisions.filter((decision) => decision.runId === run.id);
  const artifact = run.artifactId ? artifactById(run.artifactId) : undefined;

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
                : run.stage === 'waiting_for_decision'
                  ? 'warn'
                  : run.stage === 'blocked'
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
    >
      <Link
        href={routes.intelligence(workspaceSlug)}
        className="mb-5 inline-flex items-center gap-1 text-[13.5px] text-ink-500 transition-colors hover:text-ink-950"
      >
        <IconChevronLeft size={16} />
        All investigations
      </Link>

      {run.stage === 'blocked' ? (
        <InlineNotice tone="warn" title="This run was blocked rather than blended" className="mb-6">
          {run.stages.find((stage) => stage.state === 'failed')?.detail}
        </InlineNotice>
      ) : null}

      {run.stage === 'analyzing' ? (
        <InlineNotice tone="info" title="This run is still working" className="mb-6">
          Two findings have been drafted. You can leave this page — the run continues and the shell will link
          you back to it.
        </InlineNotice>
      ) : null}

      <DecisionMemo
        run={run}
        findings={runFindings}
        recommendations={runRecommendations}
        evidence={evidence}
        decisions={runDecisions}
        accounts={accounts}
        artifact={artifact}
        workspaceSlug={workspaceSlug}
        nowIso={NOW_ISO}
      />
    </PageShell>
  );
}
