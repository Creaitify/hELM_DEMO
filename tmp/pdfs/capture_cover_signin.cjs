const { chromium } = require('C:/Users/prach/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

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
  await page.goto('http://127.0.0.1:3100/signin?returnTo=%2Fw%2Fnorthstar-group');
  await page.waitForLoadState('networkidle');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'C:/Users/prach/helm-final/tmp/pdfs/captures/cover-signin.png' });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
