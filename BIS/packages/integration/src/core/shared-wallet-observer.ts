import type { watchActivity } from '../arkade/activity.ts';
import type { AccountSecret } from '../arkade/account.ts';
import type { BisTransaction } from './activity.ts';

/** One live source, shared by the account lifetime and foreground consumers. */
export function createSharedWalletObserver(source: typeof watchActivity) {
  type Listener = { publish: (rows: readonly BisTransaction[]) => void; end: (error?: unknown) => void };
  const listeners = new Set<Listener>();
  let account: AccountSecret | undefined;
  let operation: AbortController | undefined;
  let snapshot: readonly BisTransaction[] | undefined;
  function stop() { operation?.abort(); operation = undefined; snapshot = undefined; }
  function start() {
    if (!account || !listeners.size) return;
    stop();
    const current = operation = new AbortController();
    void Promise.resolve().then(() => {
      if (current.signal.aborted) return;
      return source(account!, current.signal, rows => {
        if (current !== operation || current.signal.aborted) return;
        snapshot = rows;
        for (const listener of [...listeners]) {
          if (listeners.has(listener)) {
            try { listener.publish(rows); } catch (error) { listener.end(error); }
          }
        }
      });
    }).then(() => ended(new Error('Wallet observation ended.')), ended);
    function ended(error: unknown) {
      if (current !== operation) return;
      stop();
      for (const listener of [...listeners]) listener.end(error);
    }
  }
  const observe: typeof watchActivity = (nextAccount, signal, publish) => {
    if (signal.aborted) return Promise.resolve();
    if (account && account.profileId !== nextAccount.profileId) {
      stop();
      for (const listener of [...listeners]) listener.end(new Error('Wallet changed.'));
    }
    account = nextAccount;
    return new Promise<void>((resolve, reject) => {
      const listener: Listener = {publish, end(error) {
        signal.removeEventListener('abort', abort);
        listeners.delete(listener);
        if (!listeners.size) { stop(); account = undefined; }
        if (error) reject(error); else resolve();
      }};
      const abort = () => listener.end();
      listeners.add(listener);
      signal.addEventListener('abort', abort, {once:true});
      if (!operation) start();
      else if (snapshot) {
        try {publish(snapshot);} catch(error) {listener.end(error);}
      }
    });
  };
  return {observe, refresh: start};
}
