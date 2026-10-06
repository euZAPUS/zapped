import { MAX_CUSTOM_WORDS, parseCustomText } from '../engine/words';
import { settings } from '../settings/store';
import { createModal } from '../ui/dialog';
import { closeButton } from '../ui/dialog';
import { h } from '../ui/dom';

const EXAMPLE_C = `#include <unistd.h>

void\tft_putchar(char c)
{
\twrite(1, &c, 1);
}

int\tmain(void)
{
\tft_putchar('4');
\tft_putchar('2');
\treturn (0);
}`;

const EXAMPLE_TEXT =
  'La mecanografía es un oficio que se aprende con paciencia. Cada tecla, una pequeña descarga; cada palabra, un relámpago.';

/** Modal to paste any text or code to practise with. */
export function mountCustomDialog(onSaved: () => void): { open: () => void } {
  const area = h('textarea', {
    class: 'input custom-area',
    rows: 12,
    spellcheck: false,
    placeholder: 'Pega aquí el texto o el código con el que quieres practicar…',
    'aria-label': 'Texto propio',
  });
  const info = h('p', { class: 'muted small', 'aria-live': 'polite' });
  const dialog = h('dialog', { class: 'modal', 'aria-labelledby': 'custom-title' });
  const modal = createModal(dialog);

  const update = (): void => {
    const n = parseCustomText(area.value).length;
    info.textContent =
      n === 0
        ? 'Nada que escribir todavía.'
        : `${n} palabras${n >= MAX_CUSTOM_WORDS ? ` (máximo ${MAX_CUSTOM_WORDS}, el resto se recorta)` : ''}.`;
    save.disabled = n === 0;
  };
  const save = h('button', { class: 'btn primary', type: 'button' }, 'Usar este texto');
  save.addEventListener('click', () => {
    settings.set({ customText: area.value, mode: 'custom' });
    modal.close();
    onSaved();
  });
  area.addEventListener('input', update);
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !save.disabled) save.click();
  });

  dialog.append(
    h(
      'div',
      { class: 'modal-head' },
      h('h2', { id: 'custom-title' }, 'Texto propio'),
      closeButton(() => modal.close()),
    ),
    h(
      'p',
      { class: 'muted small' },
      'Las líneas se escriben con ',
      h('kbd', {}, 'Enter'),
      '. La sangría del principio de línea se salta sola, así que ',
      h('kbd', {}, 'Tab'),
      ' sigue sirviendo para reiniciar incluso con código.',
    ),
    area,
    h(
      'div',
      { class: 'modal-foot' },
      info,
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: () => ((area.value = EXAMPLE_C), update()) }, 'Ejemplo en C'),
        h('button', { class: 'btn small', type: 'button', onclick: () => ((area.value = EXAMPLE_TEXT), update()) }, 'Ejemplo de prosa'),
        save,
      ),
    ),
  );
  document.body.append(dialog);

  return {
    open() {
      area.value = settings.get().customText;
      update();
      modal.open();
      area.focus();
    },
  };
}
