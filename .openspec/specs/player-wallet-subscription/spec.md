# player-wallet-subscription Specification

## Purpose

Keep player wallet views current through one account-scoped observation lifetime, independently of individual game actions and toast messages.

## Requirements

### Requirement: Account-scoped shared observation
BIS SHALL maintain one shared wallet observation lifetime for the current player account while it is retained, regardless of which Account page is open. Navigation SHALL NOT create a second network observer. Observation SHALL reconnect after failure and stop on replacement, logout or disposal. Late callbacks from a stopped session SHALL NOT affect the current account.

#### Scenario: Navigation and replacement
- **WHEN** the user opens and closes Transactions and then changes account
- **THEN** navigation uses the existing observer and the old account observation is stopped before its callbacks can update the new account

### Requirement: Automatic wallet view updates
BIS SHALL refresh visible balances and holdings on fresh wallet observations independently of payment-notification eligibility, and update visible activity from the shared history. Coverage SHALL include incoming and outgoing payments, asset changes and confirmation changes supplied by the wallet. Confirmed local operations SHALL request fresh shared observation and view refresh. Overlapping reads SHALL NOT restore pre-change values after a wallet change. Hidden pages SHALL obtain fresh data when opened.

#### Scenario: Outgoing payment without a toast
- **WHEN** B1 succeeds or the wallet reports an outgoing payment
- **THEN** the visible Arkade balance updates without clicking Refresh even if no incoming-payment toast is emitted

#### Scenario: Asset and confirmation updates
- **WHEN** a wallet observation reports an asset change or a later confirmation state
- **THEN** the visible affected wallet view refreshes without navigation or manual action

### Requirement: Recovery and manual refresh
BIS SHALL preserve manual Refresh, bounded initial Activity loading with one retry, and unavailable states. Observation SHALL use periodic live reconciliation when notifications fail or do not cover a change. Reconnection SHALL NOT replay historical receipt toasts or present failed reads as fresh balance evidence.

#### Scenario: Missed notification
- **WHEN** a wallet notification is missed but the next live reconciliation succeeds
- **THEN** visible views update from the resulting wallet data

#### Scenario: Disconnected observation
- **WHEN** the observer fails and subsequently reconnects
- **THEN** the observer recovers without duplicate subscriptions or replaying already observed payment toasts

### Requirement: One visible loading cycle per local payment
A successful local payment and its follow-up wallet observations SHALL produce only one foreground Balance loading cycle. A newly observed incoming Arkade receipt, including F3, while Balance is visible SHALL also start one foreground balance read covered by the existing Pending Operation Dialog, clearing old displayed amounts until fresh data is prepared. The dialog SHALL represent the bounded balance read, not an indefinite wait for network settlement. Repeated observations and later settlement of the same receipt SHALL update balances silently after that cycle. Independent wallet changes SHALL still update the balance, and failed reconciliation SHALL clear amounts into the existing unavailable state. Foreground read failures SHALL retain the existing retry and Pending Operation Dialog error contract. Manual Refresh SHALL retain its explicit loading behavior. Historical baseline snapshots and unchanged reconciliation SHALL NOT trigger additional foreground loading. Hidden Balance pages SHALL NOT open automatically.

#### Scenario: Delayed snapshot after pay 1000
- **WHEN** B1 pays 1,000 sats with Balance open and the observer snapshot arrives after the payment-triggered refresh completes
- **THEN** the user sees one loading window and the delayed snapshot updates silently

#### Scenario: Independent change during reconciliation
- **WHEN** another wallet change arrives while the payment is being reconciled
- **THEN** the displayed balance reflects the latest successful read without suppressing that change

#### Scenario: F3 receipt with Balance open
- **WHEN** a new F3 Arkade receipt is observed after the session baseline with Balance open
- **THEN** Balance immediately shows its Pending Operation Dialog through the fresh read and preparation, then reveals fresh Arkade and total balances
- **AND** the pending toast remains visible through the shared toast presentation
- **AND** duplicate observations and settlement of that receipt do not reopen the loading dialog

#### Scenario: Balance closed or account replaced
- **WHEN** a receipt arrives with Balance closed or an old account callback arrives after replacement
- **THEN** no Balance page is opened and no old-account loading or amounts affect the current session

#### Scenario: Read fails during receipt loading
- **WHEN** the receipt-triggered balance read exhausts the existing bounded retry
- **THEN** the existing operation error and OK behavior is shown without stale amounts or a fabricated zero
