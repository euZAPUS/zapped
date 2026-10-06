import type { WordSlot } from '../engine/types';
import { h } from '../ui/dom';

interface WordEl {
  el: HTMLElement;
  letters: HTMLElement[];
  /** Visible ↵ glyph for words that end a line in custom text. */
  nl: HTMLElement | null;
}

const FOCUS_AHEAD = 3;
const VISIBLE_LINES = 3;

/**
 * Renders the target text and keeps it in sync with the engine. Letters are
 * updated in place (never rebuilt) so CSS animations survive between keys.
 */
export class TextView {
  private slots: WordSlot[] = [];
  private words: WordEl[] = [];
  private current = 0;
  private charIndex = 0;
  private scrollY = 0;
  private focusMode = false;
  private farFrom = 0;
  readonly caret = h('span', { class: 'caret', 'aria-hidden': 'true' });
  readonly fx = h('span', { class: 'fx', 'aria-hidden': 'true' });

  constructor(private readonly viewport: HTMLElement, private readonly inner: HTMLElement) {
    inner.append(this.caret, this.fx);
    new ResizeObserver(() => this.relayout()).observe(viewport);
    void document.fonts?.ready.then(() => this.relayout());
    document.fonts?.addEventListener?.('loadingdone', () => this.relayout());
  }

  setWords(slots: WordSlot[]): void {
    this.slots = [];
    for (const w of this.words) {
      w.el.remove();
    }
    this.inner.querySelectorAll('.indent, .line-break').forEach((n) => n.remove());
    this.words = [];
    this.current = 0;
    this.charIndex = 0;
    this.scrollY = 0;
    this.farFrom = 0;
    this.inner.style.transform = 'translateY(0)';
    this.appendWords(slots);
    this.setCurrent(0, 0);
  }

  appendWords(slots: WordSlot[]): void {
    const frag = document.createDocumentFragment();
    for (const slot of slots) {
      const index = this.slots.length;
      this.slots.push(slot);
      const built = this.buildWord(slot, index, frag);
      this.words.push(built);
    }
    this.inner.appendChild(frag);
    if (this.focusMode) this.applyFocus();
  }

  private buildWord(slot: WordSlot, index: number, frag: DocumentFragment): WordEl {
    if (slot.indent > 0) frag.appendChild(h('span', { class: 'indent', style: `width:${slot.indent}ch` }));
    const letters = slot.text.split('').map((ch) => h('span', { class: 'l' }, ch));
    const nl = slot.sep === '\n' ? h('span', { class: 'l nl' }, '↵') : null;
    const el = h('span', { class: 'word', 'data-i': index }, letters, nl);
    frag.appendChild(el);
    if (nl) frag.appendChild(h('span', { class: 'line-break' }));
    return { el, letters, nl };
  }

  /** Brings a word's letters in line with what was typed. */
  updateWord(index: number, typed: string, committed: boolean): void {
    const w = this.words[index];
    const slot = this.slots[index];
    if (!w || !slot) return;
    const target = slot.text;
    const need = Math.max(target.length, typed.length);

    while (w.letters.length < need) {
      const span = h('span', { class: 'l' }, typed[w.letters.length] ?? '');
      w.el.insertBefore(span, w.nl);
      w.letters.push(span);
    }
    while (w.letters.length > need && w.letters.length > target.length) {
      w.letters.pop()?.remove();
    }

    for (let j = 0; j < w.letters.length; j++) {
      const l = w.letters[j] as HTMLElement;
      let state = '';
      if (j >= target.length) {
        state = 'extra';
        if (l.textContent !== typed[j]) l.textContent = typed[j] ?? '';
      } else if (j < typed.length) {
        state = typed[j] === target[j] ? 'ok' : 'bad';
      }
      if ((l.dataset.s ?? '') !== state) {
        if (state) l.dataset.s = state;
        else delete l.dataset.s;
      }
    }
    const wrong = committed && typed !== target;
    if ((w.el.dataset.err === '1') !== wrong) {
      if (wrong) w.el.dataset.err = '1';
      else delete w.el.dataset.err;
    }
  }

