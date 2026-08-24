# HELM Frontend Rebuild Brief

**Product:** HELM — premium paid-media intelligence  
**Document role:** Creative direction, product UX specification, frontend architecture brief, and Claude CLI implementation contract  
**Target folder:** C:\Users\prach\HELM103\Helm103\frontend  
**Existing reference material:** C:\Users\prach\HELM103\Helm103\design  
**Backend status:** Out of scope for this build. Use typed mock adapters until the backend contract is deliberately designed.

Run Claude CLI from the nested project root:

~~~powershell
Set-Location 'C:\Users\prach\HELM103\Helm103'
~~~

All relative paths in this document assume that working directory.

---

## 0. Read this first: the implementation order is non-negotiable

The first delivery is Phase 1A: the landing header/hero/signature scene and the complete sign-in composition. It is a focused visual concept gate, not the full product or the full long-form landing page.

Claude must:

1. Read this entire document before editing.
2. Inspect git status and preserve all existing uncommitted work; do not overwrite unrelated user changes.
3. Inspect the current frontend and the files in design as visual reference, not as architecture to preserve.
4. Build the shared foundations needed by the landing and sign-in pages.
5. Implement only:
   - / with the header, hero, signature signal scene, and a clean page ending for the concept gate
   - /signin as a complete responsive composition with deterministic view states
   - shared tokens, fonts, brand mark, public-page primitives, and motion utilities required by those two routes
6. Avoid mass deletion in Phase 1. Leave existing authenticated routes untouched until the concept is approved.
7. Verify the two routes at desktop, tablet, and mobile sizes.
8. Run type-check, lint, build, accessibility checks, and visual screenshots.
9. Stop and present the result for design approval.

Claude must not implement the authenticated shell, dashboard, connections, Meta Ads flow, or any later route during the first delivery. Those are specified now so the first two screens establish the correct system, but they come after approval.

Claude must not edit anything inside backend during the frontend prototype.

Do not delete the existing design files. Do not blindly port existing page components. The present project is reference material; the new information architecture and production contract in this brief are the source of truth.

Phase 1A file safety:

- Replace the existing src/app/page.tsx and src/app/signin/page.tsx in place, or move them atomically into route groups. Never add a second page file that resolves to the same URL.
- Keep the existing src/app/(app) routes in the active source tree until the concept is approved.
- Namespace new marketing/auth-only styles where needed and preserve legacy token/class aliases so the existing authenticated routes still compile.
- Run the full frontend build. A successful preview of only / and /signin is not enough if another route no longer compiles.

### Document map

- Sections 1–5: product thesis, what to retain/remove, audience, and creative concept.
- Sections 6–9: visual system, motion, landing page, and sign-in page.
- Sections 10–17: routing, shell, account switching, connections, Meta Ads, onboarding, pages, and charts.
- Sections 18–25: components, contracts, state, mocks, content states, copy, accessibility, and responsive behavior.
- Sections 26–30: frontend architecture, production requirements, testing, delivery gates, and the exact Claude CLI directive.
- Sections 31–33: current-project reference map, external research context, and the final design checklist.

---

## 1. Executive direction

HELM should feel like a privately commissioned decision instrument for serious paid-media teams: calm, exact, fast, and expensive because it removes uncertainty—not because it adds visual spectacle.

The product is not “another dashboard,” not “ChatGPT for ads,” and not a public display of an agent fleet. It is the decision layer between fragmented ad-platform data and the person responsible for where the next unit of budget goes.

The core promise is:

> See what moved. Know what to move next.

The supporting product sentence is:

> HELM reconciles paid-media performance across every connected account, detects the decisions hiding in the movement, and shows the evidence before you move budget.

The frontend should make four ideas immediately legible:

- Google Ads and Meta Ads can be connected, disconnected, and switched without leaving the current work.
- Cross-channel numbers are normalized into one trustworthy view while source truth remains visible.
- Intelligence is a recommendation with evidence, freshness, confidence, and impact—not a chat response floating above unexplained data.
- The user remains in control. Any future write action is explicit, reviewable, and reversible.

### The emotional target

The interface should feel:

- composed, not empty;
- editorial, not templated;
- intelligent, not theatrical;
- precise, not dense for the sake of density;
- alive, not restless;
- premium, not glossy;
- human-authored, not assembled from common AI-SaaS sections.

### The strategic difference

Current category leaders increasingly combine unified data, measurement, intelligence, and activation. HELM should not imitate their pages or claim feature parity. Its ownable edge is a more legible decision process:

**signal → discrepancy → evidence → recommendation → human decision**

That sequence is both the product model and the visual motif.

---

## 2. What the current project gets right

The current frontend is not the implementation base, but it contains several ideas worth preserving.

### Keep and refine

- The HELM name, circular instrument mark, and “navigation/heading” metaphor.
- The deep navy plus indigo identity.
- The cool blue-sand product field and rare pale-peach action accent.
- Tinted near-white surfaces instead of a field of pure-white cards.
- Instrument Sans for product UI and IBM Plex Mono for metrics, dates, IDs, axes, and data provenance.
- Tabular numerals everywhere numbers may reflow or align.
- Hairlines for separation; shadows only for true lift.
- The dark public world transitioning into a light product world.
- The mist material: navy below blue, a controlled iris/peach wash, and a faint measurement grid.
- The code-native icon family rather than a generic icon pack.
- Decision-focused chart rules: one semantic question per chart, visible comparison basis, direct labels, honest unavailable states, and no gratuitous dual axes.
- Freshness, grounding, provenance, and “not available rather than estimated.”
- Discrete workflow status rather than invented progress percentages.
- Background work that survives navigation.
- Human approval gates.
- The older sign-in prototype’s signal network: nodes, curved connections, measured data travel, and a single legible path through the system.
- The “Where the money grows” editorial layer above raw metrics.

### Fix before those ideas become the new system

- Choose one exact token source. The current app, Tailwind config, charts, and design prototypes contain slightly different indigos, surfaces, and signal colors.
- Implement real dark and light mist variants. The current Mist component accepts a tone but does not use it, and the sign-in references an undefined mist-light class.
- Establish one primary-action rule. The current system alternates between peach and indigo without a clear hierarchy.
- Raise routine body and control text. The current 9.5–11.5px density often looks technical rather than luxurious.
- Enforce the spacing scale instead of using many arbitrary half-pixel font sizes, padding values, and radii.
- Reserve hover lift for interactive objects.
- Make all touch targets at least 44 by 44 CSS pixels where practical.
- Self-host fonts through Next font handling rather than loading raw Google Fonts stylesheets.
- Make reduced motion affect JavaScript number animation and any motion library, not CSS keyframes alone.

---

## 3. What must be retired

The following patterns are not part of the rebuild.

### Retire from the public experience

- The generic centered treatment of eyebrow + oversized headline + paragraph + two CTAs. An asymmetric authored hero may use these content types when the product scene is co-primary.
- Equal-sized numbered feature cards.
- Three generic trust pillars.
- A centered closing CTA that repeats the hero.
- Decorative gradient blobs, glass cards, random floating tiles, and sparkle icons used as shorthand for AI.
- Public environment names, provider availability, “offline stub” labels, backend setup instructions, or secret/config variable names.
- Unsupported enterprise claims such as SAML unless the product actually exposes the flow.
- Fake customer logos, invented testimonials, fabricated usage counters, or unattributed benchmark claims.
- Technical language such as “normalized tables,” “tenant,” “agent reviewer,” or “control plane” in primary marketing copy.

### Retire from primary product navigation

- Agent Fleet as a normal user destination.
- Separate top-level pages for Studio, Asset Library, and Documents.
- Separate Data Sources and Integrations destinations.
- Activity and Admin in the main work navigation.
- Two competing HELM experiences that duplicate the same conversation and state.
- Ten campaign-detail tabs.
- Repeated page titles inside a shell that already names the page.
- Free-text technical fields that can be represented by platform-aware presets or progressive disclosure.

### Explicit anti-pattern list

Do not ship:

- a giant centered gradient headline;
- a generic bento grid;
- endless rounded rectangles;
- every section fading upward;
- every card rising on hover;
- a pulsing orb that communicates no state;
- a typewriter chat effect;
- 3D charts, unlabeled axes, or chart gradients used as decoration;
- tiny uppercase copy everywhere;
- icons inside colored rounded squares for every section;
- an entire page that looks like a screenshot trapped inside a fake browser frame;
- emoji as interface icons;
- default Lucide-style visual identity;
- “AI-powered” as the main reason to care.

---

## 4. Product definition

### Category

Paid-media intelligence for brands, agencies, and performance teams managing Google Ads and Meta Ads across one or many accounts.

### Initial audience

1. **Performance lead**
   - Needs to know what changed, why it matters, and what to do today.
   - Moves between platforms and accounts many times per day.
   - Distrusts unexplained blended numbers.

2. **Agency operator**
   - Manages multiple workspaces and many ad accounts.
   - Needs fast context switching without stale client data or route resets.
   - Needs clear evidence that can be shared with a client.

3. **Founder or CMO**
   - Wants a concise view of spend, attributed value, efficiency, risk, and the next decision.
   - Does not want to configure a dashboard to receive a useful answer.

4. **Creative strategist**
   - Needs to connect creative fatigue, hook, format, spend, and conversion performance.
   - Needs a bridge from evidence to the next test, not a disconnected image generator.

### Core jobs

- Connect a source without committing to a long setup flow.
- Switch workspace, account group, channel, or ad account in place.
- Understand what changed over a selected period and comparison.
- Find budget, efficiency, and creative opportunities.
- Investigate the evidence behind a recommendation.
- Save, share, approve, dismiss, or later execute an action.
- Understand freshness, source, attribution basis, and data gaps at a glance.

### Product principles

1. **Decision before dashboard.** The first screen surfaces the few changes that deserve attention.
2. **Evidence beside assertion.** Every insight links to the metrics, entities, date range, source, and comparison that produced it.
3. **Source truth stays visible.** Unified views never pretend provider differences disappeared.
4. **Context never goes stale silently.** Workspace/account switches cancel old requests, invalidate cached data, and visibly confirm the new scope.
5. **Progressive disclosure.** Common work stays simple; advanced attribution, mapping, and creative settings appear only when requested.
6. **Routes are stable and shareable.** Important filters and scope live in the URL.
7. **No surprise navigation.** Connectors, account switches, and detail inspection use local overlays or deliberate links, not redirects through unrelated pages.
8. **AI stays behind the work.** The interface shows evidence, judgment, confidence, and controls—not a parade of model names or animated agents.
9. **Unavailable is a valid state.** Do not infer a metric the available data cannot support.
10. **Read-only first.** Connecting an account never implies permission to mutate campaigns.

### Initial non-goals

- A full campaign-builder UI.
- Automatic bid or budget execution in the first backend release.
- A generic creative generation playground.
- A data warehouse configuration console.
- A public agent observability product.
- A comprehensive CRM, email, commerce, or attribution suite on day one.
- Pixel setup, CAPI setup, catalogs, pages, and every Meta asset in the initial connection flow unless a shipped feature needs them.

---

## 5. Brand and creative concept

### Working brand idea: The Decision Instrument

HELM is a navigation instrument for money in motion. The interface should borrow from measurement, cartography, editorial finance, and a calm operations room—but never become nautical cosplay or a sci-fi control panel.

The visual signature is a **decision spine**:

- a fine rule begins with provider signals;
- measured points travel along it;
- conflicting readings are visibly reconciled;
- an annotation locks onto the decisive change;
- the final action sits at the end with evidence and a human control.

This spine appears differently across the product:

- on the landing page, it becomes the hero’s animated signal map;
- on sign-in, it becomes a quieter account network converging into one scope;
- in the product, it becomes the provenance rail on an intelligence brief;
- in connection flows, it becomes discrete stages with truthful state;
- in reports, it becomes the timeline of what changed and why.

