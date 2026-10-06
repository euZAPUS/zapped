import { sound } from '../audio/sound';
import type { Effects } from '../render/effects';
import { renderResult } from '../render/result-view';
import type { TextView } from '../render/text-view';
import { TestEngine, type EngineEvent } from '../engine/test-engine';
import type { WordSlot } from '../engine/types';
import { closeSlots, generateWords, parseCustomText, type GenOptions } from '../engine/words';
import { settings } from '../settings/store';
import { previousBest } from '../stats/aggregates';
import { history, newId, type ResultRecord } from '../stats/history';

export interface TestUi {
  view: TextView;
  effects: Effects;
  hud: HTMLElement;
  wordsWrap: HTMLElement;
  resultEl: HTMLElement;
  /** Called when custom mode has no text yet. */
  askCustomText: () => void;
}

const INITIAL_TIME_WORDS = 120;

export class TestController {
  private engine: TestEngine | null = null;
  private timer = 0;
  private lastSlots: WordSlot[] = [];
  private blinkTimer = 0;
  private hudMain = document.createElement('span');
  private hudWpm = document.createElement('span');

  constructor(private readonly ui: TestUi) {
    this.hudWpm.className = 'live-wpm';
    ui.hud.append(this.hudMain, this.hudWpm);
  }

  get state(): 'ready' | 'running' | 'finished' | 'empty' {
    if (!this.engine) return 'empty';
    return this.engine.status === 'idle' ? 'ready' : this.engine.status === 'running' ? 'running' : 'finished';
  }

  private genOptions(): GenOptions {
    const s = settings.get();
    return { language: s.language, accents: s.accents, punctuation: s.punctuation, numbers: s.numbers };
  }

  /** Starts a fresh test from the current settings (or the same words when `repeat`). */
  newTest(repeat = false): void {
    this.stopTimer();
    this.engine?.dispose();
    const s = settings.get();
    let slots: WordSlot[];
    let supplier: ((n: number) => WordSlot[]) | undefined;

    if (repeat && this.lastSlots.length > 0) {
      slots = this.lastSlots;
    } else if (s.mode === 'custom') {
      slots = parseCustomText(s.customText);
    } else if (s.mode === 'words') {
      slots = closeSlots(generateWords(s.words, this.genOptions()));
    } else {
      slots = generateWords(INITIAL_TIME_WORDS, this.genOptions());
    }
    if (s.mode === 'time') supplier = (n) => generateWords(n, this.genOptions());

    this.lastSlots = slots;
    this.ui.effects.reset();
    document.documentElement.classList.remove('typing');

    if (slots.length === 0) {
      this.engine = null;
      this.ui.view.setWords([]);
      this.setState('ready');
      this.renderHud();
      this.ui.askCustomText();
      return;
    }

    const engine = new TestEngine({
      mode: s.mode,
      words: slots,
      timeLimit: s.time,
      stopOnError: s.stopOnError,
      supplier,
    });
    engine.on((e) => this.onEvent(engine, e));
    this.engine = engine;

    this.ui.view.setFocusMode(s.focusMode);
    this.ui.view.setWords(slots);
    this.ui.resultEl.hidden = true;
    this.ui.wordsWrap.hidden = false;
    this.setState('ready');
    this.renderHud();
    this.setBlink(true);
    requestAnimationFrame(() => this.ui.view.relayout());
  }

  restart(): void {
    this.newTest(false);
  }

  /** Feed a character typed by the user. */
  type(ch: string): void {
    const engine = this.engine;
    if (!engine || engine.status === 'finished') return;
    if (!document.documentElement.classList.contains('typing')) document.documentElement.classList.add('typing');
    this.setBlink(false);
    engine.type(ch, performance.now());
    this.scheduleBlink();
  }

  backspace(): void {
    this.engine?.backspace();
  }

  deleteWord(): void {
    this.engine?.deleteWord();
  }

  private setState(state: 'ready' | 'running' | 'finished'): void {
    document.documentElement.dataset.state = state;
  }

