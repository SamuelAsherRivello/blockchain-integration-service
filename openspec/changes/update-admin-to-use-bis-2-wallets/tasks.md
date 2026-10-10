# Tasks

## 1. Establish the shared two-wallet scope

- [x] 1.1 Trace and document the Admin/Runtime composition boundary for one Player context and one Game Wallet controller, then add a focused characterization test proving A.G.1, A.G.2, and A.G.3 receive the same controller and player session.
- [x] 1.2 Add a neutral current-wallet scope/readiness projection containing Player profile, Game profile, active network, and Game Wallet selection or generation identity; verify the projection contains no recovery material or Arkade-specific types.
- [x] 1.3 Revalidate the captured scope on Player Wallet, Game Wallet, network, and controller-generation changes; verify stale reads, quotes, and submissions are rejected or cancelled and already-submitted records retain their original scope.

## 2. Normalize Admin operation availability

- [x] 2.1 Route A.G.3 boarding, Continue payment, marketplace, contract, and related Game Wallet Admin checks through the current shared wallet scope and active-network policy; verify distinct roles and same-network requirements are enforced before signing or submission.
- [x] 2.2 Map wallet-read, provider-read, network-mismatch, role-conflict, insufficient-funds, unresolved-operation, pending, confirmed, and stale-scope outcomes to stable safe availability categories; verify unsupported or unknown conditions never submit or fabricate a balance.
- [x] 2.3 Ensure settled transient unavailable results are cleared or invalidated so a later explicit attempt rechecks fresh state; verify a recovered provider/balance read can re-enable the matching operation without logout or storage reset.
- [x] 2.4 Add focused controller and operation tests for reservations, role changes, network changes, pending recovery, retry exhaustion, and independent funds; verify existing wallet-operation and game-wallet suites remain green.

## 3. Improve A.G.3 Admin presentation and diagnostics

- [x] 3.1 Update A.G.3 status and Details output to distinguish loading, known zero, wallet-read failure, provider/live-evidence failure, insufficient eligible funds, unresolved operation, pending boarding, confirmed boarding, and ready states; verify the console and controls remain public-data-only.
- [x] 3.2 Preserve Details access when boarding submission is blocked, clear stale waiting state after evidence failure or wallet change, and retain explicit quote/confirmation boundaries; verify component tests cover each state and no unavailable read becomes `0` or `Boarded`.
- [x] 3.3 Add or update Admin browser fixtures for Runtime-selected Player/Game Wallets, cross-surface synchronization, same-origin assumptions, retry recovery, and representative left-side operations; verify no recovery phrase appears in DOM, logs, or diagnostic output.

## 4. Integrated verification and acceptance

- [x] 4.1 Run focused integration-admin and integration tests plus repository typecheck and build; verify failures are resolved without weakening wallet isolation, durable recovery, or game-facing API boundaries.
- [x] 4.2 Perform live Signet verification with two distinct public wallet identities on the same network: log in through Runtime Preview, confirm Admin observes both wallets, record public status and addresses, and exercise supported Admin operations with real provider evidence.
- [x] 4.3 Record live acceptance evidence under the repository output policy without secrets, and verify the final change status/spec validation passes while unrelated working-tree edits remain untouched.
