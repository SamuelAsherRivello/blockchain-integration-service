## MODIFIED Requirements

### Requirement: Confirmed local logout
Confirmed logout SHALL clear only integration-owned remembered account material and end the active local session. It SHALL preserve unrelated browser data and wallet assets and SHALL NOT depend on operator connectivity. On confirmed success the Account dialogue SHALL remain open with Create Account / Restore Account visible; Restore SHALL be enabled and open A3 restoration. Back SHALL restore the preceding host presentation. Ordinary gameplay SHALL remain available.

#### Scenario: Successful logout and reload
- **WHEN** a player confirms logout and clearing succeeds
- **THEN** no active profile remains and the logged-out Account dialogue appears
- **AND** reloading the same origin does not restore the cleared account

#### Scenario: Offline logout
- **WHEN** the operator is unreachable but local storage is available
- **THEN** confirmed logout can complete without a wallet transaction or operator request
