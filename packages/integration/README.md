# Integration package

Production UI and state, consumed only through public exports. `src/core` owns lifecycle and state; `src/ui` owns components and all light production styling; `src/arkade` is reserved for future SDK operations.

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
adminContext.resetClient(); // transient state only; never clears storage
// Host cleanup before replacement:
unsubscribe();
ui.unmount();
context.dispose();
```

The demo rebuilds all handles after reset, clears selection, and leaves runtime content empty. `getState()` returns an immutable snapshot; `subscribe()` returns cleanup. `closeAccount()` restores the prior presentation. Mounting twice in the same container is idempotent; unmount before changing containers. Calling actions on a disposed context throws. `GameOverlay` remains a compatibility wrapper around the same UI.

The Account chooser works without wallet initialization. Create/Restore remain disabled. Active-profile routing is tested internally; the live A4 menu is not implemented. No public profile setters or SDK types are exposed. No account data is persisted by this slice.

Run core tests from the repository root: `node --test packages/integration/tests/context.test.mjs` (Node 24+). A plain-host browser fixture is available at the demo's `/tests/ui-host.html` during development.


