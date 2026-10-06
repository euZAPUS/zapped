import { $, E, makeHeadline, seg, set } from '../lib.js';
import { applyDock, buildBg, buildCode, buildDock, buildPointer, buildWords, placeIndicator } from '../ui.js';

const PROSE = 'La práctica hace al maestro; cada sesión suma, cada fallo enseña y cada récord se queda en tu perfil.';
const C = 'size_t\tft_strlen(const char *s)\n{\n\tsize_t\ti;\n\n\ti = 0;\n\twhile (s[i])\n\t\ti++;\n\treturn (i);\n}';
const PY = 'def fibonacci(n: int) -> list[int]:\n    seq = [0, 1]\n    while len(seq) < n:\n        seq.append(seq[-1] + seq[-2])\n    return seq[:n]';
const JS = 'const debounce = (fn, delay = 300) => {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n};';

// the "script": what the pointer clicks and when (seconds from the scene start)
const CLICKS = [
  { at: 0.65, seg: 'mode', idx: 1, patch: { mode: 'words' } },
  { at: 1.3, seg: 'words', idx: 2, patch: { words: 2 } },
  { at: 1.95, seg: 'mode', idx: 2, patch: { mode: 'code' } },
  { at: 2.55, seg: 'code', idx: 1, patch: { code: 1 } },
  { at: 3.15, seg: 'code', idx: 2, patch: { code: 2 } },
];

