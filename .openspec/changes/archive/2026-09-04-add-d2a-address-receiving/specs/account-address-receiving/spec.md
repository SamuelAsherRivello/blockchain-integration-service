## Purpose

Provide a complete address-based Receive journey with honest payment-type availability, without depending on live Lightning invoice support.

## ADDED Requirements

### Requirement: Address receiving and refresh
An active account SHALL offer Receive with separate labeled Arkade and Bitcoin address fields and independent Copy controls. Addresses SHALL load on entry and manual Refresh. Loading or failed reads SHALL NOT leave stale addresses copyable. Failure SHALL give a safe explanation and allow manual retry. Receive SHALL NOT initiate a payment, funding request, or account transfer.

#### Scenario: Entry and copy
- **WHEN** an active account opens Receive and address loading succeeds
- **THEN** both address fields display their actual values and each Copy action copies only its own value with truthful feedback

#### Scenario: Refresh failure and recovery
- **WHEN** manual Refresh starts and subsequently fails
- **THEN** old values are no longer offered for copying and an unavailable explanation appears
- **AND** another manual Refresh can recover the fields without changing the account

#### Scenario: Clipboard failure
- **WHEN** the clipboard rejects an address copy
- **THEN** the UI explains the failure without claiming success and keeps the address selectable for manual copying

### Requirement: Unavailable invoice presentation for D2a
Receive SHALL show a separated Lightning invoice section below the address fields and explain that its controls affect only Lightning. D2a SHALL expose provider-neutral unavailable state, show Currently unavailable, select No Invoice by default, keep the invoice value empty and amount default at zero, and disable invoice selection/creation and invoice Copy. It SHALL NOT present an actionable amount/fee prompt, fabricated invoice, or simulated receipt. Invoice availability SHALL NOT alter either address.

#### Scenario: Default unavailable state
- **WHEN** Receive is displayed in the D2a release
- **THEN** No Invoice is selected, With Invoice and invoice Copy are disabled, and no invoice is displayed
- **AND** address receiving remains independently usable

### Requirement: Receive navigation and accessibility
Back SHALL return to Account without clearing saved account material. Re-entering Receive SHALL start default presentation and reload addresses. Closed, disposed, or replaced-account views SHALL NOT publish stale address results. The page SHALL support keyboard navigation, labeled controls, readable 9:16 presentation without horizontal overflow, and access to Back when vertical scrolling is necessary.

#### Scenario: Back and re-entry
- **WHEN** the player leaves Receive and reopens it
- **THEN** the account is retained, addresses reload, and No Invoice/zero/empty-invoice defaults remain

#### Scenario: Late result
- **WHEN** an address request finishes after its view is closed or account replaced
- **THEN** it does not repopulate the obsolete view with stale account addresses

#### Scenario: Keyboard and portrait use
- **WHEN** the player navigates Receive by keyboard in the 9:16 preview
- **THEN** enabled controls have visible focus and readable labels, disabled invoice controls cannot activate, and Back is reachable without horizontal scrolling
