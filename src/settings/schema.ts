import type { LangId } from '../data/words';
import type { Mode } from '../engine/types';

export type CaretStyle = 'line' | 'block' | 'underline';
export type SoundId = 'off' | 'click' | 'pop' | 'typewriter' | 'bubble';
export type MotionPref = 'auto' | 'reduced' | 'full';
export type BackgroundKind = 'aurora' | 'grid' | 'dots' | 'plain' | 'gradient' | 'image';
export type FontId = 'jetbrains' | 'fira' | 'plex' | 'space' | 'system';

export interface Settings {
  // test
  mode: Mode;
  time: number;
  words: number;
  language: LangId;
  accents: boolean;
  punctuation: boolean;
  numbers: boolean;
  customText: string;
  stopOnError: boolean;
  liveStats: boolean;

  // cursor and feel
  caret: CaretStyle;
  smoothCaret: boolean;
  pop: boolean;
  sparks: boolean;
  glow: boolean;
  dimUi: boolean;
  focusMode: boolean;
  motion: MotionPref;

  // sound
  sound: SoundId;
  volume: number;
  errorSound: boolean;

  // look
  theme: string;
  accent: string | null;
  font: FontId;
  fontSize: number;
  background: BackgroundKind;
  bgColorA: string | null;
  bgColorB: string | null;
  /** 'local' means the image uploaded on this device; anything else is a URL. */
  bgImage: string;
  bgDim: number;
  bgBlur: number;

  // profile
  profileName: string;

  /** Last modification (ms). Used to pick the newest settings when syncing. */
  updatedAt: number;
}

export const TIME_OPTIONS = [15, 30, 60, 120] as const;
export const WORD_OPTIONS = [10, 25, 50, 100] as const;

export const DEFAULT_SETTINGS: Settings = {
  mode: 'time',
  time: 30,
  words: 25,
  language: 'es',
  accents: true,
  punctuation: false,
  numbers: false,
  customText: '',
  stopOnError: false,
  liveStats: true,

  caret: 'line',
  smoothCaret: true,
  pop: true,
  sparks: false,
  glow: true,
  dimUi: true,
  focusMode: false,
  motion: 'auto',

  sound: 'off',
  volume: 0.5,
  errorSound: false,

  theme: 'voltio',
  accent: null,
  font: 'jetbrains',
  fontSize: 28,
  background: 'aurora',
  bgColorA: null,
  bgColorB: null,
  bgImage: '',
  bgDim: 55,
  bgBlur: 4,

  profileName: '',
  updatedAt: 0,
};

export interface ThemeInfo {
  id: string;
  name: string;
  dark: boolean;
  /** Preview swatches: background, text, accent, secondary accent. */
  swatch: [string, string, string, string];
}

export const THEMES: ThemeInfo[] = [
  { id: 'voltio', name: 'Voltio', dark: true, swatch: ['#0c0d1f', '#e8ebff', '#c6ff3d', '#7a6bff'] },
  { id: 'brasa', name: 'Brasa', dark: true, swatch: ['#130f0d', '#f6ebe0', '#ff7a2f', '#ffc15c'] },
  { id: 'marea', name: 'Marea', dark: true, swatch: ['#06161c', '#def5f6', '#2de2c8', '#3aa0ff'] },
  { id: 'noctiluca', name: 'Noctiluca', dark: true, swatch: ['#120a1f', '#f3e9ff', '#ff4fd8', '#8a5cff'] },
  { id: 'papel', name: 'Papel', dark: false, swatch: ['#f6efe2', '#1d2a44', '#2447d6', '#e8590c'] },
  { id: 'escarcha', name: 'Escarcha', dark: false, swatch: ['#eef5fb', '#17324d', '#0b7a99', '#6a5acd'] },
];

export const FONTS: { id: FontId; name: string }[] = [
  { id: 'jetbrains', name: 'JetBrains Mono' },
  { id: 'fira', name: 'Fira Code' },
  { id: 'plex', name: 'IBM Plex Mono' },
  { id: 'space', name: 'Space Mono' },
  { id: 'system', name: 'Sistema' },
];

const oneOf = <T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const hex = (v: unknown): string | null => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null);
const str = (v: unknown, fallback: string, max: number): string =>
  typeof v === 'string' ? v.slice(0, max) : fallback;

/** Coerces untrusted data (storage, import, gist) into a valid Settings object. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    mode: oneOf(r.mode, ['time', 'words', 'custom'] as const, d.mode),
    time: oneOf(r.time, TIME_OPTIONS, d.time),
    words: oneOf(r.words, WORD_OPTIONS, d.words),
    language: oneOf(r.language, ['es', 'en', 'cyber', 'c42'] as const, d.language),
    accents: bool(r.accents, d.accents),
    punctuation: bool(r.punctuation, d.punctuation),
    numbers: bool(r.numbers, d.numbers),
    customText: str(r.customText, d.customText, 60000),
    stopOnError: bool(r.stopOnError, d.stopOnError),
    liveStats: bool(r.liveStats, d.liveStats),

    caret: oneOf(r.caret, ['line', 'block', 'underline'] as const, d.caret),
    smoothCaret: bool(r.smoothCaret, d.smoothCaret),
    pop: bool(r.pop, d.pop),
    sparks: bool(r.sparks, d.sparks),
    glow: bool(r.glow, d.glow),
    dimUi: bool(r.dimUi, d.dimUi),
    focusMode: bool(r.focusMode, d.focusMode),
    motion: oneOf(r.motion, ['auto', 'reduced', 'full'] as const, d.motion),

    sound: oneOf(r.sound, ['off', 'click', 'pop', 'typewriter', 'bubble'] as const, d.sound),
    volume: num(r.volume, 0, 1, d.volume),
    errorSound: bool(r.errorSound, d.errorSound),

    theme: oneOf(r.theme, THEMES.map((t) => t.id), d.theme),
    accent: hex(r.accent),
    font: oneOf(r.font, FONTS.map((f) => f.id), d.font),
    fontSize: num(r.fontSize, 18, 48, d.fontSize),
    background: oneOf(r.background, ['aurora', 'grid', 'dots', 'plain', 'gradient', 'image'] as const, d.background),
    bgColorA: hex(r.bgColorA),
    bgColorB: hex(r.bgColorB),
    bgImage: str(r.bgImage, d.bgImage, 2000),
    bgDim: num(r.bgDim, 0, 90, d.bgDim),
    bgBlur: num(r.bgBlur, 0, 24, d.bgBlur),

    profileName: str(r.profileName, d.profileName, 24),
    updatedAt: num(r.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}
