import { E, seg } from './lib.js';
import * as intro from './scenes/intro.js';
import * as typing from './scenes/typing.js';
import * as result from './scenes/result.js';
import * as modes from './scenes/modes.js';
import * as palette from './scenes/palette.js';
import * as custom from './scenes/custom.js';
import * as profile from './scenes/profile.js';
import * as sync from './scenes/sync.js';
import * as outro from './scenes/outro.js';

const DURATION = 30;
const cues = { keys: [], whooshes: [], hits: [], themes: [] };
const ctx = { cues };

const modules = [intro, typing, result, modes, palette, custom, profile, sync, outro];
const scenes = modules.map((m) => m.create(ctx));
const stage = document.getElementById('stage');
scenes.forEach((s) => stage.append(s.el));

const FADE = 0.45;

window.__cues = cues;
window.__duration = DURATION;
window.__scenes = scenes.map((s) => ({ id: s.id, a: s.a, b: s.b }));

window.__render = (t) => {
  scenes.forEach((s, i) => {
    const last = i === scenes.length - 1;
    const end = last ? DURATION + 1 : s.b + FADE + 0.05;
    const visible = t >= s.a && t < end;
    s.el.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    const pin = i === 0 ? 1 : E.out2(seg(t, s.a, s.a + FADE));
    const pout = last ? 0 : E.inOut2(seg(t, s.b, s.b + FADE));
    s.el.style.opacity = String(pin);
    const sc = (i === 0 ? 1 : 1.05 - 0.05 * E.out3(seg(t, s.a, s.a + FADE))) + 0.045 * pout;
    s.el.style.transform = sc === 1 ? '' : `scale(${sc})`;
    const blur = (i === 0 ? 0 : (1 - E.out3(seg(t, s.a, s.a + FADE))) * 10) + pout * 8;
    s.el.style.filter = blur > 0.05 ? `blur(${blur}px)` : '';
    s.update(t);
  });
};

window.__ready = (async () => {
  const faces = ['400 20px "Space Grotesk"', '500 20px "Space Grotesk"', '700 20px "Space Grotesk"', '400 20px "JetBrains Mono"', '700 20px "JetBrains Mono"',
    '400 20px "Fira Code"', '400 20px "IBM Plex Mono"', '400 20px "Space Mono"', '400 20px "Source Code Pro"', '400 20px "Roboto Mono"', '400 20px "Inconsolata"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'AaÁáñ¿↵0123456789')));
  await document.fonts.ready;
  window.__render(0);
})();
