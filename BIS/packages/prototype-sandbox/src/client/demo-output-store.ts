import type { DemoExplorerTarget } from './demo-explorer.ts';

export type OutputDetails = Readonly<{ explorer?: DemoExplorerTarget; recoverable?: boolean; vaultId?: string; creatorPublicKey?: string }>;
type Result = Readonly<{ output: string; elapsedMs: number | null; details: OutputDetails }>;
const empty: Result = Object.freeze({ output: '', elapsedMs: null, details: Object.freeze({}) });

export function createDemoOutputStore() {
  const results = new Map<string, Result>();
  const listeners = new Set<() => void>();
  const snapshot = (scope: string) => results.get(scope) ?? empty;
  function update(scope: string, patch: Partial<Result>) {
    results.set(scope, Object.freeze({ ...snapshot(scope), ...patch }));
    for (const listener of listeners) listener();
  }
  return {
    snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    // Only a user-started execution may erase a result. Setters, effects,
    // disposal callbacks and async completions cannot clear it accidentally.
    beginExecution(scope: string) { update(scope, empty); },
    write(scope: string, output: string, details: OutputDetails = {}) {
      if (typeof output !== 'string' || !output.trim()) return;
      update(scope, { output, details });
    },
    setElapsedMs(scope: string, elapsedMs: number | null) { update(scope, { elapsedMs }); },
  };
}
