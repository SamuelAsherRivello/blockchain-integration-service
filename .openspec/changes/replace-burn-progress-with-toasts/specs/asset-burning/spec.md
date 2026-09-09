## MODIFIED Requirements

### Requirement: Explicit reusable burn confirmation
Asset Detail SHALL place Burn above Back. Burn SHALL open the reusable Confirmation modal with Are you sure?, OK and Cancel, focus containment, initial focus on Cancel, and Escape cancellation. Only OK SHALL submit the selected asset ID and entire displayed base-unit quantity once. After OK, burn progress SHALL use a pending toast and verified success SHALL use a confirmed toast, without a covering progress dialog during submission or its holdings refresh. Success SHALL reveal refreshed Assets without inline progress or completion messages. Failure or unknown outcome SHALL show safe feedback and only OK; acknowledgement closes the error dialog and its source page without clearing recovery records. A failed refresh SHALL retry once without repeating Burn. Duplicate burn actions SHALL remain disabled or guarded while the attempt is in flight; the runtime SHALL NOT become globally inert because of burn progress.

#### Scenario: Cancel or confirm
- **WHEN** the player cancels Confirmation or presses Escape
- **THEN** no wallet submission or burn toast occurs and focus returns to the prior control
- **WHEN** the player confirms with OK
- **THEN** exactly one burn request runs and a pending toast replaces the former Burning... overlay

#### Scenario: Successful burn and refresh
- **WHEN** the burn returns verified success
- **THEN** a confirmed toast is queued and holdings refresh without a burn or refresh progress overlay
- **AND** a refresh failure does not retract verified burn success or repeat submission

#### Scenario: Unconfirmed outcome
- **WHEN** a burn fails or returns an unknown outcome
- **THEN** no confirmed toast is emitted and existing safe acknowledgment and durable recovery protections remain effective
