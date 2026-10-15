# Spec Delta

## MODIFIED Requirements

### Requirement: Admin mint form
C1 Mint Asset SHALL open in the Admin fullscreen dialog with Source wallet, Destination wallet, Name, Ticker, Amount, Decimals, optional Icon URL, an Unverified asset preview, and read-only Control Asset: None. The dialog content SHALL appear in this order: Quick fill, Preview, then Form. Quick fill SHALL begin with Clear followed by the existing achievement presets. Clear SHALL restore a fresh default mint draft while preserving the selected source and destination. Preview SHALL retain the existing unverified summary, SHALL keep a fixed footprint while its values change, and SHALL render the Icon URL image when Icon URL has a value; no image SHALL render for a blank Icon URL. Form SHALL contain source and destination selectors and the mint fields. Source and Destination SHALL be presented as distinct controls, and Control Asset SHALL remain read-only None. Source SHALL display `Game wallet` as its only value and SHALL be disabled or otherwise non-editable. Destination SHALL offer `Player wallet` and `Game wallet`, defaulting to `Game wallet` for a new window. The Game Wallet source SHALL fund issuance in every case. When Destination is Game Wallet, the issued asset SHALL remain there; when Destination is Player Wallet, the issued asset SHALL be delivered from Game Wallet to Player Wallet after issuance through the production asset-delivery boundary. Name/ticker/amount SHALL be required. The form SHALL use editable defaults of an asset, ASSET, 1, and 0 respectively, with blank Icon URL. Existing/New control-asset choices SHALL NOT be offered. Only an explicit valid Mint action SHALL call the generic production mint-and-delivery flow. The Mint or Done action SHALL precede a dialog console output region that presents the existing mint guidance, validation, progress, result, and error text. Pending/results/errors SHALL also appear in Admin Console with the fixed source identity and selected destination identity. Pending submission SHALL disable edits and duplicate submission; bounded unknown outcomes SHALL preserve the request, source, destination, wallet identities and operation ID for reconciliation.

C1 SHALL require an active Game Wallet source for a new mint or pending-mint recovery. A Player Wallet SHALL be required only when Destination is Player Wallet. The form SHALL explain in its console output when the source or selected destination is absent or inactive, and SHALL display actual insufficient-funds or other failures returned by production issuance or delivery. It SHALL NOT silently switch wallets, fund a wallet, issue directly from Player Wallet, or claim delivery before both operations are confirmed. Pending-state lookup SHALL complete successfully for the fixed source and selected destination before a new mint is allowed. Changing an idle destination SHALL preserve editable metadata, assign a fresh operation ID for a new request, and inspect source-scoped recovery state. A recovered pending request SHALL replace the editable draft and lock its metadata, source, and destination. Closing and reopening SHALL retain access to source-scoped recovery records. Account replacement or logout SHALL invalidate the affected form session and prevent late results from being shown as belonging to a new wallet.

#### Scenario: Mint from Game Wallet to Player Wallet
- **WHEN** the operator opens C1, leaves Source as Game wallet, selects Player wallet as Destination, enters valid details, and clicks Mint
- **THEN** issuance is funded and signed by Game Wallet
- **AND** the issued quantity is delivered from Game Wallet to Player Wallet
- **AND** the result is reported only after the issuance and delivery outcomes are reconciled

#### Scenario: Mint from Game Wallet to Game Wallet
- **WHEN** the operator selects Game wallet as Destination and submits valid details
- **THEN** Game Wallet funds and retains the issued asset without a Player Wallet requirement

#### Scenario: Inspect source and destination controls
- **WHEN** C1 opens
- **THEN** Source displays Game wallet as a fixed non-editable value
- **AND** Destination is independently selectable between Player wallet and Game wallet

#### Scenario: Insufficient Game Wallet funds
- **WHEN** the Game Wallet has insufficient eligible spendable funds for issuance
- **THEN** no issuance or delivery is submitted
- **AND** the dialog displays the returned insufficient-funds failure

#### Scenario: Missing Player Wallet destination
- **WHEN** Player wallet is selected as Destination but no active Player Wallet is available
- **THEN** C1 prevents submission before issuance
- **AND** the Game Wallet is not charged

#### Scenario: Recover an unresolved source or delivery operation
- **WHEN** issuance or a subsequent Game-to-Player delivery has an unresolved outcome
- **THEN** Resume pending mint restores the original request, fixed source, destination, and operation identity
- **AND** reconciliation checks the unresolved phase without issuing or delivering a duplicate

