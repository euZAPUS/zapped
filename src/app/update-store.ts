import { desktop, type UpdateStatus } from './desktop';

type Listener = (status: UpdateStatus) => void;

/** Keeps the latest update status coming from the desktop shell. */
class UpdateStore {
  status: UpdateStatus = { state: 'idle' };
  private listeners = new Set<Listener>();

  constructor() {
    if (!desktop) return;
    desktop.onUpdateStatus((s) => this.set(s));
    // the shell may have started checking before this page finished loading
    void desktop.lastUpdateStatus().then((s) => {
      if (this.status.state === 'idle') this.set(s);
    });
  }

  private set(status: UpdateStatus): void {
    this.status = status;
    for (const fn of this.listeners) fn(status);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const updates = new UpdateStore();
