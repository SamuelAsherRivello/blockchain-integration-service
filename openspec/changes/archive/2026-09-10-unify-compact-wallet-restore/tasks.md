## 1. Shared recovery entry

- [x] 1.1 Extract the Player Wallet twelve-word entry, masking, local validation, paste, and focus behavior into a reusable private UI component; verify existing Player Restore host checks still pass.
- [x] 1.2 Replace the user-facing Game Wallet restore textarea with the reusable entry and preserve its independent `importWallet`, error, restore-label, and Back behavior; verify Game Wallet restoration renders all twelve fields and submits only a locally valid phrase.

## 2. Compact presentation and verification

- [x] 2.1 Reduce only the recovery-grid row height, padding, and gap while retaining the existing input font and no scrollbar; verify Player and Game Wallet flows fit in the supported 9:16 preview.
- [x] 2.2 Run the focused browser-host checks and the integration/demo build, then visually inspect the served restore flow in a real browser without using an actual recovery phrase.
