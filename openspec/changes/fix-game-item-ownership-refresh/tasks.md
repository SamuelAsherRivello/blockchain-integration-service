## 1. BIS ownership refresh regression

- [ ] 1.1 Reproduce the post-delivery ownership-read failure with a focused `@bis/integration` equipment test for a matching player profile, and verify the test fails for the missing purchased item rather than test setup.
- [ ] 1.2 Implement the smallest public equipment/API correction that returns a freshly chain-recognized delivered item only for the active matching profile; verify the same focused test passes and unavailable reads leave no effective bonus.
- [ ] 1.3 Run the related equipment, asset-listing, Marketplace checkout, and package build checks; verify all pass without logging recovery data or treating cached UI state as ownership.

## 2. Separate game package consumer

- [ ] 2.1 Build and pack the corrected `@bis/integration` artifact, update Stealth & Steel through its existing vendored-package provenance and inventory workflow, and verify the recorded package hash and public API match the new artifact.
- [ ] 2.2 Add or update the game Items/account integration regression so an explicitly established matching profile receives the freshly owned item while a guest, mismatched profile, or unavailable read remains safe; verify the focused game tests pass.
- [ ] 2.3 Build the game and verify its development server loads the updated package rather than a sibling source import or stale archive.

## 3. End-to-end acceptance and delivery

- [ ] 3.1 In the existing local Marketplace and Stealth & Steel browser sessions, complete or reconcile one real local purchase, explicitly establish the receiving Player Wallet in the game origin, and verify the item appears in Items and can be selected; save only non-secret evidence under each repository's `output/` convention.
- [ ] 3.2 Verify the selected item has its documented gameplay effect after the next player spawn, and verify guest/unavailable gameplay still proceeds without an item bonus.
- [ ] 3.3 If the corrected package or published BIS assets require release, run the project's two-demo Pages release contract and verify both public routes before reporting deployment complete; otherwise record that no release was necessary.
