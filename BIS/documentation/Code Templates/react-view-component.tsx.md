# React/TSX view component

## Purpose

Present one BIS view model and route user intent to a public controller action. The component does not own wallet state or provider calls.

## Allowed dependencies

- React, a typed BIS context/controller, and private presentation primitives.
- No Arkade SDK import, direct browser persistence, or game-specific policy.

## Template

```tsx
export function FeatureView({ controller }: { controller: FeatureController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  useEffect(() => () => controller.dispose(), [controller]);
  return <section aria-busy={state.status === 'loading'}>{/* render state and explicit actions */}</section>;
}
```

## Lifecycle and errors

Use effects only for view lifecycle. Keep unmount cleanup explicit; never translate a closed view into cancellation of a submitted wallet operation. Render truthful pending and recovery guidance supplied by the controller.

## Verification

Add or update an isolated UI fixture and run its focused Node/browser test plus `npm run typecheck`.
