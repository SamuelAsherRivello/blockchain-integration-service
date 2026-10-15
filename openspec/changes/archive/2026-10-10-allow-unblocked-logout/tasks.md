# Tasks

## 1. Logout confirmation behavior

- [x] 1.1 Update the Account Log Out copy to the concise recovery-phrase reminder and render only applicable backup, pending-operation, and separate Game Wallet warnings; verify the zero/one/two/three-warning UI states in the focused React/client tests.
- [x] 1.2 Remove acknowledgement state from the final Log Out button's disabled condition while retaining controlled checkbox interaction and reset-on-open behavior; verify an unchecked final action submits exactly once.

## 2. Player logout orchestration

- [x] 2.1 Change `confirmLogout` so warning acknowledgements, pending-count snapshots, and separate Game Wallet reset availability cannot reject Player logout; verify logout still targets the original profile and reports obsolete-profile protection.
- [x] 2.2 Preserve successful completion, failure, restart-request, cache invalidation, and one-time disconnection-event behavior after the new non-blocking path; verify the existing context/logout tests and add coverage for warning-discovery failure.

## 3. Storage cleanup and coordination

- [x] 3.1 Remove Player logout's hard rejection for changed or unresolved pending-operation snapshots while preserving profile-scoped cleanup, other-profile retention, remote-operation non-cancellation, and Admin Reset guards; verify account-storage tests for pending and multi-profile cases.
- [x] 3.2 Make normal logout lock contention wait for the exclusive browser mutation lock rather than fail with an unavailable-lock error, while retaining an explicit unsupported-browser failure; verify concurrent cleanup tests and read-back integrity.
- [x] 3.3 Keep separate Game Wallet records independent from Player logout and ensure cache/read-coordinator invalidation occurs after confirmed Player removal; verify Game Wallet preservation and stale-context tests.

## 4. Documentation and integration verification

- [x] 4.1 Update the user-facing logout flow documentation and OpenSpec-linked acceptance notes to describe optional warnings and unconditional Player logout; verify no documentation still claims acknowledgement gates for Player logout.
- [x] 4.2 Run focused logout/storage tests, package typecheck/build, `openspec validate allow-unblocked-logout --type change --strict`, and the relevant browser smoke checks; record any unrelated pre-existing failures without changing their scope.
