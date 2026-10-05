## MODIFIED Requirements

### Requirement: Admin mint form
C1 Mint Asset SHALL open an Admin-owned form with Destination, Name, Ticker, Amount, Decimals, optional Icon URL, an Unverified asset summary, and read-only Control Asset: None. Destination SHALL offer Player wallet and Game wallet, defaulting to Game wallet for a new window. The selected wallet SHALL fund and receive its own issuance through its existing generic mint API. Name/ticker/amount SHALL be required. The form SHALL use editable defaults of an asset, ASSET, 1, and 0 respectively, with blank Icon URL. Existing/New control-asset choices SHALL NOT be offered. Only an explicit valid Mint action SHALL call the generic production mint API. Pending/results/errors SHALL appear in Admin Console with the destination and actual operation's public wallet identity. Pending submission SHALL disable edits and duplicate submission; bounded unknown outcomes SHALL preserve the request, destination, wallet identity and operation ID for reconciliation.

C1 SHALL remain accessible when either wallet is present and active for an explicit mint attempt or pending-mint recovery, without requiring the other wallet or a separate Admin balance precheck. The form SHALL explain when the selected wallet is absent or inactive, and SHALL display actual insufficient-funds or other failures returned by production minting and SHALL NOT silently switch wallets, fund a wallet, or transfer assets. Pending-state lookup SHALL complete successfully for the selected wallet before a new mint is allowed. Changing an idle destination SHALL preserve editable metadata, assign a fresh operation ID for a new request, and inspect that wallet's pending mint. A recovered pending request SHALL replace the editable draft and lock its metadata and destination. Closing and reopening SHALL retain access to each wallet's recovery records. Account replacement or logout SHALL invalidate the affected form session and prevent late results from being shown as belonging to a new wallet.

#### Scenario: Edit and mint
- **WHEN** the user opens C1, selects either destination, edits valid fields, and clicks Mint
- **THEN** that wallet's public API receives those values with no control asset and Admin Console shows pending followed by the returned result
- **AND** the form summary before success is not represented as wallet ownership

#### Scenario: Invalid or cancelled form
- **WHEN** inputs are invalid or the user dismisses the idle form
- **THEN** no mint is submitted and relevant validation or ordinary Admin controls remain available

#### Scenario: Player wallet without a game wallet
- **WHEN** only the player wallet is available and Admin opens C1
- **THEN** Admin can select Player wallet and mint through it
- **AND** Game wallet shows its unavailability without blocking Player wallet

#### Scenario: Game wallet without a player wallet
- **WHEN** only the game wallet is available and Admin opens C1
- **THEN** Admin can mint to Game wallet without logging in a player

#### Scenario: Selected wallet cannot mint
- **WHEN** the selected wallet is missing or its pending-state lookup fails
- **THEN** the form explains the condition and prevents new submission to that wallet
- **AND** no other wallet is charged or used as a fallback

#### Scenario: Production and Admin player mint parity
- **WHEN** the same active player wallet and valid asset request can mint through the production entry point
- **THEN** Admin Player wallet selection reaches that same entry point without an independent balance veto
- **AND** production collection policy, issuance, funds checks, reservation safeguards and reward behavior remain unchanged

#### Scenario: Stale Admin balance information
- **WHEN** old or unavailable Admin balance information disagrees with current production mint eligibility
- **THEN** that information does not disable an otherwise valid explicit Mint attempt
- **AND** production validates current funds and returns the authoritative result

#### Scenario: Insufficient production funds
- **WHEN** Admin explicitly mints and the production method determines eligible funds are insufficient
- **THEN** it submits no network issuance and Admin displays that returned failure
- **AND** no other wallet funds the request

#### Scenario: Change destination before submission
- **WHEN** Admin changes the destination of an idle draft with no unresolved operation
- **THEN** metadata is preserved and the selected wallet's recovery state is checked before submission is enabled
- **AND** a new request has a fresh operation ID unless an existing pending request is recovered

#### Scenario: Recover unresolved issuance
- **WHEN** a wallet has an unresolved mint and Admin selects that destination and chooses Resume pending mint
- **THEN** its original request is restored with its original operation ID and locked destination
- **AND** checking status reconciles that wallet's operation without starting issuance in either wallet

#### Scenario: Wallet changes while window is open
- **WHEN** the selected wallet identity changes or is removed during a draft or operation
- **THEN** that form session is invalidated and cannot submit or reconcile against the replacement wallet
- **AND** late results cannot be attributed to the replacement wallet

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

## ADDED Requirements

### Requirement: Admin payment direction labels
B1 SHALL append `(Player->Game)` to its existing quoted payment label without changing its BIS-owned continuation price. F3 SHALL display `F3. Send 100 Sats (Game->Player)` and its payment SHALL deliver exactly 100 sats to the player, with fees charged separately. Existing availability suffixes and guards SHALL remain applicable. Previously recorded payments SHALL retain their original amounts for recovery.

#### Scenario: Inspect payment actions
- **WHEN** Admin renders B1 and F3
- **THEN** their labels show the respective payment directions
- **AND** B1 retains its existing amount while a new F3 payment requests 100 sats
