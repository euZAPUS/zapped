import { LANGUAGE_IDS, LANGUAGES, type LangId } from '../data/words';
import { TIME_OPTIONS, WORD_OPTIONS, type Settings } from '../settings/schema';
import { settings } from '../settings/store';
import { clear, h } from '../ui/dom';
import { segmented } from '../ui/segmented';

const MODE_LABELS = [
  { value: 'time' as const, label: 'tiempo' },
  { value: 'words' as const, label: 'palabras' },
  { value: 'custom' as const, label: 'texto' },
];

const SHORT_LANG: Record<LangId, string> = { es: 'Español', en: 'English', cyber: 'Ciber', c42: 'C · 42' };

/** The pill-shaped bar above the text: mode, amount, language and text options. */
export function mountDock(root: HTMLElement, opts: { editText: () => void; afterChange: () => void }): void {
  const s0 = settings.get();

  const mode = segmented(MODE_LABELS, s0.mode, (mode) => change({ mode }), 'Modo');
  const time = segmented(TIME_OPTIONS.map((t) => ({ value: t, label: String(t) })), s0.time, (time) => change({ time }), 'Segundos');
  const words = segmented(WORD_OPTIONS.map((w) => ({ value: w, label: String(w) })), s0.words, (words) => change({ words }), 'Palabras');
  const lang = segmented(
    LANGUAGE_IDS.map((id) => ({ value: id, label: SHORT_LANG[id], title: LANGUAGES[id].label })),
    s0.language,
    (language) => change({ language }),
    'Lista de palabras',
  );

  const toggle = (label: string, key: 'punctuation' | 'numbers' | 'accents', title: string): HTMLButtonElement => {
    const b = h('button', { class: 'pill', type: 'button', 'aria-pressed': String(s0[key]), title }, label);
    b.addEventListener('click', () => change({ [key]: !settings.get()[key] }));
    return b;
  };
  const punct = toggle('@ puntuación', 'punctuation', 'Añade signos de puntuación');
  const nums = toggle('# números', 'numbers', 'Mezcla números entre las palabras');
  const accents = toggle('á tildes', 'accents', 'Mantener o quitar las tildes (la ñ siempre se mantiene)');
  const edit = h('button', { class: 'btn small', type: 'button', onclick: opts.editText }, 'Editar texto');

  const timeGroup = h('div', { class: 'group' }, time.el);
  const wordsGroup = h('div', { class: 'group' }, words.el);
  const customGroup = h('div', { class: 'group' }, edit);
  const langGroup = h('div', { class: 'group' }, lang.el);
  const optGroup = h('div', { class: 'group' }, punct, nums, accents);
  const d1 = h('span', { class: 'divider', 'aria-hidden': 'true' });
  const d2 = h('span', { class: 'divider', 'aria-hidden': 'true' });
  const d3 = h('span', { class: 'divider', 'aria-hidden': 'true' });

  clear(root);
  root.append(h('div', { class: 'group' }, mode.el), d1, timeGroup, wordsGroup, customGroup, d2, langGroup, d3, optGroup);

  function change(patch: Partial<Settings>): void {
    settings.set(patch);
    opts.afterChange();
  }

  const sync = (s: Settings): void => {
    mode.set(s.mode);
    time.set(s.time);
    words.set(s.words);
    lang.set(s.language);
    punct.setAttribute('aria-pressed', String(s.punctuation));
    nums.setAttribute('aria-pressed', String(s.numbers));
    accents.setAttribute('aria-pressed', String(s.accents));

    timeGroup.hidden = s.mode !== 'time';
    wordsGroup.hidden = s.mode !== 'words';
    customGroup.hidden = s.mode !== 'custom';
    const custom = s.mode === 'custom';
    langGroup.hidden = custom;
    optGroup.hidden = custom;
    d2.hidden = custom;
    d3.hidden = custom;
    accents.hidden = s.language !== 'es';
    edit.textContent = s.customText.trim() ? 'Editar texto' : 'Pegar texto';
    // re-measure indicators now that groups changed visibility
    requestAnimationFrame(() => {
      time.set(s.time);
      words.set(s.words);
      lang.set(s.language);
    });
  };
  settings.subscribe((s) => sync(s));
  sync(s0);
}
