## Purpose

Provide a clear Admin-only workspace for safe local batch-session actions without treating a UI action as a remote wallet, Arkade, or Marketplace mutation.

## ADDED Requirements

### Requirement: Numbered Batch Operations section

The integration demo Admin SHALL render a foldable section titled exactly `04. Batch Operations` after its existing operational Admin sections and before Console. The section SHALL render two native buttons in this order: `Clear Last Batch` and `Start New Batch`. Both controls SHALL remain keyboard operable, expose visible focus, fit the supported narrow Admin layout without horizontal overflow, and preserve the existing section-folding behavior.

#### Scenario: Section is rendered in the Admin workflow

- **WHEN** the integration demo Admin is displayed with or without an active Player or Game Wallet
- **THEN** `04. Batch Operations` is present before Console with `Clear Last Batch` followed by `Start New Batch`
- **AND** no wallet login, address lookup, asset query, or transaction starts merely because the section rendered

#### Scenario: Keyboard operation

- **WHEN** a keyboard user focuses an enabled Batch Operations button and activates it with Enter or Space
- **THEN** the corresponding local batch-session action occurs exactly once
- **AND** focus remains usable in the Admin panel without opening an unrelated dialog

### Requirement: Safe local batch-session lifecycle

Batch Operations SHALL manage only one in-memory Admin batch-session record. `Start New Batch` SHALL replace the recorded local batch session with a newly initialized local session. `Clear Last Batch` SHALL remove the currently recorded local batch session and remain disabled when no local batch session exists. Neither action SHALL mint, burn, transfer, settle, cancel, retry, erase, or otherwise mutate any Player Wallet, Game Wallet, Arkade operation, Marketplace catalog item, remote transaction, recovery record, or durable browser wallet state.

#### Scenario: Start a first local batch

- **WHEN** an operator activates `Start New Batch` while no local batch session is recorded
- **THEN** Admin records a new in-memory local batch session and enables `Clear Last Batch`
- **AND** no Arkade SDK call or wallet mutation is made

#### Scenario: Replace the local batch

- **WHEN** an operator activates `Start New Batch` while a prior local batch session is recorded
- **THEN** Admin records a new local batch session in place of the prior local session
- **AND** the prior session's clearing or replacement does not alter remote or durable operation state

#### Scenario: Clear the local batch

- **WHEN** an operator activates enabled `Clear Last Batch`
- **THEN** Admin removes only the recorded local batch session and disables `Clear Last Batch`
- **AND** it does not imply cancellation, settlement, deletion, or reversal of a wallet or Marketplace operation

### Requirement: Truthful local feedback and interaction safety

Each successful Batch Operations action SHALL append a clearly local status entry to the existing Admin Console. The Console entry SHALL distinguish starting, replacing, or clearing local Admin batch-session state from any network, wallet, or Marketplace outcome. A transition in progress SHALL prevent a duplicate conflicting Batch Operations activation, while unrelated Admin controls and Runtime Preview interaction remain available. Local batch-session state SHALL not be persisted across a full page reload or exposed through public game-facing APIs.

#### Scenario: Console reports a local transition

- **WHEN** an operator starts, replaces, or clears a local batch session
- **THEN** the Admin Console identifies the performed local session transition
- **AND** it does not claim an asset issuance, burn, payment, transfer, remote cancellation, or confirmation

#### Scenario: Duplicate protection and reload

- **WHEN** a Batch Operations transition is still being committed and the operator repeats its control activation
- **THEN** the duplicate activation does not create a second local transition
- **AND** after a full page reload no previous local batch session is restored as active
