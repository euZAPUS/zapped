import { sound } from '../audio/sound';
import { CODE_LANG_IDS, CODE_LANGS } from '../data/snippets';
import { LANGUAGE_IDS, LANGUAGES } from '../data/words';
import {
  FONTS,
  THEMES,
  TIME_OPTIONS,
  WORD_OPTIONS,
  type BackgroundKind,
  type CaretStyle,
  type MotionPref,
  type Settings,
  type SoundId,
} from '../settings/schema';
import { settings } from '../settings/store';
import { downloadExport } from '../sync/portable';
import { sync } from '../sync/sync-manager';
import { desktop } from './desktop';

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

export interface Badge {
  text: string;
  /** Toggle state, rendered as an on/off pill. */
  on?: boolean;
}

export interface Leaf {
  kind: 'leaf';
  id: string;
  title: string;
  keywords?: string;
  badge?: () => Badge | null;
  /** Marks the option that is currently selected inside a submenu. */
  current?: () => boolean;
  /** Keep the palette open after running (toggles). */
  stay?: boolean;
  run: () => void;
  /** Called when the entry is highlighted, to show what it would look like. */
  preview?: () => void;
}

export interface Menu {
  kind: 'menu';
  id: string;
  title: string;
  keywords?: string;
  badge?: () => string | null;
  items: () => Leaf[];
}

export type Entry = Leaf | Menu;

export interface Section {
  title: string;
  entries: Entry[];
}

export interface CommandDeps {
  newTest: (repeat: boolean) => void;
  openSettings: () => void;
  editText: () => void;
  goto: (route: 'test' | 'profile') => void;
  preview: (patch: Partial<Settings>) => void;
}

const ACCENTS: { name: string; hex: string }[] = [
  { name: 'Lima', hex: '#c6ff3d' },
  { name: 'Naranja', hex: '#ff7a2f' },
  { name: 'Turquesa', hex: '#2de2c8' },
  { name: 'Magenta', hex: '#ff4fd8' },
  { name: 'Azul', hex: '#3aa0ff' },
  { name: 'Amarillo', hex: '#ffd23f' },
  { name: 'Coral', hex: '#ff5c7a' },
  { name: 'Violeta', hex: '#a78bfa' },
];

const BACKGROUND_NAMES: Record<BackgroundKind, string> = {
  aurora: 'Aurora', grid: 'Cuadrícula', dots: 'Puntos', gradient: 'Degradado', image: 'Imagen', plain: 'Liso',
};

const s = (): Settings => settings.get();
const onOff = (v: boolean): Badge => ({ text: v ? 'activado' : 'desactivado', on: v });

