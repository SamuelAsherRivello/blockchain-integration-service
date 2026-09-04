## MODIFIED Requirements

### Requirement: Restoration failure and cancellation
Connection and saving SHALL use Restoring... and Saving... in the Pending Operation Dialog and prevent duplicate submissions. A connection failure SHALL leave the account inactive and unsaved, retain input only temporarily in memory, uncheck Show, and show a sanitized error and only OK in the Pending Operation Dialog. A save failure SHALL NOT claim activation; it SHALL show a safe error and only OK and reconcile any uncertain durable completion when leaving or restarting. Back from entry or OK from an operation failure SHALL clear the transient phrase and return to the logged-out Account dialogue, unless reconciliation finds an already committed account. Host-initiated departure during connection SHALL invalidate pending work; the short saving phase SHALL prevent cancellation until its outcome is reconciled. Ordinary host gameplay SHALL remain usable after leaving the flow.

#### Scenario: Connection unavailable
- **WHEN** restoration cannot establish the required Signet connection
- **THEN** no account is saved or activated, the phrase is retained hidden, and the operation dialog offers only OK
- **AND** OK closes the source page and clears transient input

#### Scenario: Save fails
- **WHEN** saving fails or its completion is uncertain
- **THEN** success is not reported prematurely and leaving or restarting reconciles durable state without duplicate activation

### Requirement: Account lifecycle isolation
Restoration SHALL NOT replace an existing active or persisted account. Back, disposal, reset, and account changes in another context SHALL invalidate obsolete restoration work so it cannot later save or activate. No disposed instance SHALL publish later state or events. The flow SHALL release temporary SDK resources and clear transient input on exit and success.

#### Scenario: Another context changes the account
- **WHEN** another context commits an account or resets local account state while restoration is pending
- **THEN** stale restoration cannot overwrite or repopulate that state and the live context reconciles the current account

#### Scenario: Leave before completion
- **WHEN** the host leaves the connection flow or the client is disposed
- **THEN** later asynchronous completion cannot save, activate, or notify former consumers
