const path = require('node:path');

/**
 * Playwright resolves from the frontend install, and the output directory is
 * relative to this file, so the script runs on any machine that checked the
 * repo out — the earlier version hardcoded both to one developer's laptop.
 */
const BASE = process.env.HELM_BASE_URL || 'http://127.0.0.1:3000';

const PLAYWRIGHT = require.resolve('playwright', {
  paths: [path.join(__dirname, '../../frontend')],
});

const { chromium } = require(PLAYWRIGHT);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  // The design mockup this used to open has been superseded by the real
  // workflow surface, so capture a completed run instead.
  const workspace = process.env.HELM_WORKSPACE || 'northstar-group';
  const api = process.env.HELM_API_ORIGIN || 'http://127.0.0.1:8000';
  const response = await fetch(`${api}/api/workspaces/${workspace}/intelligence`);
  const { runs } = await response.json();
  const run = runs.find((entry) => entry.stage === 'complete') || runs[0];
  if (!run) throw new Error('No runs to capture — start one first.');

  await page.goto(`${BASE}/w/${workspace}/intelligence/${run.id}`);
  await page.waitForSelector('h1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(__dirname, 'captures', 'agent-fleet.png'),
    fullPage: true,
  });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
