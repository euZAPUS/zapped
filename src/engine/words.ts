import { LANGUAGES, type LangId } from '../data/words';
import type { WordSlot } from './types';

export interface GenOptions {
  language: LangId;
  /** Keep accents (Spanish). When false they are stripped, ñ is preserved. */
  accents: boolean;
  /** Keep ñ. When false it is typed as n (Spanish). Defaults to true. */
  enye?: boolean;
  /** Wrap Spanish questions and exclamations in ¿? and ¡!. Defaults to true. */
  invertedMarks?: boolean;
  punctuation: boolean;
  numbers: boolean;
  rng?: () => number;
}

export function stripEnye(text: string): string {
  return text.replace(/ñ/g, 'n').replace(/Ñ/g, 'N');
}

/** Removes diacritics but keeps ñ/Ñ, which has its own key on Spanish keyboards. */
export function stripAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/(?<![nN])[̀-ͯ]|(?<=[nN])[̀-̂̄-ͯ]/g, '')
    .normalize('NFC');
}

const PROSE_ENDINGS = [',', ',', ',', '.', '.', '.', '?', '!', ';', ':'];
const CODE_ENDINGS = [';', ';', ',', '()', '();', '[0]'];

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length)] as T;
}

function randomNumber(rng: () => number): string {
  const digits = 1 + Math.floor(rng() * 4);
  let out = String(1 + Math.floor(rng() * 9));
  for (let i = 1; i < digits; i++) out += Math.floor(rng() * 10);
  return out;
}

/** Applies punctuation to a flat list of tokens, in place. */
function punctuate(tokens: string[], lang: LangId, rng: () => number, invertedMarks: boolean): string[] {
  const code = lang === 'c42';
  const prose = lang === 'es' || lang === 'en';
  const out = tokens.slice();
  let sentenceStart = true;

  for (let i = 0; i < out.length; i++) {
    let w = out[i] as string;
    if (/^-{1,2}\w/.test(w) || w.startsWith('#')) continue; // flags and directives stay untouched
    const r = rng();

    if (code) {
      if (r < 0.12) w = `(${w})`;
      else if (r < 0.2) w = `*${w}`;
      else if (r < 0.26) w = `&${w}`;
      else if (r < 0.4) w += pick(CODE_ENDINGS, rng);
    } else {
      if (prose && sentenceStart) w = w.charAt(0).toLocaleUpperCase() + w.slice(1);
      sentenceStart = false;
      if (r < 0.07) {
        w = `"${w}"`;
      } else if (r < 0.1) {
        w = `(${w})`;
      } else if (r < 0.28) {
        const end = pick(PROSE_ENDINGS, rng);
        if (lang === 'es' && invertedMarks && (end === '?' || end === '!')) {
          // Spanish brackets questions and exclamations
          w = (end === '?' ? '¿' : '¡') + w + end;
        } else {
          w += end;
        }
        if (prose && /[.?!]$/.test(end)) sentenceStart = true;
      }
    }
    out[i] = w;
  }
  return out;
}

/** Generates `count` words ready to feed the engine. */
export function generateWords(count: number, opts: GenOptions): WordSlot[] {
  const rng = opts.rng ?? Math.random;
  const list = LANGUAGES[opts.language];
  let pool = list.words;
  if (opts.language === 'es') {
    if (!opts.accents) pool = pool.map(stripAccents);
    if (opts.enye === false) pool = pool.map(stripEnye);
  }
  const tokens: string[] = [];
  let previous = '';

  while (tokens.length < count) {
    if (opts.numbers && rng() < 0.14) {
      tokens.push(randomNumber(rng));
      previous = '';
      continue;
    }
    if (list.phrases.length > 0 && rng() < 0.1) {
      const phrase = pick(list.phrases, rng);
      tokens.push(...phrase.split(' '));
      previous = '';
      continue;
    }
    const word = pick(pool, rng);
    if (word === previous) continue;
    tokens.push(word);
    previous = word;
  }

  const finalTokens = tokens.slice(0, count);
  const punctuated = opts.punctuation ? punctuate(finalTokens, opts.language, rng, opts.invertedMarks !== false) : finalTokens;
  return punctuated.map((text) => ({ text, sep: ' ' as const, indent: 0 }));
}

/** Marks the last word of a finite test so the engine knows when to stop. */
export function closeSlots(slots: WordSlot[]): WordSlot[] {
  return slots.map((w, i) => (i === slots.length - 1 ? { ...w, sep: '' as const } : w));
}

export const MAX_CUSTOM_WORDS = 3000;

/**
 * Turns pasted text or code into words. Line breaks become Enter separators,
 * leading indentation is skipped automatically (so Tab never needs typing) and
 * inner whitespace runs collapse into a single space.
 */
export function parseCustomText(raw: string): WordSlot[] {
  const lines = raw.replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n');
  const slots: WordSlot[] = [];

  for (const line of lines) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const lead = /^[ \t]*/.exec(line)?.[0] ?? '';
    const indent = [...lead].reduce((n, c) => n + (c === '\t' ? 4 : 1), 0);
    tokens.forEach((text, i) => {
      slots.push({ text, sep: i === tokens.length - 1 ? '\n' : ' ', indent: i === 0 ? indent : 0 });
    });
    if (slots.length >= MAX_CUSTOM_WORDS) break;
  }

  const trimmed = slots.slice(0, MAX_CUSTOM_WORDS);
  return closeSlots(trimmed);
}
