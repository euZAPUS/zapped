import { $, E, BOLT_PATH, seg, set } from '../lib.js';
import { buildBg } from '../ui.js';

/** 27.5–30 s: the logo again, where to get it, then black. */
export function create(ctx) {
  const el = $('<section class="layer" data-ptheme="voltio" style="--bg:#04050c"></section>');
  const bg = buildBg();
  const content = $('<div class="content"></div>');
  const glow = $('<div class="aura" style="width:1700px;height:900px;top:42%"></div>');
  const flash = $('<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 42%, rgb(234 255 138 / .9), transparent 55%)"></div>');
  const bolt = $(`<svg viewBox="0 0 24 24" style="position:absolute;left:50%;top:330px;width:190px;height:190px;margin-left:-95px;overflow:visible"><defs><linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eaff8a"/><stop offset="1" stop-color="#9be31f"/></linearGradient></defs><path d="${BOLT_PATH}" fill="url(#bg2)"/></svg>`);
  const word = $('<div style="position:absolute;left:0;right:0;top:470px;text-align:center;font:700 210px/1 var(--font-ui);letter-spacing:-0.06em"></div>');
  const letters = [...'zapped'].map((c) => { const s = $(`<span style="display:inline-block">${c}</span>`); word.append(s); return s; });
  const tag = $('<div class="caption" style="position:absolute;left:0;right:0;top:720px;font-size:56px;color:var(--fg)"><span style="opacity:.5">Descárgala. </span>Escribe con chispa.</div>');
  const chips = ['Windows', 'macOS', 'Linux', 'Web'].map((n) => $(`<span class="chip" style="font-size:32px;padding:14px 30px">${n}</span>`));
  const chipRow = $('<div style="position:absolute;left:0;right:0;top:836px;display:flex;gap:18px;justify-content:center"></div>');
  chipRow.append(...chips);
  const url = $('<div class="caption" style="position:absolute;left:0;right:0;top:940px;font:500 34px var(--font-mono);letter-spacing:0">github.com/euZAPUS/zapped</div>');
  const black = $('<div style="position:absolute;inset:0;background:#000;z-index:9"></div>');
  content.append(glow, bolt, word, tag, chipRow, url);
  el.append(bg.el, flash, content, $('<div class="vignette"></div>'), black);

  ctx.cues.hits.push({ t: 27.55, k: 'finale' });
  ctx.cues.whooshes.push({ t: 27.0, k: 'rise', d: 0.55 });

  return {
    id: 'outro', a: 27.5, b: 30.0, el,
    update(g) {
      const t = g - 27.5;
      bg.update(g, 0.7);
      set(bg.el, { opacity: '0.55' });
      const f = Math.max(0, 1 - seg(t, 0, 0.55)) ** 2;
      set(flash, { opacity: String(f) });
      const bin = E.out4(seg(t, 0.05, 0.7));
      set(bolt, { opacity: String(bin), transform: `scale(${0.8 + 0.2 * bin})`, filter: `drop-shadow(0 0 ${30 + f * 80}px rgb(198 255 61 / ${0.4 + f * 0.5}))` });
      set(glow, { opacity: String(0.35 + f * 0.4), transform: `scale(${0.9 + 0.1 * bin})` });
      letters.forEach((s, i) => {
        const p = E.out4(seg(t, 0.2 + i * 0.05, 0.85 + i * 0.05));
        set(s, { opacity: String(p), transform: `translate3d(0, ${(1 - p) * 60}px, 0)`, filter: `blur(${(1 - p) * 14}px)` });
      });
      const tg = E.out4(seg(t, 0.75, 1.4));
      set(tag, { opacity: String(tg), transform: `translate3d(0, ${(1 - tg) * 22}px, 0)`, filter: `blur(${(1 - tg) * 8}px)` });
      chips.forEach((c, i) => {
        const p = E.back(seg(t, 1.0 + i * 0.1, 1.55 + i * 0.1), 1.5);
        set(c, { opacity: String(seg(t, 1.0 + i * 0.1, 1.2 + i * 0.1)), transform: `translate3d(0, ${(1 - p) * 30}px, 0) scale(${0.85 + 0.15 * p})` });
      });
      set(url, { opacity: String(E.out3(seg(t, 1.5, 2.0)) * 0.8) });
      set(black, { opacity: String(E.in3(seg(t, 2.1, 2.5))) });
    },
  };
}
