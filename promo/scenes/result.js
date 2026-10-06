import { $, E, lerp, rng, seg, set, makeHeadline } from '../lib.js';
import { buildBg } from '../ui.js';

const W = 640;
const H0 = 170;
const M = { l: 42, r: 14, t: 14, b: 30 };

/** Chart markup identical to the app's lineChart (same classes), drawn by progress p. */
export function chartSvg(net, raw, errors, o = {}) {
  const H = o.H ?? H0;
  const n = net.length;
  const max = o.max ?? 200;
  const stepY = o.stepY ?? 50;
  const labelStep = o.labelStep ?? 4;
  const label = o.label ?? ((i) => `${i + 1} s`);
  const plotW = W - M.l - M.r;
  const plotH = H - M.t - M.b;
  const x = (i) => M.l + (i / (n - 1)) * plotW;
  const y = (v) => M.t + plotH - (v / max) * plotH;
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  let grid = '';
  Array.from({ length: Math.round(max / stepY) + 1 }, (_, k) => k * stepY).forEach((v, i) => {
    grid += `<line x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}" class="${i === 0 ? 'axis' : 'gridline'}"/><text x="${M.l - 8}" y="${y(v) + 4}" text-anchor="end" class="tick">${v}</text>`;
  });
  for (let i = 0; i < n; i += labelStep) grid += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="tick">${label(i)}</text>`;
  const marks = errors.map((i) => `<path d="M${x(i) - 4} ${y(net[i]) - 4}l8 8m0 -8l-8 8" stroke="var(--err)" stroke-width="2" stroke-linecap="round" fill="none"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg"><defs><clipPath id="rc"><rect class="rclip" x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
    <g class="grid">${grid}</g><g clip-path="url(#rc)">
    <path d="${path(raw)}" fill="none" stroke="var(--accent-2)" stroke-width="1.5" stroke-linejoin="round" opacity="0.55"/>
    <path d="${path(net)}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${marks}</g></svg>`;
}

/** 7–10.5 s: the result screen, with numbers counting up and the chart drawing itself. */
export function create(ctx) {
  const el = $('<section class="layer" data-ptheme="voltio"></section>');
  const bg = buildBg();
  const content = $('<div class="content"></div>');
  const headline = makeHeadline([[{ t: 'Mide' }, { t: 'lo que', cls: 'dim' }, { t: 'importa.', cls: 'accent' }]]);
  set(headline.el, { position: 'absolute', left: 0, right: 0, top: '58px', fontSize: '84px' });

  const rand = rng(21);
  const net = Array.from({ length: 30 }, (_, i) => 118 + 31 * (1 - Math.exp(-i / 6)) + Math.sin(i * 0.9) * 2.2);
  const raw = Array.from({ length: 30 }, (_, i) => net[i] + 8 + (rand() - 0.5) * 38);
  const errors = [8, 17, 24];

  const card = $(`<div class="result-card" style="position:absolute;left:50%;top:190px;width:1180px;margin-left:-590px;gap:20px">
    <div class="hero" style="gap:2px">
      <div class="big"><span class="big-num" style="font-size:210px">0</span><span class="big-unit" style="font-size:44px">ppm</span></div>
      <span class="badge" style="font-size:24px;padding:8px 22px">¡Récord nuevo! +12.4</span>
      <p class="hero-sub" style="font-size:26px"><strong>Tiempo · 30 s</strong> · Español</p>
    </div>
    <div class="stats" style="grid-template-columns:repeat(5,1fr)">
      <div class="stat"><span class="stat-label">Precisión</span><span class="stat-line"><span class="stat-value" data-c="97.2" data-d="1">0</span><span class="stat-unit">%</span></span></div>
      <div class="stat"><span class="stat-label">Brutas</span><span class="stat-line"><span class="stat-value" data-c="154" data-d="0">0</span><span class="stat-unit">ppm</span></span></div>
      <div class="stat"><span class="stat-label">Consistencia</span><span class="stat-line"><span class="stat-value" data-c="88.4" data-d="1">0</span><span class="stat-unit">%</span></span></div>
      <div class="stat"><span class="stat-label">Tiempo</span><span class="stat-line"><span class="stat-value" data-c="30" data-d="1">0</span><span class="stat-unit">s</span></span></div>
      <div class="stat"><span class="stat-label">Caracteres</span><span class="stat-line chars"><span class="ch-ok">0</span>/<span class="ch-bad">3</span>/<span class="ch-extra">0</span>/<span class="ch-miss">1</span></span></div>
    </div>
    <div class="result-chart" style="padding:18px 22px 8px">${chartSvg(net, raw, errors)}<div class="chart-legend"><span class="legend-item"><i class="swatch" style="background:var(--accent)"></i>Netas</span><span class="legend-item"><i class="swatch muted" style="background:var(--accent-2)"></i>Brutas</span><span class="legend-item"><b style="color:var(--err)">×</b> segundos con fallos</span></div></div>
  </div>`);
  content.append(headline.el, card);
  el.append(bg.el, content, $('<div class="vignette"></div>'));

  const big = card.querySelector('.big-num');
  const badge = card.querySelector('.badge');
  const heroSub = card.querySelector('.hero-sub');
  const stats = [...card.querySelectorAll('.stat')];
  const counters = [...card.querySelectorAll('[data-c]')];
  const clip = card.querySelector('.rclip');
  const okChars = card.querySelector('.ch-ok');
  const chart = card.querySelector('.result-chart');

  ctx.cues.hits.push({ t: 7.45, k: 'result' });
  ctx.cues.whooshes.push({ t: 6.95, k: 'in', d: 0.7 });

  return {
    id: 'result', a: 7.0, b: 10.5, el,
    update(g) {
      const t = g - 7.0;
      bg.update(g, 0.9);
      headline.update(t, 0.1, 99);
      const rise = E.out5(seg(t, 0, 1.1));
      const push = E.inOut2(seg(t, 0.8, 3.5));
      set(card, { transform: `translate3d(0, ${lerp(120, 0, rise) - 18 * push}px, ${lerp(-260, 0, rise)}px) rotateX(${lerp(14, 0, rise)}deg) scale(${1 + 0.035 * push})`, opacity: String(E.out3(seg(t, 0, 0.5))) });

      const count = E.out4(seg(t, 0.35, 1.7));
      big.textContent = String(Math.round(148 * count));
      counters.forEach((c, i) => {
        const p = E.out4(seg(t, 0.55 + i * 0.07, 1.8 + i * 0.07));
        c.textContent = (Number(c.dataset.c) * p).toFixed(Number(c.dataset.d));
      });
      okChars.textContent = String(Math.round(139 * E.out4(seg(t, 0.8, 1.9))));
      stats.forEach((s, i) => {
        const p = E.out4(seg(t, 0.4 + i * 0.07, 1.0 + i * 0.07));
        set(s, { opacity: String(p), transform: `translate3d(0, ${(1 - p) * 26}px, 0)` });
      });
      const bp = E.back(seg(t, 1.75, 2.3), 2.2);
      set(badge, { opacity: String(seg(t, 1.75, 1.95)), transform: `scale(${0.5 + 0.5 * bp})` });
      set(heroSub, { opacity: String(seg(t, 0.5, 1.0)) });
      clip.setAttribute('width', String(W * E.inOut2(seg(t, 0.9, 2.5))));
      set(chart, { opacity: String(E.out3(seg(t, 0.7, 1.3))), transform: `translate3d(0, ${(1 - E.out4(seg(t, 0.7, 1.4))) * 40}px, 0)` });
    },
  };
}
