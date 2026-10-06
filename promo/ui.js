import { $, BOLT } from './lib.js';

const SLIDERS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildTopbar(active = 'test') {
  const cur = (k) => (k === active ? 'aria-current="page"' : '');
  return $(`<header class="topbar chrome"><a class="logo">${BOLT.replace('<svg', '<svg width="22" height="22"')}<span>zapped</span></a>
    <nav class="nav"><a class="nav-link" ${cur('test')}>Test</a><a class="nav-link" ${cur('profile')}>Perfil</a></nav>
    <div class="topbar-actions"><button class="icon-btn" type="button">${SLIDERS}</button></div></header>`);
}

/** Aurora blobs driven by time instead of CSS keyframes. */
export function buildBg() {
  const el = $('<div class="bg"><i class="blob"></i><i class="blob"></i><i class="blob"></i></div>');
  const blobs = [...el.children];
  return {
    el,
    update(t, k = 1) {
      blobs[0].style.transform = `translate3d(${Math.sin(t * 0.21) * 160 * k}px, ${Math.cos(t * 0.17) * 110 * k}px, 0) scale(${1 + Math.sin(t * 0.13) * 0.06})`;
      blobs[1].style.transform = `translate3d(${Math.cos(t * 0.19) * -190 * k}px, ${Math.sin(t * 0.23) * -90 * k}px, 0) scale(${1 + Math.cos(t * 0.11) * 0.07})`;
      blobs[2].style.transform = `translate3d(${Math.sin(t * 0.15) * 120 * k}px, ${Math.cos(t * 0.2) * 70 * k}px, 0)`;
    },
  };
}

// ---------------------------------------------------------------- dock

function seg(labels) {
  const ind = $('<span class="ind" aria-hidden="true"></span>');
  const buttons = labels.map((l) => $(`<button type="button" aria-pressed="false">${l}</button>`));
  const el = $('<div class="seg"></div>');
  el.append(ind, ...buttons);
  return { el, ind, buttons };
}

export const MODE_KEYS = ['time', 'words', 'code', 'custom'];

export function buildDock() {
  const el = $('<div class="dock chrome"></div>');
  const segs = {
    mode: seg(['tiempo', 'palabras', 'código', 'texto']),
    time: seg(['15', '30', '60', '120']),
    words: seg(['10', '25', '50', '100']),
    code: seg(['C', 'Python', 'JavaScript', 'Bash', 'SQL']),
    lang: seg(['Español', 'English', 'Ciber', 'C · 42']),
  };
  const edit = $('<button class="btn small" type="button">Editar texto</button>');
  const pills = ['@ puntuación', '# números', 'á tildes'].map((l) => $(`<button class="pill" type="button" aria-pressed="false">${l}</button>`));
  const group = (...c) => {
    const d = $('<div class="group"></div>');
    d.append(...c);
    return d;
  };
  const groups = {
    mode: group(segs.mode.el), time: group(segs.time.el), words: group(segs.words.el), code: group(segs.code.el),
    custom: group(edit), lang: group(segs.lang.el), opts: group(...pills),
  };
  const dv = () => $('<span class="divider" aria-hidden="true"></span>');
  const dividers = [dv(), dv(), dv()];
  el.append(groups.mode, dividers[0], groups.time, groups.words, groups.code, groups.custom, dividers[1], groups.lang, dividers[2], groups.opts);
  return { el, segs, groups, dividers, pills };
}

/** state: { mode, time, words, code, lang (indexes into each seg), pills: [bool,bool,bool] } */
export function applyDock(d, s) {
  const setSeg = (sg, idx) => sg.buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === idx)));
  setSeg(d.segs.mode, MODE_KEYS.indexOf(s.mode));
  setSeg(d.segs.time, s.time);
  setSeg(d.segs.words, s.words);
  setSeg(d.segs.code, s.code);
  setSeg(d.segs.lang, s.lang);
  d.pills.forEach((p, i) => p.setAttribute('aria-pressed', String(!!s.pills[i])));
  d.groups.time.hidden = s.mode !== 'time';
  d.groups.words.hidden = s.mode !== 'words';
  d.groups.code.hidden = s.mode !== 'code';
  d.groups.custom.hidden = s.mode !== 'custom';
  const fixed = s.mode === 'custom' || s.mode === 'code';
  d.groups.lang.hidden = fixed;
  d.groups.opts.hidden = fixed;
  d.dividers[1].hidden = fixed;
  d.dividers[2].hidden = fixed;
  d.pills[2].hidden = s.lang !== 0;
}

/** Positions a segmented indicator between two buttons (p = 0..1). */
export function placeIndicator(sg, from, to, p) {
  const a = sg.buttons[from];
  const b = sg.buttons[to];
  if (!a || !b || !b.offsetWidth) return;
  const x = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * p;
  const w = (a.offsetWidth || b.offsetWidth) + (b.offsetWidth - (a.offsetWidth || b.offsetWidth)) * p;
  sg.ind.style.width = `${w}px`;
  sg.ind.style.transform = `translateX(${x}px)`;
}

// ---------------------------------------------------------------- text blocks

/** Prose in the app's own word/letter markup. Returns refs for the typing simulation. */
export function buildWords(text) {
  const wrap = $('<div class="words-wrap"><div class="viewport"><div class="inner smooth" data-caret="line"></div></div></div>');
  const inner = wrap.querySelector('.inner');
  const caret = $('<span class="caret"></span>');
  const fx = $('<span class="fx"></span>');
  inner.append(caret, fx);
  const letters = [];
  const chars = [];
  text.split(' ').forEach((w, wi, arr) => {
    const we = $('<span class="word"></span>');
    [...w].forEach((ch) => {
      const l = $(`<span class="l">${esc(ch)}</span>`);
      we.append(l);
      chars.push({ space: false, letter: letters.length });
      letters.push(l);
    });
    inner.append(we);
    if (wi < arr.length - 1) chars.push({ space: true, letter: -1 });
  });
  return { el: wrap, inner, caret, fx, letters, chars };
}

/** Code in the app's markup: indentation spacers, line breaks and the ↵ glyph. */
export function buildCode(source) {
  const wrap = $('<div class="words-wrap"><div class="viewport"><div class="inner smooth" data-caret="line"></div></div></div>');
  const inner = wrap.querySelector('.inner');
  const lines = source.replace(/\t/g, '    ').split('\n').filter((l) => l.trim());
  lines.forEach((line) => {
    const indent = line.match(/^ */)[0].length;
    const toks = line.trim().split(/\s+/);
    toks.forEach((tok, i) => {
      if (i === 0 && indent) inner.append($(`<span class="indent" style="width:${indent}ch"></span>`));
      const we = $('<span class="word"></span>');
      [...tok].forEach((ch) => we.append($(`<span class="l">${esc(ch)}</span>`)));
      if (i === toks.length - 1) we.append($('<span class="l nl">↵</span>'));
      inner.append(we);
    });
    inner.append($('<span class="line-break"></span>'));
  });
  return { el: wrap, inner };
}

export function buildPointer() {
  return $('<svg class="pointer" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8-6 1.8L10.5 19z" fill="#fff" stroke="#000" stroke-width="1.1" stroke-linejoin="round"/></svg>');
}
