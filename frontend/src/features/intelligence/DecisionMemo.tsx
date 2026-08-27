'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdAccount, Artifact, Decision, Evidence, Finding, IntelligenceRun, Recommendation } from '@/contracts';
import { EvidenceDrawer } from '@/components/data/EvidenceDrawer';
import { EvidenceLauncher, FindingCard, RecommendationPanel } from '@/components/data/FindingCard';
import { Button } from '@/components/primitives/Button';
import { StatusBadge } from '@/components/primitives/Status';
import { SectionHeading } from '@/components/primitives/States';
import { IconCheck, IconDownload, IconShare } from '@/components/icons';
import { DownloadMenu } from './DownloadMenu';
import { formatClock, formatRelative } from '@/lib/format';
import { findingTrend } from '@/lib/metrics';
import { routes } from '@/lib/routes';
import { api, describeError } from '@/lib/api';
import { cn } from '@/lib/cn';

type DecisionState = 'proposed' | 'approved' | 'revision_requested' | 'dismissed' | 'saved';

/** Discrete named stages. Never a fake percentage and never a typewriter. */
export function RunTimeline({ run, nowIso }: { run: IntelligenceRun; nowIso: string }) {
  return (
    <ol className="s-panel-subtle px-5 py-4">
      {run.stages.map((stage, index) => (
        <li key={stage.stage} className="flex gap-3.5 py-1.5">
          <span className="relative flex w-4 shrink-0 justify-center">
            {index < run.stages.length - 1 ? (
              <span
                className={cn(
                  'absolute top-4 h-full w-px',
                  stage.state === 'done' ? 'bg-good/40' : 'bg-line',
                )}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                'relative mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border',
                stage.state === 'done' && 'border-good bg-good text-white',
                stage.state === 'active' && 'anim-working border-info bg-info',
                stage.state === 'pending' && 'border-line-strong bg-surface',
                stage.state === 'failed' && 'border-bad bg-bad',
                stage.state === 'skipped' && 'border-line bg-surface-sunk',
              )}
              aria-hidden="true"
            >
              {stage.state === 'done' ? <IconCheck size={9} strokeWidth={3.2} /> : null}
            </span>
          </span>
          <span className="min-w-0 flex-1 pb-1.5">
            <span className="flex flex-wrap items-baseline gap-x-3">
              <span
                className={cn(
                  'text-[13.5px]',
                  stage.state === 'pending' || stage.state === 'skipped'
                    ? 'text-ink-400'
                    : 'font-medium text-ink-950',
                )}
              >
                {stage.label}
              </span>
              {stage.at ? (
                <span className="mono text-[11px] text-ink-400">{formatClock(stage.at)} IST</span>
              ) : null}
              {stage.state === 'failed' ? <StatusBadge tone="bad">Blocked</StatusBadge> : null}
            </span>
            {stage.detail ? (
              <span className="mt-0.5 block text-[12.5px] leading-[18px] text-ink-500">{stage.detail}</span>
            ) : null}
          </span>
        </li>
      ))}
      <li className="mono mt-2 border-t border-line pt-2.5 text-[11.5px] text-ink-400">
        Started {formatRelative(run.startedAt, nowIso)} by {run.requestedBy}
      </li>
    </ol>
  );
}

