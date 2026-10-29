# Spec Delta

## Purpose

This capability teaches developers a real, time-limited Arkade treasure contract through the Prototype Sandbox. It keeps contract state and financial outcomes grounded in the selected network while presenting a clear start, inspect, claim, and reject flow.

## ADDED Requirements

### Requirement: Treasure Hunt is a second Smart Contracts demo
The Prototype Sandbox SHALL present Treasure Hunt as a separate demo group beside Conditional Vault under Smart Contracts. It SHALL provide explicit Start, Check, Claim, and Reject actions and retain the shared demo Overview, source, diagram, and documentation conventions.

#### Scenario: Navigate to Treasure Hunt
- **WHEN** the user opens the Prototype Sandbox navigation
- **THEN** Treasure Hunt appears as a second Smart Contracts demo group and Conditional Vault remains available

#### Scenario: View Treasure Hunt source
- **WHEN** the user opens the Treasure Hunt source panel
- **THEN** it shows the executable demo source in the required Arrange, Act, Assert sections, in that order

### Requirement: Start a real treasure offer
An explicit Start action SHALL request one 1,000-sat treasure LTO with a 90-second deadline using the Arkade SDK and Setup Wallet 2. Rendering, refreshing, or navigating the demo SHALL NOT start or replace an offer. A request SHALL be bound to the selected network, wallet, unique session reference, and selected network's supported contract mode. The mnemonic SHALL NOT be stored in Treasure demo state or output. The contract mode SHALL NOT be an input field or silently changed. The demo SHALL NOT depend on a BIS Account or service.

All four step pages SHALL use the shared `Execute` button with the selected network on its second line. The buttons SHALL remain enabled independently of client-side wallet, offer, or expiry state. Each explicit action SHALL query current operator contract state and let that returned state determine whether a write is eligible. Durable recovery records MAY retain original contract terms and pending requests, but SHALL NOT be presented as network evidence.

#### Scenario: Start with supported ready wallets
- **WHEN** the user explicitly starts Treasure Hunt with ready player and game roles on a supported network, including the same supplied test wallet for both roles
- **THEN** the selected network processes a real Arkade treasure offer and the demo reports the returned pending or confirmed state

#### Scenario: Start is unavailable
- **WHEN** wallets are missing, mismatched, not ready, or the selected network lacks the required contract capability
- **THEN** Start reports the specific unavailable condition and submits no offer

#### Scenario: Network has no supported validation mode
- **WHEN** the selected network exposes no supported validation mode
- **THEN** Start reports that no mode is available and submits no offer

#### Scenario: Setup Wallet 2 cannot be restored
- **WHEN** the user explicitly runs a Treasure Hunt action and Wallet 2 cannot be opened on the selected network
- **THEN** the demo fails before making a Treasure contract request
- **AND** displays a safe wallet error

#### Scenario: Refresh after starting
- **WHEN** the demo is refreshed or reopened after an offer attempt
- **THEN** it does not create a replacement offer or report a new financial outcome

### Requirement: Inspect matching treasure contract state
Check SHALL request current operator contract state and display only Treasure Hunt contracts matching the selected wallet and network. It SHALL distinguish no offer, pending, claimable, expired, rejected, claimed, and unavailable or unknown evidence as applicable. Displayed outcomes and references SHALL come from network evidence.

#### Scenario: Ignore unrelated contracts
- **WHEN** the selected account contains other contract types, treasure sessions, or networks
- **THEN** Check leaves them unchanged and reports only the current Treasure Hunt session

#### Scenario: Network evidence is unavailable
- **WHEN** Check cannot obtain or validate current contract evidence
- **THEN** it reports unavailable or unknown and does not infer that the offer is absent, expired, or resolved

### Requirement: Claim and reject preserve uncertain outcomes
Claim and Reject SHALL query current operator state on each explicit execution and act only on a matching eligible Treasure Hunt contract using the SDK. The actions SHALL remain clickable regardless of prior browser state. An accepted asynchronous operation SHALL be shown as pending until verified evidence establishes its outcome. An uncertain or unavailable result SHALL NOT trigger an automatic resubmission or replacement offer.

#### Scenario: Claim a matching active offer
- **WHEN** the user claims a matching offer before its deadline
- **THEN** the demo shows completion only after verified contract evidence supports it

#### Scenario: Reject a matching active offer
- **WHEN** the user rejects a matching offer
- **THEN** the demo reports the rejection/refund state and does not create another offer for that session

#### Scenario: Repeat after an uncertain result
- **WHEN** a claim or rejection has an unknown or pending outcome
- **THEN** the user can explicitly Check the same session and the demo does not automatically submit another action

### Requirement: Describe network capability and contract guarantees accurately
The demo SHALL derive network availability and contract guarantees from the SDK and operator evidence. It SHALL not silently switch networks or validation modes, fabricate transaction identifiers, or present a UI-only result as a contract transition.

#### Scenario: A network lacks the required mode
- **WHEN** the selected network cannot create the treasure contract using an available supported mode
- **THEN** the demo explains that creation is unavailable on that network and keeps other demo navigation usable

#### Scenario: Contract action returns a transaction reference
- **WHEN** the SDK returns a verified transaction or contract reference
- **THEN** the demo displays only the returned reference and provides a matching explorer link when the network supports one

### Requirement: Separate deterministic checks from live acceptance
Automated UI and API tests SHALL label fixtures and deterministic behavior as such. Completion claims for real treasure funding, claim, rejection/refund, expiry, or network capability SHALL require separate live test-network evidence for each claimed path.

#### Scenario: Deterministic tests pass without live transactions
- **WHEN** deterministic tests pass without submitting test-network operations
- **THEN** their result is reported as deterministic coverage and not as live contract acceptance

#### Scenario: Report live network acceptance
- **WHEN** a network lifecycle is reported as live verified
- **THEN** its exact network, contract mode, transaction receipts, and completion evidence are recorded separately from UI test results

### Requirement: All four pages complete one real lifecycle
Create, Check, Claim and Reject SHALL share the original network/wallet-bound contract and recovery record. The finished supported flow SHALL contain no unimplemented contract placeholder. Deployed-page acceptance SHALL include actual funding, Claim, separate Reject/refund and reload/reconciliation evidence while preserving unrelated contracts and Conditional Vault.

#### Scenario: Follow the four-page workflow
- **WHEN** the user creates a supported real offer on page 22 and checks it on page 23
- **THEN** page 24 can claim that same eligible contract and show only its verified result
- **AND** a separately created offer can be rejected/refunded on page 25 with exact evidence

#### Scenario: Reload after an uncertain write
- **WHEN** a Create, Claim or Reject acknowledgement is lost and the user reloads or moves between pages
- **THEN** Check targets the original operation without replacement funding or blind resubmission
- **AND** the result stays unknown until attributable evidence establishes its outcome
