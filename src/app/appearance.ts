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

const root = document.documentElement;

/** Sets or clears a custom property depending on whether an override exists. */
function override(name: string, value: string | null): void {
  if (value) root.style.setProperty(name, value);
  else root.style.removeProperty(name);
}

let inner: HTMLElement | null = null;

function apply(s: Settings): void {
  root.dataset.theme = s.theme;
  root.dataset.font = s.font;
  root.dataset.motion = s.motion;
  root.style.setProperty('--fs', `${s.fontSize}px`);
  override('--accent', s.accent);
  override('--on-accent', s.accent ? onAccent(s.accent) : null);
  override('--fg', s.colorFg);
  override('--sub', s.colorSub);
  override('--err', s.colorErr);
  root.classList.toggle('dim-ui', s.dimUi);
  byId('glow').hidden = !s.glow;
  if (inner) {
    inner.dataset.caret = s.caret;
    inner.classList.toggle('smooth', s.smoothCaret);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    getComputedStyle(root).getPropertyValue('--bg').trim() || THEMES[0]?.swatch[0] || '#0c0d1f',
  );
}

/** Shows how a visual change would look without saving it (command palette hover). */
export function previewAppearance(patch: Partial<Settings>): void {
  apply({ ...settings.get(), ...patch });
  window.dispatchEvent(new Event('zapped:relayout'));
}

/** Drops any preview and goes back to the saved look. */
export function clearPreview(): void {
  apply(settings.get());
  window.dispatchEvent(new Event('zapped:relayout'));
}

/** Mirrors visual settings onto the document: theme, fonts, colours, motion, background. */
export function mountAppearance(textInner: HTMLElement): void {
  inner = textInner;
  settings.subscribe((s, changed) => {
    apply(s);
    if (changed.some((k) => k.startsWith('bg') || k === 'background')) applyBackground(s);
  });
  apply(settings.get());
  applyBackground(settings.get());
}
