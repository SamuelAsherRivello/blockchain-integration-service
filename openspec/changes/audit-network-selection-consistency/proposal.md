## Why

The partial Signet/Mutinynet rollout correctly routes several account reads, but the Admin/BIS audit found transaction, event, contract, recovery, persistence, and presentation paths that still hard-code Signet. A wallet selected on Mutinynet can therefore be read or mutated through the wrong operator, or have its local operation state mixed with Signet state.

## What Changes

- Complete a source-wide network-routing audit for production Admin and BIS paths, replacing fixed Signet provider, indexer, explorer, address-validation, and display assumptions with the active account/session network.
- Make every durable operation record, reservation, mutation lock, recovery lookup, event subscription, and contract/LTO scope network-aware, so data from one test network cannot authorize or appear in the other.
- Require a matching active Player/Game Wallet network at every operation boundary, including delayed event and reconciliation callbacks; preserve the current safe failure behavior when network evidence is unavailable or mismatched.
- Replace stale Signet-only UI/help/error wording with the current selected network while preserving existing legacy-Signet migration rules and never exposing wallet secrets.
- Add focused tests that enumerate each production adapter and prove both Signet and Mutinynet use only their configured routes; retain a broader regression suite for Admin/UI composition.

## Capabilities

### New Capabilities

- `network-routing-consistency`: Complete, auditable network propagation and isolation for every Admin and BIS wallet operation after network selection.

### Modified Capabilities

- `account-entry`: Display the selected test network consistently instead of fixed Signet wording on production account forms.
- `account-boarding-settlement`: Route boarding, withdrawal, reconciliation, and recovery through the active account network and isolate their local operation state.
- `account-assets`: Present selected-network asset validation/errors and preserve isolation for asset delivery, burn, and mint operation state.
- `asset-api`: Require selected-network provider routing and network-scoped mint/list operation coordination.
- `admin-game-wallet`: Route Game Wallet event observation and Admin diagnostics through the selected Player/Game Wallet network.
- `limited-time-offers`: Bind LTO contract creation, recovery, locking, and filtering to the shared active test network.

## Impact

- Arkade adapters: `boarding.ts`, `sending.ts`, `funding.ts`, `game-wallet-events.ts`, `reservation-recovery.ts`, `assets.ts`, and LTO contract code.
- Core lifecycle/persistence: operation journals, reservation and contract locks, recovery stores, LTO filtering, and account/game-wallet callback guards.
- Presentation: account/admin network labels and sanitized validation/error text.
- Verification: adapter, controller, storage, browser-host, TypeScript, and relevant full-suite checks. No new dependency, server, mainnet support, wallet-secret exposure, or automatic funding is introduced.
