## MODIFIED Requirements

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

