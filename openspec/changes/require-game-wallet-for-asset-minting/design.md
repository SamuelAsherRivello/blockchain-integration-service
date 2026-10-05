## Context

The repository already separates generic asset APIs, the Admin/Game Wallet, Player Wallet state, trophy reward composition, and Game Wallet-backed LTO/contract operations. The prior draft proposed the wrong global mint gate and is superseded by the clarified ownership model.

## Goals / Non-Goals

**Goals:**

- Add a small game-facing `hasItemSupport(): boolean` capability check based on active Player Wallet and BIS item-path availability only.
- Keep admin-minted game items separate from player trophy rewards.
- Preserve one-at-a-time trophy minting followed by immediate transfer to the Player Wallet.
- Leave existing Game Wallet gates for LTO, payments, refunds, and other Game Wallet-signed operations unchanged; they are outside this release slice.

**Non-Goals:**

- No global Game Wallet requirement for generic asset minting or item support.
- No change to Admin/Game Wallet item ownership or the Player Wallet trophy reward contract.
- No Stealth & Steel edits, server, custody, or new provider.

## Decisions

### Item support is Player Wallet-only

Expose `hasItemSupport()` from `BisGameServices` and the public integration API. It checks active Player Wallet state, supported network/environment, and the presence of the BIS item path. It does not call Game Wallet readiness or balance and does not mutate or reserve anything. A boolean is sufficient for the game’s enable/disable decision; item workflow errors remain authoritative at their operation boundaries.

### Trophy rewards use the existing separate transfer boundary

Do not retrofit `createBisAssetCollection` with a Game Wallet gate. The game reward path mints one trophy at a time through its intended issuer and immediately transfers it to the Player Wallet, preserving player-owned achievement semantics. Existing operation-ID and uncertain-result protections remain unchanged.

### Verification and release

Add focused fixture tests for no-Game-Wallet item support and Game Wallet-dependent contract support, update API documentation, run the existing package build/tests, and write a secret-free local tarball manifest under ignored `output/`. Stealth & Steel remains a downstream consumer and is not changed here.

## Risks / Trade-offs

- [Item support is confused with minting authorization] → document that game items are admin-minted and trophies use the separate reward/transfer flow.
- [A boolean preflight becomes stale] → keep final item/contract operations authoritative and revalidate Game Wallet state at contract mutation boundaries.
- [Existing dirty work is overwritten] → edit only targeted BIS files and preserve unrelated changes and OpenSpec changes.
- [Consumers expect the old global gate] → this corrected release explicitly documents that no Game Wallet is needed for item support.
