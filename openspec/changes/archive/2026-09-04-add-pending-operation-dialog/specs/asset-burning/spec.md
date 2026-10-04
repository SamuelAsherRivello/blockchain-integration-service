## MODIFIED Requirements

### Requirement: Explicit reusable burn confirmation
Asset Detail SHALL place Burn above Back. Burn SHALL open the reusable Confirmation modal with Are you sure?, OK and Cancel, focus containment, initial focus on Cancel, and Escape cancellation. Only OK SHALL submit the selected asset ID and entire displayed base-unit quantity once. The Pending Operation Dialog SHALL then show Burning... and make covered controls inert through burn and fresh holdings preparation. Success SHALL reveal refreshed Assets without inline progress or completion messages. Failure or unknown outcome SHALL show safe feedback and only OK; acknowledgement closes the pending dialog and its source page without clearing recovery records. A failed refresh SHALL retry once without repeating Burn.

#### Scenario: Cancel or confirm
- **WHEN** the player cancels Confirmation
- **THEN** no wallet submission occurs and focus returns to the prior control
- **WHEN** the player confirms
- **THEN** exactly one burn request runs while Burning... covers the source page through refresh
