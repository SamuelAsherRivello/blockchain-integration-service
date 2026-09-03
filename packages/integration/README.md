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

The Account chooser enables Create Account and Restore Account. A3 uses twelve numbered word inputs, initially masked with one asterisk per character, with one Show checkbox and explicit Paste from Clipboard. Word-list and checksum validation gate Restore; successful Signet connection and durable saving return directly to Account. `openRestoreAccount()` opens entry when logged out; recovery submission stays inside the private production UI/Core boundary. Creation uses the real Signet SDK with memory repositories; Continue commits encrypted identity to origin-scoped IndexedDB. Refresh before Continue forgets unfinished creation. The active A4 Account menu shows Account Details, Log Out, and Back. Account Details shows identity/network and available/total balances with Refresh and Back to Account; A6 is implemented with manual storage verification pending. `ready()` awaits hydration, `createAccount()` and `continueAccount()` drive creation, and `onEvent()` exposes safe `accountConnected` and `accountDisconnected` payloads. Public state never contains the phrase or SDK types. Ordinary disposal preserves saved identity. Browser storage is test-only, automatically accessible to this origin, and does not protect against compromised same-origin code. Live deletion-based reset verification remains manual under the repository rules.

The active Account action opens the A6 backup confirmation. `openLogoutConfirmation()` starts it with an unchecked acknowledgement; `setLogoutBackupAcknowledged(boolean)` controls the gate; `confirmLogout()` performs guarded local logout; `cancelLogout()` returns to Account. `retry()` retries a failed logout after reconciling persisted state. Busy logout cannot be cancelled. Success retains the open logged-out dialogue and emits `accountDisconnected` with the former public `profileId`; other live contexts reconcile the same transition. Logout does not expose the recovery phrase, require connectivity, or clear Admin selection. Game-specific run eligibility remains the host's responsibility.

Run core tests from the repository root: `node --test packages/integration/tests/*.test.mjs` (Node 24+). A real-storage plain-host browser fixture is available at `/tests/ui-host.html`. `/tests/logout-host.html` and its `?plain` mode provide explicitly isolated storage-double component checks; they are not part of the production demo. See `documentation/A6_VERIFICATION.md` for pending manual real-storage checks.

A4 exposes provider-neutral `state.balance` (idle/loading/ready/unavailable) and `refreshBalance()`. It requests fresh data on Account Details entry or Refresh, clears amounts while loading or unavailable, and never persists balances. Network failure preserves account access. Closing, changing accounts, and disposal invalidate results. No timer drives UI refresh. See `documentation/A4_VERIFICATION.md`; funded Signet verification remains pending.

`openAccountDetails()` navigates from the active Account menu. `state.accountDetails` distinguishes the two dialogs. `closeAccount()` returns from Details to Account before leaving to the host. The Account menu never requests balances.