Use the motif sparingly. It is a compositional grammar, not a logo pattern to stamp everywhere.

### Voice

HELM speaks like an experienced performance lead:

- short;
- specific;
- calm under uncertainty;
- candid about gaps;
- focused on consequences;
- never breathless about AI.

Good:

- “Meta prospecting CPA rose 31% after frequency crossed 4.6.”
- “Google Brand is limited by budget during the highest-converting hours.”
- “This recommendation uses 28 complete days. Yesterday is still syncing.”
- “Purchase value is unavailable for one account, so blended ROAS is hidden.”

Avoid:

- “Unlock unparalleled insights.”
- “Supercharge your growth with AI.”
- “Revolutionize your marketing.”
- “Our powerful agent fleet analyzes your data.”

### A premium product is selective

Luxury here comes from editing:

- fewer navigation destinations;
- fewer visible filters;
- fewer default metrics;
- more whitespace around the one decision that matters;
- higher-quality data typography;
- clear transitions;
- deliberate error and empty states;
- no interface element that looks unfinished or internally named.

---

## 6. Visual system

The first implementation must consolidate these values into one token layer. CSS custom properties are the canonical source; Tailwind utilities should consume them rather than duplicate them.

### Color

#### Public dark world

| Token | Value | Use |
|---|---:|---|
| night-950 | #070A12 | Main landing field |
| night-900 | #0B0E1A | Elevated dark region |
| night-800 | #131829 | Navy depth and active dark surface |
| night-line | rgba(255,255,255,.10) | Dark hairlines |
| night-ink | #F2F4F8 | Primary dark text |
| night-muted | #A7AEC0 | Supporting dark text |
| night-faint | #6E7688 | Quiet metadata |

#### Product light world

| Token | Value | Use |
|---|---:|---|
| canvas | #E5EDFA | Blue-sand page field |
| surface | #F9FBFF | Main surface |
| surface-subtle | #F1F6FD | Nested surface |
| surface-sunk | #E8F0FB | Inputs, inactive tracks, skeletons |
| line | #D4E1F2 | Standard hairline |
| line-strong | #B7CBE6 | Interactive boundary |
| ink-950 | #0B1224 | Primary text |
| ink-700 | #2E3A55 | Secondary text |
| ink-500 | #63718F | Supporting text |
| ink-400 | #8994AE | Quiet metadata |

#### Brand and action

| Token | Value | Use |
|---|---:|---|
| helm-500 | #3D5BD6 | Brand, selected state, blue action |
| helm-600 | #2C46B4 | Hover/pressed |
| helm-100 | #DCE5FD | Selected tint |
| iris-500 | #7C5BFF | Rare secondary intelligence marker |
| action-200 | #FFDDD0 | Primary product action background |
| action-400 | #F7AA8E | Hover/border |
| action-ink | #0B1224 | Text on peach |

#### Semantic

| Token | Value | Use |
|---|---:|---|
| good | #0B8F62 | Positive/healthy |
| good-soft | #E2F5EE | Positive surface |
| warn | #B06714 | Delayed/attention |
| warn-soft | #FCF0DF | Warning surface |
| bad | #CE2242 | Failed/destructive |
| bad-soft | #FCE9ED | Error surface |
| info | #3D5BD6 | Informational/running |
| info-soft | #EDF2FE | Informational surface |

#### Primary action rule

- On the dark marketing site, the main CTA is a light or pale-peach button with dark ink. Indigo is the brand signal and focus color, not another competing primary CTA.
- Inside the product, pale peach means “take the proposed action.” Indigo means selection, navigation, inspect, connect, or continue.
- Authentication is the explicit exception: Continue with Google is a neutral light provider button with the Google mark. It is never peach or indigo.
- Destructive actions are never styled like the primary action.
- Provider brand colors appear only in provider marks and small identity details, never as page themes.

### Typography

- Product UI: Instrument Sans through next/font/google in Phase 1A; this accepts build-time font retrieval and serves the result from the built application.
- Data: IBM Plex Mono through next/font/google in Phase 1A, with tabular numerals enabled.
- Marketing display: begin with Instrument Sans used in a more authored scale and line composition. Do not add a fashionable serif merely to appear premium. If a licensed display face is later supplied, make it a tokenized swap.
- Do not make font-display an alias with no meaningful behavior. Give marketing display its own size, line-height, tracking, and optical settings.
- Before production lock, decide whether builds must be network-independent. If yes, vendor reviewed WOFF2 files with their licenses and move to next/font/local. Do not download unreviewed font binaries or invent a licensed typeface.

#### Type scale

| Role | Desktop | Mobile | Notes |
|---|---:|---:|---|
| Landing display | clamp(56px, 6.4vw, 96px) | 44–58px | Tight but not crushed; maximum 3 lines; never overpower the product scene |
| Landing section | 44–64px | 32–42px | Editorial, often asymmetric |
| Product page | 26–32px | 23–27px | One title only |
| Section title | 16–20px | 16–18px | Avoid a sea of 14px headings |
| Body large | 18–20px | 17–18px | Landing narrative |
| Body | 14–16px | 14–16px | Never below 14px for normal prose |
| Metadata | 12–13px | 12–13px | Mono only for real data |
| Micro label | 11–12px | 11–12px | Use sparingly; not every heading |

### Spacing and geometry

- Base unit: 4px.
- Core spacing sequence: 4, 8, 12, 16, 24, 32, 48, 64, 96, 144.
- Standard control height: 44px.
- Compact desktop control: 36px only when the same action has a larger mobile target.
- Inputs: 44–48px.
- Cards: 14px radius.
- Buttons/inputs: 10–12px radius.
- Large editorial regions: 18–24px radius only when the shape has a clear compositional role.
- Pills are reserved for status, filters, and compact identity. Do not turn all metadata into pills.
- Product content max width: 1440px where analytics needs it; readable narrative max width: 720px.

### Surfaces

Use four surface types, not one universal card:

1. **Field** — page background and large uninterrupted chart canvases.
2. **Ledger** — flat content separated by rules; best for insights, evidence, and settings rows.
3. **Panel** — bordered/tinted group with no elevation.
4. **Lifted object** — interactive popover, command menu, draggable item, or focused action.

Only lifted objects receive meaningful shadow. An analytics section does not need a card merely because it has a title.

### Iconography

- Preserve the 24-unit, 1.5–1.7px code-native line style.
- Add bespoke Google Ads, Meta Ads, connection, account-scope, evidence, and decision icons.
- Provider marks must respect provider identity but fit the optical weight of the HELM system.
- Sparkles may appear once in an explanatory illustration if justified; they are not the AI icon.
- Every icon-only control gets an accessible name and visible tooltip.

Branded SVG/data scenes either expose one concise accessible description that communicates the same signal → evidence → recommendation story, or are aria-hidden when adjacent semantic HTML already provides the complete equivalent. Never make a screen reader traverse dozens of decorative SVG nodes.

### Mist and texture

Build explicit variants:

- mist-dark for the public landing and sign-in narrative field;
- mist-light for the product and sign-in form field;
- mist-static for reduced motion and low-power devices.

Mist should feel like weather behind the page, never an opaque layer over content. The measurement grid should disappear toward the edges using a mask. Peach is a rare warm event, not a permanent gradient corner.

---

## 7. Motion system

Motion must explain state, causality, focus, or continuity.

### Motion principles

- One signature sequence is more premium than fifty small reveals.
- Animate transforms and opacity first; avoid layout animation on large surfaces.
- A status pulse means active work. It never means “this brand is futuristic.”
- Charts draw once when fresh data arrives, then remain stable.
- Account switching keeps the shell still and transitions only affected data regions.
- Route changes preserve spatial continuity; the entire page should not rise from below on every click.
- Hover motion is reserved for interactive objects.
- No typewriter response animation.

### Timing

| Interaction | Duration |
|---|---:|
| Press/hover feedback | 90–140ms |
| Tooltip/menu | 140–180ms |
| Popover/account switcher | 180–240ms |
| Drawer/sheet | 240–320ms |
| Local content replacement | 180–260ms |
| Chart reveal | 600–900ms |
| Landing hero choreography | 1400–2200ms total |
| Ambient mist | 30–50s, low opacity |

Default easing:

~~~css
--ease-out: cubic-bezier(.22, 1, .36, 1);
--ease-standard: cubic-bezier(.2, 0, 0, 1);
~~~

### Landing signature sequence

On initial load, use three legible acts:

1. The HELM mark resolves while labeled Google and Meta account signals converge toward the reconciliation core.
2. The platform-reported discrepancy separates and one evidence annotation pins to the decisive point.
3. The recommended budget test settles with its evidence; packets stop and only extremely slow background weather may remain.

This sequence must be legible without motion. Reduced-motion users see the completed composition immediately.

The signal map is a semantic topology, not a constellation:

- maximum five labeled provider/account nodes from the canonical sample workspace;
- one labeled HELM reconciliation core;
- one explicit platform-reported discrepancy split;
- one recommendation annotation;
- no random glowing dots;
- no unlabeled branches;
- no ambient particles;
- no shape that can be mistaken for a brain or generic neural network.

### Reduced motion

- Respect prefers-reduced-motion in CSS and JavaScript.
- Motion-library components receive reduced values, not only shorter CSS duration.
- Count-up metrics become static.
- Data packets, looping waveform, mist drift, and smooth scrolling stop.
- Focus, visibility, and status remain understandable without animation.

---

## 8. Landing page specification

### Purpose

The landing page must make a senior marketer think: “This product understands the decision I make every morning.”

It should demonstrate a moment of intelligence rather than explain infrastructure.

### Navigation

Desktop:

- HELM mark and wordmark.
- Text links: Product, Method, Security.
- Quiet Sign in link.
- Primary CTA: View the decision layer.

Mobile:

- Mark and wordmark.
- Sign in.
- Menu button for the three anchor links.
- No full-width generic navbar drawer; use a compact dark sheet with large, simple links.

The header begins transparent over the hero, then gains a dark navy surface and hairline after scrolling. Its height must remain stable.

Phase 1A always renders Sign in because live session integration is deferred. In the live-auth phase, the server—not a client effect—renders Open workspace for an authenticated visitor and Sign in for an anonymous visitor. The CTA must never swap after paint.

### Hero composition

Do not center the hero.

Use an asymmetric 12-column composition:

- columns 1–7: headline, supporting sentence, actions;
- columns 5–12 and extending below the fold: signal map and decision spine;
- a narrow outer rail carries sample-workspace context, time range, and a “read-only intelligence” note.

The page should feel art-directed at 1440px and remain coherent rather than simply centered at very wide widths.

#### Approved hero copy

Small category line:

**PAID-MEDIA INTELLIGENCE / GOOGLE + META**

Headline:

**See what moved.**  
**Know what to move next.**

Supporting copy:

**HELM reconciles every connected ad account, finds the decisions hiding in the movement, and shows the evidence before you move budget.**

Primary CTA:

**View the decision layer**

Secondary CTA:

**Sign in**

Route behavior:

- View the decision layer scrolls to #decision-layer.
- Product links to #product.
- Method links to #method.
- Security links to #security.
- Sign in routes to /signin.

Quiet trust line:

**Read-only connections by default. Every recommendation shows its work.**

#### Hero intelligence scene

Use clearly labeled sample data, not implied customer data:

- “Sample workspace”
- “Last 30 complete days”
- “Google Ads + Meta Ads”
- currency visible

The visual tells one coherent story:

**Proposed 14-day test:** Shift up to ₹120k from Meta Prospecting / Broad 04 to Google Non-Brand / High Intent, with stop conditions and no automatic execution.

**Evidence:**

- Meta prospecting CPA +31% versus its four-week baseline.
- Frequency reached 4.8 and the leading creative’s 3-second video-view rate (3-second video plays ÷ impressions) fell from 32% to 24%.
- Google high-intent search lost 18% impression share to budget.
- Estimated decision range is shown as a range, never a guaranteed outcome.

