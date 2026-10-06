import { analyze, buildResult, netWpm, rawWpm } from './metrics';
import type { Mode, Sample, TestResult, WordSlot } from './types';

export type EngineEvent =
  | { type: 'start' }
  | { type: 'key'; word: number; index: number; correct: boolean }
  | { type: 'reject'; word: number }
  | { type: 'commit'; word: number; correct: boolean }
  | { type: 'erase'; word: number }
  | { type: 'words-added'; from: number }
  | { type: 'finish'; result: TestResult };

export interface EngineOptions {
  mode: Mode;
  words: WordSlot[];
  /** Time mode: seconds until the test ends. */
  timeLimit?: number;
  /** Do not advance (reject the key) until the right letter is typed. */
  stopOnError: boolean;
  /** Time mode: produces more words when the supply is running low. */
  supplier?: (count: number) => WordSlot[];
  /** Characters allowed past the end of a word. */
  maxExtra?: number;
}

export type Status = 'idle' | 'running' | 'finished';

const TOP_UP_AT = 40;
const TOP_UP_COUNT = 40;

/**
 * Pure typing-test state machine: no DOM, no timers. The caller feeds it keys
 * and clock readings (ms) and listens to the events it emits.
 */
export class TestEngine {
  status: Status = 'idle';
  readonly words: WordSlot[];
  readonly typed: string[];
  current = 0;
  readonly mode: Mode;
  readonly timeLimit: number;
  result: TestResult | null = null;

  private readonly stopOnError: boolean;
  private readonly supplier?: (count: number) => WordSlot[];
  private readonly maxExtra: number;
  private startTime = 0;
  private keys = { correct: 0, incorrect: 0 };
  private perSecChars: number[] = [];
  private perSecErrors: number[] = [];
  private samples: Sample[] = [];
  private listeners = new Set<(e: EngineEvent) => void>();

  constructor(opts: EngineOptions) {
    this.mode = opts.mode;
    this.words = [...opts.words];
    this.typed = this.words.map(() => '');
    this.timeLimit = opts.timeLimit ?? 0;
    this.stopOnError = opts.stopOnError;
    this.supplier = opts.supplier;
    this.maxExtra = opts.maxExtra ?? 8;
  }

