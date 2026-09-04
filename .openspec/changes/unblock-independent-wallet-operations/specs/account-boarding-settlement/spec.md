## MODIFIED Requirements

### Requirement: Durable registration boundary
The application SHALL persist prepared before settlement preparation and submitting before the first registration network call. It SHALL record the operator intent ID when available. Under the mutation lock, an abandoned prepared record MAY become not-submitted and permit a fresh review. A submitting or registered record SHALL remain pending unless success is verified or authoritative evidence tied to that attempt proves terminal failure and that it cannot subsequently settle. SDK cancellation labels, elapsed time, missing history and unspent inputs SHALL NOT authorize resubmission. An unresolved outcome MAY require operator investigation and SHALL reserve its complete input set without a force-clear control. It SHALL NOT block independent operations on verified unreserved inputs. Multiple records SHALL retain their own identities and outcomes. This limitation SHALL be visible to the user.

#### Scenario: Interrupted before registration
- **WHEN** recovery acquires the mutation lock and finds a prepared record whose registration gate is no longer active
- **THEN** it records not-submitted and requires a fresh review before any new transfer

#### Scenario: Lost registration response
- **WHEN** registration may have reached the operator but its response was lost
- **THEN** the record survives reload, status checks do not sign or submit, and conflicting inputs and account clearing remain blocked; independent transfers using verified unreserved inputs remain available

#### Scenario: Late preparation after timeout
- **WHEN** an old SDK callback reaches registration after its attempt timed out
- **THEN** the closed attempt gate rejects the callback before any network mutation

#### Scenario: Authoritatively verified failure
- **WHEN** supported authoritative evidence proves the recorded attempt has failed and cannot subsequently settle
- **THEN** reconciliation records verified failure and releases only that operation's reservations under the mutation lock; account-clearing guards release only when no unresolved operation remains
- **AND** another transfer requires a fresh review and explicit confirmation, without automatic retry

### Requirement: Evidence-based transfer status
Review Transfer SHALL only obtain a quote and SHALL NOT create a submitted operation. Transfer status SHALL distinguish known progress, awaiting confirmation, unavailable verification, verified success and verified failure using evidence for the recorded attempt. Errors SHALL preserve sanitized diagnostic categories without exposing secrets or falsely asserting submission. Status checks SHALL NOT sign, resubmit or clear uncertain records.

#### Scenario: Review without an existing attempt
- **WHEN** the player reviews an Arkade-to-Bitcoin amount and has no unresolved operation
- **THEN** a verified quote or actionable quote error appears without a pending submission warning or account-clearing lock

#### Scenario: Existing unresolved attempt
- **WHEN** the player opens transfer review with an unresolved recorded attempt
- **THEN** the UI identifies that existing attempt and its evidence-supported status and offers Check Status
- **AND** submission reusing its reserved inputs remains blocked until its outcome is resolved; independent submissions remain available

#### Scenario: Status service unavailable
- **WHEN** the operator or chain evidence cannot be retrieved
- **THEN** the UI reports verification unavailable while preserving the operation and its guards

