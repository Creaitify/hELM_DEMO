/**
 * Stable identity colour for a campaign.
 *
 * Colour here identifies, it never signals. The semantic tones (good, warn,
 * bad) mean state, so a campaign that happened to hash green must not be
 * readable as "healthy" — this palette stays clear of those hues and keeps its
 * chroma low enough that nothing here competes with a status chip.
 *
 * Six colours, not one per campaign. This workspace runs eleven campaigns, and
 * hashing that many across a wheel produces pairs no eye separates: two blues
 * that look alike identify nothing and cost the reader a second look. Six
 * separable colours narrow the field instead. The campaign name travels with
 * the colour everywhere it appears, so recognition never depends on telling
 * two tints apart, and a repeat is a smaller failure than a false distinction.
 */

export type CampaignIdentity = {
  /** Edge rule and dot. Sits on a surface, never under text. */
  mark: string;
  /** Card wash. Light enough that body ink stays well above AA over it. */
  tint: string;
  /** Named, so the colour is never the only carrier of the grouping. */
  label: string;
};

/**
 * Each mark clears 5:1 on white, so the rule and dot are unambiguous. The
 * tints are deliberately far weaker than any `-soft` semantic fill: a card
 * washed as strongly as `--bad-soft` would read as an alarm, and the identity
 * would have quietly become a status again.
 */
const PALETTE: readonly CampaignIdentity[] = [
  { label: 'Steel', mark: '#4a6489', tint: '#f6f8fb' },
  { label: 'Teal', mark: '#2c7274', tint: '#f4f8f8' },
  { label: 'Violet', mark: '#6250a2', tint: '#f8f7fc' },
  { label: 'Plum', mark: '#8a4a72', tint: '#fbf7fa' },
  { label: 'Bronze', mark: '#7b6236', tint: '#f9f7f2' },
  { label: 'Slate', mark: '#55606f', tint: '#f6f7f9' },
];

/**
 * FNV-1a over the id. The id is immutable, so a campaign keeps its colour
 * across the briefing, the campaign list and every finding that cites it —
 * which is the only property that makes the colour worth reading at all.
 */
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return result >>> 0;
}

export function campaignIdentity(campaignId: string): CampaignIdentity {
  return PALETTE[hash(campaignId) % PALETTE.length];
}

/**
 * A finding can touch several campaigns. The first one carries the edge, and
 * the card lists the rest by name, because a single rule cannot honestly stand
 * for two campaigns.
 */
export function leadCampaignIdentity(campaignIds: readonly string[]): CampaignIdentity | null {
  return campaignIds.length > 0 ? campaignIdentity(campaignIds[0]) : null;
}
