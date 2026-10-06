import { h } from './dom';

export interface ModalHandle {
  el: HTMLDialogElement;
  open(): void;
  close(): void;
  readonly isOpen: boolean;
}

/**
 * Wraps a native <dialog>: focus trap, inert background and Esc handling come
 * from the browser; this adds a short exit animation and focus restoration.
 */
export function createModal(el: HTMLDialogElement, onClose?: () => void): ModalHandle {
  let closing = false;
  const finish = (): void => {
    closing = false;
    el.classList.remove('closing');
    if (el.open) el.close();
    onClose?.();
  };
  const close = (): void => {
    if (!el.open || closing) return;
    closing = true;
    el.classList.add('closing');
    const done = (): void => finish();
    el.addEventListener('animationend', done, { once: true });
    window.setTimeout(() => closing && done(), 400); // fallback when animations are disabled
  };
  el.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  el.addEventListener('click', (e) => {
    if (e.target === el) close(); // click on the backdrop
  });
  return {
    el,
    open() {
      if (!el.open) {
        el.showModal();
        el.tabIndex = -1;
        el.focus({ preventScroll: true });
      }
    },
    close,
    get isOpen() {
      return el.open;
    },
  };
}

export function closeButton(onClick: () => void, label = 'Cerrar'): HTMLButtonElement {
  return h('button', { class: 'icon-btn close', type: 'button', 'aria-label': label, onclick: onClick }, '✕');
}
