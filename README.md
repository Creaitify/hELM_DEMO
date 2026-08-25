# HELM

Paid-media intelligence for Google Ads and Meta Ads. A decision layer between
fragmented ad-platform data and the person deciding where the next unit of
budget goes.

> See what moved. Know what to move next.

Two processes: a Fastify API that owns the decision graph and the agent fleet,
and a Next.js app that renders it.

## Run it

```bash
cd backend && npm install && npm run dev
```

```bash
cd frontend && npm install && npm run dev
```

The app is at **http://localhost:3000**, the API at **http://localhost:8000**.

The browser only ever calls same-origin `/api`. `frontend/next.config.mjs`
rewrites those paths to the API origin, so the session cookie belongs to the
public origin and provider tokens never leave the server side. Nothing in the
frontend needs to know where the backend lives.

## The workflow

A run walks eight steps. Four specialists do the work, HELM holds the two
review gates, and a person holds the approval:

```
Input / Data → Analyst → HELM Review → Creative → HELM Review
             → Human Approval → Image Generation → Final Output
```

A specialist never grades its own output and never advances its own work. A
failing review sends it back, up to `MAX_AGENT_REVISIONS` times. Nothing
reaches an ad account: every recommendation is a proposal, and approving one
records a decision rather than performing it.

## Configuration

Everything lives in `backend/.env` — copy `backend/.env.example` to start. The
service boots with an empty file: each integration falls back to something
demonstrable and `/api/health` reports which.

### Identity switches

| Setting | `false` means |
|---|---|
| `AUTH_ENABLED` | No sign-in step. Every request is the sample owner. |
| `RBAC_ENABLED` | Every permission granted regardless of role. |

Neither affects the database. The decision graph stays connected and every
write still lands in it. Set both to `true` for live Google sign-in and role
enforcement.

### What runs without a key

| Capability | Configured | Falls back to |
|---|---|---|
| Decision graph | `DATABASE_URL` (Neon) or `NEO4J_URI` | In-process graph store |
| Identity | `GOOGLE_CLIENT_ID` + secret | Sample owner |
| Google Ads | + `GOOGLE_ADS_DEVELOPER_TOKEN` | Live consent, sample portfolio |
| Meta Ads | `META_APP_ID` + secret | Sample portfolio |
| Agent reasoning | `ANTHROPIC_API_KEY` | Deterministic sample reasoning |
| Image studio | `IMAGE_PROVIDER` + `IMAGE_API_KEY` | HELM studio renderer |

The fallbacks are not stubs. The studio renderer composes real art-directed
posters, and the sample reasoning is written from the same evidence pack a
model would receive — so the product tells the same story either way, and the
interface says plainly which one produced it.

A key being present is not the same as a key that works: the API probes
Anthropic once at boot and reports `rejected` rather than promising model
reasoning it cannot deliver.

## Verify it

```bash
cd frontend && npx playwright install chromium
```

```bash
cd frontend && npm run verify:ui
```

Loads every route in a real browser, asserts each one rendered its own content
rather than its loading skeleton, fails on any console error, and writes a
screenshot per route to `frontend/screenshots/`. Exits non-zero on failure.

`npm run screenshots` drives the capture scripts in `tmp/pdfs/` for
presentation stills.

### Why a real browser is required

Checking a page from a surface that never paints a frame cannot answer whether
it rendered. React 19 schedules the **first** reveal of a streamed Suspense
boundary through `requestAnimationFrame`:

```js
$RC = function (a, b) { ... "number" !== typeof $RT
  ? requestAnimationFrame($RV.bind(null, $RB))
  : setTimeout($RV.bind(null, $RB), ...) }
```

Anything that does not composite — a hidden automation pane, a background tab —
never fires rAF, so `loading.tsx` stays on screen and a perfectly healthy page
looks hung. A background tab reveals the moment it is focused. Playwright's
headless Chromium composites properly, which is why verification goes through
it and not through a screenshot-less driver.

## Layout

```
backend/src/
  agents/        the fleet, the orchestrator, the review gates
  graph/         decision graph — Neon, Neo4j and in-process behind one interface
  http/          routes, RBAC guards, exports
  providers/     Google, Meta, Anthropic, image generation
frontend/src/
  app/           routes
  features/      one folder per product surface
  contracts/     domain types — features consume these, never raw responses
  services/http/ typed reads, one function per screen
```
