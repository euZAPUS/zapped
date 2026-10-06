import { buildDataSection } from '../app/data-section';
import { sound } from '../audio/sound';
import { applyBackground } from '../render/background';
import { KEYS, writeString } from '../storage/local';
import { closeButton, createModal, type ModalHandle } from '../ui/dialog';
import { h } from '../ui/dom';
import { rangeControl, row, switchControl } from '../ui/controls';
import { segmented } from '../ui/segmented';
import {
  DEFAULT_SETTINGS,
  FONTS,
  THEMES,
  type BackgroundKind,
  type CaretStyle,
  type FontId,
  type MotionPref,
  type Settings,
  type SoundId,
} from './schema';
import { settings } from './store';

type Updater = (s: Settings) => void;
type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const ACCENT_PRESETS = ['#c6ff3d', '#ff7a2f', '#2de2c8', '#ff4fd8', '#3aa0ff', '#ffd23f', '#ff5c7a', '#a78bfa'];

const BACKGROUNDS: { value: BackgroundKind; label: string }[] = [
  { value: 'aurora', label: 'Aurora' },
  { value: 'grid', label: 'Cuadrícula' },
  { value: 'dots', label: 'Puntos' },
  { value: 'gradient', label: 'Degradado' },
  { value: 'image', label: 'Imagen' },
  { value: 'plain', label: 'Liso' },
];

