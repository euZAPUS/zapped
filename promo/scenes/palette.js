import { $, E, lerp, makeHeadline, seg, set } from '../lib.js';
import { applyDock, buildBg, buildDock, buildTopbar, buildWords, placeIndicator } from '../ui.js';

const THEMES = ['Voltio · oscuro', 'Brasa · oscuro', 'Marea · oscuro', 'Noctiluca · oscuro', 'Ámbar · oscuro', 'Papel · claro', 'Escarcha · claro', 'Menta · claro'];
const THEME_IDS = ['voltio', 'brasa', 'marea', 'noctiluca', 'ambar', 'papel', 'escarcha', 'menta'];

const ROOT = [
  { sec: 'Test' }, { t: 'Modo', b: 'tiempo', m: true }, { t: 'Tiempo', b: '30 s', m: true }, { t: 'Palabras', m: true },
  { t: 'Lenguaje de código', m: true }, { t: 'Lista de palabras', b: 'Español', m: true },
  { sec: 'Opciones' }, { t: 'Puntuación', toggle: 'punct' }, { t: 'Números', toggle: 'nums' }, { t: 'Tildes', toggle: 'acc', on: true }, { t: 'Eñe (ñ)', toggle: 'enye', on: true },
];

// script of the palette (seconds from the scene start)
const T = {
  keycap: 0.1, press: 0.38, open: 0.7,
  type1: 1.1, // "puntu"
  toggle: 2.0, clear: 2.5,
  type2: 2.65, // "tema"
  enter2: 3.25,
  arrows: [3.55, 3.8, 4.05, 4.3], // Brasa, Marea, Noctiluca, Papel
};
const ARROW_TO = [1, 2, 3, 5];

