# admin-game-wallet Specification

## Purpose

Provide a separately retained Admin game wallet whose public addresses and live balance can be inspected independently of the player wallet.

**A.G.2 story status:** Board Wallet ✓ — complete, confirmed by the user on 2026-09-09. This completion applies to A.G.2; other game-wallet stories retain their separate status.

## Requirements

### Requirement: Import and retain an independent game wallet
Admin SHALL explicitly import a game wallet through one recovery-phrase text field and retain it in encrypted browser storage independently of the player. Import SHALL NOT activate or replace the player wallet or expose secrets in public state, logs or build artifacts. Invalid input SHALL leave storage unchanged. Importing a different game wallet SHALL retain previous identities and select the imported wallet. Re-entering a saved identity SHALL select it without duplication. There SHALL be no wallet dropdown. Importing or selecting the active Player Wallet identity as the Game Wallet SHALL fail with a clear explanation before it changes game-wallet storage or active state. The same revalidation SHALL occur when a pending Game Wallet selection completes or a Player Wallet changes while Game Wallet work is in flight. Reload SHALL restore the last-selected non-conflicting Game Wallet and fetch its current balance using the shared bounded retry policy; a detected role conflict SHALL not activate that Game Wallet or alter the Player Wallet.

#### Scenario: Import and reload
- **WHEN** Admin imports a valid identity different from the logged-in player and reloads
- **THEN** the game wallet remains available and the player retains its own identity
- **AND** a transient first balance-read failure is retried before the wallet is reported unavailable

#### Scenario: Player Wallet conflicts with Game Wallet import
- **WHEN** Admin imports or selects a Game Wallet identity whose public profile ID matches the active Player Wallet
- **THEN** BIS immediately reports the role conflict and retains the prior Game Wallet selection and Player Wallet unchanged
- **AND** no recovery material enters public state, logs, or artifacts

#### Scenario: Invalid import
- **WHEN** import is invalid
- **THEN** the operation fails without changing the selection or either wallet's storage

#### Scenario: Switch and return
- **WHEN** the operator imports wallet B after wallet A, then re-enters wallet A's recovery phrase
- **THEN** both remain retained and A becomes selected without duplication or stale balance results from B

### Requirement: Player lifecycle preserves the game wallet

Player Wallet logout or an Admin Game Wallet reset SHALL deselect the active Game Wallet session and invalidate Game Wallet-owned pending, cached, subscription, and in-memory session state while preserving retained encrypted Game Wallet identities for a later explicit login. Player Wallet logout SHALL not be blocked by Game Wallet cleanup. Game Wallet logout alone SHALL not clear or change the Player Wallet. Game-wallet state changes in another tab SHALL NOT change the active player. Existing pending-player-operation protections SHALL remain effective.

#### Scenario: Player logs out

- **WHEN** the player logs out with a Game Wallet present
- **THEN** the Player Wallet and Game Wallet are both logged out as one local lifecycle transition
- **AND** the retained Game Wallet identity remains available for a later explicit login
- **AND** logging the Player Wallet in again does not reactivate the old Game Wallet

#### Scenario: Game Wallet logs out independently

- **WHEN** the user logs out only the Game Wallet while the Player Wallet is active
- **THEN** the active Game Wallet session and Game Wallet-owned local state are removed
- **AND** retained Game Wallet identities remain available for a later explicit login
- **AND** the Player Wallet remains active and its state is unchanged
- **AND** a later Game Wallet login requires a fresh explicit import

#### Scenario: Cross-tab import

- **WHEN** another tab imports the game wallet
- **THEN** Admin can observe that wallet without replacing or logging out the player

### Requirement: Inspect public addresses and fresh funds
Admin SHALL show A.G.1. Game Wallet with buttons to its right under F. Game Wallet. A.G.1 SHALL contain Login or Logout only. Login SHALL use the existing encrypted import flow. Public wallet Details and payment-usable balance SHALL appear beside A.G.3. Details SHALL refresh and write only public wallet details, receiving addresses, balances, configured recipient and mismatch/read status into the Admin console. Logout SHALL persistently deselect without deleting retained identities or changing the player or payment recipient. A.G.3 SHALL show Balance: <payment-usable sats> sats immediately left of Details, including 0 when an unresolved wallet operation blocks spending even if the raw balance is positive. Loading and unavailable data SHALL remain distinguishable from a known zero. Details SHALL report A.G.3 Wallet Status, the payment eligibility and usable balance as well as the raw public balance. Arkade script-event notifications SHALL trigger bounded fresh balance reads with retry and recovery; a subscription failure SHALL not erase a still-valid fresh balance without a failed replacement read. Logout and wallet switching SHALL stop the previous subscription; disconnected live data SHALL be shown as unavailable after recovery attempts are exhausted. No separate Copy/Refresh buttons SHALL appear; A.G.2 provides the explicitly requested boarding action.

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

#### Scenario: Transient Game Wallet read failure
- **WHEN** a fresh address or balance read fails transiently for the selected Game Wallet
- **THEN** BIS retries within the shared bounded policy
- **AND** a successful retry publishes the selected wallet as ready with validated current public data

#### Scenario: Retry exhaustion
- **WHEN** all bounded Game Wallet read attempts fail or provider/indexer data is invalid or inconsistent
- **THEN** the selected identity remains retained but its read state becomes unavailable
- **AND** the Admin console reports unavailable rather than zero or stale balances

#### Scenario: Live subscription failure with valid balance
- **WHEN** the Game Wallet live event subscription closes after a valid balance has been read
- **THEN** BIS attempts bounded recovery reads before replacing that balance with unavailable
- **AND** logout or wallet switching cancels the old subscription and all recovery work

