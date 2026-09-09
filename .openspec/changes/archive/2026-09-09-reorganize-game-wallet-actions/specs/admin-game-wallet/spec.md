## MODIFIED Requirements

### Requirement: Inspect public addresses and fresh funds
Admin SHALL show F1. Game Wallet with buttons to its right under F. Game Wallet. F1 SHALL contain Login or Logout only. Login SHALL use the existing encrypted import flow. Public wallet Details and payment-usable balance SHALL appear beside F3. Details SHALL refresh and write only public wallet details, receiving addresses, balances, configured recipient and mismatch/read status into the Admin console. Logout SHALL persistently deselect without deleting retained identities or changing the player or payment recipient. F3 SHALL show Balance: <payment-usable sats> sats immediately left of Details, including 0 when an unresolved wallet operation blocks spending even if the raw balance is positive. Loading and unavailable data SHALL remain distinguishable from a known zero. Details SHALL report F3 Wallet Status, the payment eligibility and usable balance as well as the raw public balance. Arkade script-event notifications SHALL trigger fresh balance reads without recurring polling. Logout and wallet switching SHALL stop the previous subscription; disconnected live data SHALL be shown as unavailable. No separate Copy/Refresh buttons SHALL appear; F2 provides the explicitly requested boarding action.

#### Scenario: Payment receipt is visible
- **WHEN** an independent player pays the configured game wallet and Admin clicks Details after provider evidence is available
- **THEN** the Admin console displays the freshly observed recipient balance reflecting receipt

#### Scenario: Selected recipient
- **WHEN** the operator selects an imported game wallet
- **THEN** the demo routes new Continue requests to its public Arkade address and reports public configuration-save failures
- **AND** previously submitted operations retain their original recipients

#### Scenario: Manual funding preparation
- **WHEN** the operator inspects F. Game Wallet
- **THEN** Details makes both receiving addresses available in the Admin console for manual copying, without submitting a wallet operation


### Requirement: F3 explicit boarding and live waiting state
Admin SHALL provide F2. Board Wallet with Details and Board Wallet. Details SHALL refresh and report F2 Boarding Status in the Admin console without preparing or submitting a boarding payment. Board Wallet SHALL show a quote before a separate explicit confirmation submits it. Existing wallet mutation and recovery safeguards SHALL remain effective.

#### Scenario: Inspect boarding
- **WHEN** the operator clicks F2 Details
- **THEN** the console shows freshly checked boarding status without a new submission

#### Scenario: Review then confirm
- **WHEN** an eligible operator activates Board Wallet
- **THEN** the boarding quote is shown for a separate confirmation before submission


### Requirement: Live evidence controls boarding waiting indication
F2 Board Wallet SHALL be disabled with (Awaiting Confirmation) only when fresh incoming transaction data proves that this wallet's boarding transaction is unconfirmed, in addition to ordinary busy and account availability restrictions. Saved operation history SHALL only identify the wallet transaction to inspect; a persisted boarded flag SHALL NOT establish the waiting state. Confirmed, unrelated, unavailable or stale evidence SHALL NOT establish this waiting indication. Details SHALL remain available when only this waiting state blocks submission.

#### Scenario: Matching live unconfirmed boarding
- **WHEN** a fresh unconfirmed transaction matches the wallet's recorded boarding inputs and known commitment ID
- **THEN** Board Wallet is greyed out with (Awaiting Confirmation)

#### Scenario: Confirmation or failed read
- **WHEN** live evidence becomes confirmed or unavailable, or the selected wallet changes
- **THEN** the previous waiting indication is cleared and ordinary mutation safeguards still apply

#### Scenario: Completed boarding
- **WHEN** fresh network evidence confirms the selected wallet boarding transaction
- **THEN** F2 replaces Board Wallet with non-actionable Boarded, including after reload or later deposits
- **AND** no local persisted flag alone establishes completion; unavailable checks show unavailable status without offering another submission
