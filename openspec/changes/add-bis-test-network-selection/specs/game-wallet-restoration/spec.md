## MODIFIED Requirements

### Requirement: Shared private game-wallet recovery entry
The user-facing Game Wallet create and restore pages SHALL begin only after explicit Signet or Mutinynet selection and SHALL identify that selected network throughout. Restore SHALL present the same numbered two-column 12-word recovery entry format as Player Wallet Restore Account. It SHALL provide manual word entry, an explicit Paste from Clipboard action, a Show/Hide control, individual BIP39 word indicators, phrase-level checksum validation, Restore, and Back. It SHALL begin hidden, keep hidden fields editable, and must not expose recovery material through public state, game events, logs, URLs, analytics, or Admin history. Before a valid phrase is accepted or a candidate is selected, BIS SHALL verify the selected operator network and reject a Game Wallet that does not share the selected Player Wallet network or that matches the active Player Wallet identity. The rejection SHALL leave the Player Wallet, prior Game Wallet selection, and Game Wallet storage unchanged.

#### Scenario: Open Game Wallet restoration
- **WHEN** a user chooses Mutinynet and then Restore Game Wallet
- **THEN** the page identifies Mutinynet and shows twelve numbered word inputs in two columns with the same visibility, paste, and validation controls as Player Wallet restoration
- **AND** Restore remains disabled until the complete phrase is valid

#### Scenario: Cross-network restoration
- **WHEN** a valid Game Wallet phrase reaches network verification for a different network than the selected Player Wallet
- **THEN** BIS shows a clear non-secret network error and does not accept, select, or persist that Game Wallet identity
- **AND** the active Player Wallet and any previously selected Game Wallet remain unchanged

#### Scenario: Restore a valid game wallet
- **WHEN** a user enters or explicitly pastes a valid twelve-word Game Wallet phrase on the selected network and selects Restore
- **THEN** the system passes the phrase only to the existing Game Wallet import operation
- **AND** successful import returns to the configured Game Wallet state without activating or replacing the Player Wallet

#### Scenario: Restored game wallet conflicts with Player Wallet
- **WHEN** a valid Game Wallet recovery phrase resolves to the active Player Wallet's public profile ID
- **THEN** BIS immediately shows a clear role-conflict error and does not accept, select, or persist that Game Wallet identity
- **AND** the active Player Wallet and any previously selected Game Wallet remain unchanged
