import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * Proves every route actually renders.
 *
 * This exists because the obvious way to check — driving the page from a
 * headless pane that never composites — cannot answer the question. React 19
 * schedules the *first* reveal of a streamed Suspense boundary through
 * `requestAnimationFrame`:
 *
 *   $RC = function (a, b) { ... "number" !== typeof $RT
 *     ? requestAnimationFrame($RV.bind(null, $RB))
 *     : setTimeout($RV.bind(null, $RB), ...) }
 *
 * A surface that never paints a frame never fires rAF, so `loading.tsx` stays
 * on screen forever and the page looks broken when it is not. Playwright's
 * headless Chromium composites properly, so it sees what a person sees.
 *
 * The assertion is therefore deliberately about the *revealed* DOM: the route's
 * own heading must be visible, and no skeleton may remain. Anything weaker
 * would pass against the fallback and tell us nothing.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(here, '../screenshots');

const BASE = process.env.HELM_BASE_URL ?? 'http://localhost:3000';
const API = process.env.HELM_API_ORIGIN ?? 'http://localhost:8000';
const WORKSPACE = process.env.HELM_WORKSPACE ?? 'northstar-group';

/** Only the loading skeleton renders animate-pulse, so it is the tell. */
const SKELETON = '#main .animate-pulse';

/**
 * Reads ids from the API so the deep-link routes point at rows that exist,
 * rather than at fixtures that may have been reseeded.
 */
async function discover() {
  const read = async (path) => {
    const response = await fetch(`${API}${path}`);
    if (!response.ok) throw new Error(`${path} answered ${response.status}`);
    return response.json();
  };

  const [intelligence, campaigns, evidence] = await Promise.all([
    read(`/api/workspaces/${WORKSPACE}/intelligence`),
    read(`/api/workspaces/${WORKSPACE}/campaigns`),
    read(`/api/workspaces/${WORKSPACE}/evidence`),
  ]);

  // A completed run shows the whole workflow; a queued one would show nothing.
  const run =
    intelligence.runs.find((entry) => entry.stage === 'complete') ?? intelligence.runs[0];
  const campaign = campaigns.campaigns[0];
  // A record with rows is the only one that proves the page renders a record.
  const record = evidence.evidence.find((entry) => entry.rows?.length) ?? evidence.evidence[0];

  if (!run) throw new Error('No runs in the workspace — start one before verifying.');
  if (!campaign) throw new Error('No campaigns in the workspace — seed the graph first.');
  if (!record) throw new Error('No evidence in the workspace — seed the graph first.');

  return { runId: run.id, campaignId: campaign.id, evidenceId: record.id };
}

function routes({ runId, campaignId, evidenceId }) {
  const w = `/w/${WORKSPACE}`;
  return [
    { name: 'landing', path: '/', heading: /See what moved/i, shell: false },
    // Redirects into the workspace while AUTH_ENABLED=false; either landing
    // place is correct, so this one asserts on whichever heading arrives.
    { name: 'signin', path: '/signin', heading: /.+/, shell: false },
    { name: 'briefing', path: w, heading: /^Briefing$/ },
    { name: 'campaigns', path: `${w}/campaigns`, heading: /^Campaigns$/ },
    { name: 'campaign-detail', path: `${w}/campaigns/${campaignId}`, heading: /.+/ },
    { name: 'intelligence', path: `${w}/intelligence`, heading: /^Intelligence$/ },
    { name: 'run', path: `${w}/intelligence/${runId}`, heading: /.+/ },
    { name: 'evidence', path: `${w}/evidence/${evidenceId}`, heading: /.+/ },
    { name: 'library', path: `${w}/library`, heading: /^Library$/ },
    { name: 'studio', path: `${w}/library/studio`, heading: /^Image studio$/ },
    { name: 'connections', path: `${w}/connections`, heading: /^Connections$/ },
    { name: 'settings', path: `${w}/settings`, heading: /^Settings$/ },
    { name: 'ops', path: '/ops', heading: /^Operator console$/, shell: false },
  ];
}

/**
 * Noise the dev server emits that says nothing about the app: React's
 * devtools nudge, and the favicon 404 that only exists because the icon is
 * generated per-route.
 */
const IGNORED_CONSOLE = [/React DevTools/i, /favicon/i, /Download the React/i];

async function check(page, route) {
  const problems = [];

  // A page can render its heading and still be broken underneath, so the
  // browser's own complaints count as failures too.
  const consoleErrors = [];
  const onConsole = (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
    consoleErrors.push(text);
  };
  const onPageError = (error) => consoleErrors.push(`uncaught: ${error.message}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  const response = await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded' });
  if (response && response.status() >= 400) {
    problems.push(`HTTP ${response.status()}`);
  }

  await page.waitForLoadState('networkidle').catch(() => undefined);

  // The heading only exists once the boundary has revealed, so waiting for it
  // is the same as waiting for the reveal.
  const heading = page.locator('h1').first();
  try {
    await heading.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    problems.push('no <h1> ever became visible — the page is still showing its fallback');
  }

  const headingText = (await heading.textContent().catch(() => null))?.trim() ?? '';
  if (headingText && !route.heading.test(headingText)) {
    problems.push(`heading was "${headingText}", expected ${route.heading}`);
  }

  // Routes inside the workspace shell own a #main with a loading skeleton.
  if (route.shell !== false) {
    const skeletons = await page.locator(SKELETON).count();
    if (skeletons > 0) {
      problems.push(`${skeletons} skeleton element(s) still on screen — the reveal did not run`);
    }
  }

  const text = await page.evaluate(() => document.body.innerText.length);
  if (text < 400) problems.push(`only ${text} characters of visible text`);

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  for (const error of consoleErrors.slice(0, 3)) {
    problems.push(`console error: ${error.slice(0, 160)}`);
  }

  return { problems, headingText, text };
}

async function main() {
  const discovered = await discover();
  const list = routes(discovered);

  await rm(SHOTS, { recursive: true, force: true });
  await mkdir(SHOTS, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 2,
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    colorScheme: 'light',
  });
  // Otherwise the workflow connector animation smears the capture.
  await context.grantPermissions([]).catch(() => undefined);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const failures = [];
  console.log(`Verifying ${list.length} routes against ${BASE}\n`);

  for (const route of list) {
    let result;
    try {
      result = await check(page, route);
    } catch (error) {
      result = { problems: [error instanceof Error ? error.message : String(error)], text: 0 };
    }

    await page
      .screenshot({ path: join(SHOTS, `${route.name}.png`), fullPage: false })
      .catch(() => undefined);

    if (result.problems.length) {
      failures.push({ route, problems: result.problems });
      console.log(`  FAIL  ${route.name.padEnd(16)} ${route.path}`);
      for (const problem of result.problems) console.log(`        · ${problem}`);
    } else {
      console.log(
        `  ok    ${route.name.padEnd(16)} ${String(result.text).padStart(6)} chars  "${result.headingText}"`,
      );
    }
  }

  await browser.close();

  console.log(`\nScreenshots in ${SHOTS}`);
  if (failures.length) {
    console.error(`\n${failures.length} of ${list.length} routes failed.`);
    process.exit(1);
  }
  console.log(`All ${list.length} routes rendered.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
