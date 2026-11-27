// Reports pages whose layout is wider than a 390px phone viewport (horizontal scroll). Usage: node tools/check-overflow.js
const { chromium, devices } = require('playwright');
const path = require('path');
const PAGES = ['overview', 'transactions', 'payouts', 'refunds', 'cardholders', 'card-orders', 'issuers', 'reports', 'api-keys', 'webhooks', 'event-logs', 'docs', 'team', 'settings', 'support'];
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  for (const name of PAGES) {
    const page = await context.newPage();
    await page.goto('file://' + path.resolve(__dirname, '../pages', `${name}.html`));
    await page.waitForTimeout(1400);
    const result = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const offenders = [...document.querySelectorAll('main *')].filter((n) => n.getBoundingClientRect().right > width + 1 && !n.closest('.segmented, .tabs, .table-wrap pre, .code'))
        .slice(0, 3).map((n) => `${n.tagName.toLowerCase()}.${[...n.classList].join('.')}`);
      return { scroll: document.documentElement.scrollWidth > width, offenders };
    });
    console.log(`${name.padEnd(13)} ${result.scroll ? 'HORIZONTAL SCROLL' : 'ok'} ${result.offenders.join(' ')}`);
    await page.close();
  }
  await browser.close();
})();
