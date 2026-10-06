import { h, svg } from '../ui/dom';
import { reducedMotion } from '../ui/motion';

export interface ChartSeries {
  id: string;
  label: string;
  values: number[];
  /** CSS colour, usually a custom property: 'var(--accent)'. */
  color: string;
  width?: number;
  dots?: boolean;
  /** Muted supporting line (drawn thinner, below the main one). */
  muted?: boolean;
}

export interface ChartOptions {
  series: ChartSeries[];
  /** Label for the x position `i`, used by axis ticks, tooltip and the data table. */
  xLabel: (i: number) => string;
  xTitle?: string;
  unit: string;
  /** Indexes that get an error mark (×) on the first series' value. */
  errorAt?: Map<number, number>;
  /** Extra tooltip line for position `i`. */
  note?: (i: number) => string | null;
  height?: number;
  caption: string;
}

const W = 640;
const M = { l: 42, r: 14, t: 14, b: 30 };

/** Picks a round tick step so the axis shows at most five labels. */
function niceStep(max: number): number {
  const raw = max / 4;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

/** Responsive SVG line chart with crosshair tooltip, legend and a screen-reader table. */
export function lineChart(opts: ChartOptions): HTMLElement {
  const H = opts.height ?? 240;
  const n = Math.max(...opts.series.map((s) => s.values.length));
  const plotW = W - M.l - M.r;
  const plotH = H - M.t - M.b;
  const peak = Math.max(10, ...opts.series.flatMap((s) => s.values));
  const tickStep = niceStep(peak * 1.05);
  const ticks = Math.ceil((peak * 1.02) / tickStep);
  const maxVal = tickStep * ticks;
  const x = (i: number): number => M.l + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number): number => M.t + plotH - (v / maxVal) * plotH;

  const root = h('div', { class: 'chart' });
  const legend = h(
    'div',
    { class: 'chart-legend' },
    opts.series.map((s) =>
      h('span', { class: 'legend-item' }, h('i', { class: s.muted ? 'swatch muted' : 'swatch', style: `background:${s.color}` }), s.label),
    ),
  );
  if (opts.series.length > 1) root.append(legend);

  const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.caption, class: 'chart-svg' });
  const defs = svg('defs');
  const clipId = `clip-${Math.random().toString(36).slice(2, 8)}`;
  const clipRect = svg('rect', { x: 0, y: 0, width: W, height: H, class: 'clip-reveal' });
  defs.append(svg('clipPath', { id: clipId }, clipRect));
  el.append(defs);

  // grid + y axis
  const grid = svg('g', { class: 'grid' });
  for (let i = 0; i <= ticks; i++) {
    const v = tickStep * i;
    const yy = y(v);
    grid.append(svg('line', { x1: M.l, x2: W - M.r, y1: yy, y2: yy, class: i === 0 ? 'axis' : 'gridline' }));
    const t = svg('text', { x: M.l - 8, y: yy + 4, 'text-anchor': 'end', class: 'tick' });
    t.textContent = String(Math.round(v * 10) / 10);
    grid.append(t);
  }
  // x ticks
  const maxTicks = 8;
  const step = Math.max(1, Math.ceil(n / maxTicks));
  for (let i = 0; i < n; i += step) {
    const t = svg('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'tick' });
    t.textContent = opts.xLabel(i);
    grid.append(t);
  }
  el.append(grid);

  // series, drawn muted-first so the main line sits on top
  const plot = svg('g', { 'clip-path': `url(#${clipId})` });
  const ordered = [...opts.series].sort((a, b) => Number(!!b.muted) - Number(!!a.muted));
  for (const s of ordered) {
    if (s.values.length === 0) continue;
    const points = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    plot.append(
      svg('path', {
        d: points,
        fill: 'none',
        stroke: s.color,
        'stroke-width': s.width ?? (s.muted ? 1.5 : 2),
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
        opacity: s.muted ? 0.55 : 1,
      }),
    );
    if (s.dots || s.values.length === 1) {
      s.values.forEach((v, i) => {
        plot.append(svg('circle', { cx: x(i), cy: y(v), r: 3, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }));
      });
    }
  }
  const first = opts.series[0];
  if (opts.errorAt && first) {
    for (const [i] of opts.errorAt) {
      const v = first.values[i];
      if (v === undefined) continue;
      const cx = x(i);
      const cy = y(v);
      plot.append(
        svg('path', {
          d: `M${cx - 4} ${cy - 4}l8 8m0 -8l-8 8`,
          stroke: 'var(--err)',
          'stroke-width': 2,
          'stroke-linecap': 'round',
          fill: 'none',
        }),
      );
    }
  }
  el.append(plot);

  // hover layer
  const cross = svg('line', { class: 'crosshair', y1: M.t, y2: M.t + plotH, x1: 0, x2: 0, opacity: 0 });
  const focusDots = opts.series.map((s) =>
    svg('circle', { r: 4.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2, opacity: 0 }),
  );
  const hit = svg('rect', { x: M.l, y: M.t, width: plotW, height: plotH, fill: 'transparent', class: 'hit' });
  el.append(cross, ...focusDots, hit);

  const tooltip = h('div', { class: 'chart-tip', role: 'presentation', hidden: true });
  const show = (clientX: number): void => {
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - M.l) / plotW) * (n - 1))));
    const cx = x(i);
    cross.setAttribute('x1', String(cx));
    cross.setAttribute('x2', String(cx));
    cross.setAttribute('opacity', '1');
    opts.series.forEach((s, k) => {
      const v = s.values[i];
      const dot = focusDots[k] as SVGElement;
      if (v === undefined) return dot.setAttribute('opacity', '0');
      dot.setAttribute('cx', String(cx));
      dot.setAttribute('cy', String(y(v)));
      dot.setAttribute('opacity', '1');
    });
    tooltip.hidden = false;
    tooltip.replaceChildren(
      h('strong', {}, opts.xLabel(i)),
      ...opts.series.map((s) =>
        h(
          'span',
          { class: 'tip-row' },
          h('i', { class: 'swatch', style: `background:${s.color}` }),
          `${s.label}: `,
          h('b', {}, s.values[i] === undefined ? '–' : `${Math.round((s.values[i] as number) * 10) / 10} ${opts.unit}`),
        ),
      ),
      ...(opts.note?.(i) ? [h('span', { class: 'tip-note' }, opts.note(i) as string)] : []),
    );
    const frac = cx / W;
    tooltip.style.left = `${frac * 100}%`;
    tooltip.classList.toggle('flip', frac > 0.6);
  };
  const hide = (): void => {
    tooltip.hidden = true;
    cross.setAttribute('opacity', '0');
    focusDots.forEach((d) => d.setAttribute('opacity', '0'));
  };
  hit.addEventListener('pointermove', (e) => show((e as PointerEvent).clientX));
  hit.addEventListener('pointerleave', hide);

  const wrap = h('div', { class: 'chart-wrap' }, el, tooltip);
  root.append(wrap);

  // data table for assistive tech
  root.append(
    h(
      'table',
      { class: 'sr-only' },
      h('caption', {}, opts.caption),
      h('thead', {}, h('tr', {}, h('th', {}, opts.xTitle ?? ''), opts.series.map((s) => h('th', {}, `${s.label} (${opts.unit})`)))),
      h(
        'tbody',
        {},
        Array.from({ length: n }, (_, i) =>
          h('tr', {}, h('td', {}, opts.xLabel(i)), opts.series.map((s) => h('td', {}, String(Math.round((s.values[i] ?? 0) * 10) / 10)))),
        ),
      ),
    ),
  );

  if (!reducedMotion()) {
    queueMicrotask(() => {
      clipRect.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
        duration: 1300,
        easing: 'cubic-bezier(.22,1,.36,1)',
        fill: 'backwards',
      });
    });
  }
  return root;
}
