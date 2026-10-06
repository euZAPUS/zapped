// Small toolkit for a deterministic, time-driven animation: every frame is a pure function of t.

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const mix = (a, b, t) => a + (b - a) * t;

export const E = {
  linear: (t) => t,
  out2: (t) => 1 - (1 - t) ** 2,
  out3: (t) => 1 - (1 - t) ** 3,
  out4: (t) => 1 - (1 - t) ** 4,
  out5: (t) => 1 - (1 - t) ** 5,
  inOut2: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inOut3: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  expoOut: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  in3: (t) => t ** 3,
  back: (t, s = 1.4) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
};

export function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function $(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const set = (el, props) => Object.assign(el.style, props);

/** Visibility ramp for a scene layer: fades in at `a`, out at `b`. */
export function window01(t, a, b, fin = 0.4, fout = 0.4) {
  return E.out2(seg(t, a, a + fin)) * (1 - E.out2(seg(t, b - fout, b)));
}

/**
 * Headline with per-word mask reveal. `lines` is an array of arrays of {t, cls}.
 * update(t, tin, tout) positions every word from absolute time.
 */
export function makeHeadline(lines, className = 'h1') {
  const el = $(`<div class="${className}"></div>`);
  const words = [];
  lines.forEach((line) => {
    const row = $('<div class="hl"></div>');
    line.forEach((w) => {
      const outer = $(`<span class="w"><span class="wi ${w.cls ?? ''}">${w.t}</span></span>`);
      row.append(outer, document.createTextNode(' '));
      words.push(outer.firstElementChild);
    });
    el.append(row);
  });
  return {
    el,
    update(t, tin, tout = Infinity, stagger = 0.075) {
      words.forEach((w, i) => {
        const p = E.out4(seg(t, tin + i * stagger, tin + i * stagger + 0.8));
        const q = E.in3(seg(t, tout + i * 0.02, tout + i * 0.02 + 0.45));
        set(w, {
          opacity: String(p * (1 - q)),
          transform: `translate3d(0, ${(1 - p) * 0.95 - q * 0.3}em, 0)`,
          filter: `blur(${(1 - p) * 14 + q * 12}px)`,
        });
      });
    },
  };
}

export const BOLT_PATH = 'M13.5 2 4 14h6.5L9 22l11-13h-7z';
export const BOLT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${BOLT_PATH}" fill="currentColor"/></svg>`;
