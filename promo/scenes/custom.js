import { $, E, lerp, makeHeadline, seg, set } from '../lib.js';
import { buildBg } from '../ui.js';

const THEMES = [
  ['Voltio', true, ['#0c0d1f', '#e8ebff', '#c6ff3d', '#7a6bff']],
  ['Brasa', true, ['#130f0d', '#f6ebe0', '#ff7a2f', '#ffc15c']],
  ['Marea', true, ['#06161c', '#def5f6', '#2de2c8', '#3aa0ff']],
  ['Noctiluca', true, ['#120a1f', '#f3e9ff', '#ff4fd8', '#8a5cff']],
  ['Ámbar', true, ['#100c04', '#ffe9b8', '#ffb000', '#ff6a00']],
  ['Papel', false, ['#f6efe2', '#1d2a44', '#2447d6', '#e8590c']],
  ['Escarcha', false, ['#eef5fb', '#17324d', '#0b7a99', '#6a5acd']],
  ['Menta', false, ['#eef8f1', '#143a2b', '#0a7d52', '#c2410c']],
];
const FONTS = [['JetBrains Mono', 'jetbrains'], ['Fira Code', 'fira'], ['IBM Plex Mono', 'plex'], ['Space Mono', 'space'], ['Source Code Pro', 'source'], ['Roboto Mono', 'roboto'], ['Inconsolata', 'inconsolata'], ['Sistema', 'system']];
const ACCENTS = ['#c6ff3d', '#ff7a2f', '#2de2c8', '#ff4fd8', '#3aa0ff', '#ffd23f', '#ff5c7a', '#a78bfa'];

