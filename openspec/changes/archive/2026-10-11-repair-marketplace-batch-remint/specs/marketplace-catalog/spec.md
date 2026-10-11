# Spec Delta

## ADDED Requirements

### Requirement: Catalog generations preserve retry identity

C.G.2 SHALL persist or deterministically recover batch generation identity scoped to Game Wallet and network before submission. Retries, reloads, and concurrent invocations SHALL retain the same per-item operation IDs. Pending or unreadable history SHALL prevent replacement issuance. Existing v3 operations SHALL remain recoverable.

#### Scenario: Interrupted batch is resumed
- **WHEN** a batch stops with a pending item and Admin retries after reload
- **THEN** the original item intent is reconciled before other items
- **AND** no replacement generation or duplicate issuance is created

#### Scenario: Wallet or network changes
- **WHEN** the selected identity or network changes during preparation
- **THEN** the obsolete attempt cannot submit or publish completion

### Requirement: Fully burned catalog can be minted again

An explicit C.G.2 action SHALL create a new batch generation when all nine prior generation issuances succeeded and fresh public supply evidence confirms each is fully burned. Missing wallet ownership alone SHALL NOT permit a new generation. Old operation records SHALL remain intact. New items SHALL carry the current structured BIS metadata.

#### Scenario: Legacy v3 catalog was burned
- **WHEN** the previous nine v3 assets have verified zero supply and Admin clicks C.G.2
- **THEN** nine new per-item operation IDs are selected and one compatible asset per catalog identity is freshly verified
- **AND** subsequent retries reuse those IDs

#### Scenario: Assets transferred or evidence unavailable
- **WHEN** previous items are missing from the wallet but any supply remains positive or cannot be read
- **THEN** no replacement generation is authorized from absence alone

### Requirement: Batch diagnostics distinguish historical completion

Admin SHALL distinguish historical already-minted results from new submissions when reporting verification failures. Successful batch completion SHALL require fresh compatible holdings for all nine identities.

#### Scenario: Historical asset is absent
- **WHEN** mint returns an already-minted historical result and fresh ownership verification fails
- **THEN** Admin does not label that invocation as a new confirmed submission

### Requirement: Minted batch is visible for the selected Game Wallet

With Player and Game Wallet sessions active, Marketplace Game Wallet inventory SHALL use the selected Game Wallet's public address and network. A newly verified compatible nine-item catalog SHALL be visible after a fresh inventory read, independent of the registered default catalog address.

#### Scenario: Owned test Game Wallet differs from published default
- **WHEN** Admin mints and verifies the nine-item catalog in that wallet and the same pair is restored in Marketplace
- **THEN** Game Wallet ownership displays the nine verified items from that wallet
