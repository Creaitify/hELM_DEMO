# HELM frontend

Premium paid-media intelligence for Google Ads and Meta Ads. Frontend only — every
figure comes from a typed mock adapter, and there is no backend in this build.

## Run it

```bash
cd frontend
npm install
npm run build && npm start     # production, http://localhost:3100
npm run dev                    # development, http://localhost:3100
```

Quality gates: `npm run typecheck`, `npm run lint`, `npm run build`.

## Demo route map

| Route | What it shows |
|---|---|
| `/` | Public landing: hero signal scene and five editorial movements |
| `/signin` | 58/42 split sign-in with ready / redirecting / failed / unavailable states |
| `/onboarding` | Four-step workspace setup |
| `/app` | Redirects to the last workspace |
| `/w/northstar-group` | Briefing — scoreline, decision brief, movement charts, timeline |
| `/w/northstar-group/campaigns` | Cross-channel explorer, 11 campaigns |
| `/w/northstar-group/campaigns/cmp_m_broad_04` | Campaign detail: Overview, Ads & Creative, Intelligence |
| `/w/northstar-group/intelligence` | Intent composer and run history |
| `/w/northstar-group/intelligence/run_0824_cpa` | Decision memo awaiting a decision |
| `/w/northstar-group/library` | Reports and the Arc Bottle creative family |
| `/w/northstar-group/settings` | Workspace, Team, Connections, Preferences, Audit |
| `/w/northstar-group/connections` | Connection ledger, preflight, disconnect, delete |
| `/ops` | Gated operator console |

Suggested demo path: `/` → `/signin` → Continue with Google → Briefing → open evidence →
Campaigns → Broad 04 → Intelligence run → Library → Connections.

## Content states

`northstar-group` is the fully populated success state. The other two workspaces in the
switcher show the honest alternatives:

- `meridian-labs` — healthy but nothing connected yet (empty state)
- `harbour-and-co` — expired Meta connection, viewer role (error + permission state)

Partial data is visible inside Northstar too: Retargeting is 19 hours behind and excluded
from blended totals, Northstar US is separated for currency, and New customers is reported
as genuinely unavailable rather than estimated.

Sign-in view states can be exercised from the developer strip on `/signin`, which is
compiled out of production builds.

## Structure

```
src/
  app/            App Router: (marketing), (auth), onboarding, w/[workspaceSlug], ops
  components/     brand, primitives, public, shell, scope, data
  features/       auth, briefing, campaigns, connections, intelligence, library, onboarding, settings
  contracts/      typed domain model — no `any` in feature code
  services/
    adapters/     feature adapter interface the future HTTP client implements
    mock/         the Northstar Group sample workspace
  lib/            routes, formatting, metric catalog, safe returnTo
  styles/         tokens.css (canonical) and motion.css
```

CSS custom properties in `src/styles/tokens.css` are the single source of truth for colour,
geometry and timing; Tailwind consumes them and never re-declares a value.

## Sample data

Northstar Group, INR, Asia/Kolkata. Analysis window 25 July – 23 August 2026 inclusive
(30 complete days) against 25 June – 24 July 2026. One decision story runs through the
landing page, Briefing, Campaigns and Intelligence: Meta Prospecting / Broad 04 raised
budget 40% into a fatiguing creative while Google Non-Brand / High Intent was capped, so
HELM proposes a bounded 14-day ₹1,20,000 test with named stop conditions.

All figures are illustrative and labelled as such wherever a visitor could mistake them
for customer proof.

## Not built in this pass

Authentication is visual only: pressing **Continue with Google** moves through the
redirecting state and lands on the sample workspace so the product can be reviewed end to
end. There is no session, no OAuth callback, no protected-route guard, and no live
connector. The `AuthAdapter` boundary and the safe `returnTo` utility are real and tested
against the routing contract in the brief.
