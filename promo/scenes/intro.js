import { $, E, seg, BOLT_PATH, set } from '../lib.js';
import { buildBg } from '../ui.js';

const FINAL_SCALE = 0.72;

/** 0–3 s: a spark becomes the bolt, the wordmark slides out of it, then the tagline. */
export function create(ctx) {
  const el = $('<section class="layer" data-ptheme="voltio" style="--bg:#04050c"></section>');
  const bg = buildBg();
  const content = $('<div class="content"></div>');
  const glow = $('<div class="aura" style="width:1600px;height:900px;top:50%"></div>');
  const flare = $('<div style="position:absolute;left:50%;top:50%;width:1500px;height:4px;margin:-2px 0 0 -750px;background:linear-gradient(90deg,transparent,var(--accent),transparent);filter:blur(1px)"></div>');

  const bolt = $(`<svg viewBox="0 0 24 24" style="position:absolute;left:50%;top:50%;width:230px;height:230px;margin:-115px 0 0 -115px;overflow:visible">
    <defs><linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eaff8a"/><stop offset="1" stop-color="#9be31f"/></linearGradient></defs>
    <path class="fill" d="${BOLT_PATH}" fill="url(#bg1)" stroke="none"/>
    <path class="line" d="${BOLT_PATH}" pathLength="1" fill="none" stroke="#eaff8a" stroke-width="0.55" stroke-linejoin="round" stroke-dasharray="1" /></svg>`);
  const word = $('<div style="position:absolute;left:50%;top:50%;font:700 214px/1 var(--font-ui);letter-spacing:-0.06em;white-space:nowrap;transform:translate(-50%,-52%)"></div>');
  const letters = [...'zapped'].map((c) => {
    const s = $(`<span style="display:inline-block">${c}</span>`);
    word.append(s);
    return s;
  });
  const tagline = $('<div class="caption" style="position:absolute;left:0;right:0;top:700px;font-size:60px;color:var(--fg)"><span style="opacity:.5">Escribe</span> con chispa.</div>');
  content.append(glow, flare, bolt, word, tagline);
  el.append(bg.el, content, $('<div class="vignette"></div>'));

  const fill = bolt.querySelector('.fill');
  const line = bolt.querySelector('.line');
  ctx.cues.hits.push({ t: 1.15, k: 'ignite' });
  ctx.cues.whooshes.push({ t: 2.55, k: 'out', d: 0.8 });

  // measured once everything is laid out (fonts loaded before the first frame)
  let layout = null;
  const measure = () => {
    const W = word.getBoundingClientRect().width;
    const boltW = 230 * FINAL_SCALE;
    const gap = 30;
    const R = boltW + gap + W;
    layout = { W, boltX: -R / 2 + boltW / 2, wordX: R / 2 - W / 2 };
  };

  return {
    id: 'intro', a: 0, b: 3.0, el,
    update(t) {
      if (!layout) measure();
      bg.update(t, 0.7);
      set(el.querySelector('.bg'), { opacity: String(0.5 * E.out2(seg(t, 0.6, 2.2))) });
      // 1. a line draws the bolt (0.15 → 1.1), 2. it ignites
      const draw = E.inOut2(seg(t, 0.15, 1.1));
      const ignite = E.out3(seg(t, 1.05, 1.4));
      line.setAttribute('stroke-dashoffset', String(1 - draw));
      set(line, { opacity: String(1 - ignite * 0.7) });
      set(fill, { opacity: String(ignite) });
      const pulse = Math.max(0, 1 - seg(t, 1.1, 1.9)) ** 2;
      // 3. bolt slides left, wordmark appears
      const slide = E.inOut3(seg(t, 1.5, 2.25));
      const bx = layout.boltX * slide;
      const scale = 1 - (1 - FINAL_SCALE) * slide + pulse * 0.08;
      set(bolt, {
        transform: `translate3d(${bx}px, 0, 0) scale(${scale})`,
        filter: `drop-shadow(0 0 ${28 + pulse * 90}px rgb(198 255 61 / ${0.35 + pulse * 0.55}))`,
        opacity: String(E.out2(seg(t, 0.1, 0.35))),
      });
      // flare: a horizontal streak when it ignites
      set(flare, { transform: `scaleX(${E.out4(seg(t, 1.05, 1.5))})`, opacity: String((1 - seg(t, 1.2, 1.9)) * (t > 1.05 ? 1 : 0)) });
      set(glow, { opacity: String(0.22 + pulse * 0.5 + 0.18 * slide), transform: `scale(${0.8 + pulse * 0.3})` });
      // wordmark
      set(word, { transform: `translate(calc(-50% + ${layout.wordX}px), -52%)` });
      letters.forEach((s, i) => {
        const p = E.out4(seg(t, 1.6 + i * 0.06, 2.3 + i * 0.06));
        set(s, { opacity: String(p), transform: `translate3d(${(1 - p) * -90}px, 0, 0)`, filter: `blur(${(1 - p) * 16}px)` });
      });
      const tg = E.out4(seg(t, 2.05, 2.8));
      set(tagline, { opacity: String(tg), transform: `translate3d(0, ${(1 - tg) * 24}px, 0)`, filter: `blur(${(1 - tg) * 10}px)` });
    },
  };
}
