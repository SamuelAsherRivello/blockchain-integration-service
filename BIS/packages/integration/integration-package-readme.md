# Integration package

[Back to the main README](../../../README.md)

`@bis/integration` is the reusable BIS library for browser games. It owns Account UI, wallet state, payments, assets, and contracts for Admin, Marketplace, and external hosts. Gameplay stays in the host. SDK identities, signing sessions, and recovery material stay private.

## Public API and ownership

Start with `src/index.ts`. `IBis` defines commands, `BisService` owns the integration lifecycle, and `IBisGame` supplies host callbacks and receives `onBisEvent`. Import `@bis/integration/style.css`. The [boundary example](tests/fixtures/game-contract-types.ts) checks required callbacks, private access, and immutable snapshots.

Core state owns persistence and operation rules; React components own presentation; Arkade adapters own SDK access. Consuming packages compose the library through public exports. The shared wallet service also provides settlement to the faucet, which supplies server persistence and mutation ownership.

## Local and Server

The network determines the workflow. Mutinynet uses Local, choosing browser-held Game authority before any BIS server probe or remembered-server lookup. Signet uses Server. Player signing remains in the browser; Game signing uses BIS Server. This release has no user-facing mode toggle or Signet Local fallback.

The upper-left Account header shows Local or Server before network and BIS version. Server health appears separately. An outage keeps Server selected and offers Retry. Local create, restore, and login remain explicit. Both workflows require real Arkade and Bitcoin providers.

Readonly snapshots expose `account.workflowMode` and Game server/readiness status. Existing wallet source identifiers `manual` and `server` remain in the API. Pending operations preserve their original network, profiles, signing source, and recovery.

## Assets and equipment

Minted items share one metadata envelope. Native fields identify the asset; BIS fields identify its game record. `bisDescription` is presentation text. Only `bisAttributeDeltas` grants gameplay effects; each delta is a signed integer percentage. A missing legacy `bisAttributeDelta` normalizes to zero. Trophies have no attribute deltas.

Games reject malformed, duplicate, unknown, or out-of-range effects. Family, tier, catalog identity, price, and description support display and validation. See the [equipment definitions](src/client/state-layer-core/equipment.ts) for all nine items and prices.

BIS assets carry `bisAssetFormatVersion: "0.0.1"`. Complete unmarked legacy envelopes are recognized; generic holdings remain visible without gaining BIS eligibility. Browsing never upgrades an asset. An explicit Admin upgrade delivers a verified replacement before retiring its predecessor. Pending work cannot authorize a duplicate replacement.

## Operations and recovery

Accounts use encrypted, origin-scoped browser storage. Same-origin code can access it, so phrases, keys, and private payloads must never enter logs or public snapshots. Each app privately owns a lazy Player SDK wallet and an optional Game wallet. Navigation reuses them; identity/network replacement retires them. Uncertain cleanup reserves affected signing authority.

Display snapshots stay fresh for five minutes. New evidence invalidates them; identical observations do not renew timestamps. Refresh bypasses completed values but may join compatible live work. Failed, partial, and obsolete reads cannot replace authoritative results. Balance, addresses, history, and ownership retain separate readiness checks.

Mutations require eligible unreserved inputs and durable journals. Continue hosts await readiness and use the actual 1,000-sat price. Preparing, pending, confirmed, and unknown remain distinct. Quotes and signatures do not prove settlement. Uncertain submissions retain their original operation and block competing spends.

New Treasure offers use Browser validation on both networks. Browser expiry and payout rules can be bypassed by a modified client. The existing Contracts indicator describes network compatibility separately from login readiness. Existing stronger-mode contracts retain their artifact and recovery; stronger new offers are unavailable.

## Development and verification

Run `npm run dev` at the repository root. `/integration/` renders this README; `/admin/` and `/marketplace/` exercise the library on shared port `5174`. They share origin-scoped accounts. Older-port wallets are not migrated automatically.

Run `npm run typecheck`, `npm run build`, and `npm test`. Record funded acceptance separately from deterministic checks. See [Deep Dive Details](../../documentation/deep-dive-details.md) and [host-game smoke checks](../../documentation/SMOKE_TEST_BIS_TO_GAME.md).
