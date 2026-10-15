## MODIFIED Requirements

### Requirement: Confirmed local logout
Confirmed logout SHALL clear only integration-owned remembered account material and end the active local session. It SHALL preserve unrelated browser data and wallet assets and SHALL NOT depend on operator connectivity when no send, transfer, payable invoice, or receipt processing/reconciliation is unresolved. On confirmed success the Account dialogue SHALL remain open with Create Account / Restore Account visible; Restore SHALL be enabled and open A3 restoration. Back SHALL restore the preceding host presentation. Ordinary gameplay SHALL remain available. A payable invoice or unresolved receipt SHALL retain its receiving-operation clearing guard, including unknown receiving states. An unresolved send SHALL block account clearing, even when backup acknowledgement is checked, until reconciliation proves completion or safe failure. This guard SHALL apply across live contexts and after restart; offline uncertainty SHALL preserve recovery state rather than permit clearing.

#### Scenario: Successful logout and reload
- **WHEN** a player confirms logout with no unresolved send, transfer, payable invoice, or receipt processing/reconciliation and clearing succeeds
- **THEN** no active profile remains and the logged-out Account dialogue appears
- **AND** reloading the same origin does not restore the cleared account

#### Scenario: Offline logout
- **WHEN** the operator is unreachable but local storage is available and no send, transfer, payable invoice, or receipt processing/reconciliation is unresolved
- **THEN** confirmed logout can complete without a wallet transaction or operator request

#### Scenario: Unresolved send
- **WHEN** logout is requested while a send is submitting, pending or uncertain
- **THEN** clearing is blocked with a status explanation and account/recovery material remains intact
- **AND** navigation and ordinary gameplay remain available

#### Scenario: Payable invoice or unresolved receipt
- **WHEN** a payable invoice or unresolved receipt exists, including one hidden by navigation
- **THEN** Log Out cannot clear the account and explains why it is blocked
- **AND** Back and ordinary navigation remain available
