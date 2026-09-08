## MODIFIED Requirements

### Requirement: F2 pay player demonstration
Admin SHALL display F3 `Send 100 Sats (Game->Player)` under F. Game Wallet after F2. Without an active logged-in Runtime Preview player account, F3 SHALL be visibly greyed out and disabled for pointer and keyboard activation. Availability SHALL react to account changes and also require an eligible F1 sender and no unresolved F3 payment. Activating F3 SHALL use the production payment API; receipt feedback SHALL appear in Runtime Preview through the shared toast UI.

#### Scenario: No preview player
- **WHEN** Runtime Preview has no active player account
- **THEN** F3 remains visible, greyed out and disabled and cannot initiate a payment

#### Scenario: Player logs in or out
- **WHEN** the player logs in with an eligible F1 sender or logs out again
- **THEN** F3 respectively becomes enabled or immediately returns to disabled

#### Scenario: Pay and receive
- **WHEN** the operator clicks enabled F3 and the player receives the verified payment
- **THEN** the preview shows the sender-specific receipt toast without opening a player Send dialog


### Requirement: F2 documentation and acceptance evidence
The user-story documentation SHALL include F3's exact label, payment direction, disabled state and receipt message. Evidence SHALL distinguish isolated tests from live Signet verification and SHALL NOT claim live completion from mocked outcomes.

#### Scenario: Delivery verification
- **WHEN** F3 is reported complete
- **THEN** evidence covers real-browser no-player disabling, account transitions, pending duplicate prevention and runtime toast rendering, plus actual two-wallet payment and receipt correlation
- **AND** unavailable live checks remain explicitly pending


### Requirement: Explain F2 unavailability
F3 SHALL append (Awaiting Balance) only for balance loading or shortage. Other blockers SHALL have an accessible explanation outside the payment button suffix. Awaiting Balance SHALL be used for a balance still loading or below the required amount, rather than masking an unresolved operation. Other reasons SHALL distinguish Awaiting Player, Awaiting Game Wallet, Select A Different Wallet, Sending, Checking Wallet, Awaiting Confirmation, Wallet Operation Unresolved and Wallet Unavailable as applicable.

#### Scenario: Funds locked by unresolved operation
- **WHEN** the wallet has a positive raw balance but an unresolved operation prevents spending
- **THEN** F3 identifies the operation-related block and F3 shows 0 payment-usable sats

#### Scenario: Balance missing or insufficient
- **WHEN** an otherwise eligible wallet is loading its balance or has fewer than 100 usable sats
- **THEN** F3 appends (Awaiting Balance)

