# toast-messaging Specification

## Purpose

Provide brief user-facing BIS notifications through one shared, ordered toast presentation that works within the host runtime without interrupting gameplay or requiring an account.

## Requirements

### Requirement: Shared notification entry point

BIS SHALL provide a public notification entry point accepting plain text, an optional image URL, and an optional duration in milliseconds. Runtime producers and host applications SHALL use the same notification delivery path. Text-only delivery SHALL work without an account, wallet operation, or network connection. Blank messages SHALL be ignored; accepted text SHALL be rendered literally rather than interpreted as markup. Missing, non-finite, non-positive, or unsupported timer-range durations SHALL use the 3000 ms default.

#### Scenario: Logged-out notification
- **WHEN** a live BIS context with mounted UI receives a notification while its account screen is closed and no account is active
- **THEN** the runtime displays the notification without opening Account or starting a wallet operation

#### Scenario: Input handling
- **WHEN** a caller submits blank text followed by nonblank text containing markup characters with an invalid duration
- **THEN** only the nonblank message is displayed, its markup characters remain literal text, and its hold duration is 3000 ms

### Requirement: Timed top-edge presentation

With normal motion enabled, each toast SHALL slide down from fully outside the top edge of the runtime viewport, remain fully visible for its configured hold duration, then slide back up completely out of view. The default hold SHALL be 3000 ms, excluding entry and exit animations. A valid per-message duration SHALL override that hold for that message only. Presentation SHALL remain inside the mounted runtime bounds and SHALL respect demo preview scaling.

#### Scenario: Default lifetime
- **WHEN** a default-duration toast begins its entry animation
- **THEN** its 3000 ms hold begins after entry completes, exit begins after the hold, and the message disappears completely when exit completes

#### Scenario: Duration override
- **WHEN** a 5000 ms toast is followed by a toast with no duration override
- **THEN** their fully visible holds are 5000 ms and 3000 ms respectively

### Requirement: Ordered single-toast delivery

BIS SHALL display at most one toast at a time and queue subsequent messages in arrival order. A new message SHALL neither replace the current message nor restart its timer. The next toast SHALL begin entering only after the current toast finishes exiting. Identical message text SHALL remain separate queue entries.

#### Scenario: Burst including duplicates
- **WHEN** three messages arrive while the first is entering, visible, or exiting, including two with identical text
- **THEN** every submitted message is presented once in arrival order, with its own full hold and exit, without stacking or replacement

### Requirement: Nonblocking accessible feedback

Toast presentation SHALL preserve keyboard focus and underlying pointer interaction, wrap brief multi-line text within runtime bounds, and announce each message politely to assistive technology, including consecutive identical messages. When reduced motion is requested, entry and exit movement SHALL be omitted while preserving the configured hold and queue order. Toasts SHALL remain available independently of account-screen visibility and the runtime operation dialog's inert content.

#### Scenario: Interaction during a toast
- **WHEN** a toast appears while a user has keyboard focus on an existing runtime control
- **THEN** focus remains there, the toast creates no tab stop, and pointer events are not intercepted by the toast layer

#### Scenario: Reduced motion
- **WHEN** reduced motion is enabled and two messages arrive
- **THEN** the messages appear and disappear without sliding and retain their individual hold durations and FIFO ordering

#### Scenario: Operation dialog coexists with notification
- **WHEN** an explicit notification is submitted while a host-local pending or error dialog is open
- **THEN** the toast remains visible and available for announcement outside inert content, without changing dialog focus, acknowledgment, or input blocking

### Requirement: Context and presentation lifecycle

Notifications SHALL be isolated to their originating BIS context and SHALL NOT be persisted or broadcast across tabs. Submissions before initial UI mount SHALL wait until presentation is available before consuming their hold duration. A real UI unmount SHALL clear its current toast and existing backlog and stop presentation callbacks; later explicit submissions to the still-live context SHALL wait for its next mount. Context disposal SHALL clear notification state and prevent subsequent delivery. Ordinary account navigation SHALL NOT clear the queue. Framework development effect replay SHALL NOT duplicate, lose, or prematurely complete messages.

#### Scenario: Mount after submission
- **WHEN** a live context receives a message before its first UI mount
- **THEN** the message receives its full lifetime once that context's UI is mounted

#### Scenario: Unmount and replacement
- **WHEN** a UI with a visible toast and queued messages unmounts, and a replacement UI is mounted
- **THEN** the previous message and backlog do not replay and stale callbacks do not modify the replacement presentation

#### Scenario: Independent contexts
- **WHEN** one of two live contexts receives a notification and is later disposed
- **THEN** the other context never displays that notification and no later callback from the disposed context changes either UI

### Requirement: Notification and acknowledgment boundary

Toasts SHALL carry brief noncritical notifications. Errors requiring acknowledgment SHALL retain their existing dialogs and OK actions. Confirmations, pending operation presentation, and uncertain-outcome recovery information SHALL retain their current behavior. D1 SHALL NOT automatically translate existing wallet outcomes or inline clipboard indicators into notifications. Notification callers SHALL supply safe user-facing text without including secrets or raw wallet diagnostic payloads.

#### Scenario: Acknowledgment-required error
- **WHEN** an operation fails with an existing acknowledgment-required error
- **THEN** its error dialog stays present until acknowledgment and is not replaced or dismissed by a toast timeout

### Requirement: Optional left-hand image

A notification with a valid image URL SHALL show the image to the left of its text, preserving the image's proportions and fitting it within the toast. Image URLs SHALL support credential-free HTTPS and host-root-relative bundled paths. Notifications without an image SHALL retain their text-only layout. A trophy-award caller SHALL supply the awarded trophy asset's image URL after confirming its own award outcome; the generic notification system SHALL NOT infer, initiate, or fabricate an award.

Image preparation SHALL finish before the toast enters and SHALL have a maximum 3-second wait. Missing, invalid, failed, undecodable, or timed-out artwork SHALL fall back to text-only without blocking later messages. Preparation SHALL NOT consume the configured fully visible hold. Late image callbacks after unmount or disposal SHALL NOT revive a toast.

#### Scenario: Trophy image
- **WHEN** the caller submits trophy notification text and that trophy asset's valid image URL
- **THEN** the toast shows that image on the left and the text on the right after preparation, with its full visible hold

#### Scenario: Text-only or unavailable artwork
- **WHEN** no image is supplied or the optional image cannot be prepared within 3 seconds
- **THEN** the message appears as a text-only toast, receives its full hold, and then permits the next queued notification

#### Scenario: Runtime scrolls into view
- **WHEN** the mounted runtime is scrolled into the visible browser viewport
- **THEN** the toast clipping bounds update to that visible runtime and the image and text stay within it
