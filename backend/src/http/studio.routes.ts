import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';
import * as repo from '../graph/repository.js';
import type { Artifact, BrandKit, Finding } from '../domain/types.js';
import { generateImage, imageProviderName, type GenerateImageInput } from '../providers/images.js';
import { reasonJson } from '../providers/anthropic.js';
import { AGENTS } from '../agents/registry.js';
import { readStudioAsset, storeStudioAsset } from '../studio/assets.js';
import { invalid, requireCsrf, requireWorkspace, sendError } from './context.js';
import { ADVERTISER, CREATIVE_LINE, PRODUCT } from '../sample/campaigns.js';
import { resolveBrandKit } from '../domain/brand.js';

/**
 * The image studio.
 *
 * Reached from the creative side of the library, never as a standalone toy.
 * A generation always inherits something HELM already understands — a finding,
 * a campaign, or the brand guidance — and the result is written back to the
 * library as an artifact, so a generated image is a first-class object with
 * provenance rather than a download.
 */

const ASPECTS: GenerateImageInput['aspect'][] = ['1:1', '4:5', '9:16', '16:9'];
const DIRECTIONS = ['product-proof', 'field-use', 'typographic', 'evidence'] as const;

/**
 * One entry per distinct statement, measured through the latest date.
 *
 * Findings carry no timestamp of their own, so the end of the window a finding
 * was computed on is the closest thing to when it was true — which is also the
 * right tiebreak, since the newest window is the one still worth answering.
 */
function dedupeByTitle(findings: Finding[]): Finding[] {
  const best = new Map<string, Finding>();
  for (const finding of findings) {
    const key = finding.title.trim().toLowerCase();
    const held = best.get(key);
    if (!held || finding.basis.endDateInclusive > held.basis.endDateInclusive) {
      best.set(key, finding);
    }
  }
  return [...best.values()];
}



const PRESETS = [
  { id: 'meta_feed', label: 'Meta · 4:5 feed', aspect: '4:5', spec: '1080 × 1350', channel: 'Meta Ads' },
  { id: 'meta_story', label: 'Meta · 9:16 story', aspect: '9:16', spec: '1080 × 1920', channel: 'Meta Ads' },
  { id: 'meta_square', label: 'Meta · 1:1 square', aspect: '1:1', spec: '1080 × 1080', channel: 'Meta Ads' },
  { id: 'google_display', label: 'Google · 16:9 display', aspect: '16:9', spec: '1920 × 1080', channel: 'Google Ads' },
] as const;

