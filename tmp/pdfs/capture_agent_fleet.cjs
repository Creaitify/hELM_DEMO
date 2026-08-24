const { chromium } = require('C:/Users/prach/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await page.goto('file:///C:/Users/prach/HELM103/Helm103/design/AgentFleet.dc.html');
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'C:/Users/prach/helm-final/tmp/pdfs/captures/agent-fleet.png',
    fullPage: true,
  });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
