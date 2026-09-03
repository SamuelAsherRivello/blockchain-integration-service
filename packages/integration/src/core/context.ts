export type BisState = Readonly<{ view: 'empty' | 'account-button' | 'account'; hasProfile: boolean }>;
export interface BisContext {
  getState(): BisState;
  subscribe(listener: () => void): () => void;
  openAccountDialog(): void;
  closeAccount(): void;
  dispose(): void;
}
export function accountDestination(hasProfile: boolean) {
  return hasProfile ? 'account-menu' : 'account-chooser';
}
type Controls = { present(): void; reset(): void; assertAlive(): void };
const controls = new WeakMap<BisContext, Controls>();
export function getControls(context: BisContext): Controls {
  const result = controls.get(context);
  if (!result) throw new Error('Expected a BIS context.');
  return result;
}
export function createBisContext(): BisContext {
  let state: BisState = Object.freeze({ view: 'empty', hasProfile: false });
  let previous: BisState['view'] = 'empty';
  let disposed = false;
  const listeners = new Set<() => void>();
  const assertAlive = () => { if (disposed) throw new Error('BIS context is disposed.'); };
  const setView = (view: BisState['view']) => {
    assertAlive();
    if (state.view === view) return;
    state = Object.freeze({ ...state, view });
    for (const listener of [...listeners]) if (listeners.has(listener)) listener();
  };
  const context: BisContext = {
    getState: () => state,
    subscribe(listener) { assertAlive(); listeners.add(listener); return () => { listeners.delete(listener); }; },
    openAccountDialog() {
      assertAlive();
      if (state.view === 'account') return;
      if (accountDestination(state.hasProfile) === 'account-menu') throw new Error('Account menu is not available yet.');
      previous = state.view;
      setView('account');
    },
    closeAccount() { assertAlive(); if (state.view === 'account') setView(previous); },
    dispose() { disposed = true; listeners.clear(); },
  };
  controls.set(context, {
    assertAlive,
    present() { assertAlive(); if (state.view !== 'account') setView('account-button'); },
    reset() { assertAlive(); previous = 'empty'; setView('empty'); },
  });
  return context;
}
export function createBisAdminContext(context: BisContext) {
  const internal = getControls(context);
  internal.assertAlive();
  return Object.freeze({ resetClient: () => internal.reset() });
}

