import type { FastifyInstance } from 'fastify';
import * as repo from '../graph/repository.js';
import type { Artifact, Finding, IntelligenceRun, Recommendation } from '../domain/types.js';
import { notFound, requireWorkspace, sendError } from './context.js';
import { decisionMemo } from './documents.memo.js';
import { toHtmlDocument, toMarkdown, toWordDocument as blocksToWord } from './documents.blocks.js';
import { toPdf as blocksToPdf } from './documents.pdf.js';

/**
 * Downloads.
 *
 * A decision the product asked somebody to make has to leave the product —
 * into a deck, an email, a board pack. Every report is available as Markdown
 * for writing, HTML for reading, and JSON for anything downstream, and each
 * one carries the basis it was decided on so a figure never travels without
 * the window and the exclusions that produced it.
 */

export type Format = 'md' | 'html' | 'json' | 'csv' | 'pdf' | 'doc';

export const CONTENT_TYPE: Record<Format, string> = {
  md: 'text/markdown; charset=utf-8',
  html: 'text/html; charset=utf-8',
  json: 'application/json; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
  doc: 'application/msword',
};

/** Every format a document can leave the product in, in the order offered. */
export const FORMATS: { id: Format; label: string; detail: string }[] = [
  { id: 'pdf', label: 'PDF', detail: 'For a board pack or an attachment' },
  { id: 'doc', label: 'Word', detail: 'Opens in Word, still editable' },
  { id: 'md', label: 'Markdown', detail: 'For writing and version control' },
  { id: 'html', label: 'HTML', detail: 'For reading in a browser' },
  { id: 'json', label: 'JSON', detail: 'For anything downstream' },
];

export function safeName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'helm-report'
  );
}

function money(value: { currency: string; minorUnits: string } | undefined): string {
  if (!value) return '—';
  const major = Number(value.minorUnits) / 100;
  return `${value.currency} ${major.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export type MemoInput = {
  run: IntelligenceRun;
  findings: Finding[];
  recommendations: Recommendation[];
  decisions: { recommendationId: string; outcome: string; by: string; at: string; note?: string }[];
  artifacts: Artifact[];
  workspaceName: string;
};

export function memoMarkdown(input: MemoInput): string {
  const { run, findings, recommendations, decisions, artifacts } = input;
  const lines: string[] = [];

  lines.push(`# ${run.title}`, '');
  lines.push(`**Workspace** ${input.workspaceName}  `);
  lines.push(`**Account scope** ${run.scopeLabel}  `);
  lines.push(`**Window** ${run.rangeLabel}  `);
  lines.push(`**Requested by** ${run.requestedBy}  `);
  lines.push(`**Status** ${run.stage.replace(/_/g, ' ')}`, '');
  lines.push('## Executive answer', '', run.summary, '');

  if (findings.length) {
    lines.push('## Findings', '');
    for (const finding of findings) {
      lines.push(`### ${finding.title}`, '');
      lines.push(finding.observation, '');
      lines.push(
        `- **Kind** ${finding.kind}`,
        `- **Severity** ${finding.severity}`,
        `- **Confidence** ${finding.confidence} — ${finding.confidenceNote}`,
      );
      if (finding.exposure) {
        lines.push(
          `- **Financial exposure** ${money(finding.exposure.low)} – ${money(finding.exposure.high)} (${finding.exposure.note})`,
        );
      }
      if (finding.recommendedNextStep) lines.push(`- **Next step** ${finding.recommendedNextStep}`);
      lines.push('');
    }
  }

  if (recommendations.length) {
    lines.push('## Recommendations', '');
    for (const entry of recommendations) {
      const decision = decisions.find((row) => row.recommendationId === entry.id);
      lines.push(`### ${entry.action}`, '');
      lines.push(entry.rationale, '');
      lines.push(
        `- **Status** ${decision ? `${decision.outcome.replace(/_/g, ' ')} by ${decision.by}` : entry.status}`,
        `- **Expected** ${entry.expectedRange}`,
        `- **Horizon** ${entry.horizon}`,
        `- **Effort** ${entry.effort} · **Urgency** ${entry.urgency.replace(/_/g, ' ')}`,
      );
      if (entry.cap) lines.push(`- **Cap** ${money(entry.cap)}`);
      if (entry.assumptions.length) lines.push(`- **Assumptions** ${entry.assumptions.join('; ')}`);
      if (entry.risks.length) lines.push(`- **Risks** ${entry.risks.join('; ')}`);
      if (entry.stopConditions.length) lines.push(`- **Stop conditions** ${entry.stopConditions.join('; ')}`);
      lines.push('');
    }
  }

  const basis = findings[0]?.basis;
  if (basis) {
    lines.push('## Basis', '');
    lines.push(
      `- **Window** ${basis.startDateInclusive} to ${basis.endDateInclusive} (complete through ${basis.completeThroughDate})`,
    );
    if (basis.comparisonStartDateInclusive) {
      lines.push(
        `- **Comparison** ${basis.comparisonStartDateInclusive} to ${basis.comparisonEndDateInclusive}`,
      );
    }
    lines.push(`- **Accounts blended** ${basis.accountIds.join(', ') || 'none'}`);
    for (const exclusion of basis.exclusions) lines.push(`- **Excluded** ${exclusion}`);
    lines.push('');
  }

  if (artifacts.length) {
    lines.push('## Linked artifacts', '');
    for (const artifact of artifacts) {
      lines.push(`- **${artifact.title}** — ${artifact.type.replace(/_/g, ' ')}${artifact.format ? ` (${artifact.format})` : ''}`);
    }
    lines.push('');
  }

  lines.push('---', '');
  lines.push(
    '_Produced by HELM. Recommendations are proposals: nothing in this report has been applied to an ad account._',
  );
  return lines.join('\n');
}