This is a sample product demonstration. Mark it as such. Do not scatter unrelated vanity metrics around the hero.

### Landing narrative

The page should use five large editorial movements. Do not turn these into equal cards.

Across the five movements, use at least three materially different spatial compositions. Do not repeat an alternating copy-left/mockup-right template. The decision spine should visibly continue through the page instead of restarting inside five isolated product demos.

Required anchor ownership:

- #product begins Movement 01.
- #decision-layer begins Movement 02.
- #method begins Movement 05’s provenance ledger.
- #security targets a clearly labeled security/access subsection within Movement 05.

Every anchored section uses scroll-margin-top equal to the sticky header height plus at least 24px.

#### Movement 01 — One money view

Headline:

**The platforms can disagree. Your decision still cannot.**

Show the same conversion represented differently by Google and Meta, then show HELM’s normalized decision view with the attribution basis visible. Use a horizontal reconciliation diagram integrated into the page.

Supporting points:

- Provider-reported values remain inspectable.
- Cross-channel totals show currency, timezone, attribution basis, and freshness.
- Incompatible data is separated rather than deceptively blended.

#### Movement 02 — Decision brief

Headline:

**A morning brief built around what deserves attention.**

Use a sticky visual on one side and scrolling evidence on the other. The brief moves through:

- what changed;
- why it matters;
- the evidence;
- estimated impact range;
- recommendation;
- save, dismiss, investigate, or approve.

The user should see the product interaction, not a paragraph describing it.

#### Movement 03 — Creative intelligence

Headline:

**Performance falls after the creative starts repeating itself. See it sooner.**

Show a creative strip linked directly to frequency, hook/hold behavior, spend, conversion rate, and fatigue status. Use real asset-shaped mockups designed for HELM, not generic AI art.

The scene should make clear that creative generation is secondary. The important product is understanding what to test next.

#### Movement 04 — Account optionality

Headline:

**Every account is one command away.**

Demonstrate the account scope switcher:

- All active accounts;
- a saved group;
- one Google Ads account;
- one Meta Ads account;
- recent scopes;
- provider health and freshness;
- Connect another source;
- Manage connections.

Show that changing scope updates the data in place without sending the user to Settings.

#### Movement 05 — Evidence and control

Headline:

**When HELM has an opinion, it carries receipts.**

Use a restrained provenance ledger:

- source accounts;
- exact date window;
- freshness;
- attribution model;
- excluded/incomplete data;
- confidence;
- review state;
- actions taken.

This replaces the current trio of generic security cards. Security, permission, and audit claims belong in a precise ledger with links to Method and Security.

### Closing composition

Do not repeat the hero in a centered box.

Use a near-full-width transition from dark night into the cool product field. The decision spine arrives at an empty final state with:

**The next decision should not begin with six tabs.**

Actions:

- View the product
- Sign in

During Phase 1, View the product returns to #decision-layer and Sign in routes to /signin. Neither may be a placeholder.

Footer:

- Product
- Method
- Security
- Privacy, only when a real destination is configured
- Terms, only when a real destination is configured
- Status, only when a real status page exists
- © HELM

No dead links, environment badges, or fake availability indicators. During Phase 1, omit footer items whose real destinations do not yet exist.

### Landing responsive behavior

- At 1024–1279px, preserve the asymmetric composition but reduce the visual’s overlap.
- At 768–1023px, hero copy occupies the full upper region and the signal map becomes a wide scene directly beneath it.
- Below 768px, use a vertical signal path. Do not hide the product demonstration.
- On mobile, show one recommendation and three evidence rows; do not squeeze the desktop network.
- Anchor sections must scroll to content without placing headings under the sticky header.
- The page remains fully meaningful with JavaScript disabled, except optional motion enhancement.

### Landing SEO and metadata

- Render marketing copy on the server.
- Use route-specific title, description, canonical URL, Open Graph image, and social metadata.
- Add Organization and SoftwareApplication structured data only with truthful fields.
- Do not add star ratings, review counts, or customer numbers without a source.
- Build a real social preview asset using the signal-map composition.

---

## 9. Sign-in page specification

### Purpose

Sign-in should feel like entering the product’s operating context, not landing on a developer gateway.

### Layout

Desktop:

- 58% dark signal field.
- 42% cool light sign-in field.
- The boundary is crisp, with one controlled mist transition—not a blurred gradient seam.

The dark side uses a cropped, quieter form of the same visual language, but it tells a different story: labeled accounts converge into one selected workspace and account scope. It contains no discrepancy, recommendation, or current decision. It does not repeat the landing’s feature list.

The light side contains a single focused authentication module. It should not be a floating card unless the background needs separation; the field itself can carry the form.

Mobile:

- Retain a compact dark brand scene in the upper 34–40% rather than removing the distinctive half entirely.
- The sign-in action lives immediately below.
- Respect small dynamic viewport heights and safe areas.

### Approved copy

Wordmark subtitle:

**Paid-media intelligence**

Heading:

**Enter your intelligence workspace.**

Supporting copy:

**One work identity for every connected brand and ad account.**

Primary auth action:

**Continue with Google**

Optional enterprise action, shown only when configured:

**Use enterprise SSO**

Trust line:

**Signing in does not connect an ad account. You choose what HELM can read after entry.**

When live ad-platform connections exist, security copy may additionally state:

**Ad-platform access tokens are stored server-side and never exposed to browser JavaScript.**

Do not publish that technical claim until the live backend contract verifies it.

Footer link:

**Back to HELM**

### Fields

Production sign-in contains no email/password fields unless a real authentication method requires them.

Default visible controls:

- Continue with Google.
- Enterprise SSO only if enabled.
- Terms and privacy acknowledgement if legally required.

Developer login:

- Must not exist in the production DOM.
- May be compiled only for local development behind an explicit frontend flag.
- Lives in a collapsed “Developer access” region beneath the normal flow.
- Does not display backend environment variable names to normal users.

Phase 1 auth behavior:

- Build the real AuthAdapter boundary and all visible states.
- Do not build the authenticated application merely to provide a fake success destination.
- Build deterministic ready, redirecting, authentication-failed, and service-unavailable presentation states.
- Test safe returnTo parsing as a pure utility.
- Exercise view states through tests or a development-only scenario control that is absent from production builds and unavailable through a public query parameter.
- Do not create a real session, live callback, successful redirect, invitation continuation, or protected-route guard in Phase 1A.
- Do not pretend a production sign-in succeeded.
- State plainly in the Phase 1A handoff that authentication remains visual-only until the live adapter is implemented.

Do not ask for organization name during sign-in. Workspace creation or invitation acceptance is a separate onboarding step after authentication.

### States

1. **Ready**
   - Google button active.
   - Return destination may be shown quietly if meaningful.

2. **Redirecting**
   - Preserve button width.
   - Spinner plus “Opening Google…”
   - Disable repeat activation.

3. **Authentication failed**
   - Inline message near the button.
   - Plain user-facing reason when safe.
   - Retry action.

4. **Service unavailable**
   - “Sign-in is temporarily unavailable. Try again or contact your workspace administrator.”
   - Never say “start the backend,” expose a variable name, or silently loop.

5. **Already signed in — live-auth phase**
   - Server redirect before the sign-in page paints.

6. **Invitation — live-auth phase**
   - A one-time /invite/[token] route exchanges the token server-side for signed, short-lived invitation state.
   - Bind that state to OAuth state; never copy a reusable invitation token into local storage, session storage, or a forwarded return URL.
   - After auth, continue to invitation acceptance rather than the default overview.

### Future live-auth routing behavior

The following is the required contract for the backend-integration phase, not Phase 1A:

- A signed-out user visiting a protected URL goes to /signin?returnTo=<safe-local-path>.
- Successful auth returns to that safe local path.
- If no return path exists, go to the last workspace Briefing at /w/[workspaceSlug], or /onboarding when no workspace exists.
- Reject external, protocol-relative, encoded-external, and malformed return destinations.
- A signed-in user visiting /signin is server-redirected to the validated return path, the last valid workspace Briefing, or onboarding.
- A network failure is not automatically treated as an unauthenticated session.
- OAuth callback failure returns to sign-in once with a visible error; never bounce repeatedly.

### Sign-in acceptance criteria

- No public debug/config labels.
- No auth flicker between signed-out and signed-in CTAs.
- Keyboard focus starts predictably and returns after any modal.
- Provider button has a precise accessible name and visible loading state.
- Error copy is announced through an appropriate live region.
- The page works at 1440×900, 1024×768, 390×844, and short landscape mobile heights.
- The completed signal composition is visible under reduced motion.
- The sign-in scene remains accounts → selected workspace/scope; the landing alone owns discrepancy → evidence → recommendation.

---

## 10. Canonical information architecture and routing

HELM needs four primary destinations, not thirteen.

### Primary navigation

1. **Briefing**
   - What changed, what matters, what deserves action.
2. **Campaigns**
   - Cross-channel exploration and durable campaign detail.
3. **Intelligence**
   - Investigations, active analyses, evidence, approvals, and decision memos.
4. **Library**
   - Reports, creative directions, rendered assets, and reusable artifacts.

### Secondary destinations

- **Connections** — entered from the account scope control and Settings; not a permanent primary-nav category.
- **Settings** — workspace, team, connections, preferences, audit.
- **Ops** — separately gated operator application, never visible to a normal user.

### Canonical route map

Use routes for durable, shareable product objects. Use drawers, sheets, popovers, tabs, and URL query state for transient inspection.

~~~text
/                                      Public landing
/signin                                Authentication
/invite/[token]                        One-time invitation exchange, live-auth phase
/onboarding                            Workspace and first-connection setup

/w/[workspaceSlug]                     Briefing
/w/[workspaceSlug]/campaigns           Campaign explorer
/w/[workspaceSlug]/campaigns/[id]      Durable campaign detail
/w/[workspaceSlug]/intelligence        Intelligence workspace and history
/w/[workspaceSlug]/intelligence/[id]   Durable run / decision memo
/w/[workspaceSlug]/library             Reports and creative artifacts
/w/[workspaceSlug]/settings            Unified settings

/ops                                   Platform operators only
~~~

Optional convenience route:

- /app may server-redirect to the last valid workspace, then to onboarding if no workspace exists.

The workspace slug makes route context explicit; it is not a security boundary. The server must resolve it to an immutable workspace ID and authorize every request against current membership. In v1, workspace display names may change but slugs remain immutable.

### URL-owned analytic context

Use canonical query parameters:

~~~text
?scope=scp_demo_paid_india&range=30d&compare=previous&level=campaign
~~~

Scope grammar:

- scope is an opaque HELM scope ID, never a Google/Meta native account ID.
- A single account, staged ad-hoc selection, saved group, and All compatible selection all resolve to an opaque scope record.
- The scope resolver owns sorted/deduplicated internal account UUIDs and a schema version.
- Unknown, expired, or unauthorized scope IDs fall back to the workspace default with an explicit notice.
- Native provider IDs are display metadata only and must not enter URLs, referrers, or general analytics.
- Campaign [id] is likewise an internal durable HELM ID, never a provider-native ID.

URL state should include:

- account or saved-group scope;
- date range;
- comparison;
- platform filter;
- selected analysis level;
- sortable table column/direction when the view is meant to be shared;
- durable selected tab where relevant.

Do not put ephemeral UI in the URL:

- an open tooltip;
- a temporary menu;
- a half-completed destructive confirmation;
- a transient toast.

### Routing rules

- Switching an ad-account scope never changes the page route.
- Switching workspaces changes the workspace slug and clears workspace-scoped data.
- Connecting, reauthorizing, pausing, resuming, or disconnecting returns the user to the same route and scope where possible.
- Evidence opens in a drawer on desktop and a full-height sheet on mobile.
- Campaign detail has a route because it is shareable.
- A completed intelligence run has a route because it is a durable decision record.
- Back restores scroll position, filters, and the previously selected row.
- A “Back” control has an explicit safe fallback and never sends a user to an unrelated external page.
- Do not use a full reload for internal navigation or workspace creation.
- Do not render both a shell title and a second duplicate H1.
- A missing entity produces an intentional not-found state, not a redirect to a surprising page.

