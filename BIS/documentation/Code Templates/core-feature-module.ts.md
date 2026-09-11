# Core TypeScript feature module

## Purpose

Own one BIS workflow family and its state transitions. Keep network/provider details behind the existing Arkade adapter boundary.

## Allowed dependencies

- Peer core contracts, validators, and storage abstractions.
- Explicit Arkade adapters only when this feature owns that translation.
- No React imports and no game imports.

## Template

```ts
export type FeatureState = Readonly<{ status: 'idle' | 'loading' | 'ready' | 'error'; message?: string }>;

export function createFeature(dependencies: FeatureDependencies) {
  let disposed = false;
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = () => { if (!disposed) listeners.forEach(listener => listener()); };

  async function refresh() {
    const current = ++generation;
    try { /* validate, perform one owned operation, then publish */ }
    catch { if (!disposed && current === generation) { /* publish typed safe failure */ } }
  }

  return { getState, subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }, refresh,
    dispose() { disposed = true; generation++; listeners.clear(); } };
}
```

## Lifecycle and errors

Document who owns timers, observers, aborts, storage records, and cleanup. A stale or disposed result must not publish. Treat an uncertain wallet submission as recoverable state, never as a failed payment.

## Verification

Add a focused Node test beside the existing feature tests, then run `npm test` and `npm run typecheck`.
