# game-wallet-restoration Specification

## Purpose

Give Game Wallet restoration the same safe, private and compact twelve-word entry experience as Player Wallet restoration without changing either wallet's independent lifecycle.

## Requirements

### Requirement: Shared private game-wallet recovery entry
The user-facing Game Wallet restore page SHALL present the same numbered two-column 12-word recovery entry format as Player Wallet Restore Account. It SHALL provide manual word entry, an explicit Paste from Clipboard action, a Show/Hide control, individual BIP39 word indicators, phrase-level checksum validation, Restore, and Back. It SHALL begin hidden, keep hidden fields editable, and must not expose recovery material through public state, game events, logs, URLs, analytics, or Admin history. After a valid phrase resolves to an identity but before it is selected, BIS SHALL reject a Game Wallet identity matching the active Player Wallet with a clear role-conflict error. The rejection SHALL leave the Player Wallet, prior Game Wallet selection, and Game Wallet storage unchanged.

#### Scenario: Open Game Wallet restoration
- **WHEN** a user chooses Restore Game Wallet
- **THEN** the page shows twelve numbered word inputs in two columns with the same visibility, paste, and validation controls as Player Wallet restoration
- **AND** Restore remains disabled until the complete phrase is valid

#### Scenario: Restore a valid game wallet
- **WHEN** a user enters or explicitly pastes a valid twelve-word game-wallet phrase and selects Restore
- **THEN** the system passes the phrase only to the existing game-wallet import operation
- **AND** successful import returns to the configured Game Wallet state without activating or replacing the Player Wallet

#### Scenario: Restored game wallet conflicts with Player Wallet
- **WHEN** a valid Game Wallet recovery phrase resolves to the active Player Wallet's public profile ID
- **THEN** BIS immediately shows a clear role-conflict error and does not accept, select, or persist that Game Wallet identity
- **AND** the active Player Wallet and any previously selected Game Wallet remain unchanged

### Requirement: Compact recovery-grid presentation
The shared recovery entry SHALL retain the existing input font and all controls while reducing unused vertical space in each two-input row. The page SHALL show the full recovery flow without an internal or dialog scrollbar at its supported 9:16 preview size.

#### Scenario: Inspect the compact recovery page
- **WHEN** the Player Wallet or Game Wallet recovery page opens in the supported 9:16 preview
- **THEN** every two-input row is visibly compact while preserving its existing text font
- **AND** the warning, seed-word controls, all twelve inputs, Restore, and Back are available without scrolling
