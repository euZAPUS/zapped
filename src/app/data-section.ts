import { GistError } from '../sync/gist';
import { downloadExport, importFromFile } from '../sync/portable';
import { sync } from '../sync/sync-manager';
import { history } from '../stats/history';
import { switchControl, row } from '../ui/controls';
import { h } from '../ui/dom';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=zapped';

function formatTime(ms: number | null): string {
  if (!ms) return 'nunca';
  return new Date(ms).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

/** "Datos y nube": local export/import plus the optional gist sync. */
export function buildDataSection(): HTMLElement {
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const say = (text: string, kind: 'ok' | 'error' | '' = ''): void => {
    status.textContent = text;
    status.dataset.kind = kind;
  };

  // --- sync card
  const card = h('div', { class: 'sync-card' });
  const tokenInput = h('input', {
    type: 'password',
    autocomplete: 'off',
    spellcheck: false,
    placeholder: 'ghp_… o github_pat_…',
    'aria-label': 'Token de GitHub con permiso gist',
  });
  const connect = h('button', { class: 'btn primary', type: 'button' }, 'Conectar');
  connect.addEventListener('click', async () => {
    connect.disabled = true;
    say('Conectando…');
    try {
      await sync.connect(tokenInput.value);
      tokenInput.value = '';
      say('Conectado. Tus datos se están sincronizando.', 'ok');
    } catch (err) {
      say(err instanceof GistError ? err.message : 'No se pudo conectar.', 'error');
    } finally {
      connect.disabled = false;
    }
  });

  const renderCard = (): void => {
    card.replaceChildren();
    if (!sync.connected) {
      card.append(
        h(
          'p',
          { class: 'muted small' },
          'Guarda tus ajustes e historial en un gist secreto de tu cuenta para usarlos en otro dispositivo. Crea un token que tenga ',
          h('strong', {}, 'solo el permiso «gist»'),
          ': ',
          h('a', { href: TOKEN_URL, target: '_blank', rel: 'noopener noreferrer' }, 'abrir la página de GitHub ya preparada'),
          '. El token se guarda únicamente en este navegador.',
        ),
        h('div', { class: 'row grow' }, tokenInput, connect),
      );
      return;
    }
    const auto = switchControl(sync.auto, (on) => sync.setAuto(on), 'auto-sync-label');
    const now = h('button', { class: 'btn small', type: 'button' }, 'Sincronizar ahora');
    now.addEventListener('click', async () => {
      now.disabled = true;
      try {
        await sync.syncNow();
        say('Sincronizado.', 'ok');
      } catch (err) {
        say(err instanceof GistError ? err.message : 'No se pudo sincronizar.', 'error');
      } finally {
        now.disabled = false;
      }
    });
    const off = h('button', { class: 'btn small danger', type: 'button' }, 'Desconectar');
    off.addEventListener('click', () => {
      if (!confirm('Se borrará el token de este navegador. Tus datos locales y el gist se conservan. ¿Continuar?')) return;
      sync.disconnect();
      say('Desconectado. El token se ha eliminado de este navegador.', 'ok');
    });
    card.append(
      h('p', {}, 'Conectado como ', h('strong', {}, `@${sync.login ?? 'usuario'}`), ' · gist secreto'),
      h('p', { class: 'muted small' }, `Última sincronización: ${formatTime(sync.lastSyncAt)}`),
      row('Sincronizar automáticamente', auto.el, 'Tras cada test y al abrir la app', 'auto-sync-label'),
      h('div', { class: 'row' }, now, off),
    );
  };
  renderCard();
  sync.subscribe(() => {
    renderCard();
    if (sync.state === 'error') say(sync.message, 'error');
  });

  // --- export / import
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      const { added } = await importFromFile(f);
      say(`Importado: ${added} ${added === 1 ? 'test nuevo' : 'tests nuevos'} y ajustes aplicados.`, 'ok');
    } catch (err) {
      say(err instanceof Error ? err.message : 'No se pudo importar.', 'error');
    }
  });
  const exportBtn = h('button', { class: 'btn small', type: 'button', onclick: () => (downloadExport(), say('Exportación descargada.', 'ok')) }, 'Exportar JSON');
  const importBtn = h('button', { class: 'btn small', type: 'button', onclick: () => file.click() }, 'Importar JSON');
  const clearBtn = h(
    'button',
    {
      class: 'btn small danger',
      type: 'button',
      onclick: () => {
        const extra = sync.connected ? ' También se borrará de la nube en la próxima sincronización.' : '';
        if (!confirm(`¿Borrar todo el historial de tests?${extra} Esta acción no se puede deshacer.`)) return;
        history.clear();
        say('Historial borrado.', 'ok');
      },
    },
    'Borrar historial',
  );

  return h(
    'div',
    { class: 'data-section' },
    card,
    h('div', { class: 'row' }, exportBtn, importBtn, clearBtn, file),
    h('p', { class: 'muted small' }, 'Al importar, el historial se fusiona con el actual sin duplicados.'),
    status,
  );
}
