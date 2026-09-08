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
A successful local payment and its follow-up wallet observations SHALL produce only one foreground Balance loading cycle. Automatic reconciliation of an already displayed balance SHALL update it without reopening the loading window. Independent wallet changes SHALL still update the balance, and failed reconciliation SHALL clear amounts into the existing unavailable state. Manual Refresh SHALL retain its explicit loading behavior.

#### Scenario: Delayed snapshot after pay 1000
- **WHEN** B1 pays 1,000 sats with Balance open and the observer snapshot arrives after the payment-triggered refresh completes
- **THEN** the user sees one loading window and the delayed snapshot updates silently

#### Scenario: Independent change during reconciliation
- **WHEN** another wallet change arrives while the payment is being reconciled
- **THEN** the displayed balance reflects the latest successful read without suppressing that change
