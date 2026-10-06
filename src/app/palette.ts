import { clearPreview, previewAppearance } from './appearance';
import { buildCommands, type Badge, type CommandDeps, type Entry, type Leaf, type Menu, type Section } from './commands';
import { createModal } from '../ui/dialog';
import { h } from '../ui/dom';

/** Lowercase, accent-free text so "tildes" finds "Tildes" and "codigo" finds "Código". */
function norm(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface Row {
  entry: Entry;
  /** "Tema › Voltio" style trail, shown when the row comes from a search. */
  trail?: string;
  section?: string;
}

interface Frame {
  menu: Menu | null; // null = root
}

type PaletteDeps = Omit<CommandDeps, 'preview'> & { onClose: () => void };

/**
 * Command palette (Esc): search any option, flip toggles, pick values from
 * submenus with a live preview. Everything here is also in the settings panel.
 */
export function mountPalette(deps: PaletteDeps): { open: () => void; isOpen: () => boolean } {
  const input = h('input', {
    type: 'text', class: 'palette-input', autocomplete: 'off', spellcheck: false,
    placeholder: 'Escribe un comando…', 'aria-label': 'Buscar comando', role: 'combobox',
    'aria-expanded': 'true', 'aria-controls': 'palette-list', 'aria-autocomplete': 'list',
  });
  const crumb = h('span', { class: 'palette-crumb' });
  const list = h('ul', { class: 'palette-list', id: 'palette-list', role: 'listbox', 'aria-label': 'Comandos' });
  const hint = h(
    'div',
    { class: 'palette-hint', 'aria-hidden': 'true' },
    h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), ' moverte'),
    h('span', {}, h('kbd', {}, 'Enter'), ' elegir'),
    h('span', {}, h('kbd', {}, 'Esc'), ' atrás / cerrar'),
  );
  const dialog = h(
    'dialog',
    { class: 'palette', 'aria-label': 'Barra de comandos' },
    h('div', { class: 'palette-bar' }, crumb, input),
    list,
    hint,
  );
  const modal = createModal(dialog, () => {
    clearPreview();
    deps.onClose();
  });
  document.body.append(dialog);

  let sections: Section[] = [];
  let stack: Frame[] = [{ menu: null }];
  let rows: Row[] = [];
  let active = 0;

  const frame = (): Frame => stack[stack.length - 1] as Frame;

  function flatten(): Row[] {
    const out: Row[] = [];
    for (const sec of sections) {
      for (const e of sec.entries) {
        out.push({ entry: e, section: sec.title });
        if (e.kind === 'menu') for (const leaf of e.items()) out.push({ entry: leaf, trail: `${e.title} › ${leaf.title}`, section: sec.title });
      }
    }
    return out;
  }

  function compute(): void {
    const q = norm(input.value).trim();
    const f = frame();
    if (f.menu) {
      const items = f.menu.items().map((leaf): Row => ({ entry: leaf }));
      rows = q ? items.filter((r) => matches(r, q)) : items;
    } else if (q) {
      const hits = flatten().filter((r) => matches(r, q));
      // leaves first when they match by their own title, then the menus that contain them
      rows = hits.sort((a, b) => score(b, q) - score(a, q));
    } else {
      rows = sections.flatMap((sec) => sec.entries.map((entry): Row => ({ entry, section: sec.title })));
    }
    active = Math.min(active, Math.max(0, rows.length - 1));
  }

  function matches(r: Row, q: string): boolean {
    const hay = norm(`${r.entry.title} ${r.trail ?? ''} ${r.entry.keywords ?? ''} ${r.section ?? ''}`);
    return q.split(/\s+/).every((t) => hay.includes(t));
  }

  function score(r: Row, q: string): number {
    const title = norm(r.entry.title);
    let sc = 0;
    if (title === q) sc += 10;
    if (title.startsWith(q)) sc += 5;
    if (title.includes(q)) sc += 3;
    if (r.entry.kind === 'menu') sc += 1;
    return sc;
  }

  function badgeEl(entry: Entry): HTMLElement | null {
    if (entry.kind === 'menu') {
      const text = entry.badge?.();
      return h('span', { class: 'badge-menu' }, text ? h('span', { class: 'badge-text' }, text) : null, h('span', { class: 'chev' }, '›'));
    }
    const b: Badge | null | undefined = entry.badge?.();
    if (b) return h('span', { class: b.on === undefined ? 'badge-text' : b.on ? 'pill-state on' : 'pill-state' }, b.text);
    if (entry.current?.()) return h('span', { class: 'check', 'aria-label': 'actual' }, '●');
    return null;
  }

  function render(keepScroll = false): void {
    const prev = list.scrollTop;
    list.replaceChildren();
    let lastSection: string | undefined;
    const showSections = !input.value.trim() && !frame().menu;
    rows.forEach((r, i) => {
      if (showSections && r.section !== lastSection) {
        lastSection = r.section;
        list.append(h('li', { class: 'palette-section', role: 'presentation' }, r.section));
      }
      const li = h(
        'li',
        { class: i === active ? 'palette-item active' : 'palette-item', role: 'option', 'aria-selected': String(i === active), id: `pal-${i}` },
        h('span', { class: 'palette-title' }, r.trail ?? r.entry.title),
        badgeEl(r.entry),
      );
      li.addEventListener('mousemove', () => {
        if (active !== i) setActive(i, false);
      });
      li.addEventListener('click', () => run(i));
      list.append(li);
    });
    if (rows.length === 0) list.append(h('li', { class: 'palette-empty' }, 'Nada coincide con esa búsqueda.'));
    input.setAttribute('aria-activedescendant', `pal-${active}`);
    crumb.textContent = frame().menu ? `${frame().menu?.title} ›` : '';
    crumb.hidden = !frame().menu;
    input.placeholder = frame().menu ? 'Filtrar…' : 'Escribe un comando…';
    if (keepScroll) list.scrollTop = prev;
    else scrollActive();
    previewActive();
  }

  function scrollActive(): void {
    (list.querySelector('.palette-item.active') as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }

  function setActive(i: number, scroll = true): void {
    active = i;
    list.querySelectorAll('.palette-item').forEach((el, idx) => {
      el.classList.toggle('active', idx === i);
      el.setAttribute('aria-selected', String(idx === i));
    });
    input.setAttribute('aria-activedescendant', `pal-${i}`);
    if (scroll) scrollActive();
    previewActive();
  }

  /** Shows the highlighted option without saving it; clears when the row has no preview. */
  function previewActive(): void {
    const e = rows[active]?.entry;
    if (e && e.kind === 'leaf' && e.preview) e.preview();
    else clearPreview();
  }

  function run(i: number): void {
    const entry = rows[i]?.entry;
    if (!entry) return;
    if (entry.kind === 'menu') {
      stack.push({ menu: entry });
      input.value = '';
      active = Math.max(0, entry.items().findIndex((l) => l.current?.()));
      compute();
      render();
      return;
    }
    const leaf: Leaf = entry;
    leaf.run();
    clearPreview();
    if (leaf.stay) {
      // refresh states in place (settings changed, and so did the badges)
      sections = buildCommands(commandDeps);
      compute();
      render(true);
      return;
    }
    modal.close();
  }

  function back(): void {
    if (input.value) {
      input.value = '';
      compute();
      render();
    } else if (stack.length > 1) {
      stack.pop();
      active = 0;
      compute();
      render();
    } else {
      modal.close();
    }
  }

  input.addEventListener('input', () => {
    active = 0;
    compute();
    render();
  });
  input.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (rows.length) setActive((active + 1) % rows.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (rows.length) setActive((active - 1 + rows.length) % rows.length);
        break;
      case 'Enter':
        e.preventDefault();
        run(active);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        back();
        break;
      case 'Backspace':
        if (!input.value && stack.length > 1) {
          e.preventDefault();
          back();
        }
        break;
      case 'Tab':
        e.preventDefault();
        break;
    }
  });

  const commandDeps: CommandDeps = { ...deps, preview: previewAppearance };

  return {
    open() {
      sections = buildCommands(commandDeps);
      stack = [{ menu: null }];
      input.value = '';
      active = 0;
      compute();
      render();
      modal.open();
      input.focus();
    },
    isOpen: () => modal.isOpen,
  };
}
