## MODIFIED Requirements

### Requirement: Import and retain an independent game wallet
Admin SHALL identify this control as F1. Game Wallet (Admin-facing) and SHALL explicitly import a game wallet through one private recovery-phrase text field into the same encrypted browser-local selection used by F2. Import SHALL NOT activate or replace the player wallet or expose recovery material in public state, logs or build artifacts. Invalid input SHALL leave storage unchanged. Importing a different game wallet SHALL select it; re-entering a saved identity SHALL select it without duplication. There SHALL be no wallet dropdown. Importing the active player's identity as the game wallet SHALL fail with an explanation. Reload SHALL restore the last-selected game wallet and fetch its current balance.

#### Scenario: Import and reload
- **WHEN** Admin imports a valid identity different from the logged-in player and reloads
- **THEN** the game wallet remains available and the player retains its own identity

#### Scenario: Invalid import
- **WHEN** import is invalid
- **THEN** the operation fails without changing the selection or either wallet's storage

#### Scenario: Switch and return
- **WHEN** the operator imports wallet B after wallet A, then re-enters wallet A's recovery phrase
- **THEN** both remain retained and A becomes selected without duplication or stale balance results from B

#### Scenario: User-facing selection is already present
- **WHEN** F2 has selected a game wallet on the same browser origin
- **THEN** F1 displays and operates on that same selected identity without requiring another import

### Requirement: Inspect public addresses and fresh funds
Admin SHALL show F1. Game Wallet with Login or Logout only. F1 Login SHALL use the shared encrypted import flow. Public wallet Details and payment-usable balance SHALL appear beside F3. Details SHALL refresh and write only public wallet details, receiving addresses, balances, configured recipient and mismatch/read status into the Admin console. Logout SHALL persistently deselect without deleting retained identities or changing the player or payment recipient. F3 SHALL show Balance: <payment-usable sats> sats immediately left of Details, including 0 when an unresolved wallet operation blocks spending even if the raw balance is positive. Loading and unavailable data SHALL remain distinguishable from a known zero. Details SHALL report F3 Wallet Status, the payment eligibility and usable balance as well as the raw public balance. Arkade script-event notifications SHALL trigger fresh balance reads without recurring polling. Logout and wallet switching SHALL stop the previous subscription; disconnected live data SHALL be shown as unavailable. No separate Copy/Refresh buttons SHALL appear; F3 provides the explicitly requested boarding action.

#### Scenario: Payment receipt is visible
- **WHEN** an independent player pays the configured game wallet and Admin clicks Details after provider evidence is available
- **THEN** the Admin console displays the freshly observed recipient balance reflecting receipt

#### Scenario: Selected recipient
- **WHEN** the operator selects an imported game wallet
- **THEN** the demo routes new Continue requests to its public Arkade address and reports public configuration-save failures
- **AND** previously submitted operations retain their original recipients

#### Scenario: Manual funding preparation
- **WHEN** the operator inspects F1. Game Wallet
- **THEN** Details makes both receiving addresses available in the Admin console for manual copying, without submitting a wallet operation

### Requirement: F3 explicit boarding and live waiting state
Admin SHALL provide F3. Board Game Wallet with Details and Board Wallet, operating on the game wallet selected through F1/F2. Details SHALL refresh and report F3 Boarding Status in the Admin console without preparing or submitting a boarding payment. Board Wallet SHALL show a quote before a separate explicit confirmation submits it. Existing wallet mutation and recovery safeguards SHALL remain effective.

#### Scenario: Inspect boarding
- **WHEN** the operator clicks F3 Details
- **THEN** the console shows freshly checked boarding status without a new submission

#### Scenario: Review then confirm
- **WHEN** an eligible operator activates F3 Board Wallet
- **THEN** the boarding quote is shown for a separate confirmation before submission

