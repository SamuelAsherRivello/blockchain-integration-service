# Tasks

## 1. Preserve network-scoped profiles through logout

- [x] 1.1 Change the Player Wallet logout storage mutation to clear only active-session selection while retaining the selected network's encrypted profile collection and profile-scoped records; verify account-storage tests assert the retained profile, absent active account, and advanced logout generation/receipt.
- [x] 1.2 Preserve logout locking, cross-context notification, stale-work invalidation, and host restart behavior for the logged-out session; verify context/logout tests cover concurrent contexts, obsolete confirmation, and disposed consumers.
- [x] 1.3 Keep explicit destructive reset/removal behavior separate from non-destructive logout; verify its existing cleanup coverage still proves it can clear local account material without changing the logout contract.

## 2. Restore retained profiles deliberately

- [x] 2.1 Route same-network restoration after logout through the existing saved-profile activation path without a Create New Account prompt or duplicate save; verify restoration tests cover create or restore, logout, same-phrase restore, and preserved profile-scoped state.
- [x] 2.2 Preserve the selected-network boundary after logout; verify tests prove the same phrase on a different network still requires first-local-profile confirmation and receives no copied state.

## 3. Verify the production flow

- [x] 3.1 Add or update UI/browser coverage for logged-out-after-reload behavior and for create → logout → same-network restore; verify no recovery phrase appears in public DOM, logs, or test artifacts.
- [ ] 3.2 Run the focused logout, account-storage, and restoration tests, then `npm run typecheck`, `npm test`, and `npm run build --workspace @bis/integration`; verify all commands succeed.
