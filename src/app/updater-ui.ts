import { desktop, type UpdateStatus } from './desktop';
import { updates } from './update-store';
import { h, icon } from '../ui/dom';

/**
 * Update experience of the desktop app.
 * - Found at launch: a full-screen "Actualizando" card with progress, then the app restarts by itself.
 * - Found later while using the app: a quiet toast with "Reiniciar ahora".
 */
export function mountUpdaterUi(): void {
  if (!desktop) return;
  const bridge = desktop;

  const title = h('h2', {}, 'Actualizando zapper-aio');
  const detail = h('p', { class: 'muted' });
  const bar = h('i', {});
  const overlay = h(
    'div',
    { class: 'update-overlay', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'update-title', hidden: true },
    h(
      'div',
      { class: 'update-card' },
      icon('<svg class="update-bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 4 14h6.5L9 22l11-13h-7z" fill="currentColor"/></svg>'),
      title,
      detail,
      h('div', { class: 'update-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, bar),
    ),
  );
  title.id = 'update-title';

  const toastText = h('span', {});
  const toast = h(
    'div',
    { class: 'update-toast', role: 'status', hidden: true },
    toastText,
    h('button', { class: 'btn small primary', type: 'button', onclick: () => bridge.installUpdate() }, 'Reiniciar ahora'),
    h('button', { class: 'btn small', type: 'button', onclick: () => (toast.hidden = true) }, 'Luego'),
  );
  document.body.append(overlay, toast);

  const render = (s: UpdateStatus): void => {
    const blocking = s.auto === true && (s.state === 'available' || s.state === 'downloading' || s.state === 'downloaded');
    overlay.hidden = !blocking;
    if (blocking) {
      const v = s.version ? ` ${s.version}` : '';
      const pct = Math.max(0, Math.min(100, s.percent ?? (s.state === 'downloaded' ? 100 : 0)));
      bar.style.width = `${pct}%`;
      overlay.querySelector('.update-bar')?.setAttribute('aria-valuenow', String(pct));
      if (s.state === 'downloaded') {
        title.textContent = 'Reiniciando…';
        detail.textContent = `La versión${v} está lista. zapper-aio se reabrirá solo en un momento.`;
      } else {
        title.textContent = 'Actualizando zapper-aio';
        detail.textContent = s.state === 'available' ? `Nueva versión${v} encontrada…` : `Descargando la versión${v} · ${pct}%`;
      }
    }
    // an update found while the app was already in use never interrupts
    const quiet = s.state === 'downloaded' && !s.auto;
    toast.hidden = !quiet;
    if (quiet) toastText.textContent = `Hay una nueva versión${s.version ? ` (${s.version})` : ''} lista para instalar.`;
  };
  updates.subscribe(render);
  render(updates.status);
}