export async function studioRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>('/api/workspaces/:slug/studio', async (request, reply) => {
    try {
      const context = await requireWorkspace(request, request.params.slug, 'library.read');
      const [findings, campaigns, creatives, artifacts, brandKits] = await Promise.all([
        repo.listFindings(context.workspace.id),
        repo.listCampaigns(context.workspace.id),
        repo.listCreatives(context.workspace.id),
        repo.listArtifacts(context.workspace.id, 'creative'),
        repo.listBrandKits(context.workspace.id),
      ]);
      const activeKit = await resolveBrandKit(context.workspace.id);

      const provider = imageProviderName();

      return {
        canGenerate: context.can('studio.generate'),
        provider: {
          key: provider,
          label:
            provider === 'gemini'
              ? env.images.geminiModel
              : provider === 'openai'
                ? env.images.openaiModel
                : 'HELM studio renderer',
          live: provider !== 'studio-render',
          note:
            provider === 'studio-render'
              ? 'No image model key is configured. The studio renderer composes the brief locally in the campaign palette; set IMAGE_PROVIDER and its key to generate with a model.'
              : 'Generating with a live image model.',
        },
        director: { name: AGENTS.creative.name, gate: AGENTS.creative.gate },
        presets: PRESETS,
        directions: DIRECTIONS,
        brand: {
          advertiser: activeKit.advertiser,
          product: activeKit.product,
          campaignLine: activeKit.campaignLine,
          palette: activeKit.palette,
          audience: activeKit.audience,
          objective: activeKit.objective,
        },
        brandKits: brandKits.length ? brandKits : [activeKit],
        activeBrandKitId: activeKit.id,
        canEditBrand: context.can('library.publish'),
        /*
         * A starting point is something to answer, not a run's record of it.
         *
         * Every run that looks at the account restates the findings that are
         * still true, so listing findings raw offers the same two problems
         * five times over and reads as five different choices. They are folded
         * by what they say, keeping the statement measured through the latest
         * date, so the list is as long as the number of real problems.
         */
        startingPoints: dedupeByTitle(findings.filter((finding) => finding.severity !== 'stable'))
          .slice(0, 5)
          .map((finding) => ({
            findingId: finding.id,
            title: finding.title,
            hint: finding.recommendedNextStep ?? 'Brief a replacement direction',
            campaignId: finding.affectedCampaignIds[0],
          })),
        fatiguedCreatives: creatives
          .filter((creative) => creative.fatigue !== 'healthy')
          .map((creative) => ({
            id: creative.id,
            name: creative.name,
            campaignId: creative.campaignId,
            frequency: creative.frequency,
            note: creative.note,
          })),
        campaigns: campaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          provider: campaign.provider,
        })),
        recent: artifacts.filter((artifact) => Boolean(artifact.imageUrl)).slice(0, 12),
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  /** The brand kits a workspace has defined, for the surface that edits them. */
  app.get<{ Params: { slug: string } }>('/api/workspaces/:slug/brand-kits', async (request, reply) => {
    try {
      const context = await requireWorkspace(request, request.params.slug, 'library.read');
      const kits = await repo.listBrandKits(context.workspace.id);
      return {
        // A workspace that has never defined one still needs something to
        // edit, so the stand-in is offered rather than an empty page.
        kits: kits.length ? kits : [await resolveBrandKit(context.workspace.id)],
        canEdit: context.can('library.publish'),
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  /**
   * Saves a brand kit.
   *
   * Publishing rights, not generation rights: changing the guidance changes
   * every image the workspace makes afterwards, which is a different kind of
   * decision from asking for one picture.
   */
  app.put<{ Params: { slug: string }; Body: Partial<BrandKit> & { id?: string } }>(
    '/api/workspaces/:slug/brand-kits',
    async (request, reply) => {
      try {
        requireCsrf(request);
        const context = await requireWorkspace(request, request.params.slug, 'library.publish');
        const body = request.body ?? {};

        const name = body.name?.trim();
        if (!name) throw invalid('Give the brand kit a name.', 'name');

        const existing = body.id && body.id !== 'brand_sample' ? await repo.getBrandKit(body.id) : null;
        const kits = await repo.listBrandKits(context.workspace.id);

        const kit: BrandKit = {
          id: existing?.id ?? `brand_${randomUUID().slice(0, 8)}`,
          workspaceId: context.workspace.id,
          name,
          advertiser: body.advertiser?.trim() || existing?.advertiser || ADVERTISER,
          product: body.product?.trim() || existing?.product || PRODUCT,
          campaignLine: body.campaignLine?.trim() || existing?.campaignLine || CREATIVE_LINE,
          palette: body.palette?.trim() || existing?.palette || 'Graphite, frost, deep cobalt, one warm coral annotation',
          audience: body.audience?.trim() || existing?.audience || 'Broad prospecting · India',
          objective: body.objective?.trim() || existing?.objective || 'Sales · purchase',
          guardrails: (body.guardrails ?? existing?.guardrails ?? [])
            .map((rule) => String(rule).trim())
            .filter(Boolean)
            .slice(0, 12),
          // The first kit a workspace defines is the one everything inherits.
          isDefault: body.isDefault ?? existing?.isDefault ?? kits.length === 0,
          updatedAt: new Date().toISOString(),
        };

        await repo.upsertBrandKit(context.workspace.id, kit);
        await repo.recordAudit(context.workspace.id, {
          id: `aud_${randomUUID().slice(0, 8)}`,
          at: kit.updatedAt,
          actor: context.user.name,
          action: existing ? 'updated a brand kit' : 'created a brand kit',
          target: kit.name,
          context: `${kit.advertiser} · ${kit.product}`,
        });

        return { kit, kits: await repo.listBrandKits(context.workspace.id) };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  /**
   * Writes the brief before it draws it.
   *
   * The creative director turns a finding, a campaign and the brand guidance
   * into a headline, a subline and an art direction. The user can edit every
   * field before generating, so the model proposes and the human decides.
   */
  app.post<{
    Params: { slug: string };
    Body: { findingId?: string; campaignId?: string; note?: string; preset?: string; brandKitId?: string };
  }>('/api/workspaces/:slug/studio/brief', async (request, reply) => {
    try {
      requireCsrf(request);
      const context = await requireWorkspace(request, request.params.slug, 'studio.generate');

      const kit = await resolveBrandKit(context.workspace.id, request.body?.brandKitId);
      const finding = request.body?.findingId ? await repo.getFinding(request.body.findingId) : null;
      const creatives = await repo.listCreatives(context.workspace.id, request.body?.campaignId);
      const fatigued = creatives.filter((creative) => creative.fatigue !== 'healthy');

      const fallback = {
        title: finding ? `Replacement for ${finding.title.toLowerCase()}` : 'Cold proof, stated plainly',
        headline: '18 hours cold',
        subline: 'Measured, not claimed.',
        direction: 'product-proof' as const,
        rationale: finding
          ? `Answers “${finding.title}” with the one product claim the audience has not been shown twice.`
          : 'Leads with the single measurable product claim rather than a lifestyle scene.',
        prompt: `Editorial paid-social still for ${kit.advertiser} ${kit.product}. Cold-retention proof, hard crop, low horizon, deep cobalt field with a single warm coral annotation rule.`,
      };

      // Built above the template so the rules read as a list rather than as a
      // nested ternary inside a prompt.
      const houseRules = kit.guardrails.length
        ? ['House rules that must not be broken:', ...kit.guardrails.map((rule) => `- ${rule}`)].join('\n')
        : '';

      const result = await reasonJson({
        system:
          'You are the Creative Director inside HELM. You write one grounded creative brief at a time. Headlines are short enough to set large in a paid-social still. You never invent a product claim that is not in the guidance you are given.',
        prompt: `Brand: ${kit.advertiser} · ${kit.product}. Campaign line: ${kit.campaignLine}.
Palette: ${kit.palette}. Audience: ${kit.audience}. Objective: ${kit.objective}.
${houseRules}
${finding ? `Finding to answer: ${finding.title} — ${finding.observation}` : ''}
${fatigued.length ? `Creative that is wearing out: ${fatigued.map((creative) => `${creative.name} (${creative.note})`).join('; ')}` : ''}
${request.body?.note ? `The requester added: ${request.body.note}` : ''}

Write one replacement brief.`,
        shape: `{"title":"...","headline":"SHORT LINE, at most 5 words","subline":"one short line","direction":"product-proof"|"field-use"|"typographic"|"evidence","rationale":"why this answers the finding","prompt":"a full image-generation prompt"}`,
        fallback,
        model: AGENTS.creative.model,
      });

      return {
        brief: { ...fallback, ...result.value },
        authoredBy: result.live ? result.model : 'HELM sample creative director',
        live: result.live,
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  /** Generates an image and writes it back to the library as an artifact. */
  app.post<{
    Params: { slug: string };
    Body: {
      prompt?: string;
      headline?: string;
      subline?: string;
      aspect?: GenerateImageInput['aspect'];
      direction?: (typeof DIRECTIONS)[number];
      title?: string;
      findingId?: string;
      campaignId?: string;
      variants?: number;
      saveToLibrary?: boolean;
      /** What the person asked for on top of the brief, in their own words. */
      instructions?: string;
    };
  }>('/api/workspaces/:slug/studio/generate', async (request, reply) => {
    try {
      requireCsrf(request);
      const context = await requireWorkspace(request, request.params.slug, 'studio.generate');
      const body = request.body ?? {};

      const written = body.prompt?.trim();
      if (!written) throw invalid('Write a prompt, or generate a brief first.', 'prompt');

      /*
       * The requester's own instruction reaches the renderer.
       *
       * It used to be read only when the creative director rewrote the brief,
       * which meant typing an instruction and pressing Generate silently
       * dropped it — the image came back ignoring the one thing the person
       * actually asked for. It is appended last so it qualifies the brief
       * rather than being buried inside it.
       */
      const instructions = body.instructions?.trim();
      const prompt = instructions ? `${written}\n\nAlso: ${instructions}` : written;

      const aspect = ASPECTS.includes(body.aspect as GenerateImageInput['aspect'])
        ? (body.aspect as GenerateImageInput['aspect'])
        : '4:5';
      const direction = DIRECTIONS.includes(body.direction as (typeof DIRECTIONS)[number])
        ? body.direction
        : 'product-proof';
      const count = Math.min(Math.max(Number(body.variants) || 1, 1), 4);

      const finding = body.findingId ? await repo.getFinding(body.findingId) : null;
      const created: Artifact[] = [];
      const notes: string[] = [];

      for (let index = 0; index < count; index += 1) {
        const image = await generateImage({
          prompt,
          aspect,
          headline: body.headline,
          subline: body.subline,
          brand: `${ADVERTISER} · ${PRODUCT}`,
          direction,
          seed: `${context.workspace.id}:${prompt}:${index}`,
        });
        const asset = await storeStudioAsset(image);
        if (asset.note && !notes.includes(asset.note)) notes.push(asset.note);

        const artifact: Artifact = {
          id: `art_img_${randomUUID().slice(0, 8)}`,
          title: body.title?.trim() || body.headline?.trim() || 'Generated variant',
          type: 'generated_image',
          mode: 'creative',
          updatedAt: new Date().toISOString(),
          createdBy: `${AGENTS.creative.name} · ${image.model}`,
          status: 'draft',
          summary: body.subline?.trim() || prompt.slice(0, 160),
          tags: [
            PRODUCT,
            aspect,
            image.provider === 'studio-render' ? 'Studio render' : 'Model generated',
            ...(instructions ? ['Directed'] : []),
            ...(count > 1 ? [`Variant ${index + 1}`] : []),
          ],
          linkedCampaignId: body.campaignId ?? finding?.affectedCampaignIds[0],
          imageUrl: asset.url,
          aspect,
          prompt,
          format: `${image.width} × ${image.height}`,
        };

        if (body.saveToLibrary !== false) {
          await repo.upsertArtifact(context.workspace.id, artifact);
        }
        created.push(artifact);
      }

      return reply.status(201).send({
        artifacts: created,
        provider: imageProviderName(),
        notes,
      });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  /** Serves a stored asset. Content-addressed names only. */
  app.get<{ Params: { id: string } }>('/api/studio/assets/:id', async (request, reply) => {
    const asset = await readStudioAsset(request.params.id);
    if (!asset) return reply.status(404).send({ error: { code: 'not_found', message: 'No such asset.' } });
    return reply
      .header('content-type', asset.contentType)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
      .send(asset.data);
  });
}