### Existing-to-new route consolidation

| Current route | New home |
|---|---|
| /dashboard | /w/[workspaceSlug] |
| /campaigns | /w/[workspaceSlug]/campaigns |
| /campaigns/[id] | /w/[workspaceSlug]/campaigns/[id] |
| /helm | /w/[workspaceSlug]/intelligence |
| /agents | Run inspector inside Intelligence or gated Ops |
| /studio | Library create mode, opened in context |
| /library | /w/[workspaceSlug]/library |
| /documents | Library → Reports |
| /data-sources | Settings → Connections |
| /settings/integrations | Settings → Connections |
| /settings/members | Settings → Team |
| /activity | Settings → Audit |
| /admin | /ops |

During an eventual migration, old URLs may use simple server redirects. New components must never generate the old URLs.

---

## 11. Authenticated product shell

The shell must feel stable while the user changes accounts, dates, pages, and investigations.

### Desktop structure

- Left rail: 208–224px expanded, 68–72px collapsed.
- Top scope bar: 60–64px, sticky.
- Main content: wide data canvas with route-level max widths.
- Optional right-side evidence drawer: overlays or resizes only when space permits.

### Left rail

Top:

- HELM mark.
- Current workspace name.
- Workspace menu, visually quieter than the account control.

Primary links:

- Briefing
- Campaigns
- Intelligence
- Library

Bottom:

- Connection health summary.
- Settings.
- Profile menu.

Do not place Team, Audit, Admin, Data Sources, model providers, or Agent Fleet in the normal rail.

The active state is a thin indigo coordinate rule plus stronger label, not a large filled rounded tile. Icons remain secondary to words.

### Scope bar

The scope bar answers four questions without opening anything:

- Which workspace am I in?
- Which ad accounts are included?
- Which period am I viewing?
- How fresh is the data?

Desktop example:

~~~text
[Northstar Group]  [Google + Meta · 4 accounts ▾]  [Last 30 days ▾]
[Compare: previous ▾]                         [Synced 8 min ago]
~~~

The account control is the most prominent contextual control. Date and comparison remain nearby. Freshness is always visible but visually quiet unless action is needed.

### Canonical intelligence entry

There is one HELM intelligence experience.

- Command shortcut: Command/Ctrl + K.
- Contextual actions: “Investigate with HELM” or “Ask about this” beside a campaign, finding, or chart.
- Full work happens at /w/[workspaceSlug]/intelligence or a durable run route.
- The command surface may collect intent and context, then opens or creates the canonical run.
- Do not maintain a separate full-featured global chat drawer with duplicate history and results.

The circular HELM instrument can remain in the wordmark and determinate run-status control. Do not place a permanently floating decorative AI orb over every page.

### Background work

When an intelligence run or sync continues:

- show a restrained status strip or instrument state in the shell;
- name the real stage;
- allow navigation;
- persist state through refresh;
- expose cancel only when safe;
- link back to the durable run;
- never block the entire shell with a spinner.

### Tablet and mobile shell

At tablet widths:

- Collapse the rail to icons or an off-canvas sheet.
- Keep the account scope and date controls accessible in the top bar.
- Evidence opens as a sheet.

On mobile:

- Bottom navigation: Briefing, Campaigns, Intelligence, Library.
- Top bar: workspace mark, account scope, freshness/attention indicator.
- Settings and Connections live in a More/profile sheet.
- Account scope opens a full-height searchable sheet.
- Filters use a bottom sheet with an applied-count summary.
- Use dynamic viewport units and safe-area padding.
- Do not merely place desktop tables inside horizontal overflow and call the result responsive.

---

## 12. Workspace and ad-account switching

Workspace switching and ad-account switching are different operations and must never look interchangeable.

### Workspace switcher

Workspace is the tenant/security boundary.

- Lives in the workspace/profile menu.
- Used relatively infrequently.
- Changes the workspace slug in the URL.
- Cancels all outstanding requests from the old workspace.
- Clears all old workspace caches before new data can paint.
- Resets invalid account scopes.
- Attempts to keep the equivalent destination in the new workspace.
- Falls back to the new workspace Briefing with a clear toast if that destination/entity does not exist.
- Never flashes data from the previous workspace.

Workspace rows show:

- workspace name;
- user role;
- optional brand mark;
- number of active ad accounts;
- attention status only if real.

### Ad-account scope switcher

Account scope is a frequent analytic control.

The trigger shows:

- provider marks;
- scope label;
- count of included accounts;
- currency when unambiguous;
- freshness or attention state.

The command surface is approximately 520–600px wide on desktop and a full-height sheet on mobile.

Sections:

1. Search.
2. Recent scopes.
3. Saved account groups.
4. Google Ads accounts.
5. Meta Ads accounts.
6. Connection actions.

Each account row shows:

- provider mark;
- account name;
- native account ID in mono;
- optional manager/business parent;
- currency;
- timezone;
- last successful sync;
- healthy, syncing, stale, expired, disabled, or attention state;
- checkbox where multi-account scope is supported.

Supported selections:

- one account;
- multiple compatible accounts;
- a saved group;
- All compatible active accounts.

Multi-account changes are staged:

- checking rows edits a local draft;
- Apply scope creates/resolves one opaque scope ID and commits once;
- Cancel or Escape discards the draft;
- focus returns to the trigger;
- one committed change causes one atomic data refresh.

Saved groups are workspace-owned. Users with the appropriate permission can create a named group from the current staged selection, rename it, or delete it. Group membership is stored server-side, resolves to an opaque scope ID, and updates all links that reference the group without exposing provider account IDs.

### Account switch behavior

1. User applies a staged scope draft.
2. The URL receives the resolved opaque scope ID.
3. Old requests are cancelled.
4. Shell and geometry remain stable.
5. The trigger says “Updating from [old] to [new].”
6. Every still-rendered old dataset retains its old ScopeSnapshot label, appears suspended, and is non-interactive.
7. New scope metadata and new datasets commit atomically.
8. Data regions update together and the trigger becomes the new scope label.
9. Focus returns to the trigger.

Never place old-scope values beneath a new-scope label. Every rendered dataset carries the resolved scope snapshot that produced it.

### Compatibility rules

The frontend may preflight obvious differences, but it is not the authority that decides whether accounts can be aggregated. The analytics backend returns a typed AggregationCompatibility result covering:

- currency;
- timezone/reporting-day basis;
- metric definition;
- attribution basis;
- data completeness;
- any named currency-conversion basis.

If accounts are incompatible:

- explain why;
- allow side-by-side comparison where useful;
- do not calculate a deceptive blended total;
- provide a deliberate currency conversion option only when the backend returns a named exchange-rate basis and compatible result.

### Keyboard behavior

- Slash may focus account search when the user is not typing.
- Command/Ctrl + K remains reserved for global command/intelligence.
- Use correct combobox/listbox patterns.
- Support arrow navigation, typeahead, Space for checkboxes, Enter to apply, Escape to close, and focus restoration.

---

## 13. Connections: plug in, plug out, and remain in context

“Plugin” in this product means a safe declarative data connector. It does not mean arbitrary third-party JavaScript running inside the frontend.

### Connection entry points

Connections can be opened from:

- the footer of the account scope switcher;
- the connection-health item in the rail;
- Settings → Connections;
- an empty state on Briefing or Campaigns.

All entry points open the same underlying feature and return the user to their prior context.

### Connection surface

Use a ledger, not a marketplace wall of glossy logo cards.

Top:

- connected providers;
- total selected accounts;
- most recent sync;
- accounts needing attention.

Provider rows:

- Google Ads;
- Meta Ads;
- File import, as a secondary/manual source.

Each row shows:

- provider identity;
- signed-in connection identity;
- number of accessible/selected accounts;
- granted read capabilities in plain language;
- health;
- last sync;
- primary contextual action.

Actions:

- Connect
- Select accounts
- Sync now
- Pause scheduled sync
- Resume
- Reauthorize
- Disconnect
- Delete stored data, as a separate destructive action

Do not represent Connect/Disconnect as a casual toggle. OAuth and stored-history consequences need explicit verbs and confirmation.

### Connect flow

Use a popup or deliberate full-page OAuth navigation as required by the provider.

Preferred interaction:

1. User clicks Connect.
2. A small preflight sheet states what HELM will read and what it will not change.
3. Provider authorization opens.
4. Callback closes the popup or returns to an internal callback route.
5. The original page remains the destination.
6. An account-selection sheet opens.
7. User selects accounts.
8. Initial sync begins.
9. The sheet can close while sync continues.

Never route through several settings pages merely to finish authorization.

### Disconnect flow

One confirmation sheet:

**Disconnect Meta Ads?**

**Future syncs will stop. Stored history remains available until you delete it separately. Existing reports keep their source labels and last-updated date.**

Actions:

- Keep connected
- Disconnect

Do not combine disconnect with data deletion. Deleting stored data is a separate destructive flow requiring stronger confirmation and an exact impact summary.

### Connection states

| State | User meaning | Primary action |
|---|---|---|
| Disconnected | No authorization | Connect |
| Authorizing | Provider flow in progress | Continue/cancel |
| Connected | Healthy and scheduled | View accounts |
| Syncing | New data arriving | View progress |
| Paused | Historical data retained | Resume |
| Needs reauthorization | Token/access expired | Reauthorize |
| Attention | Partial failure or account issue | Resolve |
| Disabled account | Provider account cannot serve/read | Inspect |

State is always expressed with icon, label, and text—not color alone.

### Frontend connector registry

Use a declarative registry so Meta Ads is not implemented as a second copy of Google Ads conditionals.

~~~ts
type ProviderKey = "google_ads" | "meta_ads" | "upload";

type ConnectorCapability =
  | "campaigns"
  | "ad_groups"
  | "ads"
  | "keywords"
  | "creative"
  | "daily_metrics";

type ConnectorDefinition = {
  key: ProviderKey;
  label: string;
  accountNoun: string;
  supportsMultipleAccounts: boolean;
  capabilities: ConnectorCapability[];
  setupSteps: string[];
};

type ConnectionStatus =
  | "disconnected"
  | "authorizing"
  | "connected"
  | "syncing"
  | "paused"
  | "needs_reauthorization"
  | "attention";
~~~

Provider-specific account selectors may be lazy-loaded, but they consume shared shell contracts and shared status components.

---

## 14. Meta Ads frontend specification

Meta Ads is a first-class provider, not a badge added to a Google-only screen.

### Connection sequence

Only request information when it becomes necessary:

1. **Authorize Meta**
   - Explain read access in plain language.
2. **Choose Business Portfolio**
   - Skip this visible step when only one valid option exists.
3. **Choose ad accounts**
   - Searchable multi-select.
   - Show ID, currency, timezone, status, and parent portfolio.
4. **Confirm initial scope**
   - Let the user choose one, several, or all compatible selected accounts.
5. **Begin initial sync**
   - Show real stages and allow the user to leave.

Do not ask for Facebook Page, Instagram identity, pixel, catalog, or dataset selections in the initial read-only performance flow unless a shipped feature requires them. Add these later through a clearly named advanced asset step.

### Meta-specific account states

Handle:

- full read access;
- partial account access;
- access removed;
- token expiration;
- disabled/restricted ad account;
- currency/timezone mismatch;
- account accessible but no recent delivery;
- sync delayed by provider limits;
- business portfolio contains nested or numerous accounts.

### Meta metrics

Normalized core metrics:

- spend;
- impressions;
- reach, where available;
- clicks and link clicks with definition visible;
- CPM;
- CTR;
- CPC;
- purchases/conversions with configured event visible;
- purchase/conversion value;
- CPA;
- ROAS;
- frequency.

