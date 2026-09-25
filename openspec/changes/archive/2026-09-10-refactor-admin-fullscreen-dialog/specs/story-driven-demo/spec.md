## MODIFIED Requirements

### Requirement: Admin mint form
C1 Mint Asset SHALL open in the Admin fullscreen dialog with Destination, Name, Ticker, Amount, Decimals, optional Icon URL, an Unverified asset preview, and read-only Control Asset: None. The dialog content SHALL appear in this order: Quick fill, Preview, then Form. Quick fill SHALL begin with Clear followed by the existing achievement presets. Clear SHALL restore a fresh default mint draft while preserving the selected destination. Preview SHALL retain the existing unverified summary, SHALL keep a fixed footprint while its values change, and SHALL render the Icon URL image when Icon URL has a value; no image SHALL render for a blank Icon URL. Form SHALL contain the existing destination selector and mint fields. Destination and Control Asset SHALL share one row at equal widths, matching the existing equal-width Name and Ticker row. Destination SHALL offer Player wallet and Game wallet, defaulting to Game wallet for a new window. The selected wallet SHALL fund and receive its own issuance through its existing generic mint API. Name/ticker/amount SHALL be required. The form SHALL use editable defaults of an asset, ASSET, 1, and 0 respectively, with blank Icon URL. Existing/New control-asset choices SHALL NOT be offered. Only an explicit valid Mint action SHALL call the generic production mint API. The Mint or Done action SHALL precede a dialog console output region that presents the existing mint guidance, validation, progress, result, and error text. Pending/results/errors SHALL also appear in Admin Console with the destination and actual operation's public wallet identity. Pending submission SHALL disable edits and duplicate submission; bounded unknown outcomes SHALL preserve the request, destination, wallet identity and operation ID for reconciliation.

C1 SHALL remain accessible when either wallet is present and active for an explicit mint attempt or pending-mint recovery, without requiring the other wallet or a separate Admin balance precheck. The form SHALL explain in its console output when the selected wallet is absent or inactive, and SHALL display actual insufficient-funds or other failures returned by production minting and SHALL NOT silently switch wallets, fund a wallet, or transfer assets. Pending-state lookup SHALL complete successfully for the selected wallet before a new mint is allowed. Changing an idle destination SHALL preserve editable metadata, assign a fresh operation ID for a new request, and inspect that wallet's pending mint. A recovered pending request SHALL replace the editable draft and lock its metadata and destination. Closing and reopening SHALL retain access to each wallet's recovery records. Account replacement or logout SHALL invalidate the affected form session and prevent late results from being shown as belonging to a new wallet.

#### Scenario: Edit and mint
- **WHEN** the user opens C1, uses Quick fill or edits the Form, selects either destination, and clicks Mint
- **THEN** the Preview reflects the draft and that wallet's public API receives the valid values with no control asset
- **AND** the dialog console output below the action shows current progress or feedback while Admin Console shows pending followed by the returned result
- **AND** the preview before success is not represented as wallet ownership

#### Scenario: Inspect the Mint Asset composition
- **WHEN** C1 opens
- **THEN** Quick fill appears first, Preview appears below it, and Form appears below Preview using the existing controls
- **AND** the Mint or Done action appears above the dialog console output
- **AND** the shared upper-right `X` is used instead of a back arrow

#### Scenario: Clear a Quick fill selection
- **WHEN** Admin has selected a preset or edited the draft and activates Clear
- **THEN** Name, Ticker, Amount, Decimals, and Icon URL return to their new-window defaults with a fresh operation ID
- **AND** Clear remains the leftmost Quick fill action and the selected destination does not change

#### Scenario: Compact destination and control row
- **WHEN** C1 renders the Form
- **THEN** Destination appears to the left of Control Asset on one row
- **AND** both fields occupy equal widths

#### Scenario: Preview an icon URL
- **WHEN** Icon URL contains a value
- **THEN** Preview renders that URL as the asset image alongside the existing summary
- **AND** changing or clearing Icon URL updates or removes the preview image without submitting a mint
- **AND** the Preview keeps the same dimensions while the icon is added, changed, loaded, or removed

#### Scenario: Invalid or cancelled form
- **WHEN** inputs are invalid or the user dismisses the idle form
- **THEN** no mint is submitted and relevant validation appears in the dialog console output or ordinary Admin controls remain available

#### Scenario: Player wallet without a game wallet
- **WHEN** only the player wallet is available and Admin opens C1
- **THEN** Admin can select Player wallet and mint through it
- **AND** Game wallet shows its unavailability without blocking Player wallet

#### Scenario: Game wallet without a player wallet
- **WHEN** only the game wallet is available and Admin opens C1
- **THEN** Admin can mint to Game wallet without logging in a player

#### Scenario: Selected wallet cannot mint
- **WHEN** the selected wallet is missing or its pending-state lookup fails
- **THEN** the dialog console output explains the condition and prevents new submission to that wallet
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
- **THEN** it submits no network issuance and the dialog console output displays that returned failure
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