/** Downscales a picked image so it fits comfortably in localStorage. */
async function shrinkImage(file: File, maxSide = 1920): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export function mountSettings(opts: { onProfile: () => void; onClose: () => void }): ModalHandle {
  const updaters: Updater[] = [];
  const reg = (fn: Updater): void => {
    updaters.push(fn);
  };
  const s0 = settings.get();

  const toggleRow = (key: BoolKey, label: string, hint?: string): HTMLElement => {
    const id = `lbl-${key}`;
    const sw = switchControl(Boolean(s0[key]), (on) => settings.set({ [key]: on }), id);
    reg((s) => sw.set(Boolean(s[key])));
    return row(label, sw.el, hint, id);
  };

  function segRow<K extends 'caret' | 'motion' | 'sound', V extends string>(
    key: K,
    label: string,
    options: { value: V; label: string }[],
    hint?: string,
    onPick?: (v: V) => void,
  ): HTMLElement {
    const seg = segmented(options, s0[key] as unknown as V, (v) => {
      settings.set({ [key]: v });
      onPick?.(v);
    }, label);
    reg((s) => seg.set(s[key] as unknown as V));
    return row(label, seg.el, hint);
  }

  // ---- Prueba
  const testSection = section('Texto y prueba', [
    toggleRow('accents', 'Tildes (á é í ó ú ü)', 'Si lo apagas, las palabras en español se escriben sin tildes.'),
    toggleRow('enye', 'Eñe (ñ)', 'Si lo apagas, la ñ se escribe como n.'),
    toggleRow('invertedMarks', 'Signos ¿ ¡', 'Con puntuación, abre las preguntas y exclamaciones como en español.'),
    toggleRow('punctuation', 'Puntuación'),
    toggleRow('numbers', 'Números'),
    toggleRow('stopOnError', 'No avanzar hasta acertar', 'Una letra incorrecta no se escribe y el cursor espera la correcta.'),
    toggleRow('liveStats', 'Mostrar ppm en vivo'),
  ]);

  // ---- Cursor y efectos
  const effectsSection = section('Cursor y efectos', [
    segRow<'caret', CaretStyle>('caret', 'Estilo del cursor', [
      { value: 'line', label: 'Línea' },
      { value: 'block', label: 'Bloque' },
      { value: 'underline', label: 'Subrayado' },
    ]),
    toggleRow('smoothCaret', 'Cursor deslizante', 'Se desliza suavemente entre letras.'),
    toggleRow('pop', 'Pop al acertar', 'Cada letra correcta da un pequeño salto.'),
    toggleRow('sparks', 'Chispas', 'Partículas al teclear. Opcional y un poco más exigente.'),
    toggleRow('glow', 'Brillo de racha', 'Crece con tus aciertos seguidos y se apaga al fallar.'),
    toggleRow('dimUi', 'Atenuar la interfaz al escribir', 'Vuelve en cuanto mueves el ratón.'),
    toggleRow('focusMode', 'Modo foco', 'Desenfoca las palabras que vienen.'),
    segRow<'motion', MotionPref>(
      'motion',
      'Animaciones',
      [
        { value: 'auto', label: 'Sistema' },
        { value: 'reduced', label: 'Reducidas' },
        { value: 'full', label: 'Completas' },
      ],
      '«Sistema» respeta prefers-reduced-motion.',
    ),
  ]);

  // ---- Sonido
  const volume = rangeControl(0, 1, 0.05, s0.volume, (v) => `${Math.round(v * 100)}%`, (v) => {
    settings.set({ volume: v });
    sound.key();
  }, 'Volumen');
  reg((s) => volume.set(s.volume));
  const soundSection = section('Sonido', [
    segRow<'sound', SoundId>(
      'sound',
      'Sonido de tecla',
      [
        { value: 'off', label: 'Off' },
        { value: 'click', label: 'Clic' },
        { value: 'pop', label: 'Pop' },
        { value: 'typewriter', label: 'Máquina' },
        { value: 'bubble', label: 'Burbuja' },
      ],
      'Sintetizado con Web Audio, sin archivos.',
      (v) => sound.key(v),
    ),
    row('Volumen', volume.el),
    toggleRow('errorSound', 'Sonido de error'),
  ]);

  // ---- Tema
  const themeButtons = THEMES.map((t) => {
    const btn = h(
      'button',
      { class: 'theme-card', type: 'button', 'aria-pressed': String(s0.theme === t.id), 'data-theme-id': t.id },
      h('span', { class: 'theme-swatch', style: `background:${t.swatch[0]}` },
        h('i', { style: `background:${t.swatch[1]}` }),
        h('i', { style: `background:${t.swatch[2]}` }),
        h('i', { style: `background:${t.swatch[3]}` }),
      ),
      h('span', { class: 'theme-name' }, t.name),
      h('span', { class: 'theme-kind' }, t.dark ? 'oscuro' : 'claro'),
    );
    btn.addEventListener('click', () => settings.set({ theme: t.id }));
    return btn;
  });
  reg((s) => themeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeId === s.theme))));

  const accentInput = h('input', { type: 'color', value: s0.accent ?? '#c6ff3d', 'aria-label': 'Color de acento' });
  accentInput.addEventListener('input', () => settings.set({ accent: accentInput.value }));
  const presets = ACCENT_PRESETS.map((c) =>
    h('button', { class: 'preset', type: 'button', style: `background:${c}`, 'aria-label': `Acento ${c}`, onclick: () => settings.set({ accent: c }) }),
  );
  const resetAccent = h('button', { class: 'btn small', type: 'button', onclick: () => settings.set({ accent: null }) }, 'Del tema');
  reg((s) => {
    if (s.accent) accentInput.value = s.accent;
    resetAccent.disabled = s.accent === null;
  });

  const colorRow = (key: 'colorFg' | 'colorSub' | 'colorErr', label: string, cssVar: string, hint: string): HTMLElement => {
    const input = h('input', { type: 'color', value: s0[key] ?? '#888888', 'aria-label': label });
    input.addEventListener('input', () => settings.set({ [key]: input.value }));
    const reset = h('button', { class: 'btn small', type: 'button', onclick: () => settings.set({ [key]: null }) }, 'Del tema');
    reg((st) => {
      // show the colour actually in use when there is no override
      input.value = st[key] ?? (getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || '#888888');
      reset.disabled = st[key] === null;
    });
    return row(label, h('div', { class: 'row' }, input, reset), hint);
  };
  const colorsBlock = h(
    'div',
    { class: 'subgroup' },
    colorRow('colorFg', 'Texto acertado', '--fg', 'Las letras que ya has escrito bien.'),
    colorRow('colorSub', 'Texto por escribir', '--sub', 'Lo que aún te queda por teclear.'),
    colorRow('colorErr', 'Color de error', '--err', 'Letras falladas y palabras con errores.'),
  );

  const fontButtons = FONTS.map((f) => {
    const btn = h(
      'button',
      { class: 'font-card', type: 'button', 'aria-pressed': String(s0.font === f.id), 'data-font-id': f.id },
      h('span', { class: 'font-sample', 'data-font': f.id }, 'Aa 42 {}'),
      h('span', { class: 'theme-name' }, f.name),
    );
    btn.addEventListener('click', () => settings.set({ font: f.id as FontId }));
    return btn;
  });
  reg((s) => fontButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fontId === s.font))));
  const size = rangeControl(18, 48, 1, s0.fontSize, (v) => `${v} px`, (v) => settings.set({ fontSize: v }), 'Tamaño del texto');
  reg((s) => size.set(s.fontSize));

  const lookSection = section('Tema y tipografía', [
    h('div', { class: 'theme-grid', role: 'group', 'aria-label': 'Tema' }, themeButtons),
    row('Color de acento', h('div', { class: 'row' }, accentInput, resetAccent), 'Se aplica por encima del tema.'),
    h('div', { class: 'presets', role: 'group', 'aria-label': 'Acentos rápidos' }, presets),
    colorsBlock,
    h('div', { class: 'font-grid', role: 'group', 'aria-label': 'Tipografía' }, fontButtons),
    row('Tamaño del texto', size.el),
  ]);

  // ---- Fondo
  const bgSelect = h(
    'select',
    { 'aria-label': 'Estilo de fondo' },
    BACKGROUNDS.map((b) => h('option', { value: b.value }, b.label)),
  );
  bgSelect.value = s0.background;
  bgSelect.addEventListener('change', () => settings.set({ background: bgSelect.value as BackgroundKind }));
  reg((s) => (bgSelect.value = s.background));

  const colorA = h('input', { type: 'color', value: s0.bgColorA ?? '#0c0d1f', 'aria-label': 'Color inicial' });
  const colorB = h('input', { type: 'color', value: s0.bgColorB ?? '#15173a', 'aria-label': 'Color final' });
  colorA.addEventListener('input', () => settings.set({ bgColorA: colorA.value }));
  colorB.addEventListener('input', () => settings.set({ bgColorB: colorB.value }));
  const gradientRow = row(
    'Colores del degradado',
    h('div', { class: 'row' }, colorA, colorB, h('button', { class: 'btn small', type: 'button', onclick: () => settings.set({ bgColorA: null, bgColorB: null }) }, 'Del tema')),
  );

  const urlInput = h('input', {
    type: 'text', placeholder: 'https://…/imagen.jpg', spellcheck: false, 'aria-label': 'URL de la imagen de fondo',
    value: s0.bgImage && s0.bgImage !== 'local' ? s0.bgImage : '',
  });
  urlInput.addEventListener('change', () => {
    const v = urlInput.value.trim();
    if (v === '' || /^https?:\/\//i.test(v)) settings.set({ bgImage: v, background: v ? 'image' : settings.get().background });
  });
  const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const fileNote = h('p', { class: 'muted small', role: 'status' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    try {
      const data = await shrinkImage(f);
      if (!writeString(KEYS.bgImage, data)) throw new Error('quota');
      settings.set({ bgImage: 'local', background: 'image' });
      applyBackground(settings.get());
      urlInput.value = '';
      fileNote.textContent = 'Imagen aplicada. Se guarda solo en este dispositivo.';
    } catch {
      fileNote.textContent = 'No se pudo guardar la imagen (¿demasiado grande?). Prueba con otra o usa una URL.';
    }
  });
  const dim = rangeControl(0, 90, 1, s0.bgDim, (v) => `${v}%`, (v) => settings.set({ bgDim: v }), 'Oscurecer fondo');
  const blur = rangeControl(0, 24, 1, s0.bgBlur, (v) => `${v} px`, (v) => settings.set({ bgBlur: v }), 'Desenfoque del fondo');
  reg((s) => {
    dim.set(s.bgDim);
    blur.set(s.bgBlur);
    if (s.bgColorA) colorA.value = s.bgColorA;
    if (s.bgColorB) colorB.value = s.bgColorB;
  });
  const imageBlock = h(
    'div',
    { class: 'subgroup' },
    row('Imagen', h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', onclick: () => fileInput.click() }, 'Subir imagen'), fileInput)),
    row('…o una URL', urlInput),
    row('Oscurecer', dim.el, 'Mejora la lectura sobre fotos claras.'),
    row('Desenfoque', blur.el),
    fileNote,
  );
  const bgSection = section('Fondo', [row('Estilo', bgSelect), gradientRow, imageBlock]);
  reg((s) => {
    gradientRow.hidden = s.background !== 'gradient';
    imageBlock.hidden = s.background !== 'image';
  });

  // ---- Datos
  const dataSection = section('Datos y nube', [buildDataSection()]);

  // ---- Atajos
  const shortcuts = section('Atajos', [
    h(
      'dl',
      { class: 'shortcuts' },
      ...(
        [
          ['Tab', 'Reinicia con palabras nuevas (también en modo texto; la sangría se salta sola)'],
          ['Ctrl + ⌫', 'Borra la palabra actual'],
          ['Esc', 'Abre la barra de comandos: busca cualquier opción, activa o desactiva ajustes y cambia tema, fuente, tiempo o modo al instante'],
          ['Enter', 'Tras el resultado, lanza otro test'],
        ] as const
      ).flatMap(([k, d]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, d)]),
    ),
  ]);

  const reset = h('button', {
    class: 'btn small danger', type: 'button',
    onclick: () => {
      if (confirm('¿Restablecer todos los ajustes a sus valores por defecto? El historial no se toca.')) {
        settings.set({ ...DEFAULT_SETTINGS, customText: settings.get().customText, profileName: settings.get().profileName });
      }
    },
  }, 'Restablecer ajustes');

  const dialog = h('dialog', { class: 'drawer', 'aria-labelledby': 'settings-title' });
  const modal = createModal(dialog, opts.onClose);
  dialog.append(
    h('header', { class: 'drawer-head' },
      h('h2', { id: 'settings-title' }, 'Ajustes'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: () => (modal.close(), opts.onProfile()) }, 'Ver perfil'),
        closeButton(() => modal.close()),
      ),
    ),
    h('div', { class: 'drawer-body' }, testSection, effectsSection, soundSection, lookSection, bgSection, dataSection, shortcuts, h('div', { class: 'row end' }, reset)),
  );
  document.body.append(dialog);

  const refresh = (s: Settings): void => updaters.forEach((u) => u(s));
  settings.subscribe(refresh);
  refresh(s0);
  return modal;
}

function section(title: string, children: HTMLElement[]): HTMLElement {
  return h('section', { class: 'set-section' }, h('h3', {}, title), ...children);
}