Creative/video metrics, only when available:

- 3-second views;
- thumb-stop/hook proxy with exact formula visible;
- hold rate with exact formula visible;
- video completion milestones;
- outbound click behavior;
- creative frequency/fatigue indicators.

Do not invent a universal “hook score.” If HELM derives a score, expose the inputs and label it as derived.

### Cross-channel normalization

- Keep platform-reported values accessible.
- Make conversion action/event definitions inspectable.
- Do not blend Google conversion value with Meta purchase value until the product has a deliberate mapping.
- Show platform and normalized views as explicit modes where helpful.
- Any inferred cross-channel recommendation must identify the comparison basis and exclusions.

### Account hierarchy

Preserve native provider hierarchy within the selection flow:

- Google: manager account → client/serving account.
- Meta: business portfolio → ad account.

Present both through one HELM interaction grammar so the user learns the pattern once.

---

## 15. Onboarding

Onboarding is a short product setup, not an auth redirect maze.

### Entry rules

After authentication:

- accepted invitation → invited workspace;
- existing workspace → last workspace Briefing;
- multiple workspaces → last used workspace;
- no workspace → /onboarding.

### Onboarding steps

1. **Workspace**
   - Workspace name.
   - Optional display currency.
   - Nothing else unless legally/product-required.
2. **Connect data**
   - Google Ads.
   - Meta Ads.
   - Skip for now / use sample workspace.
3. **Select accounts**
   - Reuse the canonical provider account selector.
4. **Ready**
   - Show selected scope, freshness expectation, and direct entry to Briefing.

Allow users to connect one provider and continue. Do not make Google and Meta both mandatory.

### Sample mode

For frontend review and optional product tours:

- Clearly label the workspace “Sample workspace.”
- Use coherent Google and Meta data.
- Never mix sample data into a real workspace.
- Provide a persistent but quiet sample label.
- Leaving sample mode should be explicit.

---

## 16. Page-level product specifications

### 16.1 Briefing

Briefing is the default product route. It is a continuous intelligence report, not a wall of KPI cards.

#### Header

- One H1: “Briefing.”
- Human time context: “Monday, 24 August.”
- Quiet summary: account scope and complete date range.
- Share/export action only when implemented.

#### Scoreline

One divided horizontal scoreline with four to six metrics:

- Spend
- Attributed value/revenue, when supported
- ROAS or MER, based on available sources
- CPA or CAC, with the distinction explicit
- Conversions/purchases
- Optional new-customer metric when genuinely available

Each metric includes:

- current value;
- comparison delta;
- favorable/unfavorable semantic;
- concise definition;
- availability/caveat.

Do not show eight equal hover-lifting KPI cards.

#### Decision brief

Three sections:

1. **Needs a decision**
2. **Worth watching**
3. **Working as expected**

The first section is visually dominant and limited to roughly three high-value findings. Each finding includes:

- precise statement;
- financial exposure;
- evidence-quality marker;
- source accounts;
- date/comparison;
- next step;
- Open evidence;
- Investigate with HELM.

#### Performance movement

One primary trend chart driven by the selected scoreline metric. Use a comparison line or band where honest. Annotate material changes directly.

Below it:

- channel contribution;
- budget opportunity;
- creative fatigue signal;
- data-quality warning, only when present.

#### Since your last visit

Use a chronological ledger of material events rather than an audit log:

- new high-spend campaign;
- account sync recovered;
- creative crossed fatigue threshold;
- recommendation approved/dismissed;
- attribution definition changed.

### 16.2 Campaigns

Campaigns is a cross-channel explorer.

#### Top controls

- Search.
- Platform filter.
- Status filter.
- Level selector: campaign by default; ad group/ad set and ad as deeper views.
- Columns.
- Saved view.

Date, comparison, workspace, and account scope remain in the global scope bar.

#### Table

Default columns:

- Campaign
- Platform/account
- Status
- Spend
- Value
- ROAS
- CPA
- Change
- Intelligence status

Use sticky identity columns, clear sorting, virtualize only when needed, and preserve table state in the URL where shareable.

Rows support keyboard activation. A quick-inspect drawer may show a summary, but a durable campaign link remains available.

#### Campaign detail

Reduce the current ten-tab design to:

1. **Overview**
2. **Ads & Creative**
3. **Intelligence**

Secondary data such as structure, keywords, source files, and audit belongs in disclosures or drawers within those sections.

The campaign header includes:

- provider/account;
- status;
- date;
- core scoreline;
- Investigate with HELM.

### 16.3 Intelligence

Do not begin with an empty chatbot.

#### Entry composer

Start with purposeful intents:

- Diagnose a performance change.
- Prepare the weekly review.
- Find budget reallocation opportunities.
- Investigate creative fatigue.
- Build new creative directions.
- Ask a custom question.

Before starting, show inherited context:

- workspace;
- account scope;
- date/comparison;
- selected campaigns;
- attached brand/customer material;
- data freshness.

Users may adjust context without navigating to another page.

#### Run stages

~~~text
Queued
Collecting evidence
Analyzing
Reviewing
Waiting for your decision
Building artifact
Complete
~~~

Also support cancelled, blocked, failed, and revision states. Show real discrete stages rather than a fake percentage or typewriter.

#### Finding anatomy

Every finding contains:

- one precise observation;
- financial exposure;
- time window and comparison;
- source accounts;
- observed/calculated/inferred label;
- evidence quality/confidence;
- caveats;
- Open evidence;
- proposed next step.

#### Recommendation anatomy

- action;
- affected accounts/campaigns;
- expected direction and range, not fabricated certainty;
- assumptions;
- risk;
- effort/urgency;
- approval state;
- approve, revise, save, export, dismiss.

#### Decision memo

A completed run becomes one composed artifact:

- executive answer;
- findings;
- evidence;
- approved/rejected recommendations;
- decision notes;
- creative direction where relevant;
- linked assets;
- sources/freshness/method;
- export/share.

Do not scatter this across separate Documents, Agents, and Library pages.

### 16.4 Library

Library is a unified artifact home with two modes:

- Reports
- Creative

Reports include:

- decision memos;
- scheduled or saved briefings;
- exported snapshots.

Creative includes:

- creative directions;
- briefs;
- rendered variants;
- reusable copy;
- review status;
- linked evidence and campaign.

Create mode is contextual and progressive:

1. Start from a finding or campaign.
2. Choose a platform-aware format/preset.
3. Show inherited audience, objective, brand guidance, and constraint values.
4. Allow advanced editing only when requested.

Remove the current wall of always-visible raw prompt fields.

### 16.5 Settings

One settings route with internal tabs:

- Workspace
- Team
- Connections
- Preferences
- Audit

Use ledger rows and side panels; avoid a page of disconnected cards.

Audit is for governance and diagnostics. “Since your last visit” in Briefing remains a user-centered interpretation, not the raw audit feed.

### 16.6 Ops

/ops is a separately gated application for platform operators.

- Not linked for ordinary members.
- Its own shell may be denser.
- Contains provider/model health, cross-workspace errors, usage, and run diagnostics.
- Agent Fleet may live here or in an individual Intelligence run inspector.
- Never leak Ops vocabulary into normal marketing pages.

---

## 17. Charts and data presentation

### Chart selection

- Line: change over time.
- Bar: ranked comparison.
- Stacked bar/area: composition over time when totals matter.
- Scatter/quadrant: relationship between two quantitative variables with an explicit decision rule.
- Donut: only one simple proportion; otherwise use a bar.
- Table: exact multi-variable detail.

### Hard rules

- One semantic question per chart.
- Avoid two unrelated measures on one y-axis.
- If separate scales are unavoidable, use separate aligned small multiples before dual axes.
- Title states the question; subtitle states basis and comparison.
- Axes, units, source, date, timezone, and attribution basis are available.
- Direct-label important series when space permits.
- Use a validated series order and do not casually cycle colors.
- Provider colors identify source, not data-series meaning.
- No 3D, decorative gradients, unlabeled sparklines as evidence, or meaningless animation.
- Exact data is available by hover, tap, focus, and an accessible table.
- Color is never the only good/bad indicator.
- Loading skeleton matches chart geometry.
- Empty, partial, stale, and failed states are distinct.

### Metric honesty

- CPA is not automatically CAC.
- Conversion value is not automatically revenue.
- Link clicks are not all clicks.
- Meta and Google conversion definitions may differ.
- Reach and impressions are not interchangeable.
- Any derived metric provides its formula.
- Cross-currency totals remain unavailable until a supported conversion basis exists.
- The interface states “not available” rather than estimating without permission.

---

## 18. Component system

Build small, semantic component families. Do not recreate one enormous general-purpose ui.tsx file.

### Brand

- HelmMark
- HelmWordmark
- SignalMap
- DecisionSpine
- ProviderMark
- MistField

### Public

- MarketingHeader
- HeroDecisionScene
- EditorialSection
- ReconciliationScene
- DecisionBriefScene
- ConnectorPatchBay
- ProvenanceLedger
- MarketingFooter

### Shell and scope

- AppRail
- MobileNavigation
- ScopeBar
- WorkspaceMenu
- AccountScopeTrigger
- AccountScopeCommand
- AccountRow
- FreshnessIndicator
- BackgroundWorkStatus
- GlobalCommand

### Data and intelligence

- Scoreline
- MetricCell
- Finding
- EvidenceDrawer
- Recommendation
- DecisionControls
- RunTimeline
- ProvenanceRail
- MetricChart
- AccessibleDataTable
- CampaignTable

### Connections

- ConnectionLedger
- ConnectionRow
- ConnectionPreflight
- ProviderAccountSelector
- SyncProgress
- DisconnectConfirmation
- DeleteDataConfirmation

### Feedback and primitives

- Button
- IconButton
- TextField
- Select/Combobox
- Checkbox
- Tabs
- Disclosure
- Tooltip
- Popover
- Dialog
- Drawer/Sheet
- Toast
- InlineNotice
- Skeleton
- EmptyState
- ErrorState
- PermissionState

### Component rules

- Primitive controls use variants; feature components use semantic names.
- Avoid deeply configurable “god components.”
- A non-interactive surface never gets pointer cursor, hover lift, or button semantics.
- Dialogs trap focus, lock background scroll, close on Escape when safe, and restore focus.
- Drawers and sheets have clear headings and close controls.
- All asynchronous actions have idle, pending, success, and error behavior.
- All icon-only controls have accessible names.
- Status badges include a text label.
- Use composition instead of dozens of boolean props.
- Keep brand scenes separate from product primitives so marketing motion does not infect application bundles.

---

## 19. Frontend domain contracts

Design the frontend around stable product concepts rather than current backend response shapes.

### Core entities

~~~ts
type ProviderKey = "google_ads" | "meta_ads" | "upload";

type Workspace = {
  id: string;
  slug: string;
  name: string;
  defaultCurrency: string;
  role: "owner" | "admin" | "analyst" | "viewer";
};

type AdAccount = {
  id: string;
  provider: Exclude<ProviderKey, "upload">;
  nativeId: string;
  name: string;
  parentLabel?: string;
  currency: string;
  timeZone: string;
  status: "active" | "disabled" | "attention";
  connectionId: string;
  lastSyncedAt: string | null;
};

type AccountScope =
  | { id: string; kind: "all-compatible"; label: string; accountIds: string[] }
  | { id: string; kind: "group"; label: string; accountIds: string[] }
  | { id: string; kind: "selection"; label: string; accountIds: string[] };

type SyncHealth = {
  state:
    | "never_synced"
    | "fresh"
    | "syncing"
    | "partial"
    | "delayed"
    | "stale"
    | "paused"
    | "needs_reauthorization"
    | "failed";
  lastSuccessfulSyncAt: string | null;
  nextScheduledSyncAt?: string | null;
  message?: string;
};

type Money = {
  currency: string;
  minorUnits: string;
};

