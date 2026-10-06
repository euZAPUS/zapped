import { applyBackground } from '../render/background';
import { THEMES, type Settings } from '../settings/schema';
import { settings } from '../settings/store';
import { byId } from '../ui/dom';

function onAccent(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.4 ? '#0b0b12' : '#ffffff';
}

/** Mirrors visual settings onto the document: theme, fonts, accent, motion, background. */
export function mountAppearance(inner: HTMLElement): void {
  const root = document.documentElement;
  const glow = byId('glow');

  const apply = (s: Settings): void => {
    root.dataset.theme = s.theme;
    root.dataset.font = s.font;
    root.dataset.motion = s.motion;
    root.style.setProperty('--fs', `${s.fontSize}px`);
    if (s.accent) {
      root.style.setProperty('--accent', s.accent);
      root.style.setProperty('--on-accent', onAccent(s.accent));
    } else {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--on-accent');
    }
    root.classList.toggle('dim-ui', s.dimUi);
    glow.hidden = !s.glow;
    inner.dataset.caret = s.caret;
    inner.classList.toggle('smooth', s.smoothCaret);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      getComputedStyle(root).getPropertyValue('--bg').trim() || THEMES[0]?.swatch[0] || '#0c0d1f',
    );
  };

  settings.subscribe((s, changed) => {
    apply(s);
    if (changed.some((k) => k.startsWith('bg') || k === 'background')) applyBackground(s);
  });
  apply(settings.get());
  applyBackground(settings.get());
}