  on(fn: (e: EngineEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: EngineEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  private get finite(): boolean {
    return this.mode !== 'time';
  }

  elapsed(now: number): number {
    return this.status === 'idle' ? 0 : Math.max(0, (now - this.startTime) / 1000);
  }

  /** Live net ppm for the HUD. */
  liveWpm(now: number): number {
    const secs = this.elapsed(now);
    if (secs < 1) return 0;
    return netWpm(analyze(this.targets(), this.typed, this.current), secs);
  }

  liveRaw(now: number): number {
    const secs = this.elapsed(now);
    if (secs < 1) return 0;
    return rawWpm(analyze(this.targets(), this.typed, this.current), secs);
  }

  /** Called regularly by the host; ends time-mode tests and records per-second samples. */
  tick(now: number): void {
    if (this.status !== 'running') return;
    this.advanceClock(now);
  }

  type(ch: string, now: number): void {
    if (this.status === 'finished') return;
    const isSep = ch === ' ' || ch === '\n';
    if (this.status === 'idle') {
      if (isSep) return; // a leading space never starts the test
      this.start(now);
    }
    this.advanceClock(now);
    if ((this.status as Status) === 'finished') return;

    const word = this.words[this.current];
    if (!word) return;
    const typed = this.typed[this.current] ?? '';

    if (isSep) {
      this.separator(ch, word, typed, now);
      return;
    }

    const expected = word.text[typed.length];
    const correct = ch === expected;
    if (this.stopOnError) {
      if (!correct) {
        this.countKey(false, now);
        this.emit({ type: 'reject', word: this.current });
        return;
      }
    } else if (typed.length >= word.text.length + this.maxExtra) {
      return;
    }

    this.typed[this.current] = typed + ch;
    this.countKey(correct, now);
    this.emit({ type: 'key', word: this.current, index: typed.length, correct });

    if (this.finite && this.current === this.words.length - 1 && this.typed[this.current] === word.text) {
      this.finish(now);
    }
  }

  private separator(ch: string, word: WordSlot, typed: string, now: number): void {
    // Enter only separates words that end a line; Space and Enter both do there.
    if (ch === '\n' && word.sep === ' ') return;
    if (typed.length === 0) return;

    const complete = typed.length >= word.text.length;
    if (this.stopOnError && !complete) {
      this.countKey(false, now);
      this.emit({ type: 'reject', word: this.current });
      return;
    }
    this.countKey(complete, now);

    const correct = typed === word.text;
    const index = this.current;
    this.current++;
    this.emit({ type: 'commit', word: index, correct });
    if (this.finite && this.current >= this.words.length) {
      this.finish(now); // ending on the separator commits the last word too
      return;
    }
    this.topUp();
  }

  backspace(): void {
    if (this.status !== 'running') return;
    const typed = this.typed[this.current] ?? '';
    if (typed.length > 0) {
      this.typed[this.current] = typed.slice(0, -1);
      this.emit({ type: 'erase', word: this.current });
      return;
    }
    this.stepBack(false);
  }

  deleteWord(): void {
    if (this.status !== 'running') return;
    if ((this.typed[this.current] ?? '') === '') {
      this.stepBack(true);
      return;
    }
    this.typed[this.current] = '';
    this.emit({ type: 'erase', word: this.current });
  }

  /** Returns to the previous word when it was left with mistakes. */
  private stepBack(clear: boolean): void {
    const prev = this.current - 1;
    if (prev < 0) return;
    const target = this.words[prev]?.text;
    if (this.typed[prev] === target) return; // correct words are locked in
    this.current = prev;
    if (clear) this.typed[prev] = '';
    this.emit({ type: 'erase', word: prev });
  }

  private start(now: number): void {
    this.status = 'running';
    this.startTime = now;
    this.emit({ type: 'start' });
  }

  private countKey(correct: boolean, now: number): void {
    const sec = Math.floor(this.elapsed(now));
    this.perSecChars[sec] = (this.perSecChars[sec] ?? 0) + 1;
    if (correct) {
      this.keys.correct++;
    } else {
      this.keys.incorrect++;
      this.perSecErrors[sec] = (this.perSecErrors[sec] ?? 0) + 1;
    }
  }

  private topUp(): void {
    if (this.mode !== 'time' || !this.supplier) return;
    if (this.words.length - this.current > TOP_UP_AT) return;
    const from = this.words.length;
    for (const w of this.supplier(TOP_UP_COUNT)) {
      this.words.push(w);
      this.typed.push('');
    }
    this.emit({ type: 'words-added', from });
  }

  private targets(): string[] {
    return this.words.map((w) => w.text);
  }

  private advanceClock(now: number): void {
    const secs = this.elapsed(now);
    if (this.mode === 'time' && secs >= this.timeLimit) {
      this.finish(this.startTime + this.timeLimit * 1000);
      return;
    }
    while (secs >= this.samples.length + 1) this.pushSample(this.samples.length + 1);
  }

  private pushSample(t: number): void {
    const idx = t - 1;
    const net = netWpm(analyze(this.targets(), this.typed, this.current), t);
    this.samples.push({
      t,
      net: Math.round(net * 100) / 100,
      raw: ((this.perSecChars[idx] ?? 0) * 60) / 5,
      errors: this.perSecErrors[idx] ?? 0,
    });
  }

  private finish(now: number): void {
    if (this.status === 'finished') return;
    const seconds = Math.max(this.elapsed(now), 0.001);
    while (seconds >= this.samples.length + 1) this.pushSample(this.samples.length + 1);

    const whole = this.samples.length;
    const frac = seconds - whole;
    if (frac >= 0.2 || whole === 0) {
      const analysis = analyze(this.targets(), this.typed, this.current);
      this.samples.push({
        t: Math.round(seconds * 100) / 100,
        net: Math.round(netWpm(analysis, seconds) * 100) / 100,
        raw: (((this.perSecChars[whole] ?? 0) * 60) / 5) / Math.max(frac, 0.2),
        errors: this.perSecErrors[whole] ?? 0,
      });
    }

    this.status = 'finished';
    const analysis = analyze(this.targets(), this.typed, this.current);
    this.result = buildResult(analysis, this.keys, seconds, this.samples);
    this.emit({ type: 'finish', result: this.result });
  }

  /** Abort without producing a result (restart, mode change...). */
  dispose(): void {
    this.listeners.clear();
  }
}