type AccountDataBasis = {
  accountId: string;
  provider: Exclude<ProviderKey, "upload">;
  timeZone: string;
  currency: string;
  attributionLabel: string;
  freshness: SyncHealth;
};

type AggregationCompatibility =
  | { state: "compatible" }
  | {
      state: "converted";
      reportingCurrency: string;
      conversionBasis: string;
    }
  | {
      state: "separated";
      reasons: string[];
    };

type DataBasis = {
  accountIds: string[];
  startDateInclusive: string;
  endDateInclusive: string;
  comparisonStartDateInclusive?: string;
  comparisonEndDateInclusive?: string;
  completeThroughDate: string;
  accountBasis: AccountDataBasis[];
  aggregation: AggregationCompatibility;
  exclusions: string[];
};

type Finding = {
  id: string;
  title: string;
  observation: string;
  kind: "observed" | "calculated" | "inferred";
  severity: "decision" | "watch" | "stable";
  exposure?: { low: Money; high: Money };
  confidence: "high" | "medium" | "low";
  evidenceIds: string[];
  basis: DataBasis;
  recommendedNextStep?: string;
};

type Recommendation = {
  id: string;
  findingId: string;
  action: string;
  rationale: string;
  assumptions: string[];
  risks: string[];
  affectedAccountIds: string[];
  affectedCampaignIds: string[];
  expectedDirection: "increase" | "decrease" | "protect" | "investigate";
  status: "proposed" | "approved" | "revision_requested" | "dismissed";
};
~~~

Additional named contracts:

- Connection
- ConnectorDefinition
- MetricDefinition
- MetricSeries
- CampaignSummary
- CreativeSummary
- Evidence
- Decision
- IntelligenceRun
- Artifact
- UserPreference
- Permission

### Contract rules

- No any in feature code.
- Parse/validate external API data at the adapter boundary.
- Dates cross the boundary as ISO strings and become formatted values in one utility layer.
- Money values carry currency.
- Percent values declare whether they are ratios or already multiplied.
- Metric definitions live in a central catalog.
- Provider-native fields live in provider namespaces instead of leaking into every shared component.
- Feature components consume domain models, not raw network responses.
- Errors use a typed shape with user-safe message, retryability, code, and optional field detail.

### Date, timezone, locale, and money semantics

- Analytics start/end dates are inclusive calendar dates.
- The backend computes complete-day ranges in each account’s IANA reporting timezone and returns the exact resolved dates.
- Never derive “last 30 days” by subtracting 30 × 24 hours in the browser.
- DST follows the IANA timezone database; UI displays dates, not assumed fixed-hour buckets, for daily reporting.
- Mixed-timezone scopes carry per-account basis records and an explicit aggregation result.
- Use Intl with the user/workspace locale and currency; do not hard-code en-IN merely because the sample workspace uses INR.
- Money crosses contracts as decimal strings or minor-unit strings, never floating-point JavaScript values.

---

## 20. State, data fetching, and cache behavior

### Server-first rendering

- Server Components are the default.
- Marketing content, metadata, and initial public layout render on the server.
- Protected layouts validate the session on the server before protected UI paints.
- Use client islands for account command menus, charts, interactive tables, auth buttons, and motion.
- Do not place use client at the top of every page.

### Shared query layer

Beginning in Phase 2, use TanStack Query as the feature-aware client query/cache layer. Do not install it in Phase 1A unless the two public routes actually consume it.

Every analytic query key includes:

- workspace ID or slug;
- account scope;
- date range;
- comparison;
- metric/view parameters.

Requirements:

- Query functions accept and propagate AbortSignal.
- Workspace switch uses predicate-based cancellation/removal for the old workspace.
- Scope, range, and comparison changes invalidate only dependent queries.
- Mutations use narrow optimistic updates with rollback.
- Every successful analytic response carries the resolved ScopeSnapshot used to produce it.

Workspace switch:

- cancel outgoing requests;
- clear workspace-scoped caches;
- remove optimistic state;
- prevent old responses from committing;
- load the new equivalent route.

Account switch:

- cancel affected queries;
- retain stable geometry;
- invalidate scope-dependent queries;
- preserve only clearly suspended prior data;
- never clear unrelated UI state such as open navigation.

### URL and preference hierarchy

1. Explicit URL query.
2. Saved view or user preference.
3. Last valid scope for this workspace.
4. Workspace default.

Do not allow local storage to silently override a shareable URL.

### Streaming and background updates

- A durable intelligence run may use SSE or another server-supported stream later.
- Reconnect using durable event IDs/state.
- Treat stream closure, auth failure, and completed work differently.
- Poll only when necessary and back off.
- Freshness updates should not cause an entire page to remount.

### Error semantics

Differentiate:

- unauthenticated;
- unauthorized;
- network unavailable;
- service unavailable;
- provider needs reauthorization;
- partial data failure;
- entity not found;
- validation failure;
- rate-limited;
- run blocked.

A session network failure is not “logged out.” A failed secondary request does not silently erase the entire section.

---

## 21. Mock-data contract for frontend design

The frontend must be fully reviewable before the backend exists.

Phase 1A implements only two small typed fixtures:

- PublicDemoContent for the hero/signature scene.
- AuthViewScenario for ready, redirecting, failed, and unavailable sign-in presentation.

The full Workspace, Connection, analytics, cache, and scenario adapter system described below begins in Phase 2. Do not scaffold the entire future application during the visual checkpoint.

### Mock adapter

- Use a feature adapter interface with mock and future HTTP implementations.
- Mock latency is deterministic and short.
- Support explicit success, loading, empty, stale, partial, permission, and error scenarios.
- Do not scatter hard-coded mock objects inside page JSX.
- Add a non-production scenario selector accessible only in development.

### Canonical sample workspace

Workspace:

- Northstar Group
- Default currency: INR
- Timezone: Asia/Kolkata

Accounts:

1. Google Ads — Northstar India / Search
   - Sample ID: 187-DEM-9021
   - INR
   - Asia/Kolkata
   - Healthy
2. Google Ads — Northstar India / Performance Max
   - Sample ID: 605-DEM-7740
   - INR
   - Asia/Kolkata
   - Healthy
3. Meta Ads — Northstar India / Prospecting
   - Sample ID: 2385-DEMO-2110
   - INR
   - Asia/Kolkata
   - Healthy
4. Meta Ads — Northstar India / Retargeting
   - Sample ID: 2385-DEMO-2911
   - INR
   - Asia/Kolkata
   - Delayed
5. Google Ads — Northstar US / Search
   - Sample ID: 792-DEM-3504
   - USD
   - America/New_York
   - Used to demonstrate incompatible aggregation

### Sample decision story

Use one story across landing, Briefing, Campaigns, and Intelligence so the product feels authored:

- Meta Prospecting / Broad 04 increased spend while CPA rose 31%.
- Frequency reached 4.8.
- The leading short-form creative’s 3-second video-view rate fell from 32% to 24%; the illustrative formula is 3-second video plays ÷ impressions.
- Google Non-Brand / High Intent remained efficient but lost 18% impression share to budget.
- HELM proposes a 14-day test capped at ₹120k and a creative refresh; it does not present a permanent reallocation as settled fact.
- Illustrative financial exposure: ₹42k–₹68k of acquisition cost if current rates persist. Label this as modeled sample output, not a forecast or guarantee.
- Evidence includes source account, complete date window, comparison, freshness, metric definition, and exclusions.
- Recommendation is explicitly proposed, not executed.

Sample analytical basis:

- Analysis window: 25 July–23 August 2026 inclusive, the most recent 30 complete Asia/Kolkata reporting days.
- Comparison: 25 June–24 July 2026 inclusive.
- Current partial day is excluded.
- Northstar US is excluded for currency/timezone incompatibility.
- Meta Retargeting is excluded because its sync is delayed.
- Workspace mapping includes only Google primary Purchase and Meta Purchase, normalized to a click-attributed purchase on a common illustrative 7-day click basis.
- Provider-native numbers remain inspectable, and the proposed shift remains a bounded experiment because platform measurement can still differ.
- The illustrative exposure model holds mapped volume at 55 purchases and compares the observed Meta CPA band of ₹2,300–₹2,600 with Google’s capacity-adjusted CPA band of ₹1,360–₹1,540.
- Formula: 55 × (Meta CPA band − Google CPA band) = ₹41,800–₹68,200, displayed as the rounded ₹42k–₹68k range.
- The model excludes view-through lift, saturation after the test cap, and any revenue effect.

### Canonical sample creative family

The fictional advertiser is Northstar Hydration and the product is the Arc Bottle.

Creative language:

- graphite, frost, deep cobalt, and one warm coral annotation;
- hard editorial crops;
- a low horizon and purposeful negative space;
- condensed proof statements, never generic inspirational slogans;
- campaign line: “Cold, long after the road warms.”

Three related variants:

1. **Product proof**
   - Macro condensation on the Arc Bottle.
   - Cobalt ground, precise side light.
   - “18 HOURS COLD” as the evidence-led hook.
2. **Field use**
   - Early-morning runner cropped with the bottle as the visual anchor.
   - Dust-blue terrain and no smiling stock-photo pose.
   - Campaign line appears as a restrained lower annotation.
3. **Typographic test**
   - Oversized “18,” bottle silhouette, and one peach registration mark.
   - Built as an editorial poster rather than a floating 3D product render.

For Phase 1, these may be composed as original SVG/graphic poster assets. Do not generate unrelated glossy AI advertisements or switch visual brands between sections.

### Required mock scenarios

- No workspace.
- No connection.
- Google only.
- Meta only.
- Both providers healthy.
- Multiple workspaces.
- Multiple currencies.
- Initial sync.
- One provider delayed.
- Token needs reauthorization.
- Account disabled.
- No campaign data in range.
- Partial metric availability.
- Empty Intelligence history.
- Active run.
- Waiting for decision.
- Completed decision memo.
- Viewer without edit permission.
- Service/network failure.

Mock data must be labeled as illustrative wherever a public visitor could mistake it for real customer proof.

---

## 22. Interaction and content-state matrix

Every data-bearing feature must design these states before it is considered complete:

| State | Required treatment |
|---|---|
| Initial loading | Geometry-matched skeleton; no layout jump |
| Background refresh | Existing content remains; quiet progress/freshness |
| Empty but healthy | Explain value and offer one next action |
| No permission | State what is unavailable and who can change it |
| Stale | Preserve data, show timestamp and recovery action |
| Partial | Show available sections plus exact missing source |
| Error | Plain message, retry when safe, support detail in disclosure |
| Offline | Preserve last-known data if allowed and label it |
| Success | Confirm locally; do not redirect for confirmation |
| Destructive pending | Exact scope and consequence |
| Destructive complete | State what was removed and what remains |

### Empty-state writing

Bad:

> Nothing here yet.

Good:

> No ad accounts are connected to Northstar Group. Connect Google Ads or Meta Ads to build the first Briefing.

One primary action is enough. Do not fill empty states with illustrations, multiple buttons, and long documentation unless the decision genuinely needs them.

### Toast rules

Use toasts for:

- local confirmation;
- non-blocking failure;
- scope fallback;
- copy/export confirmation.

Do not use a toast as the only record of:

- destructive consequence;
- auth failure;
- data-quality warning;
- permission denial;
- background run failure.

---

## 23. Copy system

### Naming

Use:

- Workspace
- Ad account
- Account scope
- Connection
- Briefing
- Finding
- Evidence
- Recommendation
- Decision
- Intelligence run
- Report
- Creative direction
- Freshness

Avoid in normal user copy:

- Tenant
- Fleet
- Orchestrator
- Provider stub
- Invocation
- Normalized table
- Payload
- Resource ID
- LLM
- System prompt

### Action labels

Use exact verbs:

