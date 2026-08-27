import * as repo from '../graph/repository.js';
import { ADVERTISER, CREATIVE_LINE, PRODUCT } from '../sample/campaigns.js';
import type { BrandKit } from './types.js';

/**
 * The guidance a generation inherits.
 *
 * This lives in the domain rather than beside a route because two very
 * different callers need the same answer: the studio, when a person asks for
 * one image, and the fleet's creative director, when a run writes replacement
 * directions. They were drifting — the studio read the workspace's kit while
 * the fleet had the brand written into its prompt as a string literal, so
 * editing the kit changed one and not the other.
 *
 * A workspace that has never defined a kit still needs guidance, so the sample
 * brand stands in — named as a sample, so nobody mistakes the placeholder for
 * a decision somebody made.
 */
export async function resolveBrandKit(workspaceId: string, requested?: string): Promise<BrandKit> {
  const kits = await repo.listBrandKits(workspaceId);
  const chosen =
    (requested ? kits.find((kit) => kit.id === requested) : undefined) ??
    kits.find((kit) => kit.isDefault) ??
    kits[0];
  if (chosen) return chosen;

  return {
    id: 'brand_sample',
    workspaceId,
    name: 'Sample brand',
    advertiser: ADVERTISER,
    product: PRODUCT,
    campaignLine: CREATIVE_LINE,
    palette: 'Graphite, frost, deep cobalt, one warm coral annotation',
    audience: 'Broad prospecting · India',
    objective: 'Sales · purchase',
    guardrails: ['Never invent a product claim that is not in the guidance.'],
    isDefault: true,
    updatedAt: new Date().toISOString(),
  };
}

/** The kit as the model is told it, house rules included. */
export function brandBriefing(kit: BrandKit): string {
  const lines = [
    `Brand: ${kit.advertiser} · ${kit.product}.`,
    `Campaign line: ${kit.campaignLine}.`,
    `Palette: ${kit.palette}.`,
    `Audience: ${kit.audience}. Objective: ${kit.objective}.`,
  ];
  if (kit.guardrails.length) {
    lines.push('House rules that must not be broken:', ...kit.guardrails.map((rule) => `- ${rule}`));
  }
  return lines.join('\n');
}
