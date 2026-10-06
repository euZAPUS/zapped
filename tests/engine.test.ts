import { describe, expect, it } from 'vitest';
import { TestEngine, type EngineEvent } from '../src/engine/test-engine';
import { closeSlots } from '../src/engine/words';
import type { WordSlot } from '../src/engine/types';

const slots = (...texts: string[]): WordSlot[] =>
  closeSlots(texts.map((text) => ({ text, sep: ' ' as const, indent: 0 })));

function typeAll(engine: TestEngine, text: string, start = 0, step = 100): number {
  let now = start;
  for (const ch of text) {
    engine.type(ch, now);
    now += step;
  }
  return now;
}

describe('TestEngine · words mode', () => {
  it('finishes as soon as the last word is typed correctly', () => {
    const e = new TestEngine({ mode: 'words', words: slots('hola', 'mundo'), stopOnError: false });
    typeAll(e, 'hola mundo');
    expect(e.status).toBe('finished');
    expect(e.result?.accuracy).toBe(100);
    expect(e.result?.chars.correct).toBe(10); // 9 letters + 1 separator
  });

  it('ignores a leading space and does not start the clock', () => {
    const e = new TestEngine({ mode: 'words', words: slots('a', 'b'), stopOnError: false });
    e.type(' ', 0);
    expect(e.status).toBe('idle');
  });

  it('does not skip words on an empty separator', () => {
    const e = new TestEngine({ mode: 'words', words: slots('uno', 'dos'), stopOnError: false });
    e.type('u', 0);
    e.type(' ', 10);
    e.type(' ', 20);
    expect(e.current).toBe(1);
  });

  it('counts incorrect, extra and missed characters', () => {
    const e = new TestEngine({ mode: 'words', words: slots('casa', 'sol', 'luz'), stopOnError: false });
    // "cesa" (1 wrong), "sol+xx" (2 extra), "l" + space (2 missed)
    typeAll(e, 'cesa solxx l ');
    expect(e.status).toBe('finished');
    const c = e.result!.chars;
    expect(c.incorrect).toBe(1); // the e in "cesa"
    expect(c.extra).toBe(2);
    expect(c.missed).toBe(2);
  });

  it('computes net ppm only from fully correct words', () => {
    const e = new TestEngine({ mode: 'words', words: slots('abcd', 'wxyz'), stopOnError: false });
    // first word wrong, second right, 12 s total
    e.type('a', 0);
    e.type('x', 100);
    e.type('c', 200);
    e.type('d', 300);
    e.type(' ', 400);
    typeAll(e, 'wxyz', 11600, 100);
    const r = e.result!;
    expect(r.duration).toBeCloseTo(11.9, 1);
    // net: 4 chars (second word) => 0.8 words in ~0.198 min
    expect(r.wpm).toBeCloseTo(4 / 5 / (11.9 / 60), 1);
    // raw counts everything typed: 4 + 1 sep + 4 = 9
    expect(r.raw).toBeCloseTo(9 / 5 / (11.9 / 60), 1);
    expect(r.accuracy).toBeCloseTo((8 / 9) * 100, 0); // one wrong keystroke out of 9 (sep counts)
  });

  it('keeps counting a corrected mistake against accuracy', () => {
    const e = new TestEngine({ mode: 'words', words: slots('ab'), stopOnError: false });
    e.type('x', 0);
    e.backspace();
    e.type('a', 100);
    e.type('b', 200);
    expect(e.result!.accuracy).toBeCloseTo((2 / 3) * 100, 0);
    expect(e.result!.chars.incorrect).toBe(0);
  });

  it('limits extra characters', () => {
    const e = new TestEngine({ mode: 'words', words: slots('ab', 'cd'), stopOnError: false, maxExtra: 3 });
    typeAll(e, 'abxxxxxx');
    expect(e.typed[0]).toBe('abxxx');
  });
});

