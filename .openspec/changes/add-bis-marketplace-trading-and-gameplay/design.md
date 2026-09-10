## Context

See proposal.md for motivation and the delta specs for behavior. The current implementation has one encrypted player identity in `bis-account-signet-v1`, a separately retained Admin Game Wallet, generic mint/list/burn APIs, H1 batch issuance, and a public Marketplace catalog. H1 currently publishes browser-local catalog facts after minting; asset listing exposes only standard name, ticker, decimals, and icon metadata. Marketplace artwork still comes from a bundled artwork key. Burn recovery treats any pending burn as a wallet-wide spend blocker. The separate Stealth & Steel repository consumes a packaged `@bis/integration` artifact and must remain playable when BIS is unavailable.

The implementation uses `@arkade-os/sdk` 0.4.71 on Signet, browser-local storage, and no custom server. A registered game-wallet public address may be published, but recovery phrases, signing material, and private transaction data may not cross package or application boundaries.

## Goals / Non-Goals

**Goals:**

- Make the nine catalog assets self-describing on-chain and render their chain-provided URLs everywhere.
- Retain multiple encrypted player profiles and isolate selections and recovery journals by public profile ID.
- Provide a small Arkade-free equipment API for BIS UI, Marketplace, and Stealth & Steel.
- Enable Buy and Sell only if a recoverable atomic Arkade asset-for-sats exchange is proven on Signet.
- Leave the active Game Wallet owning the nine H1 items after final implementation verification.

**Non-Goals:**

- Hosted coordination, custody, player-to-player listings, compensation-based pseudo-atomic settlement, fees, or a buy/sell spread.
- Changing gameplay systems other than the three approved equipment effects and their UI.
- Treating an item name, ticker, local catalog record, or bundled artwork key as proof of item classification or ownership.

## Decisions

### Prove the atomic boundary before enabling trade

The first implementation task inspects the installed SDK 0.4.71 API and official Arkade material, then exercises the supported Signet path with two browser-local accounts. Acceptance requires one protocol operation whose contract prevents only the asset or only the sats leg from settling, plus durable pre-submission intent, exact input/term capture, a stable receipt identifier, and restart reconciliation. Sequential sends, UI locking, or a compensating refund do not qualify.

If that proof succeeds, `@bis/integration` owns an atomic trade adapter and journal while Marketplace consumes its JSON-safe results. If it does not, Marketplace exposes an explicit unavailable reason and never calls separate asset and sats sends. Login, public browsing, My Items, H1/H2, loadout, and game integration continue independently. This gate resolves feasibility without leaving an open design choice.

### Use one versioned chain metadata envelope

Generic mint requests gain optional JSON-safe metadata, passed through to Arkade issuance and returned by fresh ownership reads without assigning game semantics inside the generic asset layer. Stealth & Steel recognition requires this complete v1 string envelope in addition to the standard `icon` field:

- `bisSchemaVersion: "1"`
- `bisGameId: "stealth-and-steel"`
- `bisAssetType: "item"` or `"trophy"`
- `bisCatalogId`: stable item or trophy identity
- `bisEquipmentFamily`: `Shoes`, `Dagger`, or `Shield` for items
- `bisTier`: `1`, `2`, or `3`
- `bisPriceSats`: approved integer-sat string for items
- `icon`: immutable absolute HTTPS URL, surfaced publicly as `iconUrl`

The asset adapter preserves unknown metadata as untrusted JSON-safe values and validates the known envelope before an H1/C1 mutation. H1 uses new stable v2 operation IDs because existing v1 issuance records do not contain the full envelope. C1 achievement presets tag newly minted trophies with game, trophy type, stable trophy ID, tier, and icon metadata while generic user-entered assets remain valid without game fields.

### Publish immutable marketplace images beside C1 assets

Marketplace PNGs live under `BIS/packages/integration-demo/public/assets/marketplace/v1/` and H1 stores their absolute GitHub Pages URLs on-chain, following the existing C1 achievements pattern. Revised art uses a new version directory. BIS Assets, Marketplace cards/details, game Settings, and HUD all use the fresh asset's `iconUrl`; an unavailable URL may show a neutral missing-image state but never a different bundled item image.

The static `catalog.json` remains a public bootstrap containing the registered wallet and expected catalog IDs. Runtime availability, classification, price, and artwork come from fresh chain asset records matched by `bisCatalogId`, not from the bootstrap's display copy.

### Centralize recognition and approved item values

An Arkade-free catalog module in `packages/integration/src/core` owns the nine stable IDs, family/tier types, prices, and approved effects. It validates chain metadata and produces public `BisEquipmentItem` records. H1, H2, Account Assets, loadout, Marketplace, and game-facing output reuse this module so there is one price/effect contract and no asset-ID allowlist.

Prices are Shoes 1000/2000/3000, Dagger 1100/2100/3100, and Shield 1200/2200/3200 sats. Effect magnitudes are 10/20/30 percent by tier for Shoes movement, Dagger player damage, and Shield incoming-damage reduction.

### Migrate single-account storage to a profile collection non-destructively

IndexedDB advances to a collection-capable schema. Each profile keeps its own non-extractable encryption key and encrypted identity envelope keyed by public profile ID; a separate active-profile key may be absent. On first load, a valid legacy `identity` envelope is moved into the collection and selected without exposing or re-encrypting the phrase outside the existing private transaction. Invalid legacy state remains an error rather than being overwritten.

