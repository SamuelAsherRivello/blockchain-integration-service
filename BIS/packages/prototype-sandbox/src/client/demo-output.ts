import { createContext, useContext, useSyncExternalStore, type Context } from 'react';
import { createDemoOutputStore, type OutputDetails } from './demo-output-store.ts';

// Window memory survives component remounts and module hot updates, without
// localStorage/sessionStorage, IndexedDB, or saving output across a full reload.
const owner = globalThis as typeof globalThis & {
  __bisSandboxDemoOutputSession?: { store: ReturnType<typeof createDemoOutputStore>; scope: Context<string> };
};
const session = owner.__bisSandboxDemoOutputSession ??= { store: createDemoOutputStore(), scope: createContext('standalone') };
export const DemoOutputScope = session.scope;

export function useDemoOutput() {
  const scope = useContext(DemoOutputScope);
  const result = useSyncExternalStore(session.store.subscribe, () => session.store.snapshot(scope), () => session.store.snapshot(scope));
  return {
    ...result,
    scope,
    beginExecution: () => session.store.beginExecution(scope),
    setOutput: (output: string, details: OutputDetails = {}) => session.store.write(scope, output, details),
    setElapsedMs: (elapsedMs: number | null) => session.store.setElapsedMs(scope, elapsedMs),
  };
}
