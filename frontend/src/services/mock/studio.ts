import type { StudioResponse } from '@/services/http/queries';
import type { BrandKit } from '@/contracts';
import { artifacts } from './library';
import { campaigns } from './campaigns';
import { decisionFindings, watchFindings } from './intelligence';

/**
 * The studio, for a build with no API behind it.
 *
 * Same reason as the document shelf: this was the other surface that answered
 * with an error panel instead of the sample workspace, so the static export
 * dead-ended on it. The controls render and read exactly as they do live; what
 * is absent is the one thing that genuinely needs a server, which is drawing
 * an image — `canGenerate` is false and the provider says so in as many words.
 *
 * Presets and directions are the same four the API serves (see the backend's
 * studio routes). The rest is composed from the fixtures the other surfaces
 * already use, so the studio names the same campaigns and findings the
 * briefing does.
 */

const brandKit: BrandKit = {
  id: 'kit_northstar',
  workspaceId: 'ws_northstar',
  name: 'Northstar — Arc Bottle',
  advertiser: 'Northstar Group',
  product: 'Arc Bottle, insulated 700ml',
  campaignLine: 'Holds the line, hot or cold.',
  palette: 'Deep teal, warm sand, brushed steel',
  audience: 'Commuters and desk athletes, 25–40, metro India',
  objective: 'Purchases on one mapped basis',
  guardrails: [
    'Never show the bottle open in a bag.',
    'No claims about temperature duration beyond 12 hours.',
    'The line always sits clear of the product silhouette.',
  ],
  isDefault: true,
  updatedAt: '2026-08-22T11:15:00+05:30',
};

export const sampleStudioResponse: StudioResponse = {
  /*
   * True, so the studio renders.
   *
   * This flag is a role gate, not a capability one: false swaps the whole
   * surface for "generating images needs the analyst role or above", which on
   * a build with no API is both wrong about the reason and hides the thing the
   * demo exists to show. The provider note below carries the honest caveat.
   */
  canGenerate: true,
  provider: {
    key: 'studio-render',
    label: 'HELM studio renderer',
    live: false,
    note: 'This build has no API behind it, so the studio composes but does not draw. Generation returns when it runs against a live HELM.',
  },
  director: { name: 'Creative director', gate: 'HELM review' },
  presets: [
    { id: 'meta_feed', label: 'Meta · 4:5 feed', aspect: '4:5', spec: '1080 × 1350', channel: 'Meta Ads' },
    { id: 'meta_story', label: 'Meta · 9:16 story', aspect: '9:16', spec: '1080 × 1920', channel: 'Meta Ads' },
    { id: 'meta_square', label: 'Meta · 1:1 square', aspect: '1:1', spec: '1080 × 1080', channel: 'Meta Ads' },
    { id: 'google_display', label: 'Google · 16:9 display', aspect: '16:9', spec: '1920 × 1080', channel: 'Google Ads' },
  ],
  directions: ['product-proof', 'field-use', 'typographic', 'evidence'],
  brand: {
    advertiser: brandKit.advertiser,
    product: brandKit.product,
    line: brandKit.campaignLine,
    palette: brandKit.palette,
    audience: brandKit.audience,
    objective: brandKit.objective,
  },
  // A creative brief starts from something the account actually did.
  startingPoints: [...decisionFindings, ...watchFindings].slice(0, 4).map((finding) => ({
    findingId: finding.id,
    title: finding.title,
    hint: finding.observation,
    campaignId: finding.affectedCampaignIds[0],
  })),
  fatiguedCreatives: [
    {
      id: 'crv_arc_hero_02',
      name: 'Arc Bottle / Hero 02',
      campaignId: 'cmp_m_broad_04',
      frequency: 4.8,
      note: '3-second view rate fell from 32% to 24% while frequency climbed past 4.5.',
    },
    {
      id: 'crv_arc_field_01',
      name: 'Arc Bottle / Field 01',
      campaignId: 'cmp_m_advantage_shopping',
      frequency: 3.6,
      note: 'Still holding, but the decay curve matches Hero 02 four weeks ago.',
    },
  ],
  campaigns: campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    provider: campaign.provider,
  })),
  recent: artifacts.filter((artifact) => artifact.mode === 'creative'),
  brandKits: [brandKit],
  activeBrandKitId: brandKit.id,
  // Editing the kit is a write, and there is nothing to write to.
  canEditBrand: false,
};
