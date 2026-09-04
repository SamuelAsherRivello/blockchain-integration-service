# account-invoice-receiving Specification

## Purpose
Let an account receive test funds through a clearly separated Lightning invoice flow while preserving address receiving, truthful payment status, and recovery across navigation and application restart.

## Requirements

### Requirement: Protect unfinished receiving operations from account clearing
Log Out and Reset SHALL be blocked while any account invoice can still be paid or its receipt requires processing or reconciliation. The guard SHALL cover hidden invoices, creation in progress, restart hydration, and other live contexts, and SHALL be enforced by the core clearing APIs as well as the UI. Unknown operation state SHALL fail closed. Expiration on the local clock alone SHALL NOT release an operation that may require receipt processing. Blocking SHALL explain the reason without exposing secrets and SHALL NOT block ordinary navigation. Clearing SHALL become available only when all relevant operations are safely reconciled as no longer payable and requiring no further processing, subject to existing confirmation requirements.

#### Scenario: Hidden payable invoice
- **WHEN** the player leaves Receive while an invoice remains payable
- **THEN** Log Out and Reset remain blocked despite the Receive presentation resetting

#### Scenario: Expired invoice with unfinished receipt
- **WHEN** an invoice expires but its receipt state remains pending or unknown
- **THEN** Log Out and Reset remain blocked until reconciliation establishes that no processing remains

#### Scenario: Cross-context clearing race
- **WHEN** one context attempts clearing while another starts invoice creation for the same account
- **THEN** serialization prevents both account clearing and an actionable invoice without recoverable account state

#### Scenario: All operations resolved
- **WHEN** all tracked invoices are no longer payable and all receipts require no further processing
- **THEN** the receiving-operation block is removed without bypassing ordinary logout acknowledgement

### Requirement: Separate invoice receiving from address receiving
Receive SHALL retain the existing Arkade address and Bitcoin address fields and their copy behavior. Below them it SHALL show a visually grouped Lightning invoice field with Copy and adjacent mutually exclusive No Invoice and With Invoice buttons. Explanatory text SHALL make clear that invoice controls affect only Lightning, not the two addresses. The invoice SHALL NOT be described as a permanent Lightning address. Sending and paid continuation SHALL remain outside this feature.

#### Scenario: Default presentation
- **WHEN** the player enters Receive
- **THEN** No Invoice is selected, the invoice amount is 0, no previous invoice is displayed, and invoice Copy is disabled
- **AND** the two address fields retain their ordinary independent loading and copying behavior

#### Scenario: Invoice controls do not rewrite addresses
- **WHEN** the player selects, creates, hides, or renews an invoice
- **THEN** the Arkade and Bitcoin address values are not modified by that operation

### Requirement: Honest receiving availability
The system SHALL enable live invoice creation only after the configured Signet receiving service, compatible client integration, and recoverable completion path are verified. Without that support, the Lightning section SHALL show Currently unavailable and disable its invoice-generation and copy controls. Ordinary address receiving and Back SHALL remain usable. The runtime and demo SHALL NOT generate fake invoices, simulate payment success, silently switch networks, or use an unavailable retired service as a fallback.

#### Scenario: No supported receiving service
- **WHEN** a supported Signet receiving route has not been verified
- **THEN** Receive shows the unavailable Lightning section without attempting invoice creation
- **AND** displaying this section is not reported as completion of live Lightning receiving

### Requirement: Amount entry and explicit fee review
When invoice receiving is available and no reusable invoice is selected, With Invoice SHALL open an amount prompt initially showing 0 sats with Clear and Submit. Clear SHALL reset the entered amount to 0 and invalidate any fee review. Submit SHALL reject zero, negative, fractional, unsafe, and provider-disallowed amounts without generating an invoice. The entered amount SHALL mean the invoice amount the payer pays, not the net receipt. A valid first Submit SHALL show the payer amount, fee, and net receipt in that same prompt. A second Submit SHALL be required to generate the invoice. Changing the amount or quote terms SHALL invalidate the previous review. The system SHALL NOT silently increase the payer amount.

#### Scenario: Review and generate
- **WHEN** the player enters 1000 sats and presses Submit
- **THEN** the prompt shows 1000 sats as the payer amount together with the quoted fee and net receipt, without presenting a generated invoice
- **WHEN** the player presses Submit again with unchanged valid terms
- **THEN** invoice generation begins for the reviewed amount

#### Scenario: Clear reviewed amount
- **WHEN** the player presses Clear after reviewing fees
- **THEN** the amount becomes 0 and the prior quote is no longer authorized for generation

#### Scenario: Invalid or changed terms
- **WHEN** the amount is invalid or previously reviewed fees change
- **THEN** the system does not generate an invoice using those invalid or unreviewed terms

