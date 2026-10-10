# Integration package

[Back to the main README](../../../README.md)

`@bis/integration` is the reusable BIS library for browser games. It owns Account UI, state, wallet operations, and contracts for Admin, Marketplace, and external hosts. Gameplay stays in the host; SDK types and recovery material stay private.

## Responsibilities and public API

Start with `src/index.ts`: `IBis` defines commands, `BisService` coordinates services, and `IBisGame` supplies five callbacks including `onBisEvent`. Import `@bis/integration/style.css`. Wallet creation, restoration, and selection remain explicit.

Game commands expose copied, readonly `BisSnapshot` projections and named payloads, not controllers or wallet internals. Game payloads use `BisGame` names; system payloads use `Bis` names. The [typechecked boundary example](tests/fixtures/game-contract-types.ts) rejects missing callbacks, private members, and mutable snapshots. Admin and Marketplace retain supported lower-level exports without creating alternative game channels.

`state-layer-core` owns lifecycle, persistence, and operations; `ui-layer-react` owns components; `wallet-layer-arkade` adapts providers. Demo composition belongs in consuming packages.

The shared `wallet-layer-arkade/shared-wallet-service.ts` provides settlement. Wallet adapters own browser storage, roles, locks, and presentation; the faucet injects server persistence and mutation ownership. Completion requires verified Arkade balance and transaction evidence. Quotes and registrations cannot establish spendability. Operator failures remain unavailable.

## Authoritative item metadata

Minted items share one raw metadata envelope. Native fields identify the asset; BIS fields identify its game record. `bisDescription` is presentation text, never gameplay authority. `bisAttributeDeltas` alone grants gameplay effects: each delta is a signed integer percentage, and a missing `bisAttributeDelta` normalizes to `0`. Trophies provide an empty delta array.

Family, tier, catalog identity, price, and description support display and validation only. Games must reject malformed, duplicate, unknown, or out-of-range deltas instead of inferring effects. See the [equipment definitions and metadata builder](src/client/state-layer-core/equipment.ts) for complete item shapes.

## Accounts, caching, and operations

Remembered accounts use encrypted, origin-scoped browser storage. Refresh and disposal retain committed access. Compromised same-origin code can still access browser secrets; never log recovery phrases or put them in public state, telemetry, or reports. Logout/reset confirmations preserve unresolved-operation guards; clearing local access cannot cancel submitted transactions or erase remote holdings.

After activation and initial rendering, BIS warms balance and addresses, then Transactions and passive Contracts. Assets require inventory demand or a current-session visit. BIS owns role/profile/network-scoped inventory snapshots, reuse, and invalidation. Marketplace owns view state and classification counts. Onboarding and Game Wallet retain their workers.

One speculative job runs at a time; foreground work takes priority. Page entry joins compatible reads without restarting deadlines or retries. Leaving detaches presentation. Balance and addresses settle independently; Details requires both. History reuses the observer without awaiting its lifetime.

Successful complete snapshots, including empty collections, stay fresh for five minutes. Lifecycle changes and new evidence invalidate them; identical observations never renew timestamps. Refresh bypasses completed values but may join live work. Failed, partial, and obsolete results are excluded. No TTL refill, snapshot persistence, or cross-context sharing occurs.

Mint readiness requires fresh provider evidence, eligible unreserved inputs, valid metadata, and durable recovery storage. Pre-submission failures expose retryable reasons such as `reserved-inputs`. Uncertain submissions retain their operation ID as `outcome-unknown` for reconciliation. Diagnostics exclude SDK errors, keys, recovery phrases, and private transaction payloads.

Continue hosts await `controller.readyAsync()` before checking `canPay`; it joins current eligibility work, including superseding balance evidence. Preparing is distinct from verified unavailable and submitted pending. Account, network, recipient, or session replacement abandons an unsubmitted gesture. Game Wallet refreshes publish only current reads, including conflict diagnostics; obsolete completions cannot overwrite a newer selection.

Modal pages retain their first-frame construction gate. Details stays interactive with placeholders and spinning Refresh while dependencies are pending. Background failures are silent. Quotes, spending, equipment selection, contract actions, recovery, and reconciliation retain their authoritative checks and explicit boundaries.

## Development and verification

Run `npm run dev` from the repository root. `/integration/` renders this README; `/admin/` and `/marketplace/` exercise consuming applications on the shared server, normally port `5174`. They share account storage on that origin; the onboarding spike uses separate storage. Wallets from older ports are not migrated automatically.

Run `npm run typecheck`, `npm run build`, and `npm test` from the root. Keep fixtures isolated from funded accounts and record live acceptance separately. See [Deep Dive Details](../../documentation/deep-dive-details.md) and the [host-game smoke checks](../../documentation/SMOKE_TEST_BIS_TO_GAME.md) for boundaries and verification limits.
