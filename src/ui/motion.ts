import { settings } from '../settings/store';

const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');

/** True when animations should be skipped: OS preference, unless the user overrides it. */
export function reducedMotion(): boolean {
  const pref = settings.get().motion;
  if (pref === 'reduced') return true;
  if (pref === 'full') return false;
  return query?.matches ?? false;
}
