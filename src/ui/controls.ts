import { h } from './dom';

/** Row layout shared by the settings panel: label (+hint) on the left, control on the right. */
export function row(label: string, control: HTMLElement, hint?: string, id?: string): HTMLElement {
  const lbl = h('span', { class: 'row-label', id }, label);
  return h('div', { class: 'set-row' }, h('div', { class: 'row-text' }, lbl, hint ? h('span', { class: 'row-hint' }, hint) : null), control);
}

export interface Switch {
  el: HTMLButtonElement;
  set(on: boolean): void;
}

export function switchControl(on: boolean, onChange: (on: boolean) => void, labelledBy?: string): Switch {
  const el = h('button', {
    class: 'switch',
    type: 'button',
    role: 'switch',
    'aria-checked': String(on),
    'aria-labelledby': labelledBy,
  });
  el.append(h('span', { class: 'knob' }));
  el.addEventListener('click', () => onChange(el.getAttribute('aria-checked') !== 'true'));
  return { el, set: (v) => el.setAttribute('aria-checked', String(v)) };
}

export interface Range {
  el: HTMLElement;
  set(value: number): void;
}

export function rangeControl(
  min: number,
  max: number,
  step: number,
  value: number,
  format: (v: number) => string,
  onInput: (v: number) => void,
  label: string,
): Range {
  const out = h('output', { class: 'range-out' }, format(value));
  const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = format(v);
    onInput(v);
  });
  return {
    el: h('div', { class: 'range' }, input, out),
    set(v) {
      input.value = String(v);
      out.textContent = format(v);
    },
  };
}
