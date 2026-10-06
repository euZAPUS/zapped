import { settings } from '../settings/store';
import { history } from '../stats/history';
import { mergeSnapshots, parseSnapshot } from '../sync/merge';
import { applySnapshot, buildSnapshot } from '../sync/portable';
import { desktop } from './desktop';

const WRITE_DELAY_MS = 2500;

/**
 * Desktop only: keeps a JSON copy of the user's data on disk next to
 * localStorage, and restores it if localStorage ever comes back empty
 * (cleared cache, moved profile, reinstalled system).
 */
export async function mountDesktopBackup(): Promise<void> {
  if (!desktop) return;
  const bridge = desktop;

  const empty = history.all().length === 0 && settings.get().updatedAt === 0;
  if (empty) {
    try {
      const raw = await bridge.readBackup();
      const saved = raw ? parseSnapshot(JSON.parse(raw)) : null;
      if (saved) applySnapshot(mergeSnapshots(buildSnapshot(), saved));
    } catch {
      /* a damaged backup must never stop the app from starting */
    }
  }

  let timer = 0;
  const schedule = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void bridge.writeBackup(JSON.stringify(buildSnapshot())).catch(() => undefined), WRITE_DELAY_MS);
  };
  history.subscribe(schedule);
  settings.subscribe(schedule);
  if (!empty) schedule();
}
