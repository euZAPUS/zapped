// Renders the promo to an MP4:  node promo/render.mjs [--fps 30] [--workers 4] [--audio promo/out/audio.wav] [--out promo/out/zapped-promo.mp4] [--cues-only]
// Every frame is a pure function of time, so frames can be produced in parallel and in any order.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const FPS = Number(arg('fps', 30));
const WORKERS = Number(arg('workers', 4));
const OUT = path.resolve(arg('out', path.join(here, 'out', 'zapped-promo.mp4')));
const AUDIO = path.resolve(arg('audio', path.join(here, 'out', 'audio.wav')));
const FRAMES = path.join(here, 'out', 'frames');
const FORMAT = arg('format', 'png');

const { server, port } = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--font-render-hinting=none', '--disable-lcd-text'] });

async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => window.__ready);
  return page;
}

// 1. cue sheet for the soundtrack
const probe = await openPage();
const duration = await probe.evaluate(() => window.__duration);
const cues = await probe.evaluate(() => window.__cues);
writeFileSync(path.join(here, 'out', 'cues.json'), JSON.stringify({ duration, ...cues }, null, 1));
await probe.close();
if (process.argv.includes('--cues-only')) {
  console.log('cues.json written');
  await browser.close();
  server.close();
  process.exit(0);
}
const total = Math.round(duration * FPS);
console.log(`Rendering ${total} frames at ${FPS} fps with ${WORKERS} workers…`);

// 2. frames
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
let next = 0;
let done = 0;
const started = Date.now();
await Promise.all(
  Array.from({ length: WORKERS }, async () => {
    const page = await openPage();
    for (;;) {
      const i = next++;
      if (i >= total) break;
      await page.evaluate((t) => window.__render(t), i / FPS);
      const file = path.join(FRAMES, `${String(i).padStart(5, '0')}.${FORMAT}`);
      await page.screenshot(FORMAT === 'png' ? { path: file, type: 'png' } : { path: file, type: 'jpeg', quality: 95 });
      if (++done % 60 === 0) {
        const per = (Date.now() - started) / done;
        console.log(`  ${done}/${total}  ~${Math.round((per * (total - done)) / 1000)} s left`);
      }
    }
    await page.close();
  }),
);
await browser.close();
server.close();

// 3. encode
const args = ['-y', '-framerate', String(FPS), '-i', path.join(FRAMES, `%05d.${FORMAT}`)];
const hasAudio = existsSync(AUDIO);
if (hasAudio) args.push('-i', AUDIO);
args.push(
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high', '-level', '4.2',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-movflags', '+faststart',
);
if (hasAudio) args.push('-c:a', 'aac', '-b:a', '224k', '-ar', '48000', '-shortest');
args.push(OUT);
console.log('Encoding…');
await new Promise((resolve, reject) => {
  const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
  ff.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${c}`))));
});
console.log(`Done in ${Math.round((Date.now() - started) / 1000)} s → ${OUT}`);
