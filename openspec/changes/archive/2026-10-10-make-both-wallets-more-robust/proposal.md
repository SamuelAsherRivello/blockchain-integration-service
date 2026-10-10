# Proposal

## Why

Player Wallet balance reads are generally reliable, while the independently selected Game Wallet frequently reports that its reads are unavailable. Both wallets ultimately use Arkade-backed balance and address discovery, but their lifecycle, retry, and live-observation paths are not equivalent: the Player path retries bounded reads, while the Game Wallet can become unavailable after one transient read or subscription failure. This change makes both wallet roles resilient to transient provider/indexer failures without fabricating balances or weakening wallet-role and network isolation.

## What Changes

- Give Player Wallet and Game Wallet balance/address reads one consistent bounded retry and cancellation policy.
- Make transient Game Wallet read failures recoverable through controlled retry/backoff rather than immediately losing the selected wallet identity.
- Keep known zero distinct from loading, unavailable, stale, or provider-disconnected state.
- Prevent a failed Game Wallet live subscription from unnecessarily erasing a valid fresh balance; retain truthfulness and trigger bounded recovery reads instead.
- Preserve separate wallet identities, network matching, encrypted Game Wallet storage, role-conflict checks, and late-result invalidation.
- Add focused unit and browser-level coverage for transient Arkade/provider failures, retry exhaustion, recovery, wallet switching, network changes, logout, and live-observation failure.
- Add diagnostics sufficient to distinguish storage, address, balance, network, indexer, and live-subscription failure classes without logging recovery phrases or other secrets.
- Keep the public `IBis`/`BisSnapshot` contract provider-neutral; no Arkade-specific types or wallet secrets become game-facing state.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-balance`: make Player Wallet balance and address reads use the shared resilient read policy while retaining fresh-read, no-stale-fallback, bounded-deadline, and unavailable-state guarantees.
- `admin-game-wallet`: make independent Game Wallet reads and live balance observation recoverable and diagnosable while retaining role, network, storage, and public-details boundaries.

## Impact

- BIS state and Arkade adapter code under `BIS/packages/integration/src/client/state-layer-core` and `BIS/packages/integration/src/client/wallet-layer-arkade`.
- Admin and embedded Game Wallet presentation/read-status handling under `BIS/packages/integration-admin` and `BIS/packages/integration/src/client/ui-layer-react`.
- Existing wallet and provider failure tests, plus targeted browser acceptance for both wallet roles.
- The separately vendored game package may require a coordinated BIS package refresh so the game executes the resilient implementation; exact release/publish scope remains an implementation-phase decision.
- No new server, persistence format, wallet-role semantics, or Arkade SDK dependency is proposed.
