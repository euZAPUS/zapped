import { $, E, lerp, makeHeadline, seg, set } from '../lib.js';
import { buildBg } from '../ui.js';
import { BOLT } from '../lib.js';

const CLOUD = '<svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4 4 0 0 1 .5 8.5Z"/></svg>';

function monitor(label) {
  return $(`<div style="width:300px;display:grid;justify-items:center;gap:14px">
    <div style="width:300px;height:190px;border-radius:18px;background:var(--surface);border:2px solid var(--border);padding:16px;box-shadow:0 30px 70px rgb(0 0 0 / .5);display:grid;gap:10px;align-content:start">
      <div style="display:flex;gap:6px"><i style="width:9px;height:9px;border-radius:50%;background:#ff5f57"></i><i style="width:9px;height:9px;border-radius:50%;background:#febc2e"></i><i style="width:9px;height:9px;border-radius:50%;background:#28c840"></i></div>
      <div style="height:12px;width:70%;border-radius:6px;background:var(--accent)"></div>
      <div style="height:10px;width:92%;border-radius:5px;background:var(--surface-2)"></div>
      <div style="height:10px;width:80%;border-radius:5px;background:var(--surface-2)"></div>
      <div style="height:10px;width:55%;border-radius:5px;background:var(--surface-2)"></div>
    </div>
    <div style="width:110px;height:10px;border-radius:0 0 12px 12px;background:var(--border)"></div>
    <div style="font:600 32px var(--font-ui);letter-spacing:-.02em">${label}</div></div>`);
}

/** 25–27.5 s: it updates itself and keeps your computers in sync. */
export function create(ctx) {
  const el = $('<section class="layer" data-ptheme="voltio"></section>');
  const bg = buildBg();
  const content = $('<div class="content"></div>');
  const headline = makeHeadline([[{ t: 'Siempre' }, { t: 'al día.', cls: 'accent' }], [{ t: 'En todos tus equipos.', cls: 'dim' }]]);
  set(headline.el, { position: 'absolute', left: 0, right: 0, top: '58px', fontSize: '84px' });

  // left: the real update screen
  const upd = $(`<div class="update-card" style="position:absolute;left:140px;top:360px;width:740px;padding:44px 44px 40px;gap:16px">
    <svg class="update-bolt" viewBox="0 0 24 24" style="width:78px;height:78px"><path d="M13.5 2 4 14h6.5L9 22l11-13h-7z" fill="currentColor"/></svg>
    <h2 style="font-size:2.2rem">Actualizando zapped</h2><p class="muted" style="font-size:1.35rem">Descargando la versión 1.1.0 · 0%</p>
    <div class="update-bar" style="height:12px"><i style="width:0%"></i></div></div>`);
  const title = upd.querySelector('h2');
  const detail = upd.querySelector('p');
  const bar = upd.querySelector('.update-bar i');
  const bolt = upd.querySelector('.update-bolt');

  // right: two computers and a secret gist
  const net = $('<div style="position:absolute;left:1010px;top:380px;width:820px;height:420px"></div>');
  const home = monitor('Casa');
  const work = monitor('Trabajo');
  const cloud = $(`<div style="position:absolute;left:350px;top:40px;width:120px;height:120px;border-radius:50%;display:grid;place-items:center;background:var(--surface-2);border:2px solid var(--accent);color:var(--accent);box-shadow:0 0 60px color-mix(in srgb, var(--accent) 45%, transparent)">${CLOUD}</div>`);
  const cloudLabel = $('<div style="position:absolute;left:290px;top:176px;width:240px;text-align:center;font:600 28px var(--font-ui);color:var(--muted)">gist secreto</div>');
  set(home, { position: 'absolute', left: '0', top: '100px' });
  set(work, { position: 'absolute', right: '0', top: '100px' });
  const dots = Array.from({ length: 10 }, () => $('<i style="position:absolute;width:14px;height:14px;border-radius:50%;background:var(--accent);box-shadow:0 0 18px var(--accent)"></i>'));
  const lines = $(`<svg style="position:absolute;inset:0;overflow:visible" width="820" height="420"><path d="M300 175 C 360 175, 340 100, 410 100" stroke="var(--accent)" opacity=".45" stroke-width="3" fill="none" stroke-dasharray="2 10" stroke-linecap="round"/><path d="M520 175 C 480 175, 480 100, 410 100" stroke="var(--accent)" opacity=".45" stroke-width="3" fill="none" stroke-dasharray="2 10" stroke-linecap="round"/></svg>`);
  net.append(lines, home, work, cloud, cloudLabel, ...dots);

  content.append(headline.el, upd, net);
  el.append(bg.el, content, $('<div class="vignette"></div>'));
  void BOLT;

  ctx.cues.whooshes.push({ t: 24.95, k: 'in', d: 0.7 });
  ctx.cues.hits.push({ t: 25.4, k: 'soft' });
  ctx.cues.hits.push({ t: 26.7, k: 'done' });

  const path = (u, side) => {
    // quadratic-ish curve between a computer (x 300 / 520) and the cloud (410,100)
    const sx = side === 0 ? 300 : 520;
    const x = lerp(sx, 410, u);
    const y = lerp(175, 100, E.inOut2(u));
    return { x, y };
  };
  return {
    id: 'sync', a: 25.0, b: 27.5, el,
    update(g) {
      const t = g - 25.0;
      bg.update(g, 0.9);
      headline.update(t, 0.05, 99);
      const pin = E.out5(seg(t, 0.15, 0.9));
      set(upd, { opacity: String(E.out3(seg(t, 0.15, 0.6))), transform: `translate3d(${(1 - pin) * -80}px, 0, 0)` });
      set(net, { opacity: String(E.out3(seg(t, 0.3, 0.8))), transform: `translate3d(${(1 - E.out5(seg(t, 0.3, 1.0))) * 80}px, 0, 0)` });
      const prog = E.inOut2(seg(t, 0.5, 1.75));
      bar.style.width = `${prog * 100}%`;
      const done = t >= 1.8;
      title.textContent = done ? 'Reiniciando…' : 'Actualizando zapped';
      detail.textContent = done ? 'La versión 1.1.0 está lista. zapped se reabre sola.' : `Descargando la versión 1.1.0 · ${Math.round(prog * 100)}%`;
      set(bolt, { transform: `scale(${1 + 0.08 * Math.sin(t * 6)}) rotate(${Math.sin(t * 4) * 4}deg)` });
      // packets flowing both ways through the gist
      dots.forEach((d, i) => {
        const side = i % 2;
        const u = (((t * 1.15 + i * 0.37) % 1) + 1) % 1;
        const dir = Math.floor(i / 2) % 2 ? 1 - u : u; // alternate direction
        const pt = path(dir, side);
        set(d, { left: `${pt.x - 7}px`, top: `${pt.y - 7}px`, opacity: String(t > 0.6 ? Math.sin(u * Math.PI) : 0) });
      });
      set(cloud, { transform: `scale(${1 + 0.05 * Math.sin(t * 5)})` });
    },
  };
}
