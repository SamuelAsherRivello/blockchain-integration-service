import type { watchActivity } from '../wallet-layer-arkade/activity.ts';
import type { AccountSecret } from '../wallet-layer-arkade/account.ts';
import type { BisTransaction } from './activity.ts';

/** One live source, shared by the account lifetime and foreground consumers. */
export function createSharedWalletObserver(source: typeof watchActivity) {
  type Listener = { publish: (rows: readonly BisTransaction[]) => void; end: (error?: unknown) => void };
  const listeners = new Set<Listener>();
  let account: AccountSecret | undefined;
  let operation: AbortController | undefined;
  let snapshot: readonly BisTransaction[] | undefined;
  let fetchedAt = 0;
  let signature: string | undefined;
  function stop() { operation?.abort(); operation = undefined; snapshot = undefined; signature=undefined; }
  function start() {
    if (!account || !listeners.size) return;
    stop();
    const current = operation = new AbortController();
    void Promise.resolve().then(() => {
      if (current.signal.aborted) return;
      return source(account!, current.signal, rows => {
        if (current !== operation || current.signal.aborted) return;
        const nextSignature=JSON.stringify(rows);
        if (nextSignature!==signature) fetchedAt=Date.now();
        signature=nextSignature; snapshot = rows;
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
  /** Replay preserves its source timestamp; readiness is not the observer lifetime. */
  function first(nextAccount: AccountSecret, signal: AbortSignal) {
    return new Promise<{rows:readonly BisTransaction[];fetchedAt:number}>((resolve,reject)=>{
      const consumer=new AbortController();
      const abort=()=>{consumer.abort();reject(signal.reason);};
      if(signal.aborted){abort();return;}
      signal.addEventListener('abort',abort,{once:true});
      void observe(nextAccount,consumer.signal,rows=>{
        signal.removeEventListener('abort',abort);
        resolve({rows,fetchedAt});
        // Let the readiness continuation attach a page before releasing this
        // lease. Separate-source warmers otherwise stop after the first result.
        setTimeout(()=>consumer.abort(),0);
      }).catch(reject).finally(()=>signal.removeEventListener('abort',abort));
    });
  }
  return {observe, refresh: start, first, snapshot:()=>snapshot ? {rows:snapshot,fetchedAt}:undefined};
}
