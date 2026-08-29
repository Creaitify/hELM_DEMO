import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import * as repo from '../graph/repository.js';
import type { Artifact, Finding, MetricValue, Recommendation } from '../domain/types.js';
import { invalid, notFound, requireCsrf, requireWorkspace, sendError } from './context.js';
import { deriveAnalytics, resolveBasis } from './analytics.routes.js';
import { campaignReportMarkdown, campaignReportTitle, type CampaignReportInput } from './documents.report.js';
import { DEFAULT_SCOPE_ID, WINDOW_LABEL } from '../sample/constants.js';
import { scoreline as sampleScoreline } from '../sample/scoreline.js';
import {
  CONTENT_TYPE,
  FORMATS,
  memoMarkdown,
  safeName,
  type Format,
  type MemoInput,
} from './export.routes.js';
import { markdownToHtml, toPdf, toWordDocument } from './documents.render.js';

/**
 * Documents.
 *
 * The library holds two kinds of thing that behave nothing alike. A generated
 * image is looked at; a decision memo is read, cited and handed to somebody who
 * was not in the room. Keeping both behind one tab meant neither got the
 * treatment it needed, so documents now have their own surface.
 *
 * A document is written from what the fleet actually found. It is not a
 * summary composed here from scratch — it is the run, its findings, its
 * recommendations and the decisions taken on them, rendered as prose and then
 * frozen, so the memo says what was true when it was written even after the
 * next run changes the numbers.
 */

/** Everything needed to write a memo about one run. */
async function memoInputFor(workspaceId: string, workspaceName: string, runId: string): Promise<MemoInput> {
  const run = await repo.getRun(runId);
  if (!run) throw notFound('That investigation no longer exists.');

  const findings = (await Promise.all(run.findingIds.map((id) => repo.getFinding(id)))).filter(
    (entry): entry is Finding => Boolean(entry),
  );
  const recommendations = (
    await Promise.all(run.recommendationIds.map((id) => repo.getRecommendation(id)))
  ).filter((entry): entry is Recommendation => Boolean(entry));
  const decisions = await repo.listDecisions(run.id);
  const artifacts = (await repo.listArtifacts(workspaceId)).filter(
    (artifact) => artifact.linkedRunId === run.id,
  );

  return { run, findings, recommendations, decisions, artifacts, workspaceName };
}

/**
 * The document's own text.
 *
 * Memos written before documents had a body carry only a one-line summary, and
 * downloading one produced a ninety-byte "memo" that looked like a real
 * deliverable until somebody opened it. When a document has no stored body but
 * names the run it came from, it is written from that run on demand — the same
 * builder, the same prose — so every memo on the shelf is a whole document.
 */
async function bodyOf(workspaceId: string, workspaceName: string, document: Artifact): Promise<string> {
  if (document.content?.trim()) return document.content;

  if (document.linkedRunId) {
    try {
      return memoMarkdown(await memoInputFor(workspaceId, workspaceName, document.linkedRunId));
    } catch {
      // The run has been deleted since. The summary is all that is left, and
      // saying so beats handing over a document that pretends to be complete.
    }
  }

  return [
    `# ${document.title}`,
    '',
    document.summary,
    '',
    '---',
    '',
    '_This artifact predates stored document bodies and the investigation behind it is no longer available, so only its summary survives._',
  ].join('\n');
}

