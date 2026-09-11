## MODIFIED Requirements

### Requirement: Marketplace batch tools use the active game wallet
H1 and H2 SHALL operate only through the currently active, separately retained Admin Game Wallet signer. Before every mint or burn submission, Admin SHALL revalidate that the selected identity remains active and that the relevant asset ownership and operation intent belong to it. Player profiles SHALL NOT sign, fund, receive, or reconcile H1 or H2 operations. The additional test-only `Send Item to Player` control SHALL sign only with the active Game Wallet and direct the verified selected item only to the separately active Player Wallet. The additional test-only `Burn Item from Player` control SHALL sign only with the active Player Wallet after fresh ownership validation and explicit confirmation. Neither control SHALL operate if the Game Wallet and Player Wallet resolve to the same identity, and an identity change before submission SHALL prevent attribution or submission under a replacement wallet.

#### Scenario: Active game wallet changes during H1 or H2
- **WHEN** the selected Game Wallet changes before an item submission
- **THEN** work prepared for the previous wallet cannot submit or be attributed to the replacement
- **AND** already submitted work remains associated with its original public wallet identity for reconciliation

#### Scenario: No active game wallet
- **WHEN** H1 or H2 is requested without an active Game Wallet
- **THEN** Admin reports the game-wallet requirement without submitting a mint or burn

#### Scenario: Item test controls use their separate wallet roles
- **WHEN** distinct active Player and Game Wallets request delivery or cleanup for a selected catalog item
- **THEN** delivery can sign only from Game Wallet to Player Wallet and cleanup can sign only from Player Wallet
- **AND** neither operation can substitute one wallet identity for the other
