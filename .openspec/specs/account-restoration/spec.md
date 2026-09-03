# account-restoration Specification

## Purpose

Restore access to the same experience-created Signet test account through private phrase entry, verified connectivity, and persistent activation.

## Requirements

### Requirement: Private numbered recovery grid
Restore Account SHALL open a numbered grid for the experience's 12-word English recovery phrase, with manual entry, Paste from Clipboard, one Show checkbox, Restore, and Back. The UI SHALL warn that this is a Signet test account and never to enter or reuse a real-funds recovery phrase. Show SHALL begin unchecked; each nonempty hidden field SHALL display one `*` per character instead of its word, while empty fields remain empty. Checking Show SHALL reveal every word and unchecking SHALL hide every word. Hidden fields SHALL remain editable with keyboard and touch. Recovery material SHALL NOT appear in public state, game events, logs, analytics, URLs, or Admin history.

#### Scenario: Enter and reveal words
- **WHEN** the player opens restoration and types words into numbered fields
- **THEN** nonempty fields are masked and Show is unchecked
- **AND** toggling Show reveals or hides the complete grid without changing its words or validity

### Requirement: Explicit whole-phrase paste
Individual word inputs SHALL also accept multiple whitespace-separated words and distribute them sequentially starting at that field, replacing only the corresponding fields. Typing a space after a word SHALL advance focus to the next field. Input exceeding the remaining field count SHALL preserve existing words and show an error.

Paste from Clipboard SHALL uncheck Show before reading the clipboard and SHALL populate all fields in order only when the phrase has the supported word count. Case and whitespace SHALL be normalized without correcting or reordering words. A wrong word count SHALL leave all entered words unchanged and show an error. Clipboard denial or unavailability SHALL preserve entry and allow manual input. Clipboard reads SHALL occur only on an explicit paste action.

#### Scenario: Enter multiple words in one field
- **WHEN** the player enters or pastes "blah blah" into word field four
- **THEN** fields four and five each contain "blah", with their validation and masks updated
- **AND** other fields remain unchanged

#### Scenario: Paste a copied A2 phrase
- **WHEN** the player clicks Paste from Clipboard with a correctly sized phrase
- **THEN** Show is unchecked before population and all words populate their numbered fields hidden with one `*` per character
- **AND** word and whole-phrase validation update

#### Scenario: Wrong count or inaccessible clipboard
- **WHEN** paste encounters the wrong word count or cannot read the clipboard
- **THEN** the words already entered remain unchanged and hidden, and an explanatory error appears
- **AND** manual entry remains available

### Requirement: Word and complete phrase validation
Each entered field SHALL show a small green indicator for an English BIP39 word or red for an invalid word; empty fields SHALL remain neutral. Indicators SHALL provide an accessible validity description without reading hidden words. Restore SHALL be disabled unless every field is populated and the complete phrase passes BIP39 checksum validation, and while a restoration operation is pending. Validation SHALL run locally before any network request. When all words are individually valid but the checksum fails, indicators SHALL remain green and a phrase-level error SHALL explain that the words do not form a valid recovery phrase.

#### Scenario: Invalid word
- **WHEN** a nonempty field contains a word outside the supported word list
- **THEN** that field has a red invalid indicator and Restore is disabled

#### Scenario: Valid words with invalid checksum
- **WHEN** every field is a valid word but the complete phrase fails its checksum
- **THEN** word indicators remain green and a phrase-level error appears
- **AND** Restore remains disabled without contacting the operator

#### Scenario: Valid phrase
- **WHEN** the complete phrase is valid and no operation is pending
- **THEN** Restore becomes enabled

### Requirement: Signet-gated persistent restoration
The logged-in message SHALL display "You are now logged in as" followed by a line break and "Account ID: ", the first four and last four characters of the active public profile ID separated by an ellipsis, and a period. The shortened ID SHALL use code styling.
Restore SHALL reconstruct the same compatible identity using the creation derivation and SHALL require successful Signet connection before saving or activating. Only account access SHALL be restored; balances, achievements, the full account menu, and gameplay progress SHALL remain outside A3. Successful durable saving SHALL immediately activate the profile, emit accountConnected with its existing public profile ID once for the initiating operation, clear transient recovery input, and return to the Account dialogue showing "You are now logged in as Account ID: <first 4 characters>…<last 4 characters>.", Log Out, and Back. No further Continue step SHALL be required. A restored account SHALL survive reload and browser restart on the same origin/profile using the existing account persistence contract.

#### Scenario: Restore the same account
- **WHEN** an experience-created account's phrase is restored with Signet available and saving succeeds
- **THEN** the original profile ID becomes active, the normal logged-in Account dialogue appears, and accountConnected carries only that public ID
- **AND** reloading the same origin reopens that account without phrase entry

### Requirement: Restoration failure and cancellation
Connection and saving SHALL use the production lightning loader and prevent duplicate submissions. A connection failure SHALL leave the account inactive and unsaved, retain input only temporarily in memory, uncheck Show, and offer Retry and Back. Retry SHALL use the retained phrase. A save failure SHALL NOT claim activation; it SHALL offer safe Retry and Back and reconcile any uncertain durable completion before attempting another save. Back from entry or a failure SHALL clear the transient phrase and return to the logged-out Account dialogue, unless reconciliation finds an already committed account. Back during connection SHALL invalidate pending work; the short saving phase SHALL prevent cancellation until its outcome is reconciled. Ordinary host gameplay SHALL remain usable after leaving the flow.

#### Scenario: Connection unavailable
- **WHEN** restoration cannot establish the required Signet connection
- **THEN** no account is saved or activated, the phrase is retained hidden, and Retry and Back are available
- **AND** Retry reuses that input, while Back clears it

#### Scenario: Save fails
- **WHEN** saving fails or its completion is uncertain
- **THEN** success is not reported prematurely and retry reconciles durable state without duplicate activation

### Requirement: Account lifecycle isolation
Restoration SHALL NOT replace an existing active or persisted account. Back, disposal, reset, and account changes in another context SHALL invalidate obsolete restoration work so it cannot later save or activate. No disposed instance SHALL publish later state or events. The flow SHALL release temporary SDK resources and clear transient input on exit and success.

#### Scenario: Another context changes the account
- **WHEN** another context commits an account or resets local account state while restoration is pending
- **THEN** stale restoration cannot overwrite or repopulate that state and the live context reconciles the current account

#### Scenario: Leave before completion
- **WHEN** the player goes Back during connection or the client is disposed
- **THEN** later asynchronous completion cannot save, activate, or notify former consumers
