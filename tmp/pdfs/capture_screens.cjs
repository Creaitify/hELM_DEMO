const path = require('node:path');

/**
 * Playwright resolves from the frontend install, and the output directory is
 * relative to this file, so the script runs on any machine that checked the
 * repo out — the earlier version hardcoded both to one developer's laptop.
 */
const PLAYWRIGHT = require.resolve('playwright', {
  paths: [path.join(__dirname, '../../frontend')],
});

const { chromium } = require(PLAYWRIGHT);

const ROOT = path.join(__dirname, 'captures');
const BASE = process.env.HELM_BASE_URL || 'http://127.0.0.1:3000';

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 2,
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    colorScheme: 'light',
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/w/northstar-group`);
  await settle(page);
  await page.locator('#movement').evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -150));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, 'briefing-movement.png') });

  await page.goto(`${BASE}/`);
  await settle(page);
  await page.getByRole('heading', { name: 'The next decision should not begin with six tabs.' })
    .evaluate((element) => element.closest('section').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, 'landing-closing.png') });

  await page.goto(`${BASE}/w/northstar-group`);
  await settle(page);
  await page.getByRole('button', { name: /Investigate/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(ROOT, 'intelligence-command.png') });

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
