import type { TestResult } from '../engine/types';
import { describeConfig } from '../stats/aggregates';
import type { ResultRecord } from '../stats/history';
import { clear, h } from '../ui/dom';
import { reducedMotion } from '../ui/motion';
import { lineChart } from './charts';

export interface ResultContext {
  result: TestResult;
  record: ResultRecord;
  /** Previous best ppm for the same configuration, if any. */
  previousBest: number | null;
  onNext: () => void;
  onRepeat: () => void;
}

function countUp(el: HTMLElement, to: number, decimals: number, duration = 1000): void {
  const fmt = (v: number): string => v.toFixed(decimals);
  if (reducedMotion() || duration <= 0) {
    el.textContent = fmt(to);
    return;
  }
  const start = performance.now();
  const step = (now: number): void => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - p) ** 4;
    el.textContent = fmt(to * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function stat(label: string, value: string, unit: string, title?: string): { el: HTMLElement; value: HTMLElement } {
  const v = h('span', { class: 'stat-value' }, value);
  const el = h(
    'div',
    { class: 'stat', title },
    h('span', { class: 'stat-label' }, label),
    h('span', { class: 'stat-line' }, v, unit ? h('span', { class: 'stat-unit' }, unit) : null),
  );
  return { el, value: v };
}

export function renderResult(container: HTMLElement, ctx: ResultContext): void {
  const { result, record } = ctx;
  clear(container);

  const isRecord = ctx.previousBest === null ? false : result.wpm > ctx.previousBest;
  const isFirst = ctx.previousBest === null;
  const cfg = describeConfig(record);

  const big = h('span', { class: 'big-num' }, '0');
  const hero = h(
    'div',
    { class: 'hero' },
    h('div', { class: 'big', title: `${result.wpm} ppm netas` }, big, h('span', { class: 'big-unit' }, 'ppm')),
    isRecord || isFirst
      ? h(
          'span',
          { class: 'badge' },
          isRecord ? `¡Récord nuevo! +${(result.wpm - (ctx.previousBest ?? 0)).toFixed(1)}` : 'Primera marca en esta configuración',
        )
      : null,
    h('p', { class: 'hero-sub' }, h('strong', {}, cfg.title), cfg.detail ? ` · ${cfg.detail}` : ''),
  );

  const acc = stat('Precisión', '0', '%');
  const raw = stat('Brutas', '0', 'ppm', 'Todo lo escrito, acierte o no');
  const cons = stat('Consistencia', '0', '%', 'Cuánto de estable fue tu velocidad');
  const time = stat('Tiempo', result.duration.toFixed(1), 's');
  const c = result.chars;
  const chars = h(
    'div',
    { class: 'stat', title: 'correctos / fallos / extra / omitidos' },
    h('span', { class: 'stat-label' }, 'Caracteres'),
    h(
      'span',
      { class: 'stat-line chars' },
      h('span', { class: 'ch-ok' }, String(c.correct)),
      '/',
      h('span', { class: 'ch-bad' }, String(c.incorrect)),
      '/',
      h('span', { class: 'ch-extra' }, String(c.extra)),
      '/',
      h('span', { class: 'ch-miss' }, String(c.missed)),
    ),
  );

  const errorAt = new Map<number, number>();
  result.samples.forEach((s, i) => {
    if (s.errors > 0) errorAt.set(i, s.errors);
  });
  const chart = lineChart({
    caption: 'Evolución de las ppm a lo largo del test',
    xTitle: 'Segundo',
    unit: 'ppm',
    xLabel: (i) => `${Math.round((result.samples[i]?.t ?? i + 1) * 10) / 10} s`,
    series: [
      { id: 'net', label: 'Netas', values: result.samples.map((s) => s.net), color: 'var(--accent)', width: 2.5 },
      { id: 'raw', label: 'Brutas', values: result.samples.map((s) => s.raw), color: 'var(--accent-2)', muted: true },
    ],
    errorAt,
    note: (i) => {
      const e = result.samples[i]?.errors ?? 0;
      return e > 0 ? `${e} ${e === 1 ? 'fallo' : 'fallos'}` : null;
    },
  });
  const legendNote = errorAt.size > 0 ? h('p', { class: 'chart-note' }, h('span', { class: 'x-mark' }, '×'), ' segundos con fallos') : null;

  const next = h('button', { class: 'btn primary', type: 'button', onclick: ctx.onNext }, 'Siguiente test ', h('kbd', {}, 'Enter'));
  const repeat = h('button', { class: 'btn', type: 'button', onclick: ctx.onRepeat }, 'Repetir el mismo texto');

  container.append(
    h(
      'div',
      { class: 'result-card' },
      hero,
      h('div', { class: 'stats' }, acc.el, raw.el, cons.el, time.el, chars),
      h('div', { class: 'result-chart' }, chart, legendNote),
      h('div', { class: 'actions' }, next, repeat),
    ),
  );

  countUp(big, result.wpm, 0, 1100);
  countUp(acc.value, result.accuracy, 1, 900);
  countUp(raw.value, result.raw, 0, 900);
  countUp(cons.value, result.consistency, 1, 900);
  next.focus({ preventScroll: true });
}
