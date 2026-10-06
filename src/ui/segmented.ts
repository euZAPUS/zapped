import { h } from './dom';

export interface SegOption<T extends string | number> {
  value: T;
  label: string;
  title?: string;
}

export interface Segmented<T extends string | number> {
  el: HTMLElement;
  set(value: T): void;
}

/** Button group with a sliding accent indicator. */
export function segmented<T extends string | number>(
  options: SegOption<T>[],
  value: T,
  onChange: (value: T) => void,
  label: string,
): Segmented<T> {
  const ind = h('span', { class: 'ind', 'aria-hidden': 'true' });
  const buttons = options.map((o) =>
    h('button', { type: 'button', 'aria-pressed': String(o.value === value), title: o.title, onclick: () => onChange(o.value) }, o.label),
  );
  const el = h('div', { class: 'seg', role: 'group', 'aria-label': label }, ind, buttons);
  let current = value;
  let placed = false;

  const place = (): void => {
    const idx = options.findIndex((o) => o.value === current);
    const btn = buttons[idx];
    if (!btn || btn.offsetWidth === 0) return;
    ind.style.width = `${btn.offsetWidth}px`;
    ind.style.transform = `translateX(${btn.offsetLeft}px)`;
    if (!placed) {
      placed = true;
      // no slide on first paint
      ind.style.transition = 'none';
      requestAnimationFrame(() => (ind.style.transition = ''));
    }
  };
  new ResizeObserver(place).observe(el);
  void document.fonts?.ready.then(place);

  return {
    el,
    set(next) {
      current = next;
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i]?.value === next)));
      place();
    },
  };
}
