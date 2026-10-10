# Proposal

## Why

The BIS Admin and Runtime Preview are intended to operate on one Player Wallet and one independently selected Game Wallet, but A.G.3 can currently collapse provider or live-boarding read failures into a generic `Status Unavailable` result. That makes it difficult to tell whether the shared two-wallet session is wired correctly and prevents operators from understanding why an otherwise logged-in wallet operation cannot proceed.

The change is needed now because the two-wallet composition already exists, while live verification and Admin feedback do not yet prove or explain the complete contract. The Admin should use the same current BIS wallet state as Runtime Preview and report operation-specific readiness without presenting unavailable data as a usable zero or as a generic failure.

## What Changes

- Make the Admin and Runtime Preview two-wallet contract explicit: one shared Player Wallet context and one shared Game Wallet controller per same-origin demo session.
- Ensure A.G.1, A.G.2, A.G.3, Continue payments, marketplace actions, contract actions, and related Admin controls read the current selected Player/Game Wallet identities and network rather than stale or independently recreated wallet state.
- Revalidate both wallet roles, active network, fresh public reads, durable reservations, pending mutations, and operation-specific provider capabilities before enabling or submitting an Admin wallet operation.
- Replace generic A.G.3 `Status Unavailable` feedback with truthful, safe diagnostics that distinguish wallet-read failure, provider/live-evidence failure, network mismatch, unresolved operation, insufficient eligible funds, and confirmed boarding state where the evidence supports it.
- Preserve wallet isolation, same-origin storage behavior, pending-operation recovery, secret-free public state, and the ability to use the Admin while Runtime Preview remains open or closed.
- Add focused controller, Admin, and browser-level verification for shared wallet identity, role/network changes, fresh-read recovery, and representative left-side operations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-game-wallet`: require A.G.1/A.G.2/A.G.3 to use the same selected Game Wallet and active Player Wallet session, and require operation-specific truthful availability and diagnostics.
- `wallet-operation-availability`: extend shared availability and reason reporting to Admin-controlled Game Wallet operations while preserving durable reservations, active-network isolation, and fresh evidence requirements.

## Impact

- Affected code: `BIS/packages/integration-admin` Admin composition and panels, `BIS/packages/integration` Game Wallet controller, boarding/readiness adapters, wallet-operation availability, and focused tests.
- Affected behavior: Admin controls and console diagnostics; no recovery phrase, wallet-storage format, or game-facing Arkade type exposure changes are intended.
- No custom server or signing service is introduced. Real Signet/Arkade provider behavior remains authoritative; tests may use isolated fakes but cannot claim live acceptance.
- Live acceptance must verify that a Player Wallet and distinct Game Wallet selected through Runtime Preview are observed by the Admin and that each supported Admin operation reports a specific truthful result.
