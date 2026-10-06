// Regenerates the README screenshots from the production build.
//   npm run build && npm run screenshots
// Uses the Chromium that Playwright finds, or the one in CHROMIUM_PATH.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

/** Believable, deterministic history so the profile looks lived-in. */
function seedHistory(n = 72) {
  let seed = 42;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const now = Date.now();
  const cfgs = [
    { mode: 'time', limit: 30, language: 'es', punctuation: false, numbers: false },
    { mode: 'time', limit: 60, language: 'en', punctuation: true, numbers: false },
    { mode: 'words', limit: 25, language: 'cyber', punctuation: false, numbers: false },
    { mode: 'time', limit: 30, language: 'c42', punctuation: false, numbers: true },
  ];
  return Array.from({ length: n }, (_, i) => {
    const c = cfgs[Math.floor(rnd() * cfgs.length)];
    const base = 48 + i * 0.6 + (rnd() - 0.5) * 14;
    const dur = c.mode === 'time' ? c.limit : 14 + rnd() * 6;
    const series = Array.from({ length: Math.round(dur) }, (_, k) => Math.round(base * (0.7 + 0.3 * (1 - Math.exp(-k / 4))) + (rnd() - 0.5) * 8));
    return {
      id: `demo-${i}`, at: now - (n - i) * 9.5 * 3600 * 1000 - rnd() * 3600000, ...c, accents: true, stopOnError: false,
      wpm: +base.toFixed(2), raw: +(base + 4 + rnd() * 5).toFixed(2), acc: +(92 + rnd() * 7).toFixed(2), cons: +(70 + rnd() * 22).toFixed(2),
      correct: Math.round(base * 2.5), incorrect: Math.round(rnd() * 6), extra: Math.round(rnd() * 3), missed: Math.round(rnd() * 3),
      duration: +dur.toFixed(2), series, rawSeries: series.map((v) => v + 5),
    };
  });
}

const server = await preview({ preview: { port: 4173, strictPort: true } });
const url = 'http://localhost:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });

async function open(settings, { hash = '', size = { width: 1280, height: 720 }, history = [] } = {}) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(([h, s]) => {
    localStorage.setItem('zapped:v1:history', JSON.stringify(h));
    localStorage.setItem('zapped:v1:settings', JSON.stringify({ ...s, updatedAt: 1 }));
  }, [history, settings]);
  await page.goto(url + hash);
  await page.waitForTimeout(700);
  return { ctx, page };
}
const shot = async (page, name) => {
  await page.waitForTimeout(450); // let the caret and line scroll settle
  await page.screenshot({ path: `${OUT}${name}.png` });
};
const wordsOnScreen = (page, n) => page.$$eval('.word', (els, k) => els.slice(0, k).map((e) => e.textContent).join(' '), n);

// 1 · ready to type
{
  const { ctx, page } = await open({ theme: 'voltio' });
  await shot(page, 'test');
  await ctx.close();
}
// 2 · typing: streak glow, sparks, block caret, focus mode
{
  const { ctx, page } = await open({ theme: 'noctiluca', caret: 'block', sparks: true, focusMode: true, punctuation: true });
  const text = await wordsOnScreen(page, 40);
  for (const ch of text.slice(0, 118)) await page.keyboard.type(ch, { delay: 14 });
  await shot(page, 'typing');
  await ctx.close();
}
// 3 · result screen
{
  const { ctx, page } = await open({ theme: 'voltio', mode: 'words', words: 25, language: 'en' }, { size: { width: 1280, height: 1000 }, history: seedHistory() });
  const text = await wordsOnScreen(page, 25);
  let i = 0;
  for (const ch of text) {
    if (i === 44 || i === 97) { await page.keyboard.type('x'); await page.keyboard.press('Backspace'); }
    await page.keyboard.type(ch, { delay: 70 + Math.round(Math.abs(Math.sin(i / 9)) * 90) });
    i++;
  }
  await page.waitForTimeout(2600);
  await shot(page, 'result');
  await ctx.close();
}
// 4 · code mode
{
  const { ctx, page } = await open({ theme: 'marea', mode: 'code', codeLang: 'c', caret: 'underline' });
  const words = await page.$$eval('.word', (els) => els.map((e) => ({ t: [...e.querySelectorAll('.l:not(.nl)')].map((l) => l.textContent).join(''), nl: !!e.querySelector('.nl') })));
  for (const w of words.slice(0, 11)) {
    await page.keyboard.type(w.t, { delay: 12 });
    await page.keyboard.press(w.nl ? 'Enter' : 'Space');
  }
  await shot(page, 'code');
  await ctx.close();
}
// 4b · command palette
{
  const { ctx, page } = await open({ theme: 'noctiluca' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await shot(page, 'palette');
  await ctx.close();
}
// 4c · palette previewing a theme live
{
  const { ctx, page } = await open({ theme: 'voltio' });
  await page.keyboard.press('Escape');
  await page.keyboard.type('tema');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await shot(page, 'palette-theme');
  await ctx.close();
}
// 4d · desktop auto-update screen (simulated bridge)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    let cb = () => {};
    window.zappedDesktop = {
      version: '1.0.0', platform: 'win32', checkForUpdates: async () => {}, installUpdate() {},
      lastUpdateStatus: async () => ({ state: 'idle' }), onUpdateStatus: (fn) => { cb = fn; return () => {}; },
      writeBackup: async () => {}, readBackup: async () => null,
    };
    setTimeout(() => cb({ state: 'downloading', version: '1.1.0', percent: 64, auto: true }), 400);
  });
  await page.goto(url);
  await page.waitForTimeout(900);
  await shot(page, 'update');
  await ctx.close();
}
// 5 · profile
{
  const { ctx, page } = await open({ theme: 'voltio', profileName: 'Ada Lovelace' }, { hash: '#/perfil', size: { width: 1280, height: 1500 }, history: seedHistory() });
  await page.waitForTimeout(1500);
  await shot(page, 'profile');
  await ctx.close();
}
// 6 · settings drawer
{
  const { ctx, page } = await open({ theme: 'brasa', background: 'aurora' });
  await page.click('#btn-settings');
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector('.drawer-body').scrollTo(0, 700));
  await page.waitForTimeout(300);
  await shot(page, 'settings');
  await ctx.close();
}
// 7 · light theme
{
  const { ctx, page } = await open({ theme: 'papel', language: 'es', background: 'grid', accent: null });
  const text = await wordsOnScreen(page, 30);
  await page.keyboard.type(text.slice(0, 64), { delay: 20 });
  await shot(page, 'light');
  await ctx.close();
}

await browser.close();
await new Promise((r) => server.httpServer.close(r));
console.log('Screenshots written to docs/screenshots/');
