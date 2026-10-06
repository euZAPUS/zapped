import { describe, expect, it } from 'vitest';
import { generateWords, parseCustomText, stripAccents } from '../src/engine/words';

function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('stripAccents', () => {
  it('removes accents but keeps ñ', () => {
    expect(stripAccents('canción pingüino año')).toBe('cancion pinguino año');
    expect(stripAccents('ÁÉÍÓÚ Ñandú')).toBe('AEIOU Ñandu');
  });
});

describe('generateWords', () => {
  it('returns the requested amount without immediate repeats', () => {
    const w = generateWords(200, { language: 'en', accents: true, punctuation: false, numbers: false, rng: seeded() });
    expect(w).toHaveLength(200);
    for (let i = 1; i < w.length; i++) expect(w[i]!.text).not.toBe(w[i - 1]!.text);
  });

  it('strips Spanish accents on demand', () => {
    const opts = { language: 'es' as const, punctuation: false, numbers: false, rng: seeded(3) };
    const without = generateWords(600, { ...opts, accents: false }).map((w) => w.text).join(' ');
    expect(without).not.toMatch(/[áéíóúü]/);
    const kept = generateWords(600, { ...opts, accents: true, rng: seeded(3) }).map((w) => w.text).join(' ');
    expect(kept).toMatch(/[áéíóú]/);
  });

  it('adds numbers and punctuation when asked', () => {
    const w = generateWords(300, { language: 'es', accents: true, punctuation: true, numbers: true, rng: seeded(11) })
      .map((x) => x.text);
    expect(w.some((t) => /^\d+$/.test(t))).toBe(true);
    expect(w.some((t) => /[.,;:?!]$/.test(t))).toBe(true);
    expect(w[0]).toMatch(/^[A-ZÁÉÍÓÚÑ0-9¿¡"(]/);
  });

  it('serves tokens with flags for the C list', () => {
    const w = generateWords(1500, { language: 'c42', accents: true, punctuation: false, numbers: false, rng: seeded(5) })
      .map((x) => x.text);
    expect(w).toContain('-Wall');
    expect(w.some((t) => t.startsWith('ft_'))).toBe(true);
  });
});

describe('parseCustomText', () => {
  it('splits words, marks line ends and skips indentation', () => {
    const slots = parseCustomText('int main(void)\n{\n\tif (x)\n\t\treturn 0;\n}\n');
    expect(slots.map((s) => s.text)).toEqual(['int', 'main(void)', '{', 'if', '(x)', 'return', '0;', '}']);
    expect(slots.find((s) => s.text === 'return')?.indent).toBe(8);
    expect(slots[1]?.sep).toBe('\n');
    expect(slots[0]?.sep).toBe(' ');
    expect(slots.at(-1)?.sep).toBe('');
  });

  it('collapses blank lines, tabs inside a line and CRLF', () => {
    const slots = parseCustomText('a\t\tb\r\n\r\n\r\nc');
    expect(slots.map((s) => `${s.text}${JSON.stringify(s.sep)}`)).toEqual(['a" "', 'b"\\n"', 'c""']);
  });

  it('returns nothing for empty input', () => {
    expect(parseCustomText('  \n\n ')).toEqual([]);
  });
});
