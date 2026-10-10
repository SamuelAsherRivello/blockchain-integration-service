import type { BisContext } from './context';
import type { BisContinueRequest, BisContinueResult } from './continuation';
import { BoardingBlockedError } from './boarding-record.ts';
import { SendError } from './sending.ts';
import { readWithRetry } from './pending-read.ts';
export { networkLabel } from './test-network.ts';

/** Demo price, owned by BIS. Client-side pricing is not trusted enforcement. */
export function getContinuePriceSats(): number { return 1000; }
export type BisGameContinueState = Readonly<{
  sats: number; status: 'idle' | 'pending' | 'succeeded' | 'failed'; canPay: boolean; message: string;
  operationId?: string;
}>;
export type BisGameContinueOptions = Readonly<{
  context: string; onSuccess: (result: BisContinueResult) => void;
}>;

/** One controller per defeat. Disposal abandons delivery, never cancels a payment. */
export function createBisContinue(context: BisContext, options: BisGameContinueOptions) {
  if (!options.context?.trim()) throw Error('A continuation context is required.');
  let disposed = false, checking = false, delivered = false, availability: { canPay: boolean; reason?: string } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: BisContinueRequest | undefined, profileId: string | undefined;
  let status: BisGameContinueState['status'] = 'idle', message = '';
  const listeners = new Set<() => void>();
  const scopeKey = () => { const s=context.getState(); return JSON.stringify([s.profileId,s.phase,s.hasProfile,s.network,context.getContinueRecipient?.()]); };
  let scope=scopeKey(), epoch=0, preparedEpoch:number|undefined, paymentEpoch:number|undefined;
  let lifetime=new AbortController();
  const loggedIn = () => {
    const state = context.getState();
    return state.hasProfile && state.phase === 'active' && Boolean(state.profileId);
  };
  const getState = (): BisGameContinueState => Object.freeze({
    sats: getContinuePriceSats(), status, ...(request ? { operationId: request.operationId } : {}), message: message || availability?.reason || (context.getContinueRecipient && !context.getContinueRecipient() ? 'Game wallet recipient is not configured.' : ''),
    canPay: !disposed && (preparedEpoch===undefined || preparedEpoch===epoch) && scope===scopeKey() && (!context.getContinueRecipient || !!context.getContinueRecipient()) && loggedIn() && (status === 'idle' || status === 'failed') && (availability?.canPay ?? !context.getContinueAvailability),
  });
  const publish = () => { if (!disposed) for (const listener of listeners) listener(); };
  let availabilityRead = 0;
  let latest:Promise<void>|undefined, latestKey:string|undefined;
  let eligibilityOperation=new AbortController();
  const refreshAvailability = () => {
    if (disposed || !context.getContinueAvailability) return;
    const key=JSON.stringify([scopeKey(),context.getState().balance]);
    if(latest && key===latestKey)return;
    latestKey=key;
    eligibilityOperation.abort();eligibilityOperation=new AbortController();
    const read = ++availabilityRead;
    availability = undefined; publish();
    const signal=AbortSignal.any([lifetime.signal,eligibilityOperation.signal]);
    const task=(async()=>{
      try { const next = await readWithRetry(()=>context.getContinueAvailability!(),signal); if (!disposed && !signal.aborted && read === availabilityRead) availability = next; }
      catch { if (!disposed && !signal.aborted && read === availabilityRead) availability = { canPay: false, reason: 'Balance unavailable' }; }
      publish();
    })();
    latest=task;
    void task.finally(()=>{if(latest===task)latest=undefined;});
  };
  const unsubscribe = context.subscribe(() => {
    const next=scopeKey();
    if(next!==scope){scope=next;epoch++;lifetime.abort();lifetime=new AbortController();latest=undefined;availability=undefined;}
    refreshAvailability();publish();
  });
  refreshAvailability();
  async function readyAsync() {
    preparedEpoch=epoch;
    const expected=epoch;
    if(!latest && !availability)refreshAvailability();
    while(!disposed && expected===epoch && latest){const read=latest;await read;if(read===latest)break;}
  }
  const schedule = () => {
    clearTimeout(timer);
    if (!disposed && status === 'pending') timer = setTimeout(() => { void check(); }, 3000);
  };
  function accept(result: BisContinueResult) {
    if (disposed || !request || delivered) return;
    if (result.operationId !== request.operationId || result.context !== request.context
      || result.profileId !== profileId || result.sats !== request.sats || (request.recipient !== undefined && result.recipient !== request.recipient)) {
      message = `You sent ${getContinuePriceSats()} sats (Pending)`; publish(); schedule(); return;
    }
    status = result.status;
    message = status === 'pending' ? `You sent ${getContinuePriceSats()} sats (Pending)`
      : status === 'failed' ? `You could not send ${getContinuePriceSats()} sats (Failed)` : '';
    if (status === 'succeeded') {
      delivered = true;
      clearTimeout(timer);
      const sameAccount = loggedIn() && context.getState().profileId === profileId && paymentEpoch===epoch && scope===scopeKey();
      if (!sameAccount) message = 'Payment succeeded for the original account. Restart to begin a new session.';
      publish();
      if(sameAccount)context.showToast(`You sent ${result.sats} sats (Confirmed)`, {messageType: 'success'});
      if (sameAccount && !disposed) options.onSuccess(result);
      return;
    }
    publish(); schedule();
  }
  async function check() {
    if (disposed || checking || status !== 'pending' || !request) return;
    checking = true; clearTimeout(timer);
    let results: readonly BisContinueResult[] | undefined;
    try {
      if (context.getState().profileId === profileId) results = await context.getContinueStatus(request.operationId);
    } catch { /* A status read failure is not a payment failure. */ }
    finally { checking = false; }
    if (disposed) return;
    const result = results?.find(item => item.operationId === request!.operationId);
    if (result) accept(result); else schedule();
  }
  return {
    getState,
    /** Join current eligibility work; a replacement session requires a new gesture. */
    readyAsync,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    check,
    async pay() {
      if (!getState().canPay) return;
      paymentEpoch=epoch;
      profileId = context.getState().profileId;
      request = Object.freeze({operationId: crypto.randomUUID(), sats: getContinuePriceSats(), context: options.context, ...(context.getContinueRecipient?.() ? {recipient:context.getContinueRecipient()!} : {})});
      status = 'pending'; message = `You sent ${getContinuePriceSats()} sats (Pending)`; publish();
      let result: BisContinueResult | undefined;
      try { result = await context.requestContinue(request); }
      catch (error) {
        // Reacquire B.P.1's status lock before declaring a thrown call unsubmitted.
        // A recorded or unreadable attempt remains subject to reconciliation.
        try {
          if (context.getState().profileId !== profileId) { schedule(); return; }
          const records = await context.getContinueStatus(request.operationId);
          result = records.find(item => item.operationId === request!.operationId);
          if (!result && !disposed) {
            status = 'failed'; message = error instanceof BoardingBlockedError || error instanceof SendError
              ? error.message
              : `You could not send ${getContinuePriceSats()} sats (Failed)`; publish();
          }
        } catch { schedule(); }
      }
      if (result) accept(result);
    },
    dispose() { disposed = true; lifetime.abort(); clearTimeout(timer); unsubscribe(); listeners.clear(); },
  };
}