`save` adds or selects a profile without replacing others. `selectProfile` changes only the active pointer after verifying the stored envelope. Create and Restore make their committed profile active; restoring an existing ID deduplicates it. Logout removes only the active profile and its scoped browser preferences/journals after existing acknowledgements, clears the active pointer, requests the existing host restart, and does not automatically select a remaining profile. Admin Reset retains its broader existing contract.

Submitted operations remain keyed to their originating profile. Switching profiles aborts stale pre-submission work and refreshes the new profile, but it neither cancels nor reattributes submitted work.

### Store loadout choices by profile and revalidate effective state

Local storage uses a versioned `bis-signet-equipment-v1:<encoded profileId>` record containing at most one asset ID for Shoes, Dagger, and Shield. Absence means all slots are unselected. Reads first obtain a fresh complete asset list, classify items from chain metadata, remove selections no longer owned, and return both owned items and an effective loadout. An unavailable ownership read returns no effective bonuses while preserving baseline/guest gameplay.

The public context exposes JSON-safe Arkade-free read, select/clear, refresh, and subscription behavior. Account Assets can manage the same selections, and the game Settings Items page calls only this package boundary. Profile changes publish a loadout refresh without exposing recovery material.

### Snapshot gameplay effects at player spawn

The game adapter asynchronously reads BIS equipment without delaying game startup. Settings -> Items displays the active profile's freshly owned items and updates BIS selections. The gameplay spawner snapshots the effective loadout into plain numeric multipliers: movement and outgoing damage use `1 + tierPercent`, incoming damage uses `1 - tierPercent`. The snapshot remains fixed for that player life. HUD renders `Items: [][][]` below Gold in Shoes/Dagger/Shield order from the same snapshot.

### H1 and H2 are Game-Wallet-only batch orchestrators

H1 uses the current separate Game Wallet signer and stable per-item v2 operation IDs. It mints/reconciles each item, verifies a fresh list contains the exact asset and metadata, and publishes only verified public records. The final acceptance run invokes H1 through the real Admin so the active Game Wallet owns all nine items.

H2 starts from a fresh Game Wallet list, selects only complete Stealth & Steel item envelopes, and creates one durable burn operation per exact asset/quantity. An unknown burn reserves its asset and known transaction inputs. H2 continues with provably disjoint items and otherwise records the unsubmitted item for a later run. Re-running H2 reconciles unresolved records and never duplicates them. Batch progress disables only conflicting H2 actions; other Admin, Marketplace, Account, and game interaction remains available.

### Marketplace delegates both wallet roles to BIS

Marketplace mounts the production BIS Player Wallet account surface and Game Wallet Login surface instead of implementing phrase entry, persistence, switching, or logout. Anonymous inventory uses the registered address. A different logged-in Game Wallet becomes a clearly labelled session-only inventory/trade override. My Items uses the active player's fresh classified holdings.

When atomic trading is supported, Buy/Sell revalidate both active identities, distinctness, exact item ownership, approved price, balances, and the original terms before submitting the single atomic operation. Unknown outcomes retain the same operation ID and reconcile; they are never replayed as a new trade. When unsupported, the controls remain disabled with the proven reason.

### Package the public boundary before updating the game

BIS tests and builds first, then produces a version/hash-recorded `@bis/integration` tarball using the repository's existing packaging workflow. The game updates its vendored artifact and lockfile, imports only public package exports/styles, and adds no Arkade dependency or private BIS source alias. The game repository update is explicitly in scope; if the current execution sandbox cannot write it, that filesystem restriction is handled as an execution approval rather than narrowing the design.

## Risks / Trade-offs

- **SDK 0.4.71 may not expose atomic asset-for-sats exchange** -> record primary-source and executable evidence, keep trading visibly unavailable, and continue every independent milestone.
- **Older H1 items lack the metadata envelope** -> use v2 operation IDs and classify old incomplete assets as generic rather than mutating or burning them.
- **IndexedDB migration can strand a profile** -> perform one transactional additive migration, preserve legacy data until the new record and active pointer commit, and cover reload/cross-tab cases.
- **Untrusted icon URLs can fail or track requests** -> accept only credential-free HTTPS URLs, render an honest missing-image state, and never fetch them inside core listing code.
- **Unknown burns can share fee inputs** -> reserve complete known inputs; continue only when disjointness is proven and otherwise defer the affected item without freezing unrelated UI.
- **Fresh ownership reads can be unavailable** -> retain saved preference but expose no effective item or bonus until ownership is verified.
- **Two local signers are not a remote marketplace** -> label the flow as same-browser only and make no unattended or remote-service claim.
- **Concurrent Marketplace/CSS edits already exist** -> inspect and preserve them, merging only overlapping lines required by this change.

## Migration Plan

1. Add backward-compatible public types, metadata parsing, profile storage migration, and loadout records with focused tests.
2. Add H1/H2 and Marketplace behavior while Buy/Sell remains proof-gated.
3. Build and package BIS, update the separate game consumer, and verify guest behavior before equipment behavior.
4. Exercise H2 only before the final inventory setup if a live burn check is needed; finish by invoking H1 in Admin and freshly verifying all nine active-Game-Wallet holdings.
5. Roll back UI/package deployment without deleting chain assets or profile data. Older clients continue treating new metadata as optional; no destructive storage downgrade is attempted.
