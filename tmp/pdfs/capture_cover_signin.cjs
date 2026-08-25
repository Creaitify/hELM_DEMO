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
    viewport: { width: 1536, height: 728 },
    deviceScaleFactor: 1,
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/signin?returnTo=%2Fw%2Fnorthstar-group`);
  await page.waitForLoadState('networkidle');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, 'captures', 'cover-signin.png') });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