export function DecisionMemo({
  run,
  findings,
  recommendations,
  evidence,
  decisions,
  accounts,
  artifact,
  workspaceSlug,
  nowIso,
  canApprove = true,
  live = false,
  exportHref,
}: {
  run: IntelligenceRun;
  findings: Finding[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  decisions: Decision[];
  accounts: AdAccount[];
  artifact?: Artifact;
  workspaceSlug: string;
  nowIso: string;
  /** False for a viewer or analyst — the control explains itself instead. */
  canApprove?: boolean;
  /** True when the run came from the API, so a decision can be recorded. */
  live?: boolean;
  /** Base export path. Absent when there is nothing on the server to download. */
  exportHref?: string;
}) {
  const router = useRouter();
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, DecisionState>>(
    Object.fromEntries(recommendations.map((rec) => [rec.id, rec.status as DecisionState])),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const activeEvidence = evidence.find((entry) => entry.id === openEvidenceId) ?? null;

  const runEvidence = evidence.filter((entry) =>
    findings.some((finding) => finding.evidenceIds.includes(entry.id)),
  );

  const accountsFor = (finding: Finding) =>
    finding.sourceAccountIds
      .map((id) => accounts.find((account) => account.id === id))
      .filter((account): account is AdAccount => Boolean(account))
      .map((account) => ({ id: account.id, name: account.name, provider: account.provider }));

  /**
   * Records the human decision.
   *
   * The optimistic state lands immediately so the control never feels slow,
   * then the backend writes the Decision node and, if the run was paused
   * waiting for exactly this, releases it to build the memo.
   */
  const record = async (id: string, state: DecisionState, message: string) => {
    const previous = states[id] ?? 'proposed';
    setStates((value) => ({ ...value, [id]: state }));
    setNotice(message);
    setProblem(null);

    if (!live) return;

    try {
      await api.post(
        `/api/workspaces/${workspaceSlug}/intelligence/${run.id}/recommendations/${id}/decide`,
        { outcome: state === 'saved' ? 'saved' : state },
      );
      router.refresh();
    } catch (error) {
      setStates((value) => ({ ...value, [id]: previous }));
      setNotice(null);
      setProblem(describeError(error));
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
      <div className="min-w-0 space-y-10">
        {/* Executive answer */}
        <section aria-labelledby="answer">
          <h2 id="answer" className="micro-label">
            Executive answer
          </h2>
          <p className="mt-3 max-w-prose text-[18px] leading-[28px] text-ink-950">{run.summary}</p>
        </section>

        {/* Findings */}
        <section aria-labelledby="findings">
          <SectionHeading id="findings" title="Findings" hint={`${findings.length} in this run`} />
          <div className="s-panel mt-5 px-5 py-1 sm:px-6">
            {findings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                workspaceSlug={workspaceSlug}
                accountNames={accountsFor(finding)}
                trend={findingTrend(finding, evidence)}
                onOpenEvidence={(id) => setOpenEvidenceId(id)}
                investigateHref={routes.run(workspaceSlug, run.id)}
              />
            ))}
          </div>
        </section>

        {/* Evidence */}
        <section aria-labelledby="evidence">
          <SectionHeading
            id="evidence"
            title="Evidence"
            hint="Every record carries its source, window, method and exclusions."
          />
          <div className="mt-5">
            <EvidenceLauncher
              evidenceIds={runEvidence.map((entry) => entry.id)}
              evidence={evidence}
              onOpen={(id) => setOpenEvidenceId(id)}
            />
          </div>
        </section>

        {/* Recommendations */}
        <section id="recommendations" aria-labelledby="recommendations-heading">
          <SectionHeading
            id="recommendations-heading"
            title="Recommendations"
            hint="Proposed. Nothing has been executed in Google Ads or Meta Ads."
          />
          <div className="mt-5 space-y-5">
            {recommendations.map((recommendation) => (
              <RecommendationPanel
                key={recommendation.id}
                recommendation={recommendation}
                decisionState={states[recommendation.id] ?? 'proposed'}
                canApprove={canApprove}
                onApprove={() =>
                  void record(
                    recommendation.id,
                    'approved',
                    'Approved and recorded with the basis it was decided on.',
                  )
                }
                onRevise={() =>
                  void record(
                    recommendation.id,
                    'revision_requested',
                    'Revision requested. The run has been reopened.',
                  )
                }
                onSave={() => void record(recommendation.id, 'saved', 'Saved to Library.')}
                onDismiss={() =>
                  void record(recommendation.id, 'dismissed', 'Dismissed. The finding stays on record.')
                }
              />
            ))}
          </div>
          <div aria-live="polite" className="min-h-[22px]">
            {problem ? (
              <p className="mt-3 text-[13px] text-bad">{problem}</p>
            ) : notice ? (
              <p className="mt-3 text-[13px] text-good">{notice}</p>
            ) : null}
          </div>
        </section>

        {/* Decision notes */}
        {decisions.length > 0 ? (
          <section aria-labelledby="decisions">
            <SectionHeading id="decisions" title="Decision notes" />
            <ul className="s-panel-subtle mt-5 divide-y divide-line px-5">
              {decisions.map((decision) => (
                <li key={decision.id} className="py-3.5">
                  <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink-950">
                    <span className="font-medium">{decision.by}</span>
                    <StatusBadge
                      tone={
                        decision.outcome === 'approved'
                          ? 'good'
                          : decision.outcome === 'revision_requested'
                            ? 'warn'
                            : 'neutral'
                      }
                    >
                      {decision.outcome.replace('_', ' ')}
                    </StatusBadge>
                    <span className="mono text-[11.5px] text-ink-400">
                      {formatRelative(decision.at, nowIso)}
                    </span>
                  </p>
                  {decision.note ? (
                    <p className="mt-1 text-[13.5px] leading-[20px] text-ink-500">“{decision.note}”</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {/* Sidebar: stages, sources, artifact */}
      <aside className="space-y-6 lg:sticky lg:top-[84px] lg:self-start">
        <div>
          <p className="micro-label mb-2">Run stages</p>
          <RunTimeline run={run} nowIso={nowIso} />
        </div>

        <div className="s-panel px-4 py-4">
          <p className="micro-label">Sources and method</p>
          <dl className="mono mt-2.5 space-y-2 text-[11.5px]">
            {[
              ['Scope', run.scopeLabel],
              ['Range', run.rangeLabel],
              ['Basis', 'Purchase · 7-day click'],
              ['Currency', 'INR'],
              ['Reporting day', 'Asia/Kolkata'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-line/70 pb-1.5">
                <dt className="text-ink-400">{label}</dt>
                <dd className="text-right text-ink-700">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12px] leading-[18px] text-ink-400">
            Northstar US is separated for currency. Retargeting is excluded while its sync is behind.
          </p>
        </div>

        {artifact ? (
          <div className="s-panel px-4 py-4">
            <p className="micro-label">Artifact</p>
            <Link
              href={routes.library(workspaceSlug)}
              className="mt-2 block text-[14px] font-medium text-ink-950 hover:text-helm-600"
            >
              {artifact.title}
            </Link>
            <p className="mt-1 text-[12.5px] leading-[18px] text-ink-500">{artifact.summary}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {exportHref ? (
                <DownloadMenu href={exportHref} label="Download" />
              ) : (
                <Button variant="neutral" size="compact" leading={<IconDownload size={15} />} disabled>
                  Download
                </Button>
              )}
              <Button variant="quiet" size="compact" leading={<IconShare size={15} />}>
                Share
              </Button>
            </div>
          </div>
        ) : null}
      </aside>

      <EvidenceDrawer
        evidence={activeEvidence}
        open={Boolean(activeEvidence)}
        onClose={() => setOpenEvidenceId(null)}
        fullRecordHref={activeEvidence ? routes.evidence(workspaceSlug, activeEvidence.id) : undefined}
      />
    </div>
  );
}