/** 10.5–14.5 s: the quick selector. A pointer flips mode, amount and code language. */
export function create(ctx) {
  const el = $('<section class="layer" data-ptheme="voltio"></section>');
  const bg = buildBg();
  const content = $('<div class="content"></div>');
  const headline = makeHeadline([[{ t: 'Tu' }, { t: 'forma', cls: 'dim' }, { t: 'de practicar.', cls: 'accent' }]]);
  set(headline.el, { position: 'absolute', left: 0, right: 0, top: '70px', fontSize: '98px' });

  const box = $('<div style="position:absolute;left:50%;top:300px;width:1040px;margin-left:-520px;transform-origin:50% 0"></div>');
  const dock = buildDock();
  set(dock.el, { width: '100%' });
  box.append(dock.el);

  const panels = {
    words: buildWords(PROSE),
    c: buildCode(C),
    py: buildCode(PY),
    js: buildCode(JS),
  };
  const panelHost = $('<div style="position:absolute;left:50%;top:590px;width:1400px;margin-left:-700px;font-family:var(--font-mono);font-size:42px;--fs:42px"></div>');
  Object.values(panels).forEach((p) => {
    p.el.style.position = 'absolute';
    p.el.style.left = '0';
    p.el.style.right = '0';
    panelHost.append(p.el);
  });
  panelHost.style.setProperty('--lh', '72px');
  // the prose panel shows the first words already typed, so it reads as a live test
  panels.words.letters.forEach((l, i) => { if (i < 24) l.dataset.s = 'ok'; });
  panels.words.caret.style.display = 'none';
  // code panels also look mid-test: the first lines are already typed
  ['c', 'py', 'js'].forEach((k) => {
    const ls = [...panels[k].inner.querySelectorAll('.l')];
    ls.forEach((l, i) => { if (i < Math.round(ls.length * 0.34)) l.dataset.s = 'ok'; });
  });

  const pointer = buildPointer();
  const ripple = $('<i class="ripple"></i>');
  content.append(headline.el, box, panelHost, ripple, pointer);
  el.append(bg.el, content, $('<div class="vignette"></div>'));

  CLICKS.forEach((c) => ctx.cues.keys.push({ t: 10.5 + c.at, k: 'click' }));
  ctx.cues.whooshes.push({ t: 10.45, k: 'in', d: 0.7 });

  const initial = { mode: 'time', time: 1, words: 1, code: 0, lang: 0, pills: [false, false, false] };
  const stateAt = (t) => {
    const s = { ...initial };
    CLICKS.forEach((c) => { if (c.at <= t) Object.assign(s, c.patch); });
    return s;
  };
  const valueAt = (key, t) => {
    const hist = [{ at: -1, idx: key === 'mode' ? 0 : initial[key] }, ...CLICKS.filter((c) => c.seg === key).map((c) => ({ at: c.at, idx: c.idx }))];
    let k = 0;
    hist.forEach((h, i) => { if (h.at <= t) k = i; });
    return { tc: hist[k].at, to: hist[k].idx, from: hist[Math.max(0, k - 1)].idx };
  };

  const stageRect = () => el.getBoundingClientRect();
  let lastStateKey = '';
  return {
    id: 'modes', a: 10.5, b: 14.5, el,
    update(g) {
      const t = g - 10.5;
      bg.update(g, 0.9);
      headline.update(t, 0.1, 99);
      const rise = E.out5(seg(t, 0, 1.0));
      set(box, { transform: `translate3d(0, ${(1 - rise) * 90}px, ${(rise - 1) * 200}px) scale(1.52)`, opacity: String(E.out3(seg(t, 0, 0.5))) });

      const s = stateAt(t);
      const key = JSON.stringify(s);
      if (key !== lastStateKey) { applyDock(dock, s); lastStateKey = key; }
      ['mode', 'time', 'words', 'code', 'lang'].forEach((k) => {
        const v = valueAt(k, t);
        placeIndicator(dock.segs[k], v.from, v.to, E.back(seg(t, v.tc, v.tc + 0.5), 1.2));
      });

      // which text panel is on screen
      const show = s.mode === 'code' ? ['c', 'py', 'js'][s.code] ?? 'c' : 'words';
      const tSwitch = (CLICKS.filter((c) => c.at <= t && (c.seg === 'mode' || c.seg === 'code')).pop() ?? { at: -9 }).at;
      Object.entries(panels).forEach(([name, p]) => {
        const on = name === show ? E.out4(seg(t, tSwitch + 0.05, tSwitch + 0.55)) : 0;
        set(p.el, { opacity: String(on), transform: `translate3d(0, ${(1 - on) * 24}px, 0)`, filter: `blur(${(1 - on) * 10}px)`, visibility: on > 0.01 ? '' : 'hidden' });
      });
      set(panelHost, { opacity: String(E.out3(seg(t, 0.35, 1.0))) });

      // pointer: glides to each target, clicks, ripples
      const sr = stageRect();
      const centerOf = (c) => {
        const b = dock.segs[c.seg].buttons[c.idx].getBoundingClientRect();
        return { x: b.left - sr.left + b.width / 2, y: b.top - sr.top + b.height / 2 };
      };
      let prev = { x: 1500, y: 980 };
      let pos = prev;
      let pressed = 0;
      let rip = null;
      for (let i = 0; i < CLICKS.length; i++) {
        const c = CLICKS[i];
        const t0 = i === 0 ? 0.15 : CLICKS[i - 1].at + 0.14;
        if (t < t0) break;
        const to = centerOf(c);
        const p = E.inOut3(seg(t, t0, c.at - 0.04));
        pos = { x: prev.x + (to.x - prev.x) * p, y: prev.y + (to.y - prev.y) * p - Math.sin(p * Math.PI) * 26 };
        if (t >= c.at - 0.04 && t < c.at + 0.16) pressed = 1;
        if (t >= c.at && t < c.at + 0.55) rip = { x: to.x, y: to.y, p: (t - c.at) / 0.55 };
        if (t < c.at + 0.14) break;
        prev = to;
      }
      const dockBtns = CLICKS.map((c) => dock.segs[c.seg].buttons[c.idx]);
      dockBtns.forEach((b, i) => { b.style.transform = t >= CLICKS[i].at - 0.02 && t < CLICKS[i].at + 0.16 ? 'scale(0.92)' : ''; });
      set(pointer, { transform: `translate3d(${pos.x - 6}px, ${pos.y - 4}px, 0) scale(${1 - 0.12 * pressed})`, opacity: String(E.out2(seg(t, 0.1, 0.35))) });
      set(ripple, rip ? { left: `${rip.x}px`, top: `${rip.y}px`, opacity: String(1 - rip.p), transform: `scale(${1 + rip.p * 4.5})` } : { opacity: '0' });
    },
  };
}