export function create(ctx) {
  const el = $('<section class="layer" data-ptheme="voltio"></section>');
  const bg = buildBg();
  const content = $('<div class="content"></div>');

  // the app behind the palette
  const win = $(`<div class="pwin" style="top:330px"><div class="pwin-bar"><div class="dots"><i></i><i></i><i></i></div>zapped</div><div class="pwin-body"></div></div>`);
  const body = win.querySelector('.pwin-body');
  const app = $('<div class="app"></div>');
  const view = $('<section class="view" data-view="test"></section>');
  const dock = buildDock();
  applyDock(dock, { mode: 'time', time: 1, words: 1, code: 0, lang: 0, pills: [false, false, false] });
  const words = buildWords('Cada tecla, una pequeña descarga. Escribe sin pensar en las manos y deja que el ritmo haga el resto.');
  words.letters.forEach((l, i) => { if (i < 14) l.dataset.s = 'ok'; });
  const stageUi = $('<div class="stage-ui"><div class="live"><span>30</span></div></div>');
  stageUi.append(words.el);
  view.append(dock.el, stageUi);
  app.append(buildTopbar('test'), view, $('<footer class="footer"></footer>'));
  const appBg = buildBg();
  body.append(appBg.el, app);
  win.style.setProperty('--fs', '30px');
  set(app, { '--fs': '30px' });

  const backdrop = $('<div style="position:absolute;inset:0;background:color-mix(in srgb, var(--bg) 62%, transparent);backdrop-filter:blur(7px)"></div>');
  const dimBox = $('<div style="position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none"></div>');
  dimBox.append(backdrop);

  // keycap
  const keycap = $('<div class="keycap" style="position:absolute;left:50%;top:470px;margin-left:-110px;font-size:60px">esc</div>');
  const keyLabel = $('<div class="caption" style="position:absolute;left:0;right:0;top:720px;font-size:46px;color:var(--fg)">Barra de comandos</div>');

  // the palette itself, built with the app's own classes
  const input = $('<input class="palette-input" type="text" readonly placeholder="Escribe un comando…">');
  const crumb = $('<span class="palette-crumb" hidden></span>');
  const list = $('<ul class="palette-list" role="listbox" style="overflow:hidden"></ul>');
  const palette = $(`<div class="palette" style="display:grid;position:absolute;left:50%;top:272px;width:760px;margin:0 0 0 -380px;max-height:none"></div>`);
  palette.append($('<div class="palette-bar"></div>'), list, $('<div class="palette-hint"><span><kbd>↑</kbd><kbd>↓</kbd> moverte</span><span><kbd>Enter</kbd> elegir</span><span><kbd>Esc</kbd> atrás / cerrar</span></div>'));
  palette.querySelector('.palette-bar').append(crumb, input);

  const headline = makeHeadline([[{ t: 'Esc.' }, { t: 'Lo cambias', cls: 'dim' }, { t: 'todo.', cls: 'accent' }]]);
  set(headline.el, { position: 'absolute', left: 0, right: 0, top: '60px', fontSize: '96px' });
  const sub = $('<div class="caption" style="position:absolute;left:0;right:0;top:182px;font-size:34px">Cámbialo en vivo, con vista previa. Sin entrar a ajustes.</div>');

  content.append(win, dimBox, keycap, keyLabel, palette, headline.el, sub);
  el.append(bg.el, content, $('<div class="vignette"></div>'));

  // audio cues
  ctx.cues.hits.push({ t: 14.5 + T.press, k: 'press' });
  ctx.cues.hits.push({ t: 14.5 + T.open, k: 'open' });
  ctx.cues.hits.push({ t: 14.5 + T.toggle, k: 'toggle' });
  [...'puntu'].forEach((_, i) => ctx.cues.keys.push({ t: 14.5 + T.type1 + i * 0.13, k: 'key' }));
  [...'tema'].forEach((_, i) => ctx.cues.keys.push({ t: 14.5 + T.type2 + i * 0.13, k: 'key' }));
  T.arrows.forEach((a) => ctx.cues.hits.push({ t: 14.5 + a, k: 'theme' }));
  ctx.cues.whooshes.push({ t: 14.45, k: 'in', d: 0.7 });

  const row = (r, active, on, toggled) => {
    if (r.sec) return `<li class="palette-section">${r.sec}</li>`;
    let badge = '';
    if (r.toggle) { const v = r.on || toggled; badge = `<span class="pill-state ${v ? 'on' : ''}">${v ? 'activado' : 'desactivado'}</span>`; }
    else if (r.m) badge = `<span class="badge-menu">${r.b ? `<span class="badge-text">${r.b}</span>` : ''}<span class="chev">›</span></span>`;
    else if (r.current) badge = '<span class="check">●</span>';
    return `<li class="palette-item ${active ? 'active' : ''}"><span class="palette-title">${r.t}</span>${badge}</li>`;
  };

  // list height follows the content: tall for the full menu, short while filtering
  const heightAt = (t) => {
    const stops = [[0, 430], [T.type1 - 0.05, 430], [T.type1 + 0.35, 120], [T.clear, 120], [T.clear + 0.3, 430], [T.type2 + 0.05, 430], [T.type2 + 0.45, 130], [T.enter2, 130], [T.enter2 + 0.3, 372]];
    let h = stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (t >= stops[i][0]) h = stops[i][1];
      else { h = stops[i - 1][1] + (stops[i][1] - stops[i - 1][1]) * E.inOut2(seg(t, stops[i - 1][0], stops[i][0])); break; }
    }
    return h;
  };
  let lastHtml = '';
  return {
    id: 'palette', a: 14.5, b: 19.0, el,
    update(g) {
      const t = g - 14.5;
      bg.update(g, 0.9);
      appBg.update(g, 0.5);
      headline.update(t, 0.05, 99);
      set(sub, { opacity: String(E.out3(seg(t, 0.5, 1.1))) });

      // theme in this scene changes with the highlighted entry
      let themeIdx = 0;
      T.arrows.forEach((a, i) => { if (t >= a) themeIdx = ARROW_TO[i]; });
      el.dataset.ptheme = THEME_IDS[themeIdx];

      // the app behind: slow drift
      const drift = E.inOut2(seg(t, 0, 4.5));
      set(win, { transform: `translate3d(0, ${-30 * drift}px, -80px) rotateX(${lerp(8, 3, drift)}deg) scale(${lerp(0.96, 1.02, drift)})` });
      const dimP = E.out3(seg(t, T.open - 0.1, T.open + 0.4));
      set(dimBox, { opacity: String(dimP) });

      // keycap press and exit
      const kin = E.back(seg(t, T.keycap, T.keycap + 0.35), 1.6);
      const press = seg(t, T.press, T.press + 0.07) * (1 - seg(t, T.press + 0.14, T.press + 0.3));
      const kout = E.in3(seg(t, T.open - 0.05, T.open + 0.3));
      set(keycap, { opacity: String(Math.min(1, kin * 3) * (1 - kout)), transform: `translate3d(0, ${press * 12 - kout * 40}px, 0) scale(${0.7 + 0.3 * kin - kout * 0.12})`, boxShadow: `0 ${10 - press * 8}px 0 color-mix(in srgb, var(--border) 90%, black), 0 30px 80px rgb(0 0 0 / 0.55)` });
      set(keyLabel, { opacity: String(seg(t, T.keycap + 0.2, T.keycap + 0.5) * (1 - kout)) });

      // palette appearing
      const pin = E.out4(seg(t, T.open, T.open + 0.45));
      set(palette, { opacity: String(pin), transform: `translate3d(0, ${(1 - pin) * 30}px, 0) scale(${0.95 + 0.05 * pin})`, filter: `blur(${(1 - pin) * 8}px)`, visibility: pin > 0.01 ? '' : 'hidden' });

      // content state machine
      const typed = (word, t0) => word.slice(0, Math.max(0, Math.min(word.length, Math.floor((t - t0) / 0.13) + 1)));
      let query = '';
      let html = '';
      let submenu = false;
      const toggled = t >= T.toggle;
      if (t < T.type1) html = ROOT.map((r) => row(r, false)).join('');
      else if (t < T.clear) {
        query = typed('puntu', T.type1);
        html = row({ t: 'Puntuación', toggle: 'punct' }, true, false, toggled);
        // the toggle stays open: the pill flips
      } else if (t < T.type2) html = ROOT.map((r, i) => row(r, i === 1)).join('');
      else if (t < T.enter2) {
        query = typed('tema', T.type2);
        html = row({ t: 'Tema', b: 'Voltio · oscuro', m: true }, true) + row({ t: 'Tema › Voltio · oscuro' }, false);
      } else {
        submenu = true;
        let active = 0;
        T.arrows.forEach((a, i) => { if (t >= a) active = ARROW_TO[i]; });
        html = THEMES.map((n, i) => row({ t: n, current: i === 0 }, i === active)).join('');
      }
      if (html + query + submenu !== lastHtml) {
        list.innerHTML = html;
        input.value = query;
        crumb.hidden = !submenu;
        crumb.textContent = submenu ? 'Tema ›' : '';
        input.placeholder = submenu ? 'Filtrar…' : 'Escribe un comando…';
        lastHtml = html + query + submenu;
      }
      list.style.height = `${heightAt(t)}px`;
      // pop on the toggled pill
      const pill = list.querySelector('.pill-state');
      if (pill && toggled) { const p = seg(t, T.toggle, T.toggle + 0.4); pill.style.transform = `scale(${1 + 0.35 * Math.sin(p * Math.PI)})`; }
      // blinking text caret in the input
      input.style.caretColor = 'transparent';
      placeIndicator(dock.segs.mode, 0, 0, 1);
      placeIndicator(dock.segs.time, 1, 1, 1);
      placeIndicator(dock.segs.lang, 0, 0, 1);
    },
  };
}
