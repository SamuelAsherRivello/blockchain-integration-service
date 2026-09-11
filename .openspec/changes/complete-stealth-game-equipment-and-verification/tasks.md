## 1. Stealth & Steel equipment consumer

- [x] 1.1 Build and pack the completed public `@bis/integration` boundary, update the authorized Stealth & Steel vendored package and lockfile without a sibling source alias or Arkade dependency, and verify one compatible React instance plus guest startup when BIS account loading fails.
- [ ] 1.2 Add Settings -> Items with the active player wallet's freshly owned chain-classified items, empty-by-default and one selection per Shoes, Dagger, and Shield family, and verify profile switching, clearing, ownership loss, keyboard/pointer use, and runtime chain-URL images.
- [x] 1.3 Snapshot the effective equipment at each player spawn; apply the approved Shoes movement, Dagger outgoing-damage, and Shield incoming-damage effects; render `Items: [][][]` below Gold in Shoes/Dagger/Shield order; verify all nine tiers, next-spawn behavior, guest baseline, empty/mixed/full HUD slots, and no bundled item-art fallback.

## 2. Cross-project and live acceptance

- [x] 2.1 Run focused and full BIS tests, typecheck and builds, package-consumer tests, game tests, and the game build; report or resolve only failures attributable to this change without modifying concurrent work.
- [ ] 2.2 Exercise production BIS profile switching, Account Assets selection, H1, and H2 in a real browser; use H2 before final inventory setup only when a live burn is safe, verify pending item work does not globally disable unrelated interaction, and save non-secret evidence under `output/screenshots/marketplace-trading/`.
- [ ] 2.3 Exercise Marketplace guest browsing, both role logins, registered/session addresses, My Items, runtime chain icons, and the truthful Buy/Sell gate in a real browser; if atomic trading is supported, verify one real same-browser Signet buy and sell-back, otherwise verify that no transaction submits.
- [ ] 2.4 Exercise Stealth & Steel guest and equipped-player flows in a real browser, including Settings -> Items, profile switching, next-spawn effects, HUD slots, and loss of ownership; verify gameplay remains usable without an account or connectivity.
- [ ] 2.5 Invoke H1 through real Admin only after destructive verification is complete; freshly list and verify all nine exact metadata-bearing items and their public icon URLs, then leave them owned by the active Game Wallet for manual Marketplace testing.
