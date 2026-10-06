import { describe, expect, it } from 'vitest';
import { CODE_LANG_IDS, CODE_LANGS, pickSnippet } from '../src/data/snippets';
import { parseCustomText } from '../src/engine/words';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/settings/schema';

describe('code snippets', () => {
  it('every snippet parses into typeable words with no leftover tabs', () => {
    for (const id of CODE_LANG_IDS) {
      expect(CODE_LANGS[id].snippets.length).toBeGreaterThan(1);
      for (const snippet of CODE_LANGS[id].snippets) {
        const slots = parseCustomText(snippet);
        expect(slots.length).toBeGreaterThan(5);
        expect(slots.every((s) => !/[\t ]/.test(s.text))).toBe(true);
        expect(slots.at(-1)?.sep).toBe('');
      }
    }
  });

  it('avoids repeating the previous snippet', () => {
    const first = pickSnippet('c');
    for (let i = 0; i < 30; i++) expect(pickSnippet('c', first)).not.toBe(first);
  });
});

describe('settings sanitising for the new options', () => {
  it('accepts valid values and falls back on garbage', () => {
    const s = sanitizeSettings({ mode: 'code', codeLang: 'python', colorErr: '#ff0000', colorFg: 'red', enye: false, font: 'roboto' });
    expect(s.mode).toBe('code');
    expect(s.codeLang).toBe('python');
    expect(s.colorErr).toBe('#ff0000');
    expect(s.colorFg).toBeNull();
    expect(s.enye).toBe(false);
    expect(s.font).toBe('roboto');
    expect(sanitizeSettings({ codeLang: 'cobol', mode: 'x' }).codeLang).toBe(DEFAULT_SETTINGS.codeLang);
  });
});
