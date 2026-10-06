import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';
const { server, port } = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`http://127.0.0.1:${port}/`);
await page.evaluate(() => window.__ready);
for (const t of [11.0, 11.3, 11.6]) {
  await page.evaluate((x) => window.__render(x), t);
  console.log(t, await page.evaluate(() => [...document.querySelectorAll('.layer')].filter(l => l.style.visibility === 'visible').map(l => l.dataset.ptheme)),
    await page.evaluate(() => { const inds = [...document.querySelectorAll('.layer:nth-child(4) .seg .ind')].map(i => ({ w: i.style.width, tr: i.style.transform, rect: i.getBoundingClientRect().width })); return inds; }));
}
await browser.close(); server.close();