### Requirement: A.G.3 explicit boarding and live waiting state
Admin SHALL provide A.G.2. Board Wallet with Details and Board Wallet. Details SHALL refresh and report A.G.2 Boarding Status in the Admin console without preparing or submitting a boarding payment. Board Wallet SHALL show a quote before a separate explicit confirmation submits it. Existing wallet mutation and recovery safeguards SHALL remain effective.

#### Scenario: Inspect boarding
- **WHEN** the operator clicks A.G.2 Details
- **THEN** the console shows freshly checked boarding status without a new submission

#### Scenario: Review then confirm
- **WHEN** an eligible operator activates Board Wallet
- **THEN** the boarding quote is shown for a separate confirmation before submission

### Requirement: Live evidence controls boarding waiting indication
A.G.2 Board Wallet SHALL be disabled with (Awaiting Confirmation) only when fresh incoming transaction data proves that this wallet's boarding transaction is unconfirmed, in addition to ordinary busy and account availability restrictions. Saved operation history SHALL only identify the wallet transaction to inspect; a persisted boarded flag SHALL NOT establish the waiting state. Confirmed, unrelated, unavailable or stale evidence SHALL NOT establish this waiting indication. Details SHALL remain available when only this waiting state blocks submission.

#### Scenario: Matching live unconfirmed boarding
- **WHEN** a fresh unconfirmed transaction matches the wallet's recorded boarding inputs and known commitment ID
- **THEN** Board Wallet is greyed out with (Awaiting Confirmation)

#### Scenario: Confirmation or failed read
- **WHEN** live evidence becomes confirmed or unavailable, or the selected wallet changes
- **THEN** the previous waiting indication is cleared and ordinary mutation safeguards still apply

#### Scenario: Completed boarding
- **WHEN** fresh network evidence confirms the selected wallet boarding transaction
- **THEN** A.G.2 replaces Board Wallet with non-actionable Boarded, including after reload or later deposits
- **AND** no local persisted flag alone establishes completion; unavailable checks show unavailable status without offering another submission

### Requirement: Marketplace batch tools use the active game wallet
C.G.3 and C.G.4 SHALL operate only through the currently active, separately retained Game Wallet signer. Before every burn or listing operation, Admin SHALL revalidate that the selected identity remains active and that the relevant asset ownership and operation intent belong to it. Player profiles SHALL NOT sign, fund, receive, or reconcile C.G.3 or C.G.4 operations.

#### Scenario: Active game wallet changes during C.G.3 or C.G.4
- **WHEN** the selected Game Wallet changes before an item submission
- **THEN** work prepared for the previous wallet cannot submit or be attributed to the replacement
- **AND** already submitted work remains associated with its original public wallet identity for reconciliation

#### Scenario: No active game wallet
- **WHEN** C.G.3 or C.G.4 is requested without an active Game Wallet
- **THEN** Admin reports the game-wallet requirement without submitting a mint or burn

### Requirement: Admin and Runtime share one two-wallet session
The same-origin Admin and Runtime Preview SHALL observe and mutate one active Player Wallet context and one independently selected Game Wallet controller for the lifetime of the demo session. A wallet selected or changed through either surface SHALL become the current wallet for the other surface without duplicating identities or silently creating a second wallet session.

#### Scenario: Runtime-selected wallets appear in Admin
- **WHEN** the operator logs in a distinct Player Wallet and Game Wallet through Runtime Preview on the shared demo origin
- **THEN** Admin A.G.1 and A.G.3 identify and operate on those same public wallet identities
- **AND** Admin SHALL NOT report an empty or unrelated Game Wallet solely because the login occurred through Runtime Preview

#### Scenario: Admin-selected Game Wallet appears in Runtime
- **WHEN** the operator imports or selects a distinct Game Wallet through Admin A.G.1
- **THEN** Runtime Preview A.G.2 and game-facing operations observe the same selected public Game Wallet
- **AND** the Player Wallet remains unchanged

#### Scenario: Wallet or network changes during an operation
- **WHEN** the Player Wallet, Game Wallet, or active network changes while an Admin operation is preparing or reading
- **THEN** the operation is cancelled or rejected before signing or submission if its captured wallet scope is no longer current
- **AND** already-submitted work remains bound to its original public identities and network

### Requirement: A.G.3 reports actionable availability diagnostics
A.G.3 SHALL distinguish a ready wallet, known zero, loading state, insufficient eligible funds, unresolved operation, role or network mismatch, wallet-read failure, provider or live-evidence failure, pending boarding, and confirmed boarding. It SHALL not use a generic unavailable label when a safe specific category is available, and it SHALL not present stale or unavailable data as current spendable balance.

#### Scenario: Live boarding evidence is unavailable
- **WHEN** the selected Game Wallet is ready but the provider cannot supply the fresh transaction evidence needed for the boarding probe
- **THEN** A.G.3 reports live-evidence or provider-read unavailability with a retry-oriented explanation
- **AND** it does not label the wallet boarded, awaiting confirmation, or available for a submission that the failed read cannot justify

#### Scenario: Wallet public read is unavailable
- **WHEN** fresh address or balance reads fail after the bounded retry policy
- **THEN** A.G.3 reports wallet-read unavailability and retains the selected identity without showing the failed balance as zero
- **AND** a later explicit Details action re-evaluates current state

#### Scenario: Ready distinct wallets with eligible funds
- **WHEN** the Player Wallet and distinct Game Wallet are ready on the active network, fresh evidence is available, and no durable operation blocks the requested action
- **THEN** the relevant A.G.3 action is enabled and its Details output identifies the current public wallet scope and payment-usable balance