  private onEvent(engine: TestEngine, e: EngineEvent): void {
    if (engine !== this.engine) return;
    const { view, effects } = this.ui;
    switch (e.type) {
      case 'start':
        this.setState('running');
        this.startTimer();
        break;
      case 'key': {
        const typed = engine.typed[e.word] ?? '';
        view.updateWord(e.word, typed, false);
        view.setCurrent(e.word, typed.length);
        if (e.correct) {
          effects.hit(e.word, e.index);
          sound.key();
        } else {
          effects.miss();
          sound.error();
        }
        this.renderHud();
        break;
      }
      case 'reject':
        effects.miss();
        sound.error();
        view.caret.classList.remove('reject');
        void view.caret.offsetWidth;
        view.caret.classList.add('reject');
        break;
      case 'commit':
        view.updateWord(e.word, engine.typed[e.word] ?? '', true);
        view.setCurrent(engine.current, 0);
        sound.separator();
        this.renderHud();
        break;
      case 'erase': {
        const typed = engine.typed[e.word] ?? '';
        view.updateWord(e.word, typed, false);
        view.setCurrent(e.word, typed.length);
        this.renderHud();
        break;
      }
      case 'words-added':
        view.appendWords(engine.words.slice(e.from));
        break;
      case 'finish':
        this.finish(engine);
        break;
    }
  }

  private finish(engine: TestEngine): void {
    this.stopTimer();
    const result = engine.result;
    if (!result) return;
    const s = settings.get();
    const record: ResultRecord = {
      id: newId(),
      at: Date.now(),
      mode: engine.mode,
      limit: engine.mode === 'time' ? s.time : engine.mode === 'words' ? s.words : engine.words.length,
      language: s.language,
      punctuation: s.punctuation,
      numbers: s.numbers,
      accents: s.accents,
      stopOnError: s.stopOnError,
      wpm: result.wpm,
      raw: result.raw,
      acc: result.accuracy,
      cons: result.consistency,
      correct: result.chars.correct,
      incorrect: result.chars.incorrect,
      extra: result.chars.extra,
      missed: result.chars.missed,
      duration: result.duration,
      series: result.samples.map((x) => Math.round(x.net)),
      rawSeries: result.samples.map((x) => Math.round(x.raw)),
    };
    const prev = previousBest(history.all(), record);
    if (result.chars.correct > 0) history.add(record);

    this.setState('finished');
    document.documentElement.classList.remove('typing');
    this.ui.effects.reset();
    this.ui.wordsWrap.hidden = true;
    this.ui.resultEl.hidden = false;
    renderResult(this.ui.resultEl, {
      result,
      record,
      previousBest: prev,
      onNext: () => this.newTest(false),
      onRepeat: () => this.newTest(true),
    });
    sound.finish();
    this.renderHud();
  }

  // --- HUD and timers -------------------------------------------------

  private startTimer(): void {
    this.stopTimer();
    this.timer = window.setInterval(() => {
      this.engine?.tick(performance.now());
      this.renderHud();
    }, 100);
  }

  private stopTimer(): void {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
  }

  private renderHud(): void {
    const engine = this.engine;
    const s = settings.get();
    if (!engine) {
      this.hudMain.textContent = '';
      this.hudWpm.textContent = '';
      return;
    }
    const now = performance.now();
    if (engine.mode === 'time') {
      const left = engine.status === 'idle' ? s.time : Math.max(0, Math.ceil(engine.timeLimit - engine.elapsed(now)));
      this.hudMain.textContent = String(left);
    } else {
      const total = engine.words.length;
      this.hudMain.textContent = `${Math.min(engine.current, total)}/${total}`;
    }
    const wpm = engine.status === 'running' && s.liveStats ? Math.round(engine.liveWpm(now)) : 0;
    this.hudWpm.textContent = wpm > 0 ? `${wpm} ppm` : '';
  }

  private setBlink(on: boolean): void {
    window.clearTimeout(this.blinkTimer);
    this.ui.view.caret.classList.toggle('blink', on);
  }

  private scheduleBlink(): void {
    window.clearTimeout(this.blinkTimer);
    this.blinkTimer = window.setTimeout(() => this.ui.view.caret.classList.add('blink'), 900);
  }
}