/** Builds the palette tree fresh each time it opens, so states are never stale. */
export function buildCommands(deps: CommandDeps): Section[] {
  const toggle = (key: BoolKey, title: string, keywords = ''): Leaf => ({
    kind: 'leaf',
    id: `toggle-${key}`,
    title,
    keywords,
    stay: true,
    badge: () => onOff(s()[key]),
    run: () => settings.set({ [key]: !s()[key] }),
  });

  /** A submenu whose options set one value and preview it on hover. */
  function choice<K extends keyof Settings>(
    id: string,
    title: string,
    key: K,
    options: { value: Settings[K]; label: string; extra?: Partial<Settings>; keywords?: string }[],
    opts: { visual?: boolean; audition?: (value: Settings[K]) => void; keywords?: string } = {},
  ): Menu {
    return {
      kind: 'menu',
      id,
      title,
      keywords: opts.keywords,
      badge: () => options.find((o) => o.value === s()[key])?.label ?? null,
      items: () =>
        options.map((o) => ({
          kind: 'leaf' as const,
          id: `${id}-${String(o.value)}`,
          title: o.label,
          keywords: o.keywords,
          current: () => s()[key] === o.value,
          run: () => settings.set({ [key]: o.value, ...o.extra } as Partial<Settings>),
          preview: opts.visual
            ? () => deps.preview({ [key]: o.value } as Partial<Settings>)
            : opts.audition
              ? () => opts.audition?.(o.value)
              : undefined,
        })),
    };
  }

  const modeMenu: Menu = {
    kind: 'menu',
    id: 'mode',
    title: 'Modo',
    keywords: 'tiempo palabras codigo texto propio',
    badge: () => ({ time: 'tiempo', words: 'palabras', code: 'código', custom: 'texto propio' })[s().mode],
    items: () =>
      (
        [
          ['time', 'Tiempo'],
          ['words', 'Palabras'],
          ['code', 'Código'],
          ['custom', 'Texto propio'],
        ] as const
      ).map(([value, label]) => ({
        kind: 'leaf' as const,
        id: `mode-${value}`,
        title: label,
        current: () => s().mode === value,
        run: () => settings.set({ mode: value }),
      })),
  };

  const timeMenu: Menu = {
    kind: 'menu',
    id: 'time',
    title: 'Tiempo',
    keywords: 'segundos duracion 15 30 60 120',
    badge: () => (s().mode === 'time' ? `${s().time} s` : null),
    items: () =>
      TIME_OPTIONS.map((t) => ({
        kind: 'leaf' as const,
        id: `time-${t}`,
        title: `${t} segundos`,
        keywords: String(t),
        current: () => s().mode === 'time' && s().time === t,
        run: () => settings.set({ mode: 'time', time: t }),
      })),
  };

  const wordsMenu: Menu = {
    kind: 'menu',
    id: 'words',
    title: 'Palabras',
    keywords: 'cantidad numero 10 25 50 100',
    badge: () => (s().mode === 'words' ? String(s().words) : null),
    items: () =>
      WORD_OPTIONS.map((w) => ({
        kind: 'leaf' as const,
        id: `words-${w}`,
        title: `${w} palabras`,
        keywords: String(w),
        current: () => s().mode === 'words' && s().words === w,
        run: () => settings.set({ mode: 'words', words: w }),
      })),
  };

  const codeMenu: Menu = {
    kind: 'menu',
    id: 'code',
    title: 'Lenguaje de código',
    keywords: 'modo codigo programar snippets',
    badge: () => (s().mode === 'code' ? CODE_LANGS[s().codeLang].label : null),
    items: () =>
      CODE_LANG_IDS.map((id) => ({
        kind: 'leaf' as const,
        id: `code-${id}`,
        title: CODE_LANGS[id].label,
        current: () => s().mode === 'code' && s().codeLang === id,
        run: () => settings.set({ mode: 'code', codeLang: id }),
      })),
  };

  const languageMenu = choice(
    'language',
    'Lista de palabras',
    'language',
    LANGUAGE_IDS.map((id) => ({ value: id, label: LANGUAGES[id].label, keywords: id })),
    { keywords: 'idioma espanol ingles ciberseguridad c 42 diccionario' },
  );

  const themeMenu = choice(
    'theme',
    'Tema',
    'theme',
    THEMES.map((t) => ({ value: t.id, label: `${t.name} · ${t.dark ? 'oscuro' : 'claro'}`, keywords: t.id })),
    { visual: true, keywords: 'colores apariencia' },
  );
  const fontMenu = choice('font', 'Fuente', 'font', FONTS.map((f) => ({ value: f.id, label: f.name })), {
    visual: true,
    keywords: 'tipografia letra',
  });
  const sizeMenu = choice(
    'size',
    'Tamaño del texto',
    'fontSize',
    [20, 24, 28, 32, 36, 40, 44].map((n) => ({ value: n, label: `${n} px` })),
    { visual: true, keywords: 'grande pequeno letra' },
  );
  const caretMenu = choice(
    'caret',
    'Estilo del cursor',
    'caret',
    ([['line', 'Línea'], ['block', 'Bloque'], ['underline', 'Subrayado']] as [CaretStyle, string][]).map(([value, label]) => ({ value, label })),
    { visual: true, keywords: 'caret' },
  );
  const soundMenu = choice(
    'sound',
    'Sonido de tecla',
    'sound',
    ([['off', 'Apagado'], ['click', 'Clic'], ['pop', 'Pop'], ['typewriter', 'Máquina de escribir'], ['bubble', 'Burbuja']] as [SoundId, string][]).map(([value, label]) => ({ value, label })),
    { audition: (v) => sound.key(v), keywords: 'audio volumen' },
  );
  const backgroundMenu = choice(
    'background',
    'Fondo',
    'background',
    (Object.keys(BACKGROUND_NAMES) as BackgroundKind[]).map((value) => ({ value, label: BACKGROUND_NAMES[value] })),
    { keywords: 'imagen degradado aurora' },
  );
  const motionMenu = choice(
    'motion',
    'Animaciones',
    'motion',
    ([['auto', 'Según el sistema'], ['reduced', 'Reducidas'], ['full', 'Completas']] as [MotionPref, string][]).map(([value, label]) => ({ value, label })),
    { keywords: 'movimiento reduced motion' },
  );

  const accentMenu: Menu = {
    kind: 'menu',
    id: 'accent',
    title: 'Color de acento',
    keywords: 'color colores',
    badge: () => (s().accent ? ACCENTS.find((a) => a.hex === s().accent)?.name ?? s().accent : 'del tema'),
    items: () => [
      {
        kind: 'leaf' as const,
        id: 'accent-theme',
        title: 'El del tema',
        current: () => s().accent === null,
        run: () => settings.set({ accent: null }),
        preview: () => deps.preview({ accent: null }),
      },
      ...ACCENTS.map((a) => ({
        kind: 'leaf' as const,
        id: `accent-${a.hex}`,
        title: a.name,
        current: () => s().accent === a.hex,
        run: () => settings.set({ accent: a.hex }),
        preview: () => deps.preview({ accent: a.hex }),
      })),
    ],
  };

  const action = (id: string, title: string, run: () => void, keywords = ''): Leaf => ({ kind: 'leaf', id, title, keywords, run });

  const sections: Section[] = [
    { title: 'Test', entries: [modeMenu, timeMenu, wordsMenu, codeMenu, languageMenu] },
    {
      title: 'Opciones',
      entries: [
        toggle('punctuation', 'Puntuación', 'signos comas puntos'),
        toggle('numbers', 'Números', 'cifras digitos'),
        toggle('accents', 'Tildes', 'acentos'),
        toggle('enye', 'Eñe (ñ)', 'enie n'),
        toggle('invertedMarks', 'Signos ¿ ¡', 'interrogacion exclamacion'),
        toggle('stopOnError', 'No avanzar hasta acertar', 'estricto error parar'),
        toggle('liveStats', 'ppm en vivo', 'velocidad contador'),
        toggle('smoothCaret', 'Cursor deslizante', 'suave caret'),
        toggle('pop', 'Pop al acertar', 'animacion letra'),
        toggle('sparks', 'Chispas', 'particulas'),
        toggle('glow', 'Brillo de racha', 'aura resplandor'),
        toggle('dimUi', 'Atenuar la interfaz al escribir', 'ocultar menu'),
        toggle('focusMode', 'Modo foco', 'desenfocar blur'),
        toggle('errorSound', 'Sonido de error', 'audio fallo'),
      ],
    },
    { title: 'Apariencia', entries: [themeMenu, fontMenu, sizeMenu, accentMenu, caretMenu, backgroundMenu, soundMenu, motionMenu] },
    {
      title: 'Ir a',
      entries: [
        action('new', 'Nuevo test', () => deps.newTest(false), 'reiniciar empezar'),
        action('repeat', 'Repetir el mismo texto', () => deps.newTest(true)),
        action('goto-test', 'Ir al test', () => deps.goto('test'), 'escribir inicio'),
        action('goto-profile', 'Perfil y estadísticas', () => deps.goto('profile'), 'records historial metricas'),
        action('settings', 'Abrir todos los ajustes', deps.openSettings, 'configuracion opciones'),
        action('edit-text', 'Editar texto propio', deps.editText, 'pegar'),
      ],
    },
  ];

  const data: Entry[] = [action('export', 'Exportar datos (JSON)', downloadExport, 'copia seguridad backup')];
  if (sync.connected) data.unshift(action('sync', 'Sincronizar ahora', () => void sync.syncNow().catch(() => undefined), 'nube gist'));
  if (desktop) data.push(action('update', 'Buscar actualizaciones', () => desktop?.checkForUpdates(), 'version actualizar'));
  sections.push({ title: 'Datos', entries: data });

  return sections;
}
