# Integration package

Production UI and state, consumed only through public exports. `src/core` owns lifecycle and state; `src/ui` owns components and all light production styling; `src/arkade` owns real Signet SDK creation and identity reconstruction.

```javascript
import { createBisContext, createBisAdminContext, createBisUi } from '@bis/integration';
import '@bis/integration/style.css';
const context = createBisContext();
const ui = createBisUi(context);
ui.mount(container); // host-owned positioned element; initially empty
ui.showAccountButton();
// The rendered Account button invokes context.openAccountDialog().
const unsubscribe = context.subscribe(() => console.log(context.getState().view));
// Admin UI only:
const adminContext = createBisAdminContext(context);
await adminContext.resetClient(); // explicit first-run reset; removes BIS account storage
// Host cleanup before replacement:
unsubscribe();
ui.unmount();
context.dispose();
```

The demo rebuilds all handles after reset, clears selection, and leaves runtime content empty. `getState()` returns an immutable snapshot; `subscribe()` returns cleanup. `closeAccount()` restores the prior presentation. Mounting twice in the same container is idempotent; unmount before changing containers. Calling actions on a disposed context throws. `GameOverlay` remains a compatibility wrapper around the same UI.

The Account chooser enables Create Account and keeps Restore disabled. Creation uses the real Signet SDK with memory repositories; Continue commits encrypted identity to origin-scoped IndexedDB. Refresh before Continue forgets unfinished creation. The minimal active dialogue shows status, disabled Log Out, and Back; A4/A6 remain unimplemented. `ready()` awaits hydration, `createAccount()` and `continueAccount()` drive creation, and `onEvent()` exposes only a safe `accountConnected` payload. Public state never contains the phrase or SDK types. Ordinary disposal preserves saved identity. Browser storage is test-only, automatically accessible to this origin, and does not protect against compromised same-origin code. Live deletion-based reset verification remains manual under the repository rules.

Run core tests from the repository root: `node --test packages/integration/tests/context.test.mjs` (Node 24+). A plain-host browser fixture is available at the demo's `/tests/ui-host.html` during development.


