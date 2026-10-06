import { desktop, type UpdateStatus } from './desktop';
import { updates } from './update-store';
import { h } from '../ui/dom';

function describe(s: UpdateStatus): string {
  switch (s.state) {
    case 'checking':
      return 'Buscando actualizaciones…';
    case 'available':
    case 'downloading':
      return `Descargando la versión ${s.version ?? ''}${s.percent !== undefined ? ` · ${s.percent}%` : ''}`;
    case 'downloaded':
      return `La versión ${s.version ?? ''} está lista. Se instalará al reiniciar.`;
    case 'none':
      return 'Tienes la última versión.';
    case 'error':
      return `No se pudo comprobar: ${s.message ?? 'error desconocido'}`;
    case 'dev':
      return s.message ?? '';
    default:
      return '';
  }
}

/** "Acerca de": version, and (desktop only) the manual update check. */
export function buildAboutSection(): HTMLElement {
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const kids: (HTMLElement | null)[] = [
    h('p', {}, h('strong', {}, desktop ? 'zapper-aio' : 'zapped'), ` · versión ${desktop?.version || __APP_VERSION__}`, h('span', { class: 'muted' }, desktop ? ` · escritorio (${desktop.platform})` : ' · web')),
  ];
  if (desktop) {
    const bridge = desktop;
    const check = h('button', { class: 'btn small', type: 'button' }, 'Buscar actualizaciones');
    check.addEventListener('click', () => void bridge.checkForUpdates());
    const install = h('button', { class: 'btn small primary', type: 'button', hidden: true }, 'Reiniciar e instalar');
    install.addEventListener('click', () => bridge.installUpdate());
    const render = (s: UpdateStatus): void => {
      status.textContent = describe(s);
      status.dataset.kind = s.state === 'error' ? 'error' : s.state === 'none' || s.state === 'downloaded' ? 'ok' : '';
      check.disabled = s.state === 'checking' || s.state === 'downloading';
      install.hidden = s.state !== 'downloaded';
    };
    updates.subscribe(render);
    render(updates.status);
    kids.push(
      h('div', { class: 'row' }, check, install),
      h('p', { class: 'muted small' }, 'Al abrir la app busca sola; si hay versión nueva la descarga, se instala y se reinicia sin preguntar.'),
      status,
    );
  } else {
    kids.push(h('p', { class: 'muted small' }, 'La web se actualiza sola al recargar. Si prefieres una app de escritorio con instalador, mira la sección de Releases del repositorio.'));
  }
  return h('div', { class: 'data-section' }, ...kids.filter((k): k is HTMLElement => k !== null));
}
