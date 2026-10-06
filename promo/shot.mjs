// Renders single frames for review:  node promo/shot.mjs 1.2 4.5 6   (times in seconds)
import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const times = process.argv.slice(2).map(Number);
import { fileURLToPath } from 'node:url';
const out = process.env.PROMO_SHOTS ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'shots');
mkdirSync(out, { recursive: true });
const { server, port } = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
await page.goto(`http://127.0.0.1:${port}/`);
await page.evaluate(() => window.__ready);
for (const t of times) {
  await page.evaluate((x) => window.__render(x), t);
  await page.screenshot({ path: `${out}/f-${t.toFixed(2)}.png` });
  console.log('shot', t);
}
await browser.close();
server.close();
