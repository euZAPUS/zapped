import { lineChart } from '../render/charts';
import { settings } from '../settings/store';
import {
  activityByDay,
  configKey,
  dayKey,
  describeConfig,
  rankFor,
  recordsByConfig,
  summarize,
} from '../stats/aggregates';
import { history, type ResultRecord } from '../stats/history';
import { clear, h } from '../ui/dom';

const PAGE = 20;
const fmtDate = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const fmtTime = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '⚡';
  return parts.slice(0, 2).map((p) => p.charAt(0).toLocaleUpperCase()).join('');
}

function duration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return `${Math.round(seconds)} s`;
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Profile page: rank, headline numbers, evolution chart, records, activity and history. */
export function mountProfile(root: HTMLElement, opts: { onSettings: () => void; onPlay: () => void }): { render: () => void } {
  let filter = 'all';
  let shown = PAGE;

  const render = (): void => {
    const all = history.all();
    const s = settings.get();
    clear(root);

    // --- header
    const sum = summarize(all);
    const best = sum.best?.wpm ?? 0;
    const { current, next } = rankFor(best);
    const nameInput = h('input', {
      type: 'text', class: 'name-input', value: s.profileName, maxlength: 24,
      placeholder: 'Tu nombre', 'aria-label': 'Nombre del perfil', autocomplete: 'off',
    });
    const avatar = h('div', { class: 'avatar', 'aria-hidden': 'true' }, initials(s.profileName));
    nameInput.addEventListener('input', () => {
      avatar.textContent = initials(nameInput.value);
    });
    nameInput.addEventListener('change', () => settings.set({ profileName: nameInput.value.trim() }));
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') nameInput.blur();
    });
    const progress = next ? Math.max(0, Math.min(1, (best - current.min) / (next.min - current.min))) : 1;
    const headerCard = h(
      'section',
      { class: 'card profile-head' },
      avatar,
      h(
        'div',
        { class: 'who' },
        nameInput,
        h(
          'p',
          { class: 'muted' },
          sum.firstAt ? `Zapper desde ${fmtDate.format(sum.firstAt)}` : 'Aún no has completado ningún test',
        ),
      ),
      h(
        'div',
        { class: 'rank' },
        h('span', { class: 'rank-name' }, current.name),
        h('div', { class: 'rank-bar', role: 'img', 'aria-label': next ? `${Math.round(progress * 100)}% hacia ${next.name}` : 'Rango máximo' },
          h('i', { style: `width:${progress * 100}%` })),
        h('span', { class: 'muted small' }, next ? `${Math.max(0, Math.ceil(next.min - best))} ppm para ${next.name}` : 'Rango máximo alcanzado'),
      ),
    );
    root.append(headerCard);

    if (all.length === 0) {
      root.append(
        h(
          'section',
          { class: 'card empty' },
          h('h2', {}, 'Tu historial está vacío'),
          h('p', { class: 'muted' }, 'Completa un test y aquí aparecerán tus métricas, récords y la gráfica de evolución.'),
          h('button', { class: 'btn primary', type: 'button', onclick: opts.onPlay }, 'Hacer un test'),
        ),
      );
      return;
    }

    // --- tiles
    const bestCfg = sum.best ? describeConfig(sum.best) : null;
    const tile = (label: string, value: string, unit = '', sub = ''): HTMLElement =>
      h('div', { class: 'tile' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'tile-value' }, value, unit ? h('small', {}, ` ${unit}`) : null), sub ? h('span', { class: 'muted small' }, sub) : null);
    root.append(
      h(
        'section',
        { class: 'tiles', 'aria-label': 'Resumen' },
        tile('Tests', String(sum.total), '', `${duration(sum.totalSeconds)} escribiendo`),
        tile('Mejor marca', best.toFixed(1), 'ppm', bestCfg ? `${bestCfg.title}${bestCfg.detail ? ' · ' + bestCfg.detail : ''}` : ''),
        tile('Media últimos 10', (sum.avgLast10 ?? 0).toFixed(1), 'ppm'),
        tile('Precisión media', (sum.avgAccuracy ?? 0).toFixed(1), '%'),
        tile('Consistencia media', (sum.avgConsistency ?? 0).toFixed(1), '%'),
        tile('Racha', String(sum.dayStreak), sum.dayStreak === 1 ? 'día' : 'días', 'días seguidos con algún test'),
      ),
    );

    // --- evolution
    const keys = recordsByConfig(all).map((r) => r.key);
    if (filter !== 'all' && !keys.includes(filter)) filter = 'all';
    const select = h('select', { 'aria-label': 'Filtrar por configuración' },
      h('option', { value: 'all' }, 'Todas las configuraciones'),
      ...recordsByConfig(all).map((r) => {
        const d = describeConfig(r.best);
        return h('option', { value: r.key, selected: r.key === filter }, `${d.title}${d.detail ? ' · ' + d.detail : ''}`);
      }),
    );
    select.value = filter;
    select.addEventListener('change', () => {
      filter = select.value;
      shown = PAGE;
      render();
    });
    const filtered = filter === 'all' ? all : all.filter((r) => configKey(r) === filter);
    const recent = filtered.slice(-60);
    const evolution = h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Evolución'), select));
    if (recent.length < 2) {
      evolution.append(h('p', { class: 'muted pad' }, 'Necesitas al menos dos tests en esta configuración para ver la gráfica.'));
    } else {
      const wpm = recent.map((r) => r.wpm);
      const avg = wpm.map((_, i) => {
        const win = wpm.slice(Math.max(0, i - 9), i + 1);
        return win.reduce((a, b) => a + b, 0) / win.length;
      });
      const offset = filtered.length - recent.length;
      evolution.append(
        lineChart({
          caption: 'ppm de cada test y su media móvil de 10',
          xTitle: 'Test',
          unit: 'ppm',
          xLabel: (i) => `#${offset + i + 1}`,
          series: [
            { id: 'avg', label: 'Media móvil (10)', values: avg, color: 'var(--accent)', width: 2.5 },
            { id: 'wpm', label: 'Cada test', values: wpm, color: 'var(--accent-2)', muted: true, dots: recent.length <= 40 },
          ],
          note: (i) => {
            const r = recent[i];
            return r ? `${fmtShort.format(r.at)} · ${r.acc.toFixed(0)}% precisión` : null;
          },
        }),
      );
    }
    root.append(evolution);

    // --- records
    const rows = recordsByConfig(all);
    const table = h(
      'table',
      { class: 'table' },
      h('thead', {}, h('tr', {}, ['Configuración', 'Récord', 'Precisión', 'Consist.', 'Tests', 'Fecha'].map((t, i) => h('th', { class: i > 0 ? 'num' : '' }, t)))),
      h(
        'tbody',
        {},
        rows.map((r, i) => {
          const d = describeConfig(r.best);
          return h(
            'tr',
            {},
            h('td', {}, h('strong', {}, d.title), d.detail ? h('span', { class: 'muted' }, ` · ${d.detail}`) : null, i === 0 ? h('span', { class: 'crown' }, 'mejor') : null),
            h('td', { class: 'num strong' }, r.best.wpm.toFixed(1)),
            h('td', { class: 'num' }, `${r.best.acc.toFixed(1)}%`),
            h('td', { class: 'num' }, `${r.best.cons.toFixed(0)}%`),
            h('td', { class: 'num' }, String(r.count)),
            h('td', { class: 'num muted' }, fmtShort.format(r.best.at)),
          );
        }),
      ),
    );
    root.append(h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Récords por configuración')), h('div', { class: 'table-wrap' }, table)));

    // --- activity heatmap
    root.append(h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Actividad')), buildHeatmap(all)));

    // --- history
    const list = filtered.slice().reverse();
    const body = h('tbody', {});
    list.slice(0, shown).forEach((r) => body.append(historyRow(r)));
    const histTable = h(
      'table',
      { class: 'table' },
      h('thead', {}, h('tr', {}, ['Fecha', 'Configuración', 'ppm', 'Brutas', 'Precisión', 'Consist.'].map((t, i) => h('th', { class: i > 1 ? 'num' : '' }, t)))),
      body,
    );
    const more =
      list.length > shown
        ? h('button', { class: 'btn small', type: 'button', onclick: () => ((shown += PAGE), render()) }, `Mostrar más (${list.length - shown})`)
        : null;
    root.append(h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Historial')), h('div', { class: 'table-wrap' }, histTable), more ? h('div', { class: 'center' }, more) : null));

    root.append(
      h('div', { class: 'row center pad' },
        h('button', { class: 'btn small', type: 'button', onclick: opts.onSettings }, 'Exportar, importar o sincronizar'),
      ),
    );
  };

  history.subscribe(() => {
    if (!root.hidden) render();
  });
  return { render };
}

function historyRow(r: ResultRecord): HTMLElement {
  const d = describeConfig(r);
  return h(
    'tr',
    {},
    h('td', { class: 'muted nowrap' }, `${fmtShort.format(r.at)} · ${fmtTime.format(r.at)}`),
    h('td', {}, h('strong', {}, d.title), d.detail ? h('span', { class: 'muted' }, ` · ${d.detail}`) : null),
    h('td', { class: 'num strong' }, r.wpm.toFixed(1)),
    h('td', { class: 'num' }, r.raw.toFixed(1)),
    h('td', { class: 'num' }, `${r.acc.toFixed(1)}%`),
    h('td', { class: 'num' }, `${r.cons.toFixed(0)}%`),
  );
}

/** Last 17 weeks of activity, Monday-first columns. */
function buildHeatmap(all: readonly ResultRecord[]): HTMLElement {
  const WEEKS = 17;
  const days = activityByDay(all);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const end = new Date(today);
  const dow = (end.getDay() + 6) % 7; // Monday = 0
  const start = new Date(end);
  start.setDate(end.getDate() - dow - (WEEKS - 1) * 7);
  const max = Math.max(1, ...days.values());

  const grid = h('div', { class: 'heatmap', role: 'img', 'aria-label': 'Actividad de las últimas 17 semanas' });
  const cursor = new Date(start);
  for (let i = 0; i < WEEKS * 7; i++) {
    const count = days.get(dayKey(cursor.getTime())) ?? 0;
    const future = cursor.getTime() > today.getTime();
    const level = count === 0 ? 0 : Math.min(4, 1 + Math.floor((count / max) * 3.999));
    grid.append(
      h('i', {
        class: future ? 'cell future' : 'cell',
        'data-level': String(level),
        title: `${fmtShort.format(cursor)}: ${count} ${count === 1 ? 'test' : 'tests'}`,
      }),
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  const legend = h('div', { class: 'heat-legend muted small' }, 'menos', ...[0, 1, 2, 3, 4].map((l) => h('i', { class: 'cell', 'data-level': String(l) })), 'más');
  return h('div', { class: 'heat-wrap' }, grid, legend);
}