### Requirement: Display and copy the actual invoice on Receive
After successful generation, the prompt SHALL close and Receive SHALL display the actual validated invoice in its Lightning field. With Invoice SHALL be selected and labeled With Invoice: <amount> sats. Copy SHALL copy only that invoice and SHALL be enabled only while it is known to be valid and unpaid. Pending asynchronous work SHALL expose progress and prevent duplicate submissions. A generation or clipboard error SHALL NOT be represented as successful creation, copying, or receipt. Mainnet, wrong-amount, expired, or unverifiable invoices SHALL NOT be offered for payment.

#### Scenario: Invoice ready
- **WHEN** a valid invoice for a reviewed 1000-sat payer amount is generated
- **THEN** Receive displays it beside an enabled Copy control and the selected button reads With Invoice: 1000 sats
- **AND** there is no separate invoice-result dialog or Generate button

#### Scenario: Duplicate submission
- **WHEN** the player presses Submit repeatedly while creation is pending
- **THEN** the system does not issue duplicate invoice-creation operations

#### Scenario: Invalid response
- **WHEN** generation fails or returns an invoice that cannot be validated
- **THEN** no usable invoice or success state is displayed and invoice Copy remains disabled

### Requirement: Reuse within one Receive visit
Selecting No Invoice SHALL hide the displayed invoice without implying cancellation or discarding its processing state. Selecting With Invoice again during the same Receive visit SHALL restore the same unpaid, unexpired invoice and its amount rather than creating another one.

#### Scenario: Toggle away and back
- **WHEN** a player with an unpaid, unexpired invoice selects No Invoice and then With Invoice without leaving Receive
- **THEN** the exact same invoice and amount are restored without an additional creation request

### Requirement: Explicit expiration and renewal
An expired unpaid invoice SHALL be identified as Expired and SHALL no longer be copyable. Renew SHALL explicitly request a replacement for the same payer amount. Changed fees SHALL require another review before replacement generation. Expiration SHALL NOT automatically create an invoice or erase an operation that still requires reconciliation or recovery.

#### Scenario: Expiration while displayed
- **WHEN** an unpaid invoice expires while Receive is open
- **THEN** Expired and Renew are shown and Copy is disabled
- **AND** no replacement invoice is automatically requested

#### Scenario: Changed renewal fees
- **WHEN** Renew obtains different fee terms for the same payer amount
- **THEN** the player reviews those terms before a replacement invoice is generated

### Requirement: Paid presentation reflects verified receipt
When receipt into the account is confirmed, a displayed invoice SHALL be marked Paid and Copy SHALL be disabled, while its current amount and selection remain unchanged. Invoice creation, payer initiation, or an intermediate held-payment state SHALL NOT alone be treated as confirmed receipt.

#### Scenario: Confirmed receipt while Receive is open
- **WHEN** the receiving operation confirms completion into the account
- **THEN** the displayed invoice is marked Paid with Copy disabled and its amount and selection retained

#### Scenario: Intermediate payment state
- **WHEN** a payment has started but account receipt is not confirmed
- **THEN** it is not shown as a completed receipt

### Requirement: Navigation resets presentation without abandoning receipts
Leaving Receive SHALL clear its selection, amount-entry/review state, and displayed invoice. Returning SHALL restore its default presentation, even if earlier invoices remain actionable. Necessary recovery state SHALL be retained independently. Pending processing SHALL continue while the account is active outside Receive and SHALL resume for that account after application restart without requiring Activity to be opened. A closed browser SHALL NOT be represented as guaranteeing background processing. Account changes SHALL NOT expose or apply one account's receipt to another account.

#### Scenario: Leave and return
- **WHEN** the player leaves Receive with an unfinished invoice and returns
- **THEN** No Invoice is selected, the amount is 0, and the old invoice is not displayed
- **AND** the earlier receiving operation remains tracked independently

#### Scenario: Restart with an unfinished receipt
- **WHEN** the application restarts and loads the same saved account
- **THEN** it resumes reconciliation of that account's unfinished receipts without showing a previous invoice in the default Receive presentation
- **AND** it reconciles completion before retrying a claim, rather than duplicating the receipt

### Requirement: Activity includes pending and confirmed receipts
Activity SHALL include pending and confirmed receive transactions with truthful statuses and available public identifiers. A generated unpaid invoice alone SHALL NOT be falsely represented as a payment in progress. Observations from receiving operations and wallet history SHALL be reconciled so the same logical receipt is not counted twice. Account receipt details SHALL remain inspectable after leaving Receive; secret claim or recovery material SHALL NOT appear in Activity, public events, logs, or demo output.

#### Scenario: Receipt progresses
- **WHEN** a receiving transaction progresses from pending to confirmed
- **THEN** Activity reflects that progression without adding a duplicate logical receipt or treating the invoice face amount as net receipt when fees apply

#### Scenario: Payment to a hidden invoice
- **WHEN** a previously copied invoice is paid after the player has left Receive
- **THEN** its pending and confirmed states appear in Activity without restoring the previous Receive selection