#### Scenario: Clear a Quick fill selection
- **WHEN** Admin has selected a preset or edited the draft and activates Clear
- **THEN** Name, Ticker, Amount, Decimals, and Icon URL return to their new-window defaults with a fresh operation ID
- **AND** Source remains Game wallet
- **AND** Destination does not change

#### Scenario: Invalid or cancelled form
- **WHEN** inputs are invalid or the user dismisses the idle form
- **THEN** no issuance or delivery is submitted and relevant validation appears in the dialog console output or ordinary Admin controls remain available

#### Scenario: Wallet changes while window is open
- **WHEN** the Game Wallet source or selected destination identity changes or is removed during a draft or operation
- **THEN** that form session is invalidated and cannot submit or reconcile against the replacement wallet
- **AND** late results cannot be attributed to the replacement wallet

#### Scenario: Edit and mint
- **WHEN** the user opens C1, uses Quick fill or edits the Form, selects a destination, and clicks Mint
- **THEN** the Preview reflects the draft and Game Wallet receives the valid issuance request as source
- **AND** the selected destination receives or retains the exact asset according to the source/destination flow
- **AND** the preview before success is not represented as wallet ownership

#### Scenario: Inspect the Mint Asset composition
- **WHEN** C1 opens
- **THEN** Quick fill appears first, Preview appears below it, and Form appears below Preview using the existing controls
- **AND** the Mint or Done action appears above the dialog console output
- **AND** the shared upper-right `X` is used instead of a back arrow

#### Scenario: Compact destination and control row
- **WHEN** C1 renders the Form
- **THEN** Source and Destination appear as distinct wallet controls before Control Asset
- **AND** the controls remain compact and readable without changing the existing form hierarchy

#### Scenario: Preview an icon URL
- **WHEN** Icon URL contains a value
- **THEN** Preview renders that URL as the asset image alongside the existing summary
- **AND** changing or clearing Icon URL updates or removes the preview image without submitting issuance or delivery
- **AND** the Preview keeps the same dimensions while the icon is added, changed, loaded, or removed

#### Scenario: Player wallet without a game wallet
- **WHEN** only the Player Wallet is available and Admin opens C1
- **THEN** Source reports that Game Wallet is required
- **AND** C1 cannot submit a Player-destination or Game-destination mint

#### Scenario: Game wallet without a player wallet
- **WHEN** only the Game Wallet is available and Admin opens C1
- **THEN** Admin can mint to Game Wallet
- **AND** selecting Player Wallet as Destination remains unavailable until a Player Wallet is active

#### Scenario: Selected wallet cannot mint
- **WHEN** the fixed Game Wallet source is missing or its pending-state lookup fails
- **THEN** the dialog console output explains the condition and prevents new submission
- **AND** no Player Wallet is charged or used as a fallback

#### Scenario: Production and Admin player mint parity
- **WHEN** the same active Game Wallet can issue and the selected Player Wallet can receive through the production entry point
- **THEN** Admin Player Wallet destination selection reaches that same production issuance-and-delivery flow
- **AND** production quantity, reservation, delivery, and recovery safeguards remain authoritative

#### Scenario: Stale Admin balance information
- **WHEN** old or unavailable Admin balance information disagrees with current Game Wallet mint eligibility
- **THEN** that information does not silently switch the source or disable an otherwise valid explicit Mint attempt
- **AND** production validates current Game Wallet funds and returns the authoritative result

#### Scenario: Insufficient production funds
- **WHEN** Admin explicitly mints and the production method determines Game Wallet eligible funds are insufficient
- **THEN** it submits no network issuance or delivery and the dialog console output displays that returned failure
- **AND** Player Wallet funds do not fund the request

#### Scenario: Change destination before submission
- **WHEN** Admin changes the destination of an idle draft with no unresolved operation
- **THEN** metadata is preserved and the selected destination's readiness is checked before submission is enabled
- **AND** a new request has a fresh operation ID unless an existing source-scoped pending request is recovered

#### Scenario: Recover unresolved issuance
- **WHEN** a source issuance or delivery has an unresolved operation and Admin chooses Resume pending mint
- **THEN** its original request, Game Wallet source, destination, and operation identity are restored and locked
- **AND** checking status reconciles the operation without starting duplicate issuance or delivery in either wallet