- Connect Google Ads
- Connect Meta Ads
- Select accounts
- Sync now
- Pause sync
- Reauthorize
- Disconnect
- Open evidence
- Investigate with HELM
- Approve recommendation
- Request revision
- Save for later
- Dismiss finding

Avoid vague actions:

- Continue, when the destination can be named
- Submit
- Go
- Manage, when a more exact action exists
- Learn more, when the link can state its content

### Intelligence language

Separate:

- **Observed** — directly present in source data.
- **Calculated** — derived from a disclosed formula.
- **Inferred** — a judgment from multiple signals.

Use ranges and direction when certainty is limited. Do not print a precise projected revenue number merely because the UI looks more impressive with one.

---

## 24. Accessibility

Target WCAG 2.2 AA.

### Baseline

- Logical heading order.
- One page H1.
- Skip link.
- Visible focus against both dark and light fields.
- Keyboard access to every action.
- No status conveyed by color alone.
- Correct labels, descriptions, and error association.
- Live regions for auth, sync, upload, and run changes.
- Comfortable touch targets.
- Text contrast checked in every mist/overlay state.
- Zoom to 200% without loss of content or action.
- Forced-colors support for core actions/status.

### Complex controls

Account switcher:

- correct combobox/listbox or dialog pattern;
- typed search;
- announced selection count;
- provider grouping remains perceivable;
- focus restored to trigger.

Drawers/dialogs:

- focus trapped;
- background inert;
- Escape behavior;
- close button;
- heading/description;
- restored focus.

Charts:

- concise accessible summary;
- focus/tap exact values;
- keyboard navigation between points when useful;
- data-table alternative;
- pattern/label support for color distinctions.

Motion:

- reduced-motion state is intentional;
- no essential information depends on animation order;
- auto-advancing marketing narrative can be paused or becomes static.

### Known current issues not to reproduce

- Mouse-only clickable table rows.
- Hover-only chart explanations.
- Drawers without complete focus management.
- Controls below comfortable target size.
- Hidden mobile content with a still-visible toggle.
- JavaScript count-up ignoring reduced-motion preference.

---

## 25. Responsive design

Design and verify these widths:

- 1440
- 1280
- 1024
- 768
- 390
- 360

Also test:

- 200% browser zoom;
- short landscape mobile;
- long localized text;
- very large account names;
- 50+ accounts in the switcher;
- wide currency values;
- empty and error layouts.

### Mobile is a distinct hierarchy

- Briefing prioritizes decision findings before the complete scoreline.
- Campaign rows become concise records with an explicit detail action.
- Tables that remain scrollable keep identity sticky and show an overflow cue.
- Evidence is a full sheet, not a narrow desktop drawer.
- Account scope is a searchable sheet.
- History and context panels in Intelligence are separate sheets.
- Product demonstrations on landing are recomposed vertically, not scaled down.
- Sign-in retains brand character rather than dropping the narrative surface entirely.

---

## 26. Frontend architecture

Keep Next.js App Router, React, strict TypeScript, and utility-first styling, but rebuild the feature structure.

~~~text
frontend/
  public/
    brand/
    social/
  src/
    app/
      (marketing)/
        page.tsx
      (auth)/
        signin/
          page.tsx
      onboarding/
      w/
        [workspaceSlug]/
          layout.tsx
          page.tsx
          campaigns/
          intelligence/
          library/
          settings/
      ops/
      error.tsx
      not-found.tsx
      globals.css
      layout.tsx
    components/
      brand/
      feedback/
      primitives/
      public/
      shell/
      scope/
    features/
      auth/
      briefing/
      campaigns/
      connections/
      intelligence/
      library/
      settings/
    contracts/
    services/
      adapters/
      http/
      mock/
    styles/
      tokens.css
      motion.css
    test/
~~~

### Architecture rules

- Server Components by default.
- Central route builder; no scattered hand-built workspace URLs.
- Typed domain contracts at feature boundaries.
- API adapters isolate future backend shapes.
- Runtime validation at untrusted boundaries.
- Feature folders own their query definitions, transformations, and tests.
- Query keys always include workspace and scope.
- Public and product bundles remain separate.
- Brand animations lazy-load below the fold where possible.
- Use a small unstyled accessibility primitive dependency only if it materially improves dialog/menu/combobox behavior.
- Do not install a large UI kit that brings a recognizable default aesthetic.
- Do not use raw img for remote product imagery without a deliberate image/CDN policy.
- Keep files comprehensible; split pages long before they approach the current 700–1,100-line size.
- Before Library or decision memos render backend/AI-authored rich content, sanitize Markdown/HTML, allow only reviewed link protocols, block inline script/style/event handlers, and enforce the reviewed media-origin policy.

### Auth architecture

Separate:

- Google identity authentication;
- Google Ads connection authorization;
- Meta Ads connection authorization.

Users must never believe that signing in automatically connects an ad account.

- Session cookie remains HttpOnly and secure.
- Ad-platform access/refresh tokens remain server-side and are never exposed to browser JavaScript or browser storage.
- Validate return destinations server-side.
- Protected routes are guarded before paint.
- Permissions are typed per workspace.
- Backend denial remains authoritative; frontend permissions improve clarity only.

### Environment configuration

- Validate required server environment at startup/build as appropriate.
- Never expose secrets through NEXT_PUBLIC variables.
- Define a server-only SITE_URL as the canonical public origin for metadata, OAuth return construction, robots, and sitemap.
- Public feature availability should be a stable server-rendered configuration, not a client probe that changes the CTA after paint.
- Provide a documented mock mode for frontend-only development.
- Keep live OAuth and mock auth behind the same interface.

### Route files

Add intentional:

- loading.tsx where streaming/loading benefits the route;
- error.tsx with retry/recovery;
- not-found.tsx for durable entities;
- metadata for public routes;
- favicon and application icons;
- robots.ts and sitemap.ts for the public site;
- a safe auth callback route when backend integration arrives.

---

## 27. Production and deployment requirements

Phase 1A is **design-preview ready**, not production-ready. A clean build, deterministic tests, baseline headers, metadata, and a preview deployment are required; live session/OAuth/connector guarantees become release gates as each live feature is integrated.

### Build and quality scripts

Provide non-interactive scripts for:

- dev
- build
- start
- lint
- typecheck
- unit tests
- end-to-end tests
- accessibility tests
- visual screenshot tests

The current interactive/deprecated lint setup is not acceptable.

### Hosting

Use one same-origin production topology:

~~~text
Browser
  → public HELM origin (Next server / standalone Next container)
    → same-origin /api and OAuth callback paths
      → reverse proxy or Next server route forwards to the private backend origin
~~~

- The browser never calls the backend origin directly.
- The session cookie is set for the public frontend origin through the same-origin auth/callback path.
- Protected Server Components resolve the session by forwarding the incoming cookie to the private backend session endpoint.
- The backend remains authoritative for session, membership, permission, and workspace resolution.
- Package the Next application as standalone output behind the deployment reverse proxy.

Define:

- API origin/rewrite behavior;
- trusted proxy/cookie settings;
- image origin policy;
- health endpoint;
- build-time versus runtime environment;
- cache headers;
- security headers;
- logging/monitoring integration;
- rollback procedure.

Do not assume localhost:8000 in production.

### Live-feature release gates

Before live identity auth:

- same-origin session topology;
- cookie/security settings;
- safe returnTo;
- callback and failure-loop tests;
- CSRF model.

Before each live connector:

- provider callback state;
- server-side token storage;
- permission copy;
- reauthorization/disconnect behavior;
- privacy-safe observability.

Before user-authored or AI-authored rich content:

- sanitizer;
- safe-link/media policy;
- malicious-content tests.

### Security baseline

- Content Security Policy compatible with chosen auth and asset origins.
- HSTS at the deployment edge.
- Referrer and permissions policies.
- Frame-ancestor policy.
- No secrets in browser bundles.
- No provider tokens in local/session storage.
- Safe return URL validation.
- CSRF-aware mutation model.
- Redaction of account IDs and user details from client error telemetry where appropriate.

### Observability

Capture:

- route errors;
- failed data queries;
- auth start/callback/failure;
- connector start/callback/failure;
- account switch duration/failure;
- stale-data warnings;
- intelligence run start/completion/failure;
- Web Vitals.

Do not record prompts, report contents, tokens, or raw campaign/customer data in general analytics.

Phase 1A ships no third-party product/marketing analytics. Add analytics only after privacy copy, consent behavior where required, retention, and event redaction are approved.

### Performance budget

Targets:

- LCP below 2.5 seconds at the 75th percentile.
- INP below 200ms.
- CLS below 0.1; aim below 0.05 on landing/sign-in.
- No hydration warnings.
- No route-wide client bundle merely to animate a background.
- Marketing hero works as HTML/CSS/SVG before JavaScript enhancement.
- Heavy chart/creative modules load only where used.
- Font files are subset and preloaded deliberately.
- Animation remains on compositor-friendly properties.

### Supported browsers

The tested support matrix is the current and immediately previous stable release of Chrome, Edge, Firefox, and Safari, plus the current iOS Safari release. Progressive enhancement is acceptable for decorative motion; content, navigation, authentication entry, scope selection, tables, and every decision-critical action must remain functional throughout this matrix. Document any deliberate exception instead of silently depending on a Chromium-only API.

### Image and asset policy

- Create a real frontend/public brand asset structure.
- Use code-native SVG for the decision map, diagrams, and mark where appropriate.
- Use coherent, deliberately art-directed sample creative rather than random stock or generic AI imagery.
- Optimize raster assets and provide dimensions.
- Produce a dedicated Open Graph composition.
- Avoid external runtime assets that can disappear or change without review.

---

## 28. Testing and visual QA

### Required toolchain

- ESLint CLI with eslint-config-next; no interactive next lint command.
- TypeScript with tsc --noEmit.
- Vitest and React Testing Library for unit/component tests.
- Playwright for browser flows and screenshots.
- @axe-core/playwright for automated accessibility checks.

Required scripts:

~~~text
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run build
~~~

Phase 1A test scope is intentionally narrow:

- public header/anchor/sign-in navigation;
- safe returnTo pure utility;
- deterministic sign-in view states;
- keyboard focus and Google-button loading width;
- responsive overflow at required widths;
- reduced-motion final state;
- full frontend build, including untouched legacy routes.

Workspace, connector, cache, Intelligence, and live OAuth tests begin in their corresponding later phases.

### Unit and component tests

Cover:

- safe returnTo validation;
- route builders;
- metric formatting/availability;
- account compatibility;
- connector state transitions;
- scope selection;
- permission visibility;
- reduced-motion utilities;
- error normalization.

### Integration tests

Cover:

- signed-out protected route → sign-in → validated return;
- already signed-in sign-in route → workspace;
- no-workspace onboarding;
- workspace switch without stale data;
- account switch while requests are in flight;
- Google connection callback returns to prior context;
- Meta connection callback and account selection;
- reauthorization;
- disconnect while retaining history;
- partial/stale provider data;
- Intelligence run continues through navigation.

### Accessibility tests

- Automated axe checks on every top-level route/state.
- Manual keyboard pass.
- Screen-reader pass for sign-in, account scope, evidence, and run status.
- Reduced-motion pass.
- Forced-colors/high-contrast pass.
- 200% zoom.

### Visual regression

Capture:

- 1440×900
- 1280×800
- 1024×768
- 768×1024
- 390×844
- 360×800

For Phase 1A capture at least:

- landing header/hero/signature scene;
- sign-in ready;
- sign-in loading;
- sign-in error;
- landing/sign-in reduced-motion;
- mobile menu and mobile sign-in.

For Phase 1B additionally capture:

- landing full-page;
- each materially different editorial composition;
- one mid-scroll decision scene;
- footer/final transition;
- Open Graph composition.

Review:

- no horizontal overflow;
- no text clipping;
- no unexpected font swap;
- no low-contrast mist state;
- no duplicate H1;
- stable header;
- focus ring visibility;
- stable button widths during loading;
- intentional mobile composition.

