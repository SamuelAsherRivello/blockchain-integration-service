import type { BisContext } from './context';
import type { BisContinueRequest, BisContinueResult } from './continuation';

/** Demo price, owned by BIS. Client-side pricing is not trusted enforcement. */
export function getContinuePriceSats(): number { return 1000; }
export type BisGameContinueState = Readonly<{
  sats: number; status: 'idle' | 'pending' | 'succeeded' | 'failed'; canPay: boolean; message: string;
}>;
export type BisGameContinueOptions = Readonly<{
  context: string; onSuccess: (result: BisContinueResult) => void;
}>;

/** One controller per defeat. Disposal abandons delivery, never cancels a payment. */
export function createBisContinue(context: BisContext, options: BisGameContinueOptions) {
  if (!options.context?.trim()) throw Error('A continuation context is required.');
  let disposed = false, checking = false, delivered = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: BisContinueRequest | undefined, profileId: string | undefined;
  let status: BisGameContinueState['status'] = 'idle', message = '';
  const listeners = new Set<() => void>();
  const loggedIn = () => {
    const state = context.getState();
    return state.hasProfile && state.phase === 'active' && Boolean(state.profileId);
  };
  const getState = (): BisGameContinueState => Object.freeze({
    sats: getContinuePriceSats(), status, message,
    canPay: !disposed && loggedIn() && (status === 'idle' || status === 'failed'),
  });
  const publish = () => { if (!disposed) for (const listener of listeners) listener(); };
  const unsubscribe = context.subscribe(publish);
  const schedule = () => {
    clearTimeout(timer);
    if (!disposed && status === 'pending') timer = setTimeout(() => { void check(); }, 3000);
  };
  function accept(result: BisContinueResult) {
    if (disposed || !request || delivered) return;
    if (result.operationId !== request.operationId || result.context !== request.context
      || result.profileId !== profileId || result.sats !== request.sats) {
      message = 'Payment is still being checked.'; publish(); schedule(); return;
    }
    status = result.status;
    message = status === 'pending' ? 'Payment is still processing…'
      : status === 'failed' ? 'Payment failed. No continue was granted. You can try again or restart.' : '';
    if (status === 'succeeded') {
      delivered = true;
      clearTimeout(timer);
      const sameAccount = loggedIn() && context.getState().profileId === profileId;
      if (!sameAccount) message = 'Payment succeeded for the original account. Restart to begin a new session.';
      publish();
      context.showToast(`User paid ${result.sats} sats to continue`, {icon: 'lightning'});
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
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    check,
    async pay() {
      if (!getState().canPay) return;
      profileId = context.getState().profileId;
      request = Object.freeze({operationId: crypto.randomUUID(), sats: getContinuePriceSats(), context: options.context});
      status = 'pending'; message = 'Payment is processing…'; publish();
      let result: BisContinueResult | undefined;
      try { result = await context.requestContinue(request); }
      catch {
        // Reacquire B1's status lock before declaring a thrown call unsubmitted.
        // A recorded or unreadable attempt remains subject to reconciliation.
        try {
          if (context.getState().profileId !== profileId) { schedule(); return; }
          const records = await context.getContinueStatus(request.operationId);
          result = records.find(item => item.operationId === request!.operationId);
          if (!result && !disposed) {
            status = 'failed'; message = 'Payment could not be submitted. Check your account and funds, then try again or restart.'; publish();
          }
        } catch { schedule(); }
      }
      if (result) accept(result);
    },
    dispose() { disposed = true; clearTimeout(timer); unsubscribe(); listeners.clear(); },
  };
}
