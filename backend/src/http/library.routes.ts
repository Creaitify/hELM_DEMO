import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import * as repo from '../graph/repository.js';
import type { Artifact } from '../domain/types.js';
import { invalid, notFound, requireCsrf, requireWorkspace, sendError } from './context.js';
import { CREATIVE_LINE, ADVERTISER, PRODUCT } from '../sample/campaigns.js';

/**
 * Library.
 *
 * One artifact home with two modes. Reports are decision memos, saved
 * briefings and exports; Creative is directions, briefs, rendered variants and
 * copy. Creation is contextual — it starts from a finding or a campaign that
 * HELM already understands, never from a blank prompt form.
 */

const CREATE_STARTING_POINTS = [
  { format: 'Meta · 4:5 feed', aspect: '4:5', spec: '1080 × 1350' },
  { format: 'Meta · 9:16 story', aspect: '9:16', spec: '1080 × 1920' },
  { format: 'Meta · 1:1 square', aspect: '1:1', spec: '1080 × 1080' },
  { format: 'Google · 16:9 display', aspect: '16:9', spec: '1920 × 1080' },
] as const;

export async function libraryRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string }; Querystring: { mode?: 'reports' | 'creative'; q?: string } }>(
    '/api/workspaces/:slug/library',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'library.read');
        const artifacts = await repo.listArtifacts(context.workspace.id, request.query.mode);

        const needle = request.query.q?.trim().toLowerCase();
        const filtered = needle
          ? artifacts.filter(
              (artifact) =>
                artifact.title.toLowerCase().includes(needle) ||
                artifact.summary.toLowerCase().includes(needle) ||
                artifact.tags.some((tag) => tag.toLowerCase().includes(needle)),
            )
          : artifacts;

        const findings = await repo.listFindings(context.workspace.id);

        return {
          artifacts: filtered,
          counts: {
            reports: artifacts.filter((artifact) => artifact.mode === 'reports').length,
            creative: artifacts.filter((artifact) => artifact.mode === 'creative').length,
          },
          canCreate: context.can('library.create'),
          canPublish: context.can('library.publish'),
          create: {
            formats: CREATE_STARTING_POINTS,
            startingPoints: findings
              .filter((finding) => finding.severity !== 'stable')
              .slice(0, 4)
              .map((finding) => ({
                findingId: finding.id,
                title: finding.title,
                hint: finding.recommendedNextStep ?? 'Write the decision memo for this finding',
              })),
            inherited: {
              brand: `${ADVERTISER} · ${PRODUCT}`,
              campaignLine: CREATIVE_LINE,
              palette: 'Graphite, frost, deep cobalt, one coral annotation',
              audience: 'Broad prospecting · India',
              objective: 'Sales · purchase',
            },
          },
        };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { slug: string; id: string } }>(
    '/api/workspaces/:slug/library/:id',
    async (request, reply) => {
      try {
        const context = await requireWorkspace(request, request.params.slug, 'library.read');
        const artifact = await repo.getArtifact(request.params.id);
        if (!artifact) throw notFound('That artifact is no longer in the library.');

        const run = artifact.linkedRunId ? await repo.getRun(artifact.linkedRunId) : null;
        return { artifact, run, canPublish: context.can('library.publish') };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.post<{
    Params: { slug: string };
    Body: Partial<Artifact> & { findingId?: string };
  }>('/api/workspaces/:slug/library', async (request, reply) => {
    try {
      requireCsrf(request);
      const context = await requireWorkspace(request, request.params.slug, 'library.create');
      const body = request.body ?? {};
      if (!body.title?.trim()) throw invalid('Give the artifact a title.', 'title');

      const finding = body.findingId ? await repo.getFinding(body.findingId) : null;
      const now = new Date().toISOString();

      const artifact: Artifact = {
        id: `art_${randomUUID().slice(0, 8)}`,
        title: body.title.trim(),
        type: body.type ?? 'creative_direction',
        mode: body.mode ?? 'creative',
        updatedAt: now,
        createdBy: context.user.name,
        status: 'draft',
        summary: body.summary ?? finding?.observation ?? '',
        tags: body.tags ?? [],
        linkedCampaignId: body.linkedCampaignId ?? finding?.affectedCampaignIds[0],
        linkedRunId: body.linkedRunId,
        format: body.format,
        aspect: body.aspect,
        prompt: body.prompt,
        imageUrl: body.imageUrl,
      };

      await repo.upsertArtifact(context.workspace.id, artifact);
      return reply.status(201).send({ artifact });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch<{ Params: { slug: string; id: string }; Body: Partial<Artifact> }>(
    '/api/workspaces/:slug/library/:id',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'library.create');
        const existing = await repo.getArtifact(request.params.id);
        if (!existing) throw notFound('That artifact is no longer in the library.');

        const wantsPublish =
          request.body?.status === 'approved' || request.body?.status === 'in_review';
        if (wantsPublish) context.require('library.publish');

        const artifact: Artifact = {
          ...existing,
          ...request.body,
          id: existing.id,
          updatedAt: new Date().toISOString(),
        };
        await repo.upsertArtifact(context.workspace.id, artifact);
        return { artifact };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.delete<{ Params: { slug: string; id: string } }>(
    '/api/workspaces/:slug/library/:id',
    async (request, reply) => {
      try {
        requireCsrf(request);
        await requireWorkspace(request, request.params.slug, 'library.publish');
        await repo.deleteArtifact(request.params.id);
        return { deleted: true };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { slug: string } }>('/api/workspaces/:slug/timeline', async (request, reply) => {
    try {
      const context = await requireWorkspace(request, request.params.slug, 'analytics.read');
      return { timeline: await repo.listTimeline(context.workspace.id) };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
