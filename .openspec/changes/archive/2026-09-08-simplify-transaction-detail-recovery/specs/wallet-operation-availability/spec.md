## MODIFIED Requirements

### Requirement: Actionable recovery view
Account SHALL expose all its pending operations with amount, known status, last verification, reserved value and action availability. Transaction Detail SHALL offer recovery inspection through View Recovery Info only, with copying inside its Recovery Info dialog. Check Status, Copy Recovery Details and discard controls SHALL NOT appear in Transaction Detail or that window. Existing recovery checks elsewhere SHALL remain read-only and secret-free. Discard SHALL apply only to drafts proven never submitted under the mutation lock. Network cancellation SHALL obey account-transfer-cancellation requirements; unavailable cancellation SHALL explain its reason. No Undo or force-clear action SHALL falsely release submitted work. Log Out and Reset SHALL remain protected while any unresolved operation exists.

#### Scenario: Registered transfer cannot be cancelled safely
- **WHEN** cancellation finality is unverified
- **THEN** Transaction Detail offers View Recovery Info, whose read-only report explains cancellation unavailability and shows independent spending availability separately, without execution actions

#### Scenario: Proven unsent draft
- **WHEN** the user discards a prepared draft whose registration gate is closed and which never reached submission
- **THEN** it is retained as not-submitted and its reservations are released without a network request

#### Scenario: Completed transaction
- **WHEN** completion is verified
- **THEN** the UI shows completed, offers no undo, and any reverse transfer requires a new review and confirmation
