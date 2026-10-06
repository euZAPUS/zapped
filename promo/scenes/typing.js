import { $, E, lerp, makeHeadline, rng, seg, set } from '../lib.js';
import { buildBg, buildDock, applyDock, buildTopbar, buildWords, placeIndicator } from '../ui.js';

const TEXT = 'Cada tecla, una pequeña descarga. Escribe sin pensar en las manos y deja que el ritmo haga el resto. Cada palabra, un relámpago.';
const TYPED_CHARS = 66;
const START = 0.55; // first key, relative to the scene start
const ERROR_AT = 41; // char index where we deliberately slip once

/** Builds the keystroke script and a snapshot of the whole text state after each key. */
function simulate(chars, letterCount) {
  const rand = rng(7);
  const events = [];
  let t = START;
  let cursor = 0;
  let streak = 0;
  const st = new Uint8Array(letterCount);
  const typedAt = new Float32Array(letterCount).fill(-9);
  const snap = (e) => events.push({ ...e, cursor, streak, st: st.slice(), typedAt: typedAt.slice() });
  const interval = (i) => lerp(0.1, 0.052, Math.min(1, i / 45)) * (0.8 + rand() * 0.45);

  for (let i = 0; i < TYPED_CHARS; i++) {
    if (i === ERROR_AT && !chars[i].space) {
      // wrong key, notice, backspace, then the right one
      t += interval(i);
      st[chars[i].letter] = 2;
      typedAt[chars[i].letter] = t;
      cursor = i + 1;
      streak = 0;
      snap({ t, kind: 'err' });
      t += 0.2;
      st[chars[i].letter] = 0;
      cursor = i;
      snap({ t, kind: 'back' });
      t += 0.14;
    }
    t += interval(i);
    if (!chars[i].space) {
      st[chars[i].letter] = 1;
      typedAt[chars[i].letter] = t;
    }
    cursor = i + 1;
    streak++;
    snap({ t, kind: chars[i].space ? 'space' : 'key' });
  }
  return events;
}

