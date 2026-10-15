# Tasks

## 1. Shared read resilience

- [x] 1.1 Extract or formalize the shared read-only retry/cancellation contract around the existing bounded read helper, including attempt deadlines, parent abort propagation, and retry exhaustion; verify existing `pending-read` tests and account-balance tests still pass.
- [x] 1.2 Add safe internal classification for storage, network mismatch, provider/indexer read, timeout, and observation failures without including recovery phrases, raw provider payloads, or SDK objects; verify failure messages and serialized public state contain no secret material.
- [x] 1.3 Update the Player Wallet balance/address projection to use the shared policy consistently for fresh reads and refresh cancellation; verify transient failure recovery, retry exhaustion, account replacement, and no-zero/no-stale fallback in focused tests.
- [x] 1.4 Update account-balance documentation or inline contract notes to describe the shared retry behavior and verify the documented bounded-read guarantees match the implementation and tests.

## 2. Game Wallet read and observation recovery

- [x] 2.1 Route Game Wallet address and balance inspection through the shared complete-projection retry policy, publishing only a validated same-wallet/same-network result; verify transient address failure, transient balance failure, partial failure, and retry exhaustion in `game-wallet` tests.
- [x] 2.2 Preserve selected Game Wallet identity and role/network protections while reads are unavailable or being retried; verify wallet switching, Player Wallet changes, network changes, logout, disposal, and late-result invalidation in focused tests.
- [x] 2.3 Change live Game Wallet subscription failure handling to attempt bounded recovery reads before clearing a previously validated balance, and ensure watcher/recovery cancellation on selection or logout; verify recovery success, recovery exhaustion, and no post-disposal publication.
- [x] 2.4 Update Admin and embedded Game Wallet status/details presentation to show sanitized read and observation categories while distinguishing loading, unavailable, and genuine zero; verify Admin console output contains only public wallet details and safe status text.
- [x] 2.5 Update `admin-game-wallet` implementation notes or package documentation for retry/recovery semantics and verify the documented behavior matches the focused Game Wallet tests.

## 3. Consumer and live verification

- [x] 3.1 Add or update integration-admin browser fixtures to exercise both Player Wallet and Game Wallet transient failure/recovery paths, including repeated Details/refresh actions; verify the UI never displays a different wallet's balance or substitutes zero.
- [x] 3.2 Run the BIS focused wallet, admin, and package type/build checks and record results under the repository's ignored `output/reports/` task directory; verify all required checks pass without secrets in generated artifacts.
- [x] 3.3 Compare the resulting BIS package against the game vendored archive and refresh the game package only if implementation scope authorizes it; verify package provenance/version and the game contract/type/build checks before claiming the game runtime consumes the fix. The new 0.0.18 artifact was verified in temporary generated `node_modules`; the tracked vendor archive was not replaced because this change did not authorize a release refresh.
- [x] 3.4 Perform a privacy-safe live Signet check, if the operator and test wallets are available, covering Player Wallet read, Game Wallet read, transient retry/recovery behavior, and unavailable exhaustion; verify no recovery phrase or private wallet data is recorded. No operator/test-wallet credentials were available, so no live wallet operation was attempted; deterministic checks and the package-consumer verification contain no wallet data.
- [x] 3.5 Run the relevant game integration/browser smoke checks against the actual consumed BIS package and report any remaining live Arkade limitation separately from deterministic test results; verify the game remains playable without wallet connectivity.
