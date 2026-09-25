## ADDED Requirements

### Requirement: F2 pay player demonstration
Admin SHALL display F2 `Pay 1000 Sats To Player` under F. Game Wallet after F1. Without an active logged-in Runtime Preview player account, F2 SHALL be visibly greyed out and disabled for pointer and keyboard activation. Availability SHALL react to account changes and also require an eligible F1 sender and no unresolved F2 payment. Activating F2 SHALL use the production payment API; receipt feedback SHALL appear in Runtime Preview through the shared toast UI.

#### Scenario: No preview player
- **WHEN** Runtime Preview has no active player account
- **THEN** F2 remains visible, greyed out and disabled and cannot initiate a payment

#### Scenario: Player logs in or out
- **WHEN** the player logs in with an eligible F1 sender or logs out again
- **THEN** F2 respectively becomes enabled or immediately returns to disabled

#### Scenario: Pay and receive
- **WHEN** the operator clicks enabled F2 and the player receives the verified payment
- **THEN** the preview shows the sender-specific receipt toast without opening a player Send dialog

### Requirement: F2 documentation and acceptance evidence
The user-story documentation SHALL include F2's exact label, payment direction, disabled state and receipt message. Evidence SHALL distinguish isolated tests from live Signet verification and SHALL NOT claim live completion from mocked outcomes.

#### Scenario: Delivery verification
- **WHEN** F2 is reported complete
- **THEN** evidence covers real-browser no-player disabling, account transitions, pending duplicate prevention and runtime toast rendering, plus actual two-wallet payment and receipt correlation
- **AND** unavailable live checks remain explicitly pending

### Requirement: Explain F2 unavailability
F2 SHALL append its current disabling reason in parentheses. Awaiting Balance SHALL be used for a balance still loading or below the required amount, rather than masking an unresolved operation. Other reasons SHALL distinguish Awaiting Player, Awaiting Game Wallet, Select A Different Wallet, Sending, Checking Wallet, Awaiting Confirmation, Wallet Operation Unresolved and Wallet Unavailable as applicable.

#### Scenario: Funds locked by unresolved operation
- **WHEN** the wallet has a positive raw balance but an unresolved operation prevents spending
- **THEN** F2 identifies the operation-related block and F1 shows 0 payment-usable sats

#### Scenario: Balance missing or insufficient
- **WHEN** an otherwise eligible wallet is loading its balance or has fewer than 1000 usable sats
- **THEN** F2 appends (Awaiting Balance)

## MODIFIED Requirements

### Requirement: Always-visible Admin Console
The existing Console region SHALL remain visible from initial load and show labeled pending operations and public API responses or sanitized errors. It SHALL include originating account and operation IDs where known, render text safely, scroll, and replace its previous contents with each new output. Refresh and successful Reset Client SHALL clear its contents; stale completions from a previous client SHALL be ignored. Request-level pending followed by success or error SHALL represent completed request progress; a List Assets read SHALL NOT be treated as an unresolved transaction or create a spending reservation or mint-recovery record.

#### Scenario: Reset with late output
- **WHEN** a new client replaces an old client and the old request later completes
- **THEN** the new console does not display that stale result

#### Scenario: Successful list after request progress
- **WHEN** List Assets emits pending and then success for the same request and account
- **THEN** Console shows the actual successful assets result and the read is complete
- **AND** the earlier pending entry does not create a transaction blocker or require recovery


#### Scenario: Any new console output
- **WHEN** any action emits a loading, pending, status, result or error output
- **THEN** the console clears the prior output and displays only the newly supplied labeled content
