import { $, E, lerp, makeHeadline, rng, seg, set } from '../lib.js';
import { buildBg } from '../ui.js';
import { chartSvg } from './result.js';

/** 22–25 s: the profile page, with rank, headline numbers and the evolution chart. */
export function create(ctx) {
  const el = $('<section class="layer" data-ptheme="voltio"></section>');
  const bg = buildBg();
  const content = $('<div class="content"></div>');
  const headline = makeHeadline([[{ t: 'Tu' }, { t: 'progreso,', cls: 'dim' }, { t: 'a la vista.', cls: 'accent' }]]);
  set(headline.el, { position: 'absolute', left: 0, right: 0, top: '48px', fontSize: '80px' });

  const rand = rng(5);
  const per = Array.from({ length: 60 }, (_, i) => 50 + i * 0.68 + (rand() - 0.5) * 13);
  const avg = per.map((_, i) => { const w = per.slice(Math.max(0, i - 9), i + 1); return w.reduce((a, b) => a + b, 0) / w.length; });

  const page = $(`<div style="position:absolute;left:50%;top:170px;width:1280px;margin-left:-640px;display:grid;gap:16px">
    <section class="card profile-head" style="grid-template-columns:auto 1fr 360px;padding:22px 26px">
      <div class="avatar">A</div>
      <div class="who"><div class="name-input" style="margin:0;padding:0">Ada Lovelace</div><p class="muted">Zapper desde 7 sept 2026</p></div>
      <div class="rank"><span class="rank-name">Relámpago</span><div class="rank-bar"><i style="width:0%"></i></div><span class="muted small">3 ppm para Tormenta</span></div>
    </section>
    <section class="tiles" style="grid-template-columns:repeat(6,1fr);gap:12px">
      ${[['Tests', '72', 0, ''], ['Mejor marca', '92.4', 1, 'ppm'], ['Media últimos 10', '88.6', 1, 'ppm'], ['Precisión media', '95.9', 1, '%'], ['Consistencia', '81.6', 1, '%'], ['Racha', '29', 0, 'días']]
        .map(([l, v, d, u]) => `<div class="tile" style="padding:14px 16px"><span class="stat-label">${l}</span><span class="tile-value" data-c="${v}" data-d="${d}" style="font-size:2.3rem">0</span>${u ? `<small style="color:var(--muted);margin-top:-6px">${u}</small>` : ''}</div>`).join('')}
    </section>
    <section class="card" style="padding:20px 24px 12px">
      <div class="card-head" style="margin-bottom:6px"><h2>Evolución</h2><div class="chart-legend"><span class="legend-item"><i class="swatch" style="background:var(--accent)"></i>Media móvil (10)</span><span class="legend-item"><i class="swatch muted" style="background:var(--accent-2)"></i>Cada test</span></div></div>
      ${chartSvg(avg, per, [], { H: 210, max: 100, stepY: 25, labelStep: 8, label: (i) => `#${i + 13}` })}
    </section>
  </div>`);
  content.append(headline.el, page);
  el.append(bg.el, content, $('<div class="vignette"></div>'));

  const cards = [...page.children];
  const counters = [...page.querySelectorAll('[data-c]')];
  const rankBar = page.querySelector('.rank-bar i');
  const clip = page.querySelector('.rclip');
  ctx.cues.whooshes.push({ t: 21.95, k: 'in', d: 0.7 });
  ctx.cues.hits.push({ t: 22.75, k: 'soft' });

  return {
    id: 'profile', a: 22.0, b: 25.0, el,
    update(g) {
      const t = g - 22.0;
      bg.update(g, 0.9);
      headline.update(t, 0.05, 99);
      const rise = E.out5(seg(t, 0, 1.0));
      const push = E.inOut2(seg(t, 0.8, 3.0));
      set(page, { transform: `translate3d(0, ${lerp(110, 0, rise) - 24 * push}px, ${lerp(-240, 0, rise)}px) rotateX(${lerp(12, 0, rise)}deg) scale(${1 + 0.03 * push})`, opacity: String(E.out3(seg(t, 0, 0.45))) });
      cards.forEach((c, i) => {
        const p = E.out4(seg(t, 0.12 + i * 0.16, 0.8 + i * 0.16));
        set(c, { opacity: String(p), transform: `translate3d(0, ${(1 - p) * 34}px, 0)` });
      });
      counters.forEach((c, i) => {
        const p = E.out4(seg(t, 0.35 + i * 0.07, 1.5 + i * 0.07));
        c.textContent = (Number(c.dataset.c) * p).toFixed(Number(c.dataset.d));
      });
      rankBar.style.width = `${78 * E.out4(seg(t, 0.4, 1.4))}%`;
      clip.setAttribute('width', String(640 * E.inOut2(seg(t, 0.7, 2.3))));
    },
  };
}