describe('TestEngine · stop on error', () => {
  it('rejects wrong keys and never advances', () => {
    const events: EngineEvent[] = [];
    const e = new TestEngine({ mode: 'words', words: slots('hi', 'yo'), stopOnError: true });
    e.on((ev) => events.push(ev));
    e.type('x', 0);
    expect(e.typed[0]).toBe('');
    e.type('h', 100);
    e.type(' ', 200); // incomplete word: rejected
    expect(e.current).toBe(0);
    e.type('i', 300);
    e.type(' ', 400);
    expect(e.current).toBe(1);
    expect(events.filter((ev) => ev.type === 'reject')).toHaveLength(2);
    typeAll(e, 'yo', 500);
    expect(e.status).toBe('finished');
    expect(e.result!.accuracy).toBeLessThan(100);
  });
});

describe('TestEngine · editing', () => {
  it('goes back to an incorrect previous word but not a correct one', () => {
    const e = new TestEngine({ mode: 'words', words: slots('uno', 'dos', 'tres'), stopOnError: false });
    typeAll(e, 'uno dax ');
    expect(e.current).toBe(2);
    e.backspace();
    expect(e.current).toBe(1);
    expect(e.typed[1]).toBe('dax');
    e.deleteWord();
    expect(e.typed[1]).toBe('');
    e.deleteWord(); // previous word "uno" is correct: locked
    expect(e.current).toBe(1);
  });
});

describe('TestEngine · time mode', () => {
  const supply = (n: number): WordSlot[] => Array.from({ length: n }, () => ({ text: 'ab', sep: ' ' as const, indent: 0 }));

  it('ends at the limit, produces per-second samples and tops up words', () => {
    const e = new TestEngine({
      mode: 'time', timeLimit: 5, words: supply(50), stopOnError: false, supplier: supply,
    });
    const events: EngineEvent[] = [];
    e.on((ev) => events.push(ev));
    let now = 0;
    for (let i = 0; i < 60; i++) {
      e.type('a', now);
      e.type('b', now + 20);
      e.type(' ', now + 40);
      now += 100;
    }
    expect(e.status).toBe('finished');
    expect(e.result!.duration).toBe(5);
    expect(e.result!.samples.length).toBe(5);
    expect(e.result!.samples.every((s) => s.raw > 0)).toBe(true);
    expect(events.some((ev) => ev.type === 'words-added')).toBe(true);
    expect(e.result!.accuracy).toBe(100);
  });

  it('finishes from tick() when the user stops typing', () => {
    const e = new TestEngine({ mode: 'time', timeLimit: 3, words: supply(50), stopOnError: false });
    e.type('a', 0);
    e.tick(2900);
    expect(e.status).toBe('running');
    e.tick(3100);
    expect(e.status).toBe('finished');
    expect(e.result!.duration).toBe(3);
  });

  it('ignores keys after the time is over', () => {
    const e = new TestEngine({ mode: 'time', timeLimit: 1, words: supply(50), stopOnError: false });
    e.type('a', 0);
    e.type('b', 1500);
    expect(e.status).toBe('finished');
    expect(e.typed[0]).toBe('a');
  });
});

describe('TestEngine · custom text with line breaks', () => {
  it('accepts Enter (or space) as the separator of a line-ending word', () => {
    const words: WordSlot[] = [
      { text: 'if', sep: ' ', indent: 0 },
      { text: '(x)', sep: '\n', indent: 0 },
      { text: 'return', sep: ' ', indent: 4 },
      { text: 'y;', sep: '', indent: 0 },
    ];
    const e = new TestEngine({ mode: 'custom', words, stopOnError: false });
    typeAll(e, 'if (x)\nreturn y;');
    expect(e.status).toBe('finished');
    expect(e.result!.chars.incorrect).toBe(0);
  });

  it('ignores Enter inside a line', () => {
    const words = slots('ab', 'cd');
    const e = new TestEngine({ mode: 'custom', words, stopOnError: false });
    e.type('a', 0);
    e.type('b', 10);
    e.type('\n', 20);
    expect(e.current).toBe(0);
  });
});
