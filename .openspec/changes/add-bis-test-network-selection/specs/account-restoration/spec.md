## MODIFIED Requirements

### Requirement: Private numbered recovery grid
Restore Account SHALL open a numbered grid for the selected test network's 12-word English recovery phrase, with manual entry, Paste from Clipboard, one Show checkbox, Restore, and Back. The UI SHALL warn that this is a Signet or Mutinynet test account, as selected, and never to enter or reuse a real-funds recovery phrase. Show SHALL begin unchecked; each nonempty hidden field SHALL display one `*` per character instead of its word, while empty fields remain empty. Checking Show SHALL reveal every word and unchecking SHALL hide every word. Hidden fields SHALL remain editable with keyboard and touch. Recovery material SHALL NOT appear in public state, game events, logs, analytics, URLs, or Admin history.

#### Scenario: Selected-network warning
- **WHEN** a user selects Mutinynet then opens Restore Account
- **THEN** the recovery page identifies Mutinynet as the test network without displaying Signet guidance

#### Scenario: Enter and reveal words
- **WHEN** a player enters recovery words and toggles Show
- **THEN** all hidden populated fields show one asterisk per character until Show is checked
- **AND** the fields remain editable with keyboard and touch

### Requirement: Signet-gated persistent restoration
Restore SHALL reconstruct the same compatible identity using the selected network's derivation and SHALL require successful operator verification that identifies as that selected network before saving or activating. Only account access SHALL be restored; balances, achievements, the full account menu, and gameplay progress remain outside restoration. Successful durable saving SHALL immediately activate the profile, emit accountConnected with its existing public profile ID once for the initiating operation, clear transient recovery input, and return to the Account dialogue with the selected network context. A restored account SHALL survive reload and browser restart on the same origin/profile only within its selected-network persistence scope. Before saving or activation, BIS SHALL verify that the restored public profile ID is not the currently selected Game Wallet and that the Game Wallet uses the same selected network. A mismatch SHALL reject Player Wallet restoration with a clear non-secret error, save or activate neither role, preserve the existing Game Wallet selection, and emit no accountConnected event.

#### Scenario: Verified Mutinynet restoration
- **WHEN** a valid phrase is restored after selecting Mutinynet and its operator verifies as Mutinynet
- **THEN** the profile is saved and activated only in the Mutinynet scope
- **AND** no Signet state is restored or read

#### Scenario: Mismatched operator response
- **WHEN** the selected network operator does not identify as the selected network
- **THEN** restoration leaves the account inactive and unsaved with a sanitized network diagnostic error

#### Scenario: Restore the same account
- **WHEN** a valid phrase for an already saved identity is restored on its selected network
- **THEN** BIS activates the existing profile without creating a duplicate or overwriting its profile-scoped state

#### Scenario: Restored player conflicts with Game Wallet
- **WHEN** a valid Player Wallet phrase resolves to the selected Game Wallet public profile ID
- **THEN** BIS rejects restoration before saving or activation with a non-secret role-conflict error
- **AND** the selected Game Wallet remains unchanged
