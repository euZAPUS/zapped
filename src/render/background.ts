import { KEYS, readString } from '../storage/local';
import type { Settings } from '../settings/schema';
import { byId, clear, h } from '../ui/dom';

/** Resolves the configured image into a CSS-safe URL, or null. */
function imageUrl(s: Settings): string | null {
  const src = s.bgImage === 'local' ? readString(KEYS.bgImage) : s.bgImage;
  if (!src) return null;
  return /^(https?:\/\/|data:image\/)/i.test(src) ? src : null;
}

export function applyBackground(s: Settings): void {
  const el = byId('bg');
  clear(el);
  el.dataset.kind = s.background;
  el.style.setProperty('--bg-dim', String(s.bgDim));
  el.style.setProperty('--bg-blur', `${s.bgBlur}px`);
  if (s.bgColorA) el.style.setProperty('--bg-a', s.bgColorA);
  else el.style.removeProperty('--bg-a');
  if (s.bgColorB) el.style.setProperty('--bg-b', s.bgColorB);
  else el.style.removeProperty('--bg-b');

  switch (s.background) {
    case 'aurora':
      el.append(h('i', { class: 'blob' }), h('i', { class: 'blob' }), h('i', { class: 'blob' }));
      break;
    case 'grid':
    case 'dots':
      el.append(h('i', { class: 'pattern' }));
      break;
    case 'image': {
      const url = imageUrl(s);
      if (url) {
        const photo = h('i', { class: 'photo' });
        photo.style.backgroundImage = `url(${JSON.stringify(url)})`;
        el.append(photo);
      }
      break;
    }
    default:
      break;
  }
}
