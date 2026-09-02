import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AdAccount, Evidence, Finding, IntelligenceRun } from '@/contracts';
import { PageShell } from '@/components/shell/AppShell';
import { MetricChart, SERIES_COLORS } from '@/components/data/MetricChart';
import { CampaignTag } from '@/components/data/CampaignTag';
import { KindMarker, StatusBadge } from '@/components/primitives/Status';
import { SectionHeading } from '@/components/primitives/States';
import { IconArrowRight, IconChevronLeft, ProviderMark } from '@/components/icons';
import { routes } from '@/lib/routes';
import { formatDateRange } from '@/lib/format';
import { getEvidenceRecord } from '@/services/http/queries';
import {
  accounts as sampleAccounts,
  campaignById,
  evidence,
  evidenceById,
  findings as sampleFindings,
  runs as sampleRuns,
} from '@/services/mock';
import { cn } from '@/lib/cn';

/**
 * The durable address for one evidence record.
 *
 * The drawer beside a finding is the quick look. This is the thing you can
 * link to, cite in a message, or come back to a week later — so it carries the
 * whole record: every row, the method, the basis it was measured on, what was
 * excluded, which accounts it came from, and which findings rest on it.
 */

type EvidenceRecord = {
  evidence: Evidence;
  findings: Finding[];
  accounts: AdAccount[];
  runs: IntelligenceRun[];
};

