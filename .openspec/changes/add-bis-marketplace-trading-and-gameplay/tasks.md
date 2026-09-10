## 1. Arkade Atomic Capability Gate

- [x] 1.1 Inspect the installed Arkade SDK 0.4.71 and official Arkade material for an atomic asset-for-sats primitive, exercise the supported Signet sequence where available, and record non-secret API/receipt/recovery evidence under `output/reports/marketplace-trading/`; verify the report explicitly accepts or rejects atomicity without treating sequential sends as proof.
- [x] 1.2 Add a public JSON-safe trading-availability result and, only if task 1.1 qualifies the primitive, an exact-term durable atomic trade/reconciliation adapter; otherwise expose a stable unavailable reason and no submission path. Verify focused tests cover both the gate and the absence of sequential fallback.

## 2. Chain Metadata and Marketplace Admin

- [x] 2.1 Extend generic asset mint/list public types and the Arkade adapter to round-trip validated JSON-safe metadata while preserving generic assets; verify focused tests cover complete item metadata, trophy metadata, missing optional fields, unsafe URLs, unknown metadata, retries, and external assets.
- [x] 2.2 Add the shared Arkade-free nine-item catalog/classifier with exact prices and 10/20/30 effects, tag C1 achievement presets as Stealth & Steel trophies, and add immutable Marketplace v1 PNG URLs/assets beside the existing C1 pattern; verify catalog, metadata, URL, and image-file tests pass.
- [x] 2.3 Upgrade H1 to use the active Game Wallet, v2 per-item operation IDs, full chain metadata, fresh post-mint verification, and verified public catalog publication; verify interrupted/repeated batches reconcile without duplicate issuance and never publish an unverified item.
- [x] 2.4 Implement H2 `Burn All Items for Marketplace` with fresh chain classification, one durable record per item, disjoint-input continuation, item-scoped unknown recovery, and preservation of trophies/unrelated assets; verify focused tests cover mixed inventory, partial success, unknown outcomes, later reconciliation, duplicate prevention, wallet changes, and non-blocking unrelated interaction.

## 3. Multiple Player Profiles

- [x] 3.1 Migrate account IndexedDB from the single encrypted identity to an encrypted profile collection plus optional active pointer without destructive fallback; verify legacy migration, reload, invalid-state preservation, deduplication, cross-tab notification, and non-extractable-key tests.
- [x] 3.2 Update create, restore, select, account switching, operation ownership, and logout so committed identities join the collection and logout removes only the active profile; verify stale-work isolation, remaining-profile retention, explicit post-logout selection, pending acknowledgements, and host restart tests.
- [x] 3.3 Add the production saved-profile chooser with shortened public IDs, active indication, switching, and Add Profile -> Create/Restore; verify pointer/keyboard behavior, no secret exposure, no duplicate Marketplace implementation, and existing single/no-profile routes.

## 4. Equipment Loadout API and BIS UI

- [x] 4.1 Implement chain-metadata equipment recognition and profile-scoped local selection storage with no defaults and at most one Shoes, Dagger, and Shield; verify generic assets/trophies are excluded and profile selections cannot bleed across accounts.
- [x] 4.2 Expose Arkade-free public owned-item, select/clear, refresh, effective-loadout, and subscription behavior that revalidates fresh ownership; verify unavailable reads apply no effects and losing one asset clears only its family.
- [x] 4.3 Add loadout controls to BIS Account Assets while preserving all generic asset inspection/burn behavior, and render every item image from its chain `iconUrl`; verify selection, clearing, ownership refresh, failed-image honesty, and no bundled item-art fallback.

## 5. Marketplace Sessions, Inventory, and Trading

- [x] 5.1 Replace Marketplace bundled item artwork/pricing with fresh chain-classified metadata and approved prices while retaining anonymous registered-wallet browsing; verify every card/detail image requests the chain `iconUrl` and incomplete/trophy/unrelated assets are not tradable items.
- [x] 5.2 Add Marketplace Player Wallet Login and Game Wallet Login through the production BIS surfaces, show shortened active identities, and clearly distinguish the registered game address from a session override; verify public browsing needs no login and protected actions identify the missing role without submission.
- [x] 5.3 Implement My Items from the active player's fresh classified holdings and preserve game-wallet/all filters; verify profile switching refreshes ownership and no other profile's assets appear.
- [x] 5.4 Wire Buy and Sell-back to the task 1.2 gate: use the single proven atomic adapter with approved equal-direction prices when supported, otherwise keep both disabled with the verified reason. Verify ownership/balance/identity rechecks, exact terms, unknown reconciliation, no new-operation retry, and absence of player-to-player controls.

## 6. Package and Stealth & Steel Consumer

- [x] 6.1 Build and pack the updated public `@bis/integration` package, record its version, source revision, file list, and SHA-256, and verify exports/styles contain the loadout/profile contract without private or Arkade-specific game-facing types.
- [x] 6.2 Install the reviewed tarball into the authorized Stealth & Steel `vendor/` workflow and update its lockfile/adapter without a sibling source alias or Arkade dependency; verify the game resolves one compatible React instance and starts when BIS account loading fails.
- [ ] 6.3 Add Settings -> Items with a grid of the active player wallet's freshly owned items, none selected by default, and at most one selection per family through the public BIS API; verify profile switching, clearing, ownership loss, keyboard/pointer use, and chain-URL images.
- [ ] 6.4 Snapshot effective equipment on each player spawn and apply Shoes movement +10/20/30%, Dagger outgoing damage +10/20/30%, and Shield incoming-damage reduction 10/20/30%; verify focused game tests cover all nine tiers, selection changes during a life, the next spawn, and baseline guest behavior.
- [ ] 6.5 Add `Items: [][][]` under Gold in Shoes/Dagger/Shield order using the spawn snapshot and chain-provided icons; verify empty/mixed/full slots, HUD placement, URL changes, and no bundled item-art fallback.

## 7. Verification and Final Inventory

- [ ] 7.1 Run focused and full BIS tests, `npm run typecheck`, `npm run build`, package-consumer tests, game tests, and game build; verify failures are resolved or reported as unrelated without modifying concurrent work.
- [ ] 7.2 Exercise production BIS profile switching, Account Assets selection, H1, and H2 in a real browser, using H2 before final inventory setup if a live burn is safe; verify pending item work never makes unrelated interaction globally inert and save non-secret evidence under `output/screenshots/marketplace-trading/`.
- [ ] 7.3 Exercise Marketplace guest browsing, both role logins, registered/session addresses, My Items, runtime chain icons, and the truthful Buy/Sell gate in a real browser; when atomic trading is supported, verify one real same-browser Signet buy and sell-back, otherwise verify no transaction can submit.
- [ ] 7.4 Exercise Stealth & Steel guest and equipped-player flows in a real browser, including Settings -> Items, profile switching, next-spawn effects, HUD slots, and loss of ownership; verify gameplay starts and remains usable without an account or connectivity.
- [ ] 7.5 Invoke H1 through the real Admin with the active Game Wallet after destructive verification is finished, freshly list and verify all nine exact metadata-bearing items and their public icon URLs, and leave those items owned by that Game Wallet for the user's manual Marketplace testing.