export function create(ctx) {
  const el = $('<section class="layer" data-ptheme="voltio"></section>');
  const bg = buildBg();
  const aura = $('<div class="aura"></div>');
  const content = $('<div class="content"></div>');
  const headline = makeHeadline([[{ t: 'Cada' }, { t: 'tecla,', cls: 'accent' }, { t: 'una descarga.', cls: 'dim' }]]);
  set(headline.el, { position: 'absolute', left: 0, right: 0, top: '86px', fontSize: '104px' });

  const chips = ['Cursor que se desliza', 'Pop en cada letra', 'Brillo de racha', 'Sonido sintetizado'].map((txt) => {
    const c = $(`<span class="chip" style="font-size:31px;padding:14px 26px"><i style="width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px var(--accent)"></i>${txt}</span>`);
    return c;
  });
  const chipRow = $('<div style="position:absolute;left:0;right:0;top:150px;display:flex;gap:18px;justify-content:center"></div>');
  chipRow.append(...chips);

  // window with the real app markup
  const win = $(`<div class="pwin" style="top:335px"><div class="pwin-bar"><div class="dots"><i></i><i></i><i></i></div>zapped</div><div class="pwin-body"></div></div>`);
  const body = win.querySelector('.pwin-body');
  const appBg = buildBg();
  const app = $('<div class="app"></div>');
  const topbar = buildTopbar('test');
  const view = $('<section class="view" data-view="test"></section>');
  const dock = buildDock();
  const stageUi = $('<div class="stage-ui"></div>');
  const live = $('<div class="live"><span class="live-main">30</span><span class="live-wpm"></span></div>');
  const words = buildWords(TEXT);
  stageUi.append(live, words.el);
  const hints = $('<p class="hints chrome"><span><kbd>Tab</kbd> reiniciar</span><span><kbd>Ctrl</kbd>+<kbd>⌫</kbd> borrar palabra</span><span><kbd>Esc</kbd> comandos</span></p>');
  view.append(dock.el, stageUi, hints);
  const footer = $('<footer class="footer chrome"><span></span><span></span></footer>');
  app.append(topbar, view, footer);
  body.append(appBg.el, app);
  set(app, { '--fs': '34px' });
  win.style.setProperty('--fs', '34px');
  applyDock(dock, { mode: 'time', time: 1, words: 1, code: 0, lang: 0, pills: [false, false, false] });
  const chrome = [topbar, dock.el, hints, footer];

  content.append(headline.el, chipRow, win);
  el.append(bg.el, aura, content, $('<div class="vignette"></div>'));

  // 40 reusable sparks
  const sparks = Array.from({ length: 44 }, (_, i) => {
    const s = $(`<i class="spark ${i % 2 ? 'alt' : ''}"></i>`);
    words.fx.append(s);
    return s;
  });

  const events = simulate(words.chars, words.letters.length);
  events.forEach((e) => {
    if (e.kind === 'key') ctx.cues.keys.push({ t: 3.0 + e.t, k: 'key' });
    else if (e.kind === 'space') ctx.cues.keys.push({ t: 3.0 + e.t, k: 'space' });
    else if (e.kind === 'err') ctx.cues.keys.push({ t: 3.0 + e.t, k: 'err' });
    else ctx.cues.keys.push({ t: 3.0 + e.t, k: 'back' });
  });
  ctx.cues.whooshes.push({ t: 3.05, k: 'in', d: 1.0 });
  ctx.cues.hits.push({ t: 3.3, k: 'soft' });

  const firstKey = events[0].t;
  const caretPos = (cursor) => {
    const c = words.chars[cursor];
    let target;
    let atEnd = false;
    if (!c) {
      target = words.letters[words.letters.length - 1];
      atEnd = true;
    } else if (c.space) {
      target = words.letters[words.chars[cursor - 1].letter];
      atEnd = true;
    } else target = words.letters[c.letter];
    return { x: target.offsetLeft + (atEnd ? target.offsetWidth : 0), y: target.offsetTop, w: target.offsetWidth };
  };

  let glowValue = 0;
  return {
    id: 'typing', a: 3.0, b: 7.0, el,
    update(g) {
      const t = g - 3.0; // local time
      bg.update(g, 0.9);
      appBg.update(g, 0.5);

      // camera: the window rises, settles, then pushes in slowly
      const rise = E.out5(seg(t, 0.0, 1.35));
      const push = E.inOut2(seg(t, 1.2, 4.0));
      const tilt = lerp(24, 5, rise) - 3 * push;
      const sc = lerp(0.86, 1.0, rise) + 0.17 * push;
      set(win, { transform: `translate3d(0, ${lerp(520, 0, rise) - 70 * push}px, ${lerp(-300, 0, rise)}px) rotateX(${tilt}deg) rotateY(${lerp(-6, 0, rise)}deg) scale(${sc})`, opacity: String(E.out3(seg(t, 0, 0.5))) });

      headline.update(t, 0.15, 2.3);
      const chipsIn = 2.35;
      chips.forEach((c, i) => {
        const p = E.out4(seg(t, chipsIn + i * 0.12, chipsIn + i * 0.12 + 0.6));
        set(c, { opacity: String(p), transform: `translate3d(0, ${(1 - p) * 26}px, 0) scale(${0.94 + 0.06 * p})`, filter: `blur(${(1 - p) * 8}px)` });
      });

      // UI dims once typing starts, like in the app
      const dim = E.out3(seg(t, firstKey + 0.1, firstKey + 0.9));
      chrome.forEach((c) => set(c, { opacity: String(1 - 0.94 * dim) }));

      // keystroke state at t
      let k = -1;
      for (let i = 0; i < events.length; i++) if (events[i].t <= t) k = i;
      const ev = k >= 0 ? events[k] : null;
      const st = ev ? ev.st : null;
      words.letters.forEach((l, i) => {
        const s = st ? st[i] : 0;
        if (s) l.dataset.s = s === 1 ? 'ok' : 'bad';
        else delete l.dataset.s;
        // pop: same curve as the app's keyframes
        const ta = ev ? ev.typedAt[i] : -9;
        const p = seg(t, ta, ta + 0.2);
        if (s === 1 && p > 0 && p < 1) {
          const q = 1 - E.out4(p);
          set(l, { transform: `translateY(${-4 * q}px) scale(${1 + 0.4 * q})`, textShadow: `0 0 ${14 * q}px rgb(198 255 61 / ${q})`, color: q > 0.45 ? 'var(--accent)' : '' });
        } else set(l, { transform: '', textShadow: '', color: '' });
      });

      // caret glides between positions
      const cur = ev ? ev.cursor : 0;
      const prev = k > 0 ? events[k - 1].cursor : 0;
      const a = caretPos(prev);
      const b = caretPos(cur);
      const gp = ev ? E.out3(seg(t, ev.t, ev.t + 0.1)) : 1;
      words.caret.style.transform = `translate3d(${lerp(a.x, b.x, gp)}px, ${lerp(a.y, b.y, gp)}px, 0)`;
      words.caret.style.setProperty('--cw', `${b.w}px`);
      set(words.caret, { opacity: ev || Math.floor(t * 2) % 2 === 0 ? '1' : '0.15' });

      // streak aura: grows with clean keys, drops on a mistake
      const target = ev ? Math.max(0, Math.min(1, (ev.streak - 6) / 38)) : 0;
      const since = ev ? t - ev.t : 0;
      glowValue = ev && ev.kind === 'err' ? lerp(glowValue, 0, 0.5) : lerp(glowValue, target, 0.18);
      const gv = ev ? glowValue : 0;
      set(aura, { opacity: String(gv * 0.95 + 0.08), transform: `scale(${0.6 + gv * 0.85})` });
      void since;

      // sparks (4 per correct key)
      let n = 0;
      for (let i = Math.max(0, k - 7); i <= k; i++) {
        const e = events[i];
        if (!e || e.kind !== 'key') continue;
        const age = t - e.t;
        if (age < 0 || age > 0.62) continue;
        const p = E.out3(age / 0.62);
        const c = caretPos(e.cursor - 1);
        const r = rng(i * 97 + 3);
        for (let j = 0; j < 4 && n < sparks.length; j++, n++) {
          const ang = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.15;
          const dist = 26 + r() * 54;
          set(sparks[n], {
            display: 'block', left: `${c.x + c.w / 2}px`, top: `${c.y + 24}px`,
            transform: `translate(calc(-50% + ${Math.cos(ang) * dist * p}px), calc(-50% + ${Math.sin(ang) * dist * p}px)) scale(${1 - p * 0.85})`,
            opacity: String(1 - p),
          });
        }
      }
      for (; n < sparks.length; n++) sparks[n].style.display = 'none';

      // HUD
      const running = ev && t >= firstKey;
      const elapsed = Math.max(0, t - firstKey);
      const main = live.querySelector('.live-main');
      const wpmEl = live.querySelector('.live-wpm');
      main.textContent = String(Math.max(0, Math.ceil(30 - elapsed)));
      const correct = st ? st.reduce((s, v) => s + (v === 1 ? 1 : 0), 0) + (ev ? Math.floor(ev.cursor / 7) : 0) : 0;
      wpmEl.textContent = running && elapsed > 0.9 ? `${Math.round(correct / 5 / (elapsed / 60))} ppm` : '';
      set(live, { opacity: running ? '1' : '0.35' });

      placeIndicator(dock.segs.mode, 0, 0, 1);
      placeIndicator(dock.segs.time, 1, 1, 1);
      placeIndicator(dock.segs.lang, 0, 0, 1);
    },
  };
}
