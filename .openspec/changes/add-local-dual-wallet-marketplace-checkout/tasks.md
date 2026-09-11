## 1. Live publisher inventory

- [x] 1.1 Replace the per-item static Marketplace catalog with the minimal versioned Game Wallet publisher configuration, remove the Admin development-only catalog write path, and verify catalog tests prove no secret or item snapshot is required.
- [x] 1.2 Update Marketplace runtime lookup to derive visible availability only from the registered Game Wallet's fresh public Signet inventory and verified chain metadata; verify catalog tests cover post-publication inventory additions and removals.

## 2. Exact asset delivery boundary

- [ ] 2.1 Complete the Arkade asset-delivery adapter with exact selected asset allocation, sender-change preservation, transaction-shape inspection, durable pre-submit journaling, and source/recipient reconciliation; verify focused adapter and recovery tests cover changed holdings, duplicate IDs, lost acknowledgement, and no inferred success.
- [ ] 2.2 Expose exact delivery and reconciliation through the Player context, Game Wallet controller, public package exports, wallet reservations, and logout cleanup without SDK types or secrets; verify context, Game Wallet, and public-boundary tests pass.

## 3. Recoverable local checkout coordination

- [ ] 3.1 Add a durable local Marketplace checkout journal that binds direction, distinct profiles and addresses, exact item quantity, price, and operation IDs before submission; verify unit tests cover immutable retries, profile changes, unreadable state, and exact-item conflict reservations.
- [ ] 3.2 Implement purchase progression from Player-to-Game payment through Game-to-Player exact delivery, and sell-back in the inverse order; verify tests cover confirmed completion, payment-first delivery interruption, asset-first sell interruption, and no false completed trade.
- [ ] 3.3 Generalize the Game Wallet's player payment boundary only as needed for verified exact-price sell-back and refresh both wallet/equipment views after terminal reconciliation; verify no unrelated pending item or safe user interaction is globally blocked.

## 4. Marketplace operator experience

- [x] 4.1 Replace sidebar Player Wallet Login and Game Wallet Login buttons with current wallet status plus the Listing/Sales instruction area; verify `Enable Item Listing` is enabled by default and `Enable Item Sales` directs to the upper-right Account, then Developer → Game Wallet Login path without duplicate credential controls.
- [x] 4.2 Replace the atomic-SDK detail explanation with exactly `Buying and selling are not enabled. Follow the instructions in the left sidebar.` until local sales prerequisites are verified; verify Buy and Sell remain inert until then.
- [ ] 4.3 Wire eligible item-detail Buy and Sell actions to the local checkout coordinator, show per-item pending/recovery state, and preserve public browsing and disjoint actions; verify Marketplace UI tests cover purchase and sell-back state transitions.

## 5. End-to-end verification

- [ ] 5.1 Run focused integration, Marketplace, and Admin tests plus workspace typecheck, build, and strict OpenSpec validation; save only non-secret artifacts under `output/`.
- [ ] 5.2 Run a real browser smoke test that verifies live inventory browsing, the sidebar Account-only instructions, inactive and eligible detail states, and non-blocking pending presentation.
- [ ] 5.3 With the already authorized, distinct Signet Player and Game Wallet sessions, mint or select one game-wallet item, complete a local purchase, freshly verify Player ownership and Game Wallet price receipt, activate the item through the player Items menu, and record public transaction/ownership evidence only.
- [ ] 5.4 Run the separately hosted Stealth & Steel game against the same Player Wallet, verify the purchased item appears in its Items menu, activate it, and verify its specified gameplay effect; record the current game URL and non-secret visual evidence without changing the game repository from this checkout.
