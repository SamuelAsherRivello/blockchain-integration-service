# admin-game-wallet Specification

## Purpose

Provide a separately retained Admin game wallet whose public addresses and live balance can be inspected independently of the player wallet.

## Requirements

### Requirement: Import and retain an independent game wallet
Admin SHALL explicitly import a game wallet through one recovery-phrase text field and retain it in encrypted browser storage independently of the player. Import SHALL NOT activate or replace the player wallet or expose secrets in public state, logs or build artifacts. Invalid input SHALL leave storage unchanged. Importing a different game wallet SHALL retain previous identities and select the imported wallet. Re-entering a saved identity SHALL select it without duplication. There SHALL be no wallet dropdown. Importing the active player's identity as the game wallet SHALL fail with an explanation. Reload SHALL restore the last-selected game wallet and fetch its current balance.

#### Scenario: Import and reload
- **WHEN** Admin imports a valid identity different from the logged-in player and reloads
- **THEN** the game wallet remains available and the player retains its own identity

#### Scenario: Invalid import
- **WHEN** import is invalid
- **THEN** the operation fails without changing the selection or either wallet's storage

#### Scenario: Switch and return
- **WHEN** the operator imports wallet B after wallet A, then re-enters wallet A's recovery phrase
- **THEN** both remain retained and A becomes selected without duplication or stale balance results from B

### Requirement: Player lifecycle preserves the game wallet
Player logout and Admin's existing player reset SHALL preserve the game wallet and its separately scoped state. Game-wallet state changes in another tab SHALL NOT change the active player. Existing pending-player-operation protections SHALL remain effective.

#### Scenario: Player logs out
- **WHEN** the player logs out with a retained game wallet present
- **THEN** the game wallet remains inspectable and its identity is unchanged

#### Scenario: Cross-tab import
- **WHEN** another tab imports the game wallet
- **THEN** Admin can observe that wallet without replacing or logging out the player

### Requirement: Inspect public addresses and fresh funds
Admin SHALL show F1. Game Wallet with buttons to its right under F. Game Wallet. Initially only Import SHALL appear. Once selected, Details and Logout SHALL replace Import. Details SHALL refresh and write only public wallet details, receiving addresses, balances, configured recipient and mismatch/read status into the Admin console. Logout SHALL persistently deselect without deleting retained identities or changing the player or payment recipient. The row SHALL show Balance: <payment-usable sats> sats immediately left of Details, including 0 when an unresolved wallet operation blocks spending even if the raw balance is positive. Loading and unavailable data SHALL remain distinguishable from a known zero. Details SHALL report F1 Wallet Status, the payment eligibility and usable balance as well as the raw public balance. Arkade script-event notifications SHALL trigger fresh balance reads without recurring polling. Logout and wallet switching SHALL stop the previous subscription; disconnected live data SHALL be shown as unavailable. No separate Copy/Refresh buttons SHALL appear; F3 provides the explicitly requested boarding action.

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
Admin SHALL provide F3. Board Game Wallet with Details and Board Wallet. Details SHALL refresh and report F3 Boarding Status in the Admin console without preparing or submitting a boarding payment. Board Wallet SHALL show a quote before a separate explicit confirmation submits it. Existing wallet mutation and recovery safeguards SHALL remain effective.

#### Scenario: Inspect boarding
- **WHEN** the operator clicks F3 Details
- **THEN** the console shows freshly checked boarding status without a new submission

#### Scenario: Review then confirm
- **WHEN** an eligible operator activates Board Wallet
- **THEN** the boarding quote is shown for a separate confirmation before submission

### Requirement: Live evidence controls boarding waiting indication
F3 Board Wallet SHALL be disabled with (Awaiting Confirmation) only when fresh incoming transaction data proves that this wallet's boarding transaction is unconfirmed, in addition to ordinary busy and account availability restrictions. Saved operation history SHALL only identify the wallet transaction to inspect; a persisted boarded flag SHALL NOT establish the waiting state. Confirmed, unrelated, unavailable or stale evidence SHALL NOT establish this waiting indication. Details SHALL remain available when only this waiting state blocks submission.

#### Scenario: Matching live unconfirmed boarding
- **WHEN** a fresh unconfirmed transaction matches the wallet's recorded boarding inputs and known commitment ID
- **THEN** Board Wallet is greyed out with (Awaiting Confirmation)

#### Scenario: Confirmation or failed read
- **WHEN** live evidence becomes confirmed or unavailable, or the selected wallet changes
- **THEN** the previous waiting indication is cleared and ordinary mutation safeguards still apply