/** 19–22 s: themes, fonts and accent colours, with the sample text reacting to every choice. */
export function create(ctx) {
  const el = $('<section class="layer" data-ptheme="voltio"></section>');
  const bg = buildBg();
  const content = $('<div class="content"></div>');
  const headline = makeHeadline([[{ t: 'Hazlo' }], [{ t: 'tuyo.', cls: 'accent' }]]);
  set(headline.el, { position: 'absolute', left: '130px', top: '150px', fontSize: '200px', textAlign: 'left' });
  headline.el.style.lineHeight = '0.98';
  const sample = $('<div style="position:absolute;left:134px;top:630px;font:700 150px/1 var(--font-mono);letter-spacing:-0.05em;color:var(--accent)" data-pfont="jetbrains">Escribe.</div>');
  const sampleSub = $('<div class="caption" style="position:absolute;left:136px;top:812px;text-align:left;font-size:36px;width:760px"><b id="sname" style="color:var(--fg);font-weight:600"></b></div>');
  const note = $('<div class="caption" style="position:absolute;left:136px;top:900px;text-align:left;font-size:34px;width:780px">8 temas, 8 fuentes, colores y fondos a tu gusto.</div>');

  const panel = $('<div style="position:absolute;left:1000px;top:120px;width:800px;padding:30px 30px 26px;border-radius:28px;background:color-mix(in srgb,var(--surface) 88%, transparent);border:1.5px solid var(--border);box-shadow:0 60px 140px rgb(0 0 0 / .5)"></div>');
  const h = (txt) => `<h3 style="font-size:.9rem;text-transform:uppercase;letter-spacing:.14em;color:var(--accent);margin:0 0 12px">${txt}</h3>`;
  const themeCards = THEMES.map(([name, dark, sw]) => $(`<button class="theme-card" type="button" aria-pressed="false" style="transform-origin:50% 50%">
    <span class="theme-swatch" style="background:${sw[0]}"><i style="background:${sw[1]}"></i><i style="background:${sw[2]}"></i><i style="background:${sw[3]}"></i></span>
    <span class="theme-name">${name}</span><span class="theme-kind">${dark ? 'oscuro' : 'claro'}</span></button>`));
  const fontCards = FONTS.map(([name, id]) => $(`<button class="font-card" type="button" aria-pressed="false"><span class="font-sample" data-font="${id}">Aa 42 {}</span><span class="theme-name">${name}</span></button>`));
  const presets = ACCENTS.map((c) => $(`<i class="preset" style="background:${c};display:inline-block"></i>`));
  const themeGrid = $('<div class="theme-grid" style="grid-template-columns:repeat(4,1fr);padding:0 0 18px"></div>');
  themeGrid.append(...themeCards);
  const fontGrid = $('<div class="font-grid" style="grid-template-columns:repeat(4,1fr);padding:0 0 16px"></div>');
  fontGrid.append(...fontCards);
  const presetRow = $('<div class="presets" style="gap:14px;padding:0"></div>');
  presetRow.append(...presets);
  const secs = [$(`<div>${h('Tema')}</div>`), $(`<div>${h('Tipografía')}</div>`), $(`<div>${h('Color de acento')}</div>`)];
  secs[0].append(themeGrid);
  secs[1].append(fontGrid);
  secs[2].append(presetRow);
  panel.append(...secs);
  content.append(headline.el, sample, sampleSub, note, panel);
  el.append(bg.el, content, $('<div class="vignette"></div>'));

  const sname = sampleSub.querySelector('#sname');
  for (let i = 0; i < 7; i++) ctx.cues.hits.push({ t: 19.0 + 0.62 + i * 0.13, k: 'theme' });
  for (let i = 0; i < 7; i++) ctx.cues.hits.push({ t: 19.0 + 1.62 + i * 0.13, k: 'theme' });
  ctx.cues.whooshes.push({ t: 18.95, k: 'in', d: 0.7 });

  return {
    id: 'custom', a: 19.0, b: 22.0, el,
    update(g) {
      const t = g - 19.0;
      bg.update(g, 0.9);
      headline.update(t, 0.05, 99, 0.16);
      const pin = E.out5(seg(t, 0.0, 0.9));
      set(panel, { opacity: String(E.out3(seg(t, 0, 0.45))), transform: `translate3d(${(1 - pin) * 120}px, 0, ${(pin - 1) * 220}px) rotateY(${lerp(-18, -4, pin) + 3 * seg(t, 1, 3)}deg)` });
      const items = [...themeCards, ...fontCards, ...presets];
      items.forEach((c, i) => {
        const p = E.out4(seg(t, 0.15 + i * 0.022, 0.75 + i * 0.022));
        set(c, { opacity: String(p), transform: `translate3d(0, ${(1 - p) * 30}px, 0) scale(${0.92 + 0.08 * p})` });
      });
      set(note, { opacity: String(E.out3(seg(t, 0.9, 1.5))) });

      // theme cycling (0.6 → 1.6), then fonts (1.6 → 2.6)
      const th = t < 0.62 ? 0 : Math.min(7, Math.floor((t - 0.62) / 0.13) + 1) % 8;
      const themeIdx = t < 1.6 ? th : 0;
      themeCards.forEach((c, i) => c.setAttribute('aria-pressed', String(t >= 0.55 && i === themeIdx)));
      const fi = t < 1.62 ? 0 : Math.min(7, Math.floor((t - 1.62) / 0.13));
      fontCards.forEach((c, i) => c.setAttribute('aria-pressed', String(t >= 1.55 && i === fi)));

      // the sample takes the accent of the selected theme and the selected font
      const accent = t < 1.6 ? THEMES[themeIdx][2][2] : THEMES[0][2][2];
      const presetPick = t >= 2.35 ? Math.min(7, Math.floor((t - 2.35) / 0.1)) : -1;
      const finalAccent = presetPick >= 0 ? ACCENTS[presetPick] : accent;
      el.style.setProperty('--accent', finalAccent);
      presets.forEach((p, i) => set(p, { boxShadow: i === presetPick ? `0 0 0 3px var(--bg), 0 0 0 5px ${ACCENTS[i]}` : '0 0 0 1px var(--border)', transform: i === presetPick ? 'scale(1.25)' : '' }));
      sample.dataset.pfont = FONTS[fi][1];
      sname.textContent = t < 1.6 ? `Tema ${THEMES[themeIdx][0]}` : `Fuente ${FONTS[fi][0]}`;
    },
  };
}