function findingsCsv(findings: Finding[], recommendations: Recommendation[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = [
    ['type', 'title', 'detail', 'severity_or_status', 'confidence_or_horizon', 'campaigns'].join(','),
    ...findings.map((finding) =>
      [
        'finding',
        escape(finding.title),
        escape(finding.observation),
        finding.severity,
        finding.confidence,
        escape(finding.affectedCampaignIds.join(' ')),
      ].join(','),
    ),
    ...recommendations.map((entry) =>
      [
        'recommendation',
        escape(entry.action),
        escape(entry.rationale),
        entry.status,
        escape(entry.horizon),
        escape(entry.affectedCampaignIds.join(' ')),
      ].join(','),
    ),
  ];
  return rows.join('\n');
}

export async function exportRoutes(app: FastifyInstance) {
  /** The whole decision memo for one run. */
  app.get<{ Params: { slug: string; id: string }; Querystring: { format?: Format } }>(
    '/api/workspaces/:slug/intelligence/:id/export',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'intelligence.read');
        const run = await repo.getRun(request.params.id);
        if (!run) throw notFound('That investigation no longer exists.');

        const findings = (await Promise.all(run.findingIds.map((id) => repo.getFinding(id)))).filter(
          (entry): entry is Finding => Boolean(entry),
        );
        const recommendations = (
          await Promise.all(run.recommendationIds.map((id) => repo.getRecommendation(id)))
        ).filter((entry): entry is Recommendation => Boolean(entry));
        const decisions = await repo.listDecisions(run.id);
        const artifacts = (await repo.listArtifacts(context.workspace.id)).filter(
          (artifact) => artifact.linkedRunId === run.id,
        );

        const input: MemoInput = {
          run,
          findings,
          recommendations,
          decisions,
          artifacts,
          workspaceName: context.workspace.name,
        };

        const format = (request.query.format ?? 'md') as Format;
        const filename = `${safeName(run.title)}-${run.id}.${format}`;

        // The same block structure the Documents shelf renders, so a memo
        // exported from a run and one downloaded from the shelf are the same
        // document rather than two builders drifting apart.
        const doc = decisionMemo(input);
        const payload =
          format === 'json'
            ? JSON.stringify({ run, findings, recommendations, decisions, artifacts }, null, 2)
            : format === 'html'
              ? toHtmlDocument(doc)
              : format === 'csv'
                ? findingsCsv(findings, recommendations)
                : format === 'pdf'
                  ? blocksToPdf(doc)
                  : format === 'doc'
                    ? blocksToWord(doc)
                    : toMarkdown(doc);

        return reply
          .header('content-type', CONTENT_TYPE[format] ?? CONTENT_TYPE.md)
          .header('content-disposition', `attachment; filename="${filename}"`)
          .header('cache-control', 'no-store')
          .send(payload);
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /** A single library artifact, in the format that suits what it holds. */
  app.get<{ Params: { slug: string; id: string }; Querystring: { format?: Format } }>(
    '/api/workspaces/:slug/library/:id/export',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'library.read');
        const artifact = await repo.getArtifact(request.params.id);
        if (!artifact) throw notFound('That artifact is no longer in the library.');

        // A memo artifact exports the run behind it, so the download is the
        // report rather than the row that points at it.
        if (artifact.linkedRunId && artifact.type === 'decision_memo') {
          const format = request.query.format ?? 'md';
          return reply.redirect(
            `/api/workspaces/${context.workspace.slug}/intelligence/${artifact.linkedRunId}/export?format=${format}`,
          );
        }

        const filename = `${safeName(artifact.title)}-${artifact.id}.json`;
        return reply
          .header('content-type', CONTENT_TYPE.json)
          .header('content-disposition', `attachment; filename="${filename}"`)
          .header('cache-control', 'no-store')
          .send(JSON.stringify(artifact, null, 2));
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /** The current briefing as a portable snapshot. */
  app.get<{ Params: { slug: string }; Querystring: { format?: Format } }>(
    '/api/workspaces/:slug/briefing/export',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'analytics.read');
        const [findings, campaigns] = await Promise.all([
          repo.listFindings(context.workspace.id),
          repo.listCampaigns(context.workspace.id),
        ]);

        const format = (request.query.format ?? 'csv') as Format;
        const filename = `${safeName(context.workspace.name)}-briefing.${format}`;

        const payload =
          format === 'json'
            ? JSON.stringify({ workspace: context.workspace, findings, campaigns }, null, 2)
            : format === 'csv'
              ? [
                  ['campaign', 'provider', 'status', 'spend', 'conversions', 'cpa', 'roas', 'delta_cpa'].join(','),
                  ...campaigns.map((campaign) =>
                    [
                      `"${campaign.name.replace(/"/g, '""')}"`,
                      campaign.provider,
                      campaign.status,
                      campaign.spend,
                      campaign.conversions,
                      campaign.cpa ?? '',
                      campaign.roas ?? '',
                      campaign.deltaCpa ?? '',
                    ].join(','),
                  ),
                ].join('\n')
              : findings.map((finding) => `## ${finding.title}\n\n${finding.observation}\n`).join('\n');

        return reply
          .header('content-type', CONTENT_TYPE[format] ?? CONTENT_TYPE.csv)
          .header('content-disposition', `attachment; filename="${filename}"`)
          .header('cache-control', 'no-store')
          .send(payload);
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );
}
