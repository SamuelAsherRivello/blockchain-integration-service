# Tasks

## 1. Metadata contract and generic asset boundary

- [x] 1.1 Extend BIS metadata types and normalization to support the validated `bisAttributeDeltas` array-of-objects shape, scalar defaults, size limits, duplicate-attribute rejection, and safe round-trip behavior; verify focused asset metadata tests cover valid, malformed, legacy, generic, and trophy records.
- [x] 1.2 Define the canonical item and trophy metadata builders with native Arkade fields, BIS identity fields, `bisDescription`, and authoritative deltas; verify exact full JSON fixtures for Shoes III, Dagger III, Shield III, and a trophy.
- [x] 1.3 Update item classification and the public equipment model to preserve validated deltas while treating description, family, tier, catalog identity, and price as non-gameplay metadata; verify classifiers reject invalid deltas and never infer missing effects.
- [x] 1.4 Update trophy mint requests to emit the common envelope with `bisAttributeDeltas: []`; verify trophy issuance and ownership tests preserve existing optional-collection behavior.

## 2. Marketplace and Admin behavior

- [x] 2.1 Replace family/effect-percent gameplay derivation in Marketplace and Admin catalog paths with chain-provided structured deltas and presentation-only descriptions; verify UI tests prove descriptions are not parsed and family/tier cannot create gameplay bonuses.
- [x] 2.2 Update Marketplace catalog issuance, verification, publication records, and checkout data to preserve the structured deltas; verify the nine-item batch tests require exactly one fully classified item per catalog ID.
- [x] 2.3 Make C.G.3 burn the exact nine current Marketplace listing items, including exact target discovery, guarded burn, absence verification, stable new mint operation IDs, fresh remint verification, and truthful recovery for partial or unknown outcomes; verify listing tests do not burn arbitrary or duplicate holdings.
- [x] 2.4 Update README/spec-linked package documentation and metadata fixtures with the complete raw JSON shape; verify documentation examples match the runtime metadata builder.

## 3. Local game integration

- [x] 3.1 Inspect `D:\Documents\Projects\VC\Bitcoin\blockchain-stealth-and-steel-game` and connect it to the updated local BIS package through its existing provider-neutral integration boundary; verify the game builds without Arkade-specific imports in the game-facing API.
- [x] 3.2 Make the game apply selected owned-item gameplay only from BIS-provided attribute deltas, with movement speed, player damage, and damage taken mappings; verify game contract tests cover positive, negative, zero, missing, and multiple deltas.
- [ ] 3.3 Add an end-to-end local test that observes a player-owned item, selects it, reads its structured delta, and confirms the corresponding gameplay behavior while the friendly description remains display-only.

## 4. Build, live migration, and verification

- [ ] 4.1 Run focused tests, the full BIS test suite, typecheck, and production builds; verify all pass before any wallet mutation.
- [x] 4.2 Start the shared Vite server and verify HTTP 200 plus expected content for `/admin/`, `/marketplace/`, `/onboarding/`, and `/integration/`; start the local game server using its project instructions and record only non-secret logs under `output/`.
- [ ] 4.3 Before migration, display the selected Game Wallet identity, active network, exact nine target asset IDs, and expected burn/remint plan; require the live session to match the intended Marketplace store inventory before submitting a burn.
- [ ] 4.4 Burn the nine verified old Marketplace items, reconcile every operation, and verify none remain in fresh Game Wallet inventory; stop and report if any burn is uncertain or the inventory diverges.
- [ ] 4.5 Remint the nine items with the new metadata, verify one fresh asset per catalog ID and exact structured deltas, and refresh Admin and Marketplace from chain data before claiming migration success.
- [ ] 4.6 Buy one reminted item from the Marketplace into the Player Wallet, equip it in the local game, and verify the game applies the chain-provided delta; use Playwright where helpful and retain screenshots/reports under `output/`.
- [ ] 4.7 Report the verified test sequence and provide the user the local Admin, Marketplace, game, and required tunnel URLs, clearly separating code/test success from live wallet success.