### Browser console

The checkpoint is not complete with:

- hydration warnings;
- missing keys;
- unhandled promise rejection;
- failed asset requests;
- accessibility warnings;
- repetitive network calls;
- layout-shift-causing font/image loads.

---

## 29. Delivery plan and approval gates

### Phase 0 — preserve and establish foundations

- Preserve the current frontend in version control.
- Do not touch the backend.
- Inventory existing mark, iconography, tokens, and reference scenes.
- Establish canonical tokens and the reviewed next/font/google setup.
- Define PublicDemoContent, AuthViewScenario, and minimal public route helpers.
- Configure non-interactive lint/typecheck/test commands.

### Phase 1A — visual concept gate: hero and sign-in

Build:

- / with header, asymmetric hero, signature signal scene, and a clean temporary page ending
- /signin as a complete responsive composition
- brand mark/wordmark
- exact dark/light mist variants
- typography and token system
- buttons, links, focus, notices
- signal map and decision-spine visual
- deterministic sign-in view states, not live authentication
- responsive/reduced-motion behavior
- PublicDemoContent and AuthViewScenario only
- basic title/description/canonical metadata and favicon
- the narrow Phase 1A test/visual toolchain

Do not build:

- product shell;
- Briefing;
- Campaigns;
- Intelligence;
- Library;
- Settings;
- Connections implementation;
- onboarding;
- Meta OAuth;
- backend integration.
- full domain/query/connector mock architecture.

At the end:

- run all available quality checks;
- capture the required screenshots;
- list deliberate deviations;
- stop for user approval.

### Phase 1A acceptance gate

The design is approved only if:

- it does not resemble the current generic landing structure;
- one signature signal-to-decision story is immediately understandable;
- landing and sign-in are related but do not repeat each other;
- dark and light material systems feel like one brand;
- the UI looks composed at every target width;
- Google and Meta both appear naturally in the product story;
- public pages contain no debug/config/internal vocabulary;
- no fake claims or social proof exist;
- body copy is comfortably readable;
- controls meet focus/touch expectations;
- motion settles and has a complete reduced-motion equivalent;
- build, lint, typecheck, tests, and console are clean.

Objective visual checks:

- At 1440px, the signal scene occupies at least 40% of hero width and is co-primary with the headline.
- Above the fold includes “Sample workspace,” both provider identities, the ₹120k recommendation, the complete date basis, and at least two evidence signals.
- No equal-card row or bento composition appears above the fold.
- The signal map contains no more than five labeled source/account nodes, one reconciliation core, one discrepancy split, and one recommendation annotation.
- Hero choreography finishes within 2.2 seconds. Data packets stop; only low-opacity mist may continue.
- Reduced motion renders the identical final information state immediately.
- At 390px, the recommendation and first evidence rows appear within 1.5 viewport heights; the product scene is not hidden.
- Sign-in holds the 58/42 desktop split and retains a 34–40% branded region on mobile.
- Normal prose is at least 14px, metadata at least 12px, and primary controls at least 44px.
- Text contrast meets WCAG AA in every static and animated mist state.
- Loading does not change auth-button width or header height.
- There is zero horizontal overflow, clipping, or sticky-header height shift at every required capture size.

### Phase 1B — complete the public landing

After Phase 1A visual approval, build:

- all five editorial movements using at least three different compositions;
- reconciliation, decision brief, creative intelligence, account optionality, and provenance scenes;
- continuous decision spine across sections;
- public footer and final transition;
- complete anchor navigation;
- complete route metadata;
- Open Graph asset;
- robots.ts and sitemap.ts;
- full landing screenshot matrix.

Phase 1B stops for approval before any authenticated product route is built.

### Phase 2 — shell, onboarding, and scope

- canonical workspace routing;
- four-item navigation;
- workspace switcher;
- account scope command;
- date/comparison;
- mobile shell;
- onboarding;
- connection ledger with Google/Meta mock flows;
- cache invalidation and stale-context tests.

### Phase 3 — Briefing and Campaigns

- scoreline;
- decision brief;
- evidence drawer;
- chart system;
- campaign explorer;
- campaign detail;
- responsive data records.

### Phase 4 — Intelligence

- intent-led composer;
- context preview;
- durable run stages;
- findings/evidence/recommendations;
- decision controls;
- decision memo;
- background status.

### Phase 5 — Library, Settings, and Ops

- reports and creative artifacts;
- contextual create mode;
- workspace/team/preferences/audit;
- gated Ops.

### Phase 6 — backend integration and hardening

- replace mocks feature by feature;
- generated or validated API contracts;
- live auth and OAuth callbacks;
- streaming/background run integration;
- observability;
- full accessibility review;
- performance budget;
- deployment and rollback verification.

---

## 30. Exact Claude CLI starting directive

First run:

~~~powershell
Set-Location 'C:\Users\prach\HELM103\Helm103'
~~~

Then copy the following into Claude CLI:

~~~text
Read FRONTEND_REBUILD_BRIEF.md completely before editing anything.

Rebuild only the HELM frontend in ./frontend. Treat the current React frontend and ./design/*.dc.html as visual and behavioral reference material, not architecture to extend. Do not edit ./backend.

Inspect git status first. Preserve all existing uncommitted work and do not overwrite unrelated user changes. Avoid mass deletion during the first checkpoint; leave authenticated routes untouched until the public concept is approved.

Replace or atomically move the existing src/app/page.tsx and src/app/signin/page.tsx; do not create duplicate App Router pages for the same URLs. Namespace new public styles or keep legacy token aliases so existing authenticated routes continue to compile. Run the full frontend build.

This is a premium paid-media intelligence product for Google Ads and Meta Ads. Its core visual and product grammar is:
source signal → discrepancy → evidence → recommendation → human decision.

Preserve the HELM mark, ink/indigo/blue-sand/pale-peach family, Instrument Sans + IBM Plex Mono, tabular metrics, hairline-led surfaces, freshness, evidence, and read-only trust model. Remove generic AI-SaaS composition, excessive rounded cards, sparkle/orb theater, internal agent/provider vocabulary, public environment/config messages, duplicate page concepts, and redirect-heavy flows.

FIRST CHECKPOINT = PHASE 1A ONLY:
- Implement / with the header, asymmetric hero, signature signal scene, and a clean temporary page ending.
- Implement /signin as a complete responsive composition with deterministic ready, redirecting, failed, and unavailable view states.
- Authentication is visual-only in this checkpoint. Create the AuthAdapter boundary and safe-return utility, but do not create a live session, callback, successful redirect, invitation continuation, or protected-route guard.
- Implement only the shared brand, token, typography, motion, public component, basic metadata/favicon, PublicDemoContent, AuthViewScenario, and narrow test foundations those two routes need.
- Build the authored signal-map / decision-spine product scene described in the brief.
- Use Google Ads and Meta Ads in one coherent illustrative decision story.
- Make the landing asymmetric and editorial. Do not build a centered generic hero, bento wall, equal feature cards, fake chat, neural network, or floating glass dashboard.
- Make sign-in minimal and trustworthy. Keep identity authentication separate from ad-account connection. Hide development access outside production presentation.
- Make both routes work on desktop, tablet, mobile, keyboard, and reduced motion.
- Add the prescribed non-interactive lint, typecheck, build, Phase 1A tests, accessibility checks, and visual screenshots.

Do not implement the remaining five landing movements, authenticated shell, onboarding, Briefing, Campaigns, Intelligence, Library, Connections, Meta OAuth, full domain/query mock architecture, or backend integration yet.

When Phase 1A is complete, run the full quality checks, capture the Phase 1A screenshots required by the brief, state plainly that authentication is not yet functional, summarize the files and deliberate design decisions, and STOP for visual approval.
~~~

---

## 31. Existing project reference map

Use these selectively:

- frontend/src/app/page.tsx — current landing; replace its generic section structure.
- frontend/src/app/signin/page.tsx — current auth behavior and split layout; simplify and remove public diagnostics.
- frontend/src/app/globals.css — current blue-sand/mist ideas; consolidate, do not copy token drift.
- frontend/tailwind.config.ts — current palette, typography, and motion intent.
- frontend/src/components/icons.tsx — code-native icon family and HELM mark.
- frontend/src/components/Mist.tsx — conceptual reference only; current tone handling is incomplete.
- frontend/src/components/AppShell.tsx — current organization context and navigation; replace the 13-destination IA.
- frontend/src/components/DataPipeline.tsx — truthful discrete progress reference.
- frontend/src/components/WorkflowProgress.tsx — durable stage-state reference.
- frontend/src/components/HelmOrb.tsx — instrument material/progress reference, not a mandate for a floating control.
- frontend/src/components/ui.tsx — chart and state ideas; do not preserve the monolith.
- frontend/src/lib/metrics.ts — metric-honesty language and central catalog concept.
- design/Login.dc.html — strongest source for the signal-network visual.
- design/Foundations.dc.html — current design-system intent.
- design/Main.dc.html — overview composition reference.
- design/Analytics.dc.html — chart rules/reference.
- design/Pipeline.dc.html — discrete progress states.
- design/AgentFleet.dc.html — status semantics, not primary IA.
- design/HelmPanel.dc.html — grounding ideas, not duplicate assistant UX.
- design/Studio.dc.html — creative material reference, not the current field-heavy form.
- design/canvas.json — original annotations and design philosophy.

### Current defects the rebuild must not carry forward

- Client-only rendering on all pages.
- Hard-coded post-auth redirect to /helm.
- Session network failures treated as logout.
- Stale account/workspace data after switching.
- Filters and tabs lost because they are local component state.
- Duplicate panel and full-page HELM experiences.
- Public provider/environment/offline-stub messaging.
- Undefined or non-functional mist variants.
- Competing indigo and peach primary actions.
- Token drift across CSS, Tailwind, charts, and prototypes.
- Roughly 150 uses of any.
- No functional non-interactive lint gate.
- No frontend tests, route error boundaries, not-found handling, or monitoring.
- Drawers without full focus management.
- Raw images without a production optimization policy.
- Deployment that assumes a localhost backend.

---

## 32. Research principles

This direction is informed by current category behavior but must remain visually original.

- [Triple Whale](https://www.triplewhale.com/) currently presents unified data, business intelligence, activation, and AI as layers of one system. HELM should not copy that breadth; it should make the decision trail more legible and disciplined.
- [Northbeam](https://www.northbeam.io/) emphasizes measurement, attribution, and profitable budget decisions. HELM should meet that level of measurement seriousness while differentiating through evidence-led recommendations and superior multi-account context.
- [Google Ads account types](https://developers.google.com/google-ads/api/docs/concepts/account-types) distinguish manager and serving/client accounts. The frontend must preserve that hierarchy inside a common HELM selection pattern.
- [Meta Page access guidance](https://www.facebook.com/help/289207354498410/r.php/) distinguishes levels of access and linked-account responsibilities. The connection UI must show actual granted access and avoid implying authorization the user does not have.
- [TanStack Query cancellation guidance](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) supplies an AbortSignal to query functions. The Phase 2 query layer must consume that signal so superseded workspace, scope, and date-range requests cannot commit stale results.

These references inform product truth and interaction requirements. They are not mood boards to reproduce.

---

## 33. Final design standard

Before approving any screen, ask:

1. Does the screen make the user’s next decision clearer?
2. Is the evidence close enough to verify the claim?
3. Is workspace/account/date context unambiguous?
4. Does the route represent a durable object, or should this be local UI?
5. Is any field visible before it is needed?
6. Is any card present only because the template expects a card?
7. Does motion explain something?
8. Would this still feel authored with all gradients removed?
9. Is the interface honest about freshness, definition, and uncertainty?
10. Could a keyboard and mobile user complete the same task?
11. Is internal implementation vocabulary leaking into buyer language?
12. Does the product feel quieter after the decision becomes clear?

If the answer to the last question is no, the design is still performing instead of helping.