/** Live first, fixtures behind it, exactly as every other read on this shell. */
async function readRecord(slug: string, id: string): Promise<EvidenceRecord | null> {
  const live = await getEvidenceRecord(slug, id);
  if (live.ok) return live.data;

  const evidence = evidenceById(id);
  if (!evidence) return null;

  const findings = sampleFindings.filter((finding) => finding.evidenceIds.includes(id));
  const accountIds = new Set([
    ...evidence.basis.accountIds,
    ...findings.flatMap((finding) => finding.sourceAccountIds),
  ]);
  return {
    evidence,
    findings,
    accounts: sampleAccounts.filter((account) => accountIds.has(account.id)),
    runs: sampleRuns.filter((run) => run.findingIds.some((findingId) => findings.some((f) => f.id === findingId))),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const evidence = evidenceById(id);
  return { title: evidence ? evidence.title : 'Evidence record' };
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
  return evidence.map((entry) => ({ id: entry.id }));
}

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const record = await readRecord(workspaceSlug, id);
  if (!record) notFound();

  const { evidence, findings, accounts, runs } = record;
  const window = formatDateRange(evidence.basis.startDateInclusive, evidence.basis.endDateInclusive);

  return (
    <PageShell
      title={evidence.title}
      context={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <KindMarker kind={evidence.kind} />
          <span className="mono text-[12.5px] text-ink-500">{window}</span>
          <span className="h-3.5 w-px bg-line" aria-hidden="true" />
          <span className="mono text-[12.5px] text-ink-400">{evidence.id}</span>
        </div>
      }
      actions={
        <StatusBadge tone={findings.length > 0 ? 'info' : 'neutral'}>
          {findings.length} {findings.length === 1 ? 'finding cites this' : 'findings cite this'}
        </StatusBadge>
      }
    >
      <Link
        href={routes.briefing(workspaceSlug)}
        className="mb-5 inline-flex h-11 items-center gap-1 text-[13.5px] text-ink-500 transition-colors hover:text-ink-950 md:h-auto"
      >
        <IconChevronLeft size={16} />
        Back to the briefing
      </Link>

      <div className="space-y-9">
        <p className="max-w-prose text-[15.5px] leading-[25px] text-ink-700">{evidence.summary}</p>

        {evidence.series ? (
          <div className="s-panel px-5 py-5">
            <MetricChart
              question={evidence.title}
              basis={`${window} · as reported by the source platform`}
              metric={evidence.series.metric}
              series={[
                { label: 'Observed', points: evidence.series.points, color: SERIES_COLORS.primary, fill: true },
              ]}
              annotations={evidence.series.annotations}
            />
          </div>
        ) : null}

        <section aria-labelledby="record" className="scroll-mt-24">
          <SectionHeading id="record" title="The record" hint="Every row behind the claim, as measured." />
          <dl className="s-panel mt-5 divide-y divide-line">
            {evidence.rows.map((row, index) => (
              <div
                key={`${row.label}-${index}`}
                className="grid gap-1 px-5 py-3.5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:gap-6 sm:px-6"
              >
                <dt className="text-[13px] text-ink-500">{row.label}</dt>
                <dd>
                  <span
                    className={cn(
                      'text-[14px] text-ink-950',
                      row.mono && 'mono',
                      row.tone === 'good' && 'text-good',
                      row.tone === 'warn' && 'text-warn',
                      row.tone === 'bad' && 'text-bad',
                    )}
                  >
                    {row.value}
                  </span>
                  {row.detail ? (
                    <span className="mt-0.5 block text-[12.5px] leading-[18px] text-ink-400">{row.detail}</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {evidence.method ? (
          <section aria-labelledby="method" className="scroll-mt-24">
            <SectionHeading id="method" title="Method" hint="How the figures above were produced." />
            <p className="mt-4 max-w-prose text-[14.5px] leading-[23px] text-ink-700">{evidence.method}</p>
          </section>
        ) : null}

        <section aria-labelledby="basis" className="scroll-mt-24">
          <SectionHeading
            id="basis"
            title="Basis"
            hint="The window, the accounts, and everything deliberately left out."
          />
          <div className="s-panel-subtle mt-5 px-5 py-5 sm:px-6">
            <dl className="mono grid gap-x-8 gap-y-3 text-[12.5px] sm:grid-cols-2">
              <BasisRow label="Window" value={`${window} inclusive`} />
              {evidence.basis.comparisonStartDateInclusive ? (
                <BasisRow
                  label="Comparison"
                  value={formatDateRange(
                    evidence.basis.comparisonStartDateInclusive,
                    evidence.basis.comparisonEndDateInclusive ?? evidence.basis.comparisonStartDateInclusive,
                  )}
                />
              ) : null}
              <BasisRow label="Complete through" value={evidence.basis.completeThroughDate} />
              <BasisRow
                label="Aggregation"
                value={
                  evidence.basis.aggregation.state === 'compatible'
                    ? 'Compatible — same currency and reporting day'
                    : evidence.basis.aggregation.state === 'converted'
                      ? `Converted to ${evidence.basis.aggregation.reportingCurrency}`
                      : 'Separated — shown side by side, never summed'
                }
              />
            </dl>

            {accounts.length > 0 ? (
              <div className="mt-5 border-t border-line pt-4">
                <p className="micro-label">Source accounts</p>
                <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                  {accounts.map((account) => (
                    <li key={account.id} className="flex items-center gap-2 text-[13.5px] text-ink-950">
                      <ProviderMark provider={account.provider} size={15} />
                      <span className="min-w-0 truncate">{account.name}</span>
                      <span className="mono shrink-0 text-[11.5px] text-ink-400">{account.nativeId}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {evidence.basis.exclusions.length > 0 ? (
              <div className="mt-5 border-t border-line pt-4">
                <p className="micro-label">Excluded</p>
                <ul className="mt-2.5 space-y-1.5">
                  {evidence.basis.exclusions.map((exclusion) => (
                    <li key={exclusion} className="flex gap-2 text-[13px] leading-[20px] text-ink-700">
                      <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-ink-400" aria-hidden="true" />
                      {exclusion}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="cited-by" className="scroll-mt-24">
          <SectionHeading
            id="cited-by"
            title="What rests on this"
            hint="A record is only as consequential as the claims that cite it."
          />
          {findings.length === 0 ? (
            <p className="mt-4 text-[14px] text-ink-500">
              Nothing cites this record in the current window. It stays readable so the figures behind a
              retired finding do not disappear with it.
            </p>
          ) : (
            <ul className="s-panel mt-5 divide-y divide-line">
              {findings.map((finding) => {
                const run = runs.find((entry) => entry.findingIds.includes(finding.id));
                return (
                  <li key={finding.id} className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={
                          finding.severity === 'decision'
                            ? 'bad'
                            : finding.severity === 'watch'
                              ? 'warn'
                              : 'good'
                        }
                      >
                        {finding.severity === 'decision'
                          ? 'Needs a decision'
                          : finding.severity === 'watch'
                            ? 'Worth watching'
                            : 'Stable'}
                      </StatusBadge>
                      {finding.affectedCampaignIds.map((campaignId) => (
                        <CampaignTag
                          key={campaignId}
                          campaignId={campaignId}
                          name={campaignById(campaignId)?.name ?? campaignId}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-[14.5px] leading-[21px] text-ink-950">{finding.title}</p>
                    {run ? (
                      <Link
                        href={routes.run(workspaceSlug, run.id)}
                        className="mono mt-2 inline-flex items-center gap-1.5 text-[12px] text-helm-600 hover:underline"
                      >
                        {run.title}
                        <IconArrowRight size={14} />
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function BasisRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-right text-ink-700">{value}</dd>
    </div>
  );
}
