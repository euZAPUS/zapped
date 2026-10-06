import { describe, expect, it } from 'vitest';
import { accuracy, analyze, consistency, wpmFrom } from '../src/engine/metrics';

describe('metrics', () => {
  it('uses the 5-characters-per-word convention', () => {
    expect(wpmFrom(300, 60)).toBe(60);
    expect(wpmFrom(50, 30)).toBe(20);
    expect(wpmFrom(10, 0)).toBe(0);
  });

  it('computes accuracy from keystrokes', () => {
    expect(accuracy(0, 0)).toBe(100);
    expect(accuracy(90, 10)).toBe(90);
  });

  it('reports perfect consistency for a constant speed and less for a noisy one', () => {
    expect(consistency([60, 60, 60, 60])).toBe(100);
    const noisy = consistency([20, 120, 30, 110, 25]);
    expect(noisy).toBeLessThan(50);
    expect(noisy).toBeGreaterThanOrEqual(0);
    expect(consistency([60, 58, 62, 61])).toBeGreaterThan(90);
  });

  it('analyses committed and in-progress words differently', () => {
    const a = analyze(['hello', 'world'], ['hallo', 'wor'], 1);
    expect(a.incorrect).toBe(1);
    expect(a.correct).toBe(4 + 3); // h,l,l,o + w,o,r
    expect(a.missed).toBe(0); // "wor" is still in progress
    expect(a.correctWordChars).toBe(3); // clean partial word counts, "hallo" does not
    const b = analyze(['hello', 'world'], ['hello', 'wo'], 2);
    expect(b.missed).toBe(3);
  });
});