  letter(wordIndex: number, charIndex: number): HTMLElement | undefined {
    return this.words[wordIndex]?.letters[charIndex];
  }

  /** Marks the active word and moves the caret to `charIndex` inside it. */
  setCurrent(word: number, charIndex: number): void {
    const wordChanged = word !== this.current || !this.words[word]?.el.classList.contains('active');
    if (wordChanged) {
      this.words[this.current]?.el.classList.remove('active');
      this.words[word]?.el.classList.add('active');
      this.current = word;
      this.scrollToCurrent();
      if (this.focusMode) this.applyFocus();
    }
    this.charIndex = charIndex;
    this.placeCaret();
  }

  setFocusMode(on: boolean): void {
    this.focusMode = on;
    this.inner.classList.toggle('focus', on);
    if (on) {
      this.farFrom = 0;
      this.applyFocus(true);
    } else {
      for (const w of this.words) delete w.el.dataset.far;
    }
  }

  /** Words further than FOCUS_AHEAD from the current one are blurred. */
  private applyFocus(all = false): void {
    const boundary = this.current + FOCUS_AHEAD;
    if (all) {
      this.words.forEach((w, i) => {
        if (i >= boundary) w.el.dataset.far = '';
        else delete w.el.dataset.far;
      });
      this.farFrom = boundary;
      return;
    }
    for (let i = this.farFrom; i < boundary && i < this.words.length; i++) delete this.words[i]?.el.dataset.far;
    for (let i = boundary; i < this.farFrom && i < this.words.length; i++) {
      const el = this.words[i]?.el;
      if (el) el.dataset.far = '';
    }
    // newly appended words
    for (let i = Math.max(this.farFrom, boundary); i < this.words.length; i++) {
      const el = this.words[i]?.el;
      if (el && el.dataset.far === undefined) el.dataset.far = '';
    }
    this.farFrom = boundary;
  }

  private lineHeight(): number {
    return this.words[0]?.el.offsetHeight || this.viewport.clientHeight / VISIBLE_LINES;
  }

  /** Keeps the active word on the second visible line. */
  private scrollToCurrent(): void {
    const w = this.words[this.current];
    if (!w) return;
    const lh = this.lineHeight();
    if (!lh) return;
    const target = Math.max(0, Math.round((w.el.offsetTop - lh) / lh) * lh);
    if (target !== this.scrollY) {
      this.scrollY = target;
      this.inner.style.transform = `translateY(${-target}px)`;
    }
  }

  /** Where the caret currently is, in inner coordinates. */
  caretPoint(): { x: number; y: number; w: number; h: number } {
    const w = this.words[this.current];
    if (!w || w.letters.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
    const idx = this.charIndex;
    let target: HTMLElement;
    let atEnd = false;
    if (idx < w.letters.length) {
      target = w.letters[idx] as HTMLElement;
    } else if (w.nl) {
      target = w.nl;
    } else {
      target = w.letters[w.letters.length - 1] as HTMLElement;
      atEnd = true;
    }
    return {
      x: target.offsetLeft + (atEnd ? target.offsetWidth : 0),
      y: target.offsetTop,
      w: target.offsetWidth,
      h: target.offsetHeight,
    };
  }

  private placeCaret(): void {
    const p = this.caretPoint();
    this.caret.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    this.caret.style.setProperty('--cw', `${p.w}px`);
  }

  /** Re-measures after font, size or viewport changes. */
  relayout(): void {
    this.scrollToCurrent();
    this.placeCaret();
  }

  /** Sparks and pops are anchored here. */
  caretCenter(): { x: number; y: number } {
    const p = this.caretPoint();
    return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  }

  wordCount(): number {
    return this.words.length;
  }
}