/** Renders a document into the format asked for. */
function render(
  document: Artifact,
  markdown: string,
  format: Format,
): { body: string | Buffer; contentType: string } {
  if (format === 'pdf') {
    return { body: toPdf(markdown), contentType: CONTENT_TYPE.pdf };
  }
  if (format === 'doc') {
    return { body: toWordDocument(document.title, markdownToHtml(markdown)), contentType: CONTENT_TYPE.doc };
  }
  if (format === 'html') {
    return {
      body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${document.title}</title></head><body>${markdownToHtml(markdown)}</body></html>`,
      contentType: CONTENT_TYPE.html,
    };
  }
  if (format === 'json') {
    return { body: JSON.stringify(document, null, 2), contentType: CONTENT_TYPE.json };
  }
  return { body: markdown, contentType: CONTENT_TYPE.md };
}

/**
 * Everything the campaign performance report is written from.
 *
 * It reads the same analysis the briefing reads, through the same resolver, so
 * the document and the screen can never disagree about what the account did.
 */
async function campaignReportInput(
  workspaceId: string,
  workspaceName: string,
  defaultCurrency: string,
  preparedBy: string,
  scopeId: string,
): Promise<CampaignReportInput> {
  const { snapshot, basis } = await resolveBasis(workspaceId, scopeId);
  const currency = basis.accountBasis[0]?.currency ?? defaultCurrency;

  const [accounts, campaigns, creatives, findings, derived] = await Promise.all([
    repo.listAccounts(workspaceId),
    repo.listCampaigns(workspaceId),
    repo.listCreatives(workspaceId),
    repo.listFindings(workspaceId),
    deriveAnalytics(workspaceId, basis, currency),
  ]);

  const inScopeAccounts = accounts.filter((account) => snapshot.accountIds.includes(account.id));
  const inScopeCampaigns = campaigns.filter((campaign) => snapshot.accountIds.includes(campaign.accountId));
  const campaignIds = new Set(inScopeCampaigns.map((campaign) => campaign.id));

  // Only the proposals attached to findings this report actually discusses.
  const reported = findings.slice(0, 8);
  const recommendations = (
    await Promise.all(reported.map((finding) => repo.listRecommendations(finding.id)))
  ).flat();

  return {
    workspaceName,
    scopeLabel: snapshot.label,
    rangeLabel: WINDOW_LABEL,
    currency,
    basis,
    accounts: inScopeAccounts,
    campaigns: inScopeCampaigns,
    creatives: creatives.filter((creative) => campaignIds.has(creative.campaignId)),
    scoreline: (derived?.scoreline ?? sampleScoreline) as MetricValue[],
    findings: reported,
    recommendations,
    measured: derived !== null,
    preparedBy,
    preparedAt: new Date().toISOString(),
  };
}

/**
 * What the shelf itself says.
 *
 * A shelf of documents is a record of how much of the fleet's work has
 * actually been written down and handed over, which is a different question
 * from how much work it did. These are the four numbers that answer it, and
 * every one is counted rather than modelled.
 */
function documentAnalytics(documents: Artifact[], runs: { id: string; stage: string }[]) {
  const written = new Set(documents.map((document) => document.linkedRunId).filter(Boolean));
  const finished = runs.filter((run) => run.stage === 'complete');

  const byStatus = documents.reduce<Record<string, number>>(
    (counts, document) => ({ ...counts, [document.status]: (counts[document.status] ?? 0) + 1 }),
    {},
  );

  const words = documents.reduce(
    (total, document) => total + (document.content?.trim().split(/\s+/).filter(Boolean).length ?? 0),
    0,
  );

  const latest = documents
    .map((document) => Date.parse(document.updatedAt))
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => b - a)[0];

  return {
    total: documents.length,
    byStatus,
    words,
    /** Finished investigations that nobody has written up yet. */
    unwrittenRuns: finished.filter((run) => !written.has(run.id)).length,
    coverage: finished.length ? Math.round((finished.filter((run) => written.has(run.id)).length / finished.length) * 100) : null,
    lastWrittenAt: latest ? new Date(latest).toISOString() : null,
  };
}

export async function documentRoutes(app: FastifyInstance) {
  /**
   * The documents shelf, and what could be written next.
   *
   * The runs come back with it because the question "what can I write?" is
   * the same question as "what has the fleet finished?" — asking the client to
   * make two calls to find that out would be an arbitrary separation.
   */
  app.get<{ Params: { slug: string } }>('/api/workspaces/:slug/documents', async (request, reply) => {
    try {
      const context = await requireWorkspace(request, request.params.slug, 'library.read');
      const [artifacts, runs] = await Promise.all([
        repo.listArtifacts(context.workspace.id, 'reports'),
        repo.listRuns(context.workspace.id),
      ]);

      const writtenFor = new Set(artifacts.map((artifact) => artifact.linkedRunId).filter(Boolean));

      // Bodies are resolved for the shelf too, so opening one to read never
      // shows a summary where the document should be.
      const documents = await Promise.all(
        artifacts.map(async (artifact) => ({
          ...artifact,
          content: await bodyOf(context.workspace.id, context.workspace.name, artifact),
        })),
      );

      return {
        documents,
        formats: FORMATS,
        canWrite: context.can('library.create'),
        canPublish: context.can('library.publish'),
        analytics: documentAnalytics(documents, runs),
        /** Only a finished run has a conclusion worth writing down. */
        sources: runs
          .filter((run) => run.stage === 'complete' || run.stage === 'waiting_for_approval')
          .map((run) => ({
            id: run.id,
            title: run.title,
            stage: run.stage,
            rangeLabel: run.rangeLabel,
            scopeLabel: run.scopeLabel,
            findingCount: run.findingIds.length,
            alreadyWritten: writtenFor.has(run.id),
          })),
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  /** Writes the memo for a run and files it on the shelf. */
  app.post<{ Params: { slug: string }; Body: { runId?: string; title?: string } }>(
    '/api/workspaces/:slug/documents',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'library.create');

        const runId = request.body?.runId;
        if (!runId) throw invalid('Choose the investigation to write up.', 'runId');

        const input = await memoInputFor(context.workspace.id, context.workspace.name, runId);
        const markdown = memoMarkdown(input);

        const document: Artifact = {
          id: `art_doc_${randomUUID().slice(0, 8)}`,
          title: request.body?.title?.trim() || `Decision memo — ${input.run.title}`,
          type: 'decision_memo',
          mode: 'reports',
          updatedAt: new Date().toISOString(),
          createdBy: context.user.name,
          status: 'draft',
          summary: input.run.summary.slice(0, 240),
          linkedRunId: input.run.id,
          tags: [
            input.run.scopeLabel,
            `${input.findings.length} findings`,
            ...(input.recommendations.length ? [`${input.recommendations.length} recommendations`] : []),
          ],
          format: 'Markdown',
          // Frozen at the moment of writing. A memo that silently re-rendered
          // against later data would misreport what was decided and when.
          content: markdown,
        };

        await repo.upsertArtifact(context.workspace.id, document);
        await repo.recordAudit(context.workspace.id, {
          id: `aud_${randomUUID().slice(0, 8)}`,
          at: new Date().toISOString(),
          actor: context.user.name,
          action: 'wrote a document',
          target: document.title,
          context: `From ${input.run.title}`,
        });

        return reply.status(201).send({ document });
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /**
   * Writes the campaign performance report.
   *
   * The other writer needs an investigation to write up. This one needs
   * nothing but the account: it is the standing report on what the analysis
   * already says, which is the document somebody has to produce on a Monday
   * whether or not the fleet has been asked a question that week.
   */
  app.post<{ Params: { slug: string }; Body: { scopeId?: string; title?: string } }>(
    '/api/workspaces/:slug/documents/campaign-report',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'library.create');

        const input = await campaignReportInput(
          context.workspace.id,
          context.workspace.name,
          context.workspace.defaultCurrency,
          context.user.name,
          request.body?.scopeId ?? DEFAULT_SCOPE_ID,
        );
        const markdown = campaignReportMarkdown(input);

        const decisionGrade = input.findings.filter((finding) => finding.severity === 'decision').length;

        const document: Artifact = {
          id: `art_report_${randomUUID().slice(0, 8)}`,
          title: request.body?.title?.trim() || campaignReportTitle(input),
          type: 'decision_memo',
          mode: 'reports',
          updatedAt: new Date().toISOString(),
          createdBy: context.user.name,
          status: 'draft',
          summary:
            `${input.campaigns.length} campaigns, ${input.findings.length} findings` +
            `${decisionGrade ? `, ${decisionGrade} needing a decision` : ''}. ` +
            `${input.measured ? 'Folded from stored measurements' : 'Sample portfolio'} over ${input.rangeLabel}.`,
          tags: [
            input.scopeLabel,
            'Campaign performance',
            `${input.campaigns.length} campaigns`,
            ...(input.measured ? ['Measured'] : ['Sample data']),
          ],
          format: 'Markdown',
          // Frozen at the moment of writing, like every other document here.
          content: markdown,
        };

        await repo.upsertArtifact(context.workspace.id, document);
        await repo.recordAudit(context.workspace.id, {
          id: `aud_${randomUUID().slice(0, 8)}`,
          at: new Date().toISOString(),
          actor: context.user.name,
          action: 'wrote a campaign performance report',
          target: document.title,
          context: `${input.campaigns.length} campaigns over ${input.rangeLabel}`,
        });

        return reply.status(201).send({ document });
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /**
   * The report as it would be written right now, without filing it.
   *
   * Writing a document is a commitment — it goes on the shelf, it lands in the
   * audit, and it is frozen. Being able to read it first is what makes that a
   * decision rather than a gamble.
   */
  app.get<{ Params: { slug: string }; Querystring: { scopeId?: string } }>(
    '/api/workspaces/:slug/documents/campaign-report/preview',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'library.read');
        const input = await campaignReportInput(
          context.workspace.id,
          context.workspace.name,
          context.workspace.defaultCurrency,
          context.user.name,
          request.query.scopeId ?? DEFAULT_SCOPE_ID,
        );
        const markdown = campaignReportMarkdown(input);
        return {
          title: campaignReportTitle(input),
          markdown,
          html: markdownToHtml(markdown),
          formats: FORMATS,
          measured: input.measured,
          campaignCount: input.campaigns.length,
          findingCount: input.findings.length,
        };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /** One document, in the format the reader needs it in. */
  app.get<{ Params: { slug: string; id: string }; Querystring: { format?: Format } }>(
    '/api/workspaces/:slug/documents/:id/download',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'library.read');
        const document = await repo.getArtifact(request.params.id);
        if (!document || document.mode !== 'reports') throw notFound('That document no longer exists.');

        const format = (request.query.format ?? 'pdf') as Format;
        if (!FORMATS.some((entry) => entry.id === format)) {
          throw invalid('That is not a format this document can be written in.', 'format');
        }

        const markdown = await bodyOf(context.workspace.id, context.workspace.name, document);
        const { body, contentType } = render(document, markdown, format);

        return reply
          .header('content-type', contentType)
          .header(
            'content-disposition',
            `attachment; filename="${safeName(document.title)}.${format}"`,
          )
          .send(body);
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /** The document as the reader sees it on screen, without downloading it. */
  app.get<{ Params: { slug: string; id: string } }>(
    '/api/workspaces/:slug/documents/:id',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'library.read');
        const document = await repo.getArtifact(request.params.id);
        if (!document || document.mode !== 'reports') throw notFound('That document no longer exists.');

        const markdown = await bodyOf(context.workspace.id, context.workspace.name, document);
        return { document: { ...document, content: markdown }, formats: FORMATS, html: markdownToHtml(markdown) };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );
}
