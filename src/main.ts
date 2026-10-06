import './fonts';
import './styles/index.css';
import { mountAppearance } from './app/appearance';
import { mountCustomDialog } from './app/custom-dialog';
import { bindKeyboard } from './app/keyboard';
import { currentRoute, mountRouter } from './app/router';
import { TestController } from './app/test-controller';
import { mountProfile } from './app/profile';
import { sync } from './sync/sync-manager';
import { mountDock } from './render/dock';
import { Effects } from './render/effects';
import { TextView } from './render/text-view';
import { mountSettings } from './settings/panel';
import { settings } from './settings/store';
import { byId } from './ui/dom';

const inner = byId('inner');
const capture = byId<HTMLTextAreaElement>('capture');
const wordsWrap = byId('words-wrap');

mountAppearance(inner);

const view = new TextView(byId('viewport'), inner);
const effects = new Effects(view, byId('glow'));
const customDialog = mountCustomDialog(() => controller.newTest());
const controller = new TestController({
  view,
  effects,
  hud: byId('live'),
  wordsWrap,
  resultEl: byId('result'),
  askCustomText: () => customDialog.open(),
});

let settingsModal: ReturnType<typeof mountSettings>;
const isDialogOpen = (): boolean => document.querySelector('dialog[open]') !== null;
const focusCapture = (): void => {
  if (currentRoute() === 'test' && !isDialogOpen() && controller.state !== 'finished') capture.focus({ preventScroll: true });
};

mountDock(byId('dock'), { editText: () => customDialog.open(), afterChange: focusCapture });

settingsModal = mountSettings({
  onProfile: () => (location.hash = '#/perfil'),
  onClose: () => requestAnimationFrame(focusCapture),
});
byId('btn-settings').addEventListener('click', () => settingsModal.open());

// Settings that change the text itself start a new test; the rest only restyle it.
const RESTART_KEYS = ['mode', 'time', 'words', 'language', 'accents', 'punctuation', 'numbers', 'customText', 'stopOnError'];
settings.subscribe((s, changed) => {
  if (changed.some((k) => RESTART_KEYS.includes(k))) controller.newTest();
  if (changed.includes('focusMode')) view.setFocusMode(s.focusMode);
  if (changed.some((k) => k === 'fontSize' || k === 'font' || k === 'caret')) view.relayout();
});

bindKeyboard({
  controller,
  capture,
  isTestView: () => currentRoute() === 'test',
  openSettings: () => settingsModal.open(),
  isDialogOpen,
});

// Focus handling: show a hint when the hidden input loses focus.
capture.addEventListener('focus', () => wordsWrap.classList.remove('unfocused'));
capture.addEventListener('blur', () => {
  if (!isDialogOpen() && controller.state !== 'finished') wordsWrap.classList.add('unfocused');
});
wordsWrap.addEventListener('pointerdown', () => window.setTimeout(focusCapture, 0));
byId('focus-hint').addEventListener('click', focusCapture);

// The interface fades while typing and comes back when the mouse moves.
let lastX = -1;
let lastY = -1;
window.addEventListener('pointermove', (e) => {
  if (Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) > 4) document.documentElement.classList.remove('typing');
  lastX = e.clientX;
  lastY = e.clientY;
});

const profile = mountProfile(byId('view-profile'), {
  onSettings: () => settingsModal.open(),
  onPlay: () => (location.hash = '#/'),
});

mountRouter((route) => {
  if (route === 'test') requestAnimationFrame(() => (focusCapture(), view.relayout()));
  else profile.render();
});

// Header chip showing the cloud sync state (only when a token is connected).
const syncChip = byId('btn-sync');
const renderSyncChip = (): void => {
  syncChip.hidden = !sync.connected;
  syncChip.dataset.state = sync.state;
  const label = sync.state === 'syncing' ? 'Sincronizando' : sync.state === 'error' ? 'Error de sync' : 'Nube';
  syncChip.replaceChildren(Object.assign(document.createElement('i'), { className: 'dot' }), label);
  syncChip.title = sync.message || 'Sincronización con gist';
};
syncChip.addEventListener('click', () => settingsModal.open());
sync.subscribe(renderSyncChip);
renderSyncChip();
sync.start();

controller.newTest();
focusCapture();
