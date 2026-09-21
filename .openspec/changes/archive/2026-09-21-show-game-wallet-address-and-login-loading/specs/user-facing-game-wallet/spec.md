# Spec Delta

## Purpose

Provide a compact, user-facing Game Wallet Login result that identifies the selected public Arkade destination and clearly covers asynchronous login work until the wallet is ready.

## ADDED Requirements

### Requirement: Selected Game Wallet shows its public Arkade address

When a Game Wallet is selected, the Game Wallet Login page SHALL show an address section above `Log Out Game Wallet`. The section SHALL use the header `Arkade address`, show the complete selected wallet Arkade address as its value, and provide the standard Copy action for that value. Copying SHALL affect only the displayed public address and SHALL provide the existing truthful success or manual-copy failure feedback.

#### Scenario: Logged-in game wallet
- **WHEN** the selected Game Wallet is ready and the user opens Game Wallet Login
- **THEN** the page shows `Arkade address`, the complete public Arkade address, and its Copy button above `Log Out Game Wallet`
- **AND** the page does not show the Game Wallet balance, recovery material, or boarding controls

#### Scenario: Copy the Arkade address
- **WHEN** the user activates Copy for the displayed Arkade address
- **THEN** the complete public address is sent to the clipboard through the shared copy behavior
- **AND** the address remains available for manual selection if clipboard access fails

### Requirement: Game Wallet Login covers asynchronous login work

When the user creates, restores, or commits/selects a Game Wallet from the Game Wallet Login page, the page SHALL immediately be covered by the shared blocking loading prompt and SHALL remain covered until the operation completes and the resulting selected-wallet state is ready or has reached a terminal safe error. The covered page SHALL not expose incomplete logged-in content or allow duplicate login actions.

#### Scenario: Login succeeds
- **WHEN** Game Wallet creation, restoration, or selection succeeds
- **THEN** the loading prompt remains visible through final selected-wallet readiness
- **AND** the prepared logged-in page then reveals the Arkade address section and logout action

#### Scenario: Login fails
- **WHEN** Game Wallet creation, restoration, or selection reaches a terminal error
- **THEN** the loading prompt resolves to the existing safe error presentation
- **AND** the prior selected Game Wallet and its displayed public address remain unchanged

#### Scenario: Login is still pending
- **WHEN** an asynchronous Game Wallet login operation has not completed
- **THEN** the loading prompt is above the page with no interactive covered controls reachable by pointer or keyboard
