import type { TestController } from './test-controller';

export interface KeyboardDeps {
  controller: TestController;
  capture: HTMLTextAreaElement;
  isTestView: () => boolean;
  openSettings: () => void;
  isDialogOpen: () => boolean;
}

function isEditable(el: EventTarget | null, capture: HTMLElement): boolean {
  if (!(el instanceof HTMLElement) || el === capture) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Global shortcuts plus the hidden input that receives text (dead keys, mobile, IME). */
export function bindKeyboard(deps: KeyboardDeps): void {
  const { controller, capture } = deps;

  const feed = (text: string): void => {
    for (const ch of text) controller.type(ch === '\r' ? '\n' : ch);
  };

  window.addEventListener('keydown', (e) => {
    if (e.isComposing || e.key === 'Process') return;

    if (e.key === 'Escape') {
      if (!deps.isDialogOpen()) {
        e.preventDefault();
        deps.openSettings();
      }
      return; // when a dialog is open the browser closes it natively
    }
    if (deps.isDialogOpen() || !deps.isTestView()) return;
    if (isEditable(e.target, capture)) return;
    if (e.key === 'Dead') {
      capture.focus({ preventScroll: true }); // let the browser compose the accent
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      controller.restart();
      return;
    }

    if (controller.state === 'finished') {
      if (e.key === 'Enter') {
        e.preventDefault();
        controller.newTest(false);
      }
      return;
    }
    if (controller.state === 'empty') return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (e.ctrlKey || e.altKey || e.metaKey) controller.deleteWord();
      else controller.backspace();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      controller.type('\n');
      return;
    }
    const printable = e.key.length === 1 && !e.metaKey && (!e.ctrlKey || e.getModifierState('AltGraph'));
    if (printable) {
      e.preventDefault();
      if (document.activeElement !== capture) capture.focus({ preventScroll: true });
      controller.type(e.key);
    }
  });

  // Composed text (dead keys, IME) and soft keyboards arrive through the hidden textarea.
  capture.addEventListener('compositionend', (e) => {
    const data = e.data;
    reset();
    if (data && controller.state !== 'finished') feed(data);
  });
  // A sentinel character keeps the field non-empty so soft keyboards can report Backspace.
  const SENTINEL = '\u200b';
  const reset = (): void => {
    capture.value = SENTINEL;
    capture.setSelectionRange(1, 1);
  };
  reset();
  capture.addEventListener('focus', reset);
  capture.addEventListener('input', (e) => {
    const ev = e as InputEvent;
    if (ev.isComposing) return;
    const value = capture.value.split(SENTINEL).join('');
    const deleted = ev.inputType.startsWith('delete');
    reset();
    if (controller.state === 'finished') return;
    if (deleted && value === '') controller.backspace();
    else if (value) feed(value);
  });
}
