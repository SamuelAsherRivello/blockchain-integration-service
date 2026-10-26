# Integration package

[Back to the main README](../../../README.md)

`@bis/integration` is the reusable BIS library for browser games. It owns Account UI, state, wallet operations, and contracts for Admin, Marketplace, and external hosts. Gameplay stays in the host; SDK types and recovery material stay private.

## Responsibilities and public API

Start with `src/index.ts`: `IBis` defines commands, `BisService` coordinates services, and `IBisGame` supplies five callbacks including `onBisEvent`. Game-wallet snapshots report signing source (`manual` or `server`) when known; an omitted source remains unknown. Import `@bis/integration/style.css`. Wallet creation, restoration, and selection remain explicit.

Game commands expose readonly `BisSnapshot` copies. The [boundary example](tests/fixtures/game-contract-types.ts) rejects missing callbacks, private access, and mutable snapshots. Admin and Marketplace retain supported lower-level exports.

`state-layer-core` owns lifecycle, persistence, and operations; `ui-layer-react` owns components; `wallet-layer-arkade` adapts providers. Demo composition belongs in consuming packages.

The shared `wallet-layer-arkade/shared-wallet-service.ts` provides settlement. Wallet adapters own browser storage, roles, locks, and presentation; the faucet injects server persistence and mutation ownership. Completion requires verified Arkade balance and transaction evidence. Quotes and registrations cannot establish spendability. Operator failures remain unavailable.

## Authoritative item metadata

Minted items share one raw metadata envelope. Native fields identify the asset; BIS fields identify its game record. `bisDescription` is presentation text, never gameplay authority. `bisAttributeDeltas` alone grants gameplay effects: each delta is a signed integer percentage, and a missing `bisAttributeDelta` normalizes to `0`. Trophies provide an empty delta array.

Family, tier, catalog identity, price, and description support display and validation only. Games must reject malformed, duplicate, unknown, or out-of-range deltas instead of inferring effects. See the [equipment definitions and metadata builder](src/client/state-layer-core/equipment.ts) for complete item shapes.

## Asset-format versioning

New BIS-managed assets carry `bisAssetFormatVersion: "0.0.1"`. The library also recognizes a complete unmarked legacy `0.0.1` envelope, but generic/external holdings remain visible without being promoted to BIS items. Games and Marketplace consume only the latest registered format; malformed or future markers cannot grant gameplay effects or marketplace eligibility.

When a future format is introduced, it must declare a deterministic predecessor mapping and whether Admin automatic upgrade is enabled (the default); an explicit opt-out is required when a predecessor must remain unchanged. Upgrade is never triggered by browsing: the Admin operator runs Upgrade all player items with an active Game Wallet and logged-in Player Wallet. Each source holding receives a replacement first; only then may the prior holding retire. Pending delivery or retirement remains recoverable and never authorizes a duplicate replacement.

## Accounts, caching, and operations

Remembered accounts use encrypted, origin-scoped storage. Compromised same-origin code can access secrets; never log recovery phrases or put them in public state or reports. Logout remains available without settlement waits; risk checkboxes are informational acknowledgements. Deliberate logout clears local recovery records, not remote holdings or transactions. Admin Reset retains its separate guards.

Each app privately owns one lazy Player SDK wallet and one optional Game wallet. Reads, observers, and authorized operations reuse them; automatic settlement is disabled. Navigation never disposes them. Identity/network replacement retires resources; uncertain cleanup quarantines replacement signing without blocking local logout. Complete live ownership reads remain separate from five-minute display caches and network/operator/asset-scoped immutable metadata. Standalone CLI adapters retain independent bounded lifetimes.

One speculative job runs at a time; foreground work takes priority. Page entry joins compatible reads without restarting deadlines or retries. Leaving detaches presentation. Balance and addresses settle independently; Details requires both. History reuses the observer without awaiting its lifetime.

Successful snapshots, including empty collections, stay fresh for five minutes. Lifecycle changes and new evidence invalidate them; identical observations never renew timestamps. Refresh bypasses completed values but may join live work. Failed, partial, and obsolete results are excluded. No TTL refill, snapshot persistence, or cross-context sharing occurs.

Mint readiness requires fresh provider evidence, eligible unreserved inputs, valid metadata, and durable recovery storage. Pre-submission failures expose retryable reasons such as `reserved-inputs`. Uncertain submissions retain their operation ID as `outcome-unknown` for reconciliation. Diagnostics exclude SDK errors, keys, recovery phrases, and private transaction payloads.

Continue hosts await `controller.readyAsync()` before checking `canPay`. Preparing, unavailable, and submitted pending remain distinct. Identity, network, recipient, or session replacement abandons unsubmitted gestures. Obsolete Game Wallet completions cannot overwrite a newer selection; status-only publications do not restart its reads.

Modal pages retain first-frame construction gates. Details shows placeholders and spinning Refresh while pending. Background failures stay silent. Mutations, recovery, and reconciliation retain authoritative checks.

## Development and verification

Run `npm run dev` from the repository root. `/integration/` renders this README; `/admin/` and `/integration-marketplace/` exercise consuming applications on the shared server, normally port `5174`. They share account storage on that origin; the onboarding spike uses separate storage. Wallets from older ports are not migrated automatically.

Run `npm run typecheck`, `npm run build`, and `npm test` from the root. Keep fixtures isolated from funded accounts and record live acceptance separately. See [Deep Dive Details](../../documentation/deep-dive-details.md) and the [host-game smoke checks](../../documentation/SMOKE_TEST_BIS_TO_GAME.md) for boundaries and verification limits.
