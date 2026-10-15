## MODIFIED Requirements

### Requirement: Feasibility-first delivery
Safe exact-operation cancellation and authoritative terminal-outcome semantics SHALL be established before cancellation code or UI is built. If these cannot be established for the supported operator, cancellation implementation SHALL stop and report the blocker; independent spending and read-only recovery UI SHALL proceed without claiming cancellation delivery. Disabled cancellation UI SHALL NOT count as delivery. D5. Cancel Pending Transfer SHALL be documented as a separate story with its own status, flow and acceptance criteria and linked from D4 without renumbering existing stories.

#### Scenario: Operator guarantees unproven
- **WHEN** exact cancellation targeting or terminal-outcome guarantees cannot be verified
- **THEN** cancellation implementation remains blocked, while independent spending and recovery inspection proceed; D5b documentation states the blocker without claiming delivered cancellation

### Requirement: Evidence-based terminal outcomes
The system SHALL report verified cancellation only from authoritative evidence tied to the recorded attempt that excludes later settlement of that intent. An acknowledgement without established finality semantics, timeout, missing history, unspent inputs, local cancellation label or not-found response alone SHALL NOT establish cancellation. A transfer that settles instead SHALL follow existing completion verification, not be labelled cancelled. Conflicting or insufficient evidence SHALL retain an unresolved outcome and investigation guidance.

#### Scenario: Authoritatively cancelled
- **WHEN** authoritative cancellation evidence proves the recorded intent cannot subsequently settle
- **THEN** verified cancellation is durably recorded without erasing the original transfer

#### Scenario: Cancellation loses the race
- **WHEN** the recorded transfer has verified settlement evidence instead of terminal cancellation
- **THEN** its outcome is verified transfer completion, with no cancellation-success or refund claim

#### Scenario: Ambiguous operator response
- **WHEN** cancellation returns a timeout, not-found response or acknowledgement without a verified finality guarantee
- **THEN** the system reports cancellation unverified and retains the affected input reservations and account-clearing protection while permitting independently funded operations

### Requirement: Guard release and subsequent actions
While cancellation is in progress or unverified, the affected inputs, Log Out and Reset SHALL remain protected; independently funded wallet mutations SHALL remain available. Only durably verified cancellation or existing verified transfer completion SHALL release the affected reservations. Account-clearing protection SHALL remain while any unresolved operation exists. Release SHALL NOT itself log out, reset, mint, send or retry a transfer; existing confirmations and a fresh transfer review SHALL still be required.

#### Scenario: Verified cancellation unlocks review
- **WHEN** cancellation is verified and durably recorded
- **THEN** the released inputs can be used in a fresh transfer review; normal logout/reset is available only if no other unresolved operation remains, without any automatic action

#### Scenario: Persistence failure
- **WHEN** saving terminal cancellation evidence fails
- **THEN** the system does not advertise a safely resolved cancellation or release its guards

