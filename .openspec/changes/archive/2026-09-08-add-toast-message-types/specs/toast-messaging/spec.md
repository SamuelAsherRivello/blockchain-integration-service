## ADDED Requirements

### Requirement: Four semantic message types
The public toast API SHALL expose exactly four MessageType values: info, warning, error and success. Every toast SHALL resolve to a type, defaulting to info when omitted or invalid at runtime. Each type SHALL display a distinct icon and coordinated background: blue with circled information icon, amber with warning triangle, red with barred-circle error icon, and green with check mark respectively. Current compact card geometry, runtime containment, duration, queue order and animation SHALL remain intact.

#### Scenario: Four types
- **WHEN** one toast of each type is submitted
- **THEN** each displays its corresponding background and icon in queue order without a visible type word or category colon

#### Scenario: Existing caller
- **WHEN** a caller omits messageType or supplies an invalid runtime value
- **THEN** the toast uses info presentation and retains the caller's duration and literal message

### Requirement: Sentence-case built-in messages
Built-in toast messages SHALL capitalize the first word of each sentence and use lowercase for other ordinary words, including sats, except status endings in parentheses. Arkade and Bitcoin SHALL retain their capitalization. Acronyms and exact identifiers, URLs and interpolated user data SHALL retain their original case. Built-in messages SHALL NOT prepend Info:, Warning:, Error: or Success:. Caller-supplied text SHALL remain literal; capitalization SHALL be applied at application-owned message sources rather than by transforming all queued strings.

#### Scenario: Incoming receipt
- **WHEN** a known sender receipt is pending or verified
- **THEN** its text is `User {short ID} sent you {amount} sats (Pending)` or `User {short ID} sent you {amount} sats (Confirmed)` respectively, preserving the existing verification rules

#### Scenario: Own transfer and trophy
- **WHEN** a transfer or trophy message is emitted
- **THEN** wording uses `Transferred {amount} sats from Bitcoin to Arkade` (or the reverse, with ` (Pending)` when applicable) and `Level {level} trophy collected!`

#### Scenario: Continue payment status wording
- **WHEN** a continue payment starts, remains pending, needs checking, succeeds or definitively fails
- **THEN** its progress text is `You sent {amount} sats (Pending)`, success text is `You sent {amount} sats (Confirmed)`, and fallback failure text is `You could not send {amount} sats (Failed)`
- **AND** status endings in parentheses capitalize their first word across built-in messages

#### Scenario: Literal caller content
- **WHEN** a host supplies mixed-case identifiers or a message containing a colon
- **THEN** the message is preserved exactly and no category prefix is inserted

### Requirement: Consistent producer classification
Pending and checking notifications SHALL use info. Verified receipts and completed transfers, continue payments and trophy awards SHALL use success. Login requirements, unavailable readiness and missing game-recipient configuration SHALL use warning. Failed operations, including dynamic continue failure messages, SHALL use error. D1 and D2 SHALL remain info. Assigning a type SHALL NOT create new notifications, infer an outcome, change F3 balance timing or replace acknowledgment-required dialogs.

#### Scenario: F3 progression
- **WHEN** F3 produces its existing pending and verified receipt notifications
- **THEN** they use info and success respectively with unchanged ordering, verification and deduplication

#### Scenario: Failure and readiness
- **WHEN** a continue attempt fails or cannot start because login/configuration is missing
- **THEN** the existing toast uses error for failure and warning for the readiness condition

### Requirement: Accessible typed appearance
Toast text SHALL maintain at least 4.5:1 contrast against its background and meaningful icon shapes at least 3:1. Assistive technology SHALL receive the message type and message through the existing polite announcement without duplicated icon text. Type SHALL remain distinguishable by shape as well as color. Existing focus preservation and reduced-motion behavior SHALL remain effective.

#### Scenario: Assistive announcement
- **WHEN** an error toast is displayed
- **THEN** its type and message are announced once, without stealing focus or displaying a category prefix

## MODIFIED Requirements

### Requirement: Optional left-hand image
A notification with a valid image URL SHALL show the image to the left of its text, preserving the image's proportions and fitting it within the toast, alongside the message-type icon. Image URLs SHALL support credential-free HTTPS and host-root-relative bundled paths. Notifications without an image SHALL retain the type icon and message. A trophy-award caller SHALL supply the awarded trophy asset's image URL after confirming its own award outcome; the generic notification system SHALL NOT infer, initiate, or fabricate an award.

Image preparation SHALL finish before the toast enters and SHALL have a maximum 3-second wait. Missing, invalid, failed, undecodable, or timed-out artwork SHALL fall back to type-icon-plus-text without blocking later messages. Preparation SHALL NOT consume the configured fully visible hold. Late image callbacks after unmount or disposal SHALL NOT revive a toast.

#### Scenario: Trophy image
- **WHEN** the caller submits trophy notification text and that trophy asset's valid image URL
- **THEN** the toast shows the success icon, image on the left and text on the right after preparation, with its full visible hold

#### Scenario: Text-only or unavailable artwork
- **WHEN** no image is supplied or the optional image cannot be prepared within 3 seconds
- **THEN** the message appears with its type icon, receives its full hold, and then permits the next queued notification

#### Scenario: Runtime scrolls into view
- **WHEN** the mounted runtime is scrolled into the visible browser viewport
- **THEN** the toast clipping bounds update to that visible runtime and the icon, image and text stay within it
