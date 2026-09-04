## MODIFIED Requirements

### Requirement: Truthful failure and retry
While logout is pending the Pending Operation Dialog SHALL show Logging out... and prevent duplicate submission and cancellation of that operation. If clearing fails or cannot be confirmed, it SHALL show the failure without exposing secrets and offer only OK in the Pending Operation Dialog. It SHALL NOT claim success or emit a successful-disconnection event before confirmed clearing. OK SHALL close the dialog and the failed logout page, reconcile the account state, and require a fresh confirmation before another cleanup attempt. An unchecked acknowledgement SHALL prevent a further destructive submission.

#### Scenario: Clearing fails
- **WHEN** clearing rejects or completion cannot be verified
- **THEN** the player sees the error and OK in the operation dialog, with no success claim
- **AND** OK leaves the failed confirmation and a separately confirmed successful operation completes the normal logged-out destination

#### Scenario: Repeated submission
- **WHEN** the player submits again while logout is pending
- **THEN** only one logout operation runs and no duplicate completion is reported
