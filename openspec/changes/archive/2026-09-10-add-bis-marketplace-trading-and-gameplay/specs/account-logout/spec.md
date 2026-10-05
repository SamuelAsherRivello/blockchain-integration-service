## MODIFIED Requirements

### Requirement: Confirmed local logout
Confirmed logout SHALL clear only the selected active player profile's account material and that profile's operation and recovery journals after backup acknowledgement and separate pending-loss acknowledgement when that profile's current pending count exceeds zero. A changed pending-operation set SHALL require fresh acknowledgement. Cleanup SHALL preserve every other saved player profile and its profile-scoped state, unrelated browser data, remote wallet assets, and separate Admin game-wallet identities. It SHALL NOT cancel submitted transactions or claim their completion. Confirmed cleanup SHALL invalidate live sessions for the removed profile, leave no player profile active until the user explicitly selects another saved profile, and request host-owned restart; ordinary gameplay SHALL remain available. Admin Reset SHALL retain its unresolved-operation guards.

#### Scenario: Successful logout and reload
- **WHEN** the player completes the required acknowledgements and local cleanup succeeds
- **THEN** the selected profile and its recovery journal are absent, no player profile is active, and the host receives the restart request
- **AND** reloading the same origin retains other saved profiles but does not restore the removed account

#### Scenario: Logout while other profiles are saved
- **WHEN** the active profile logs out while another player profile is saved
- **THEN** the other profile and its wallet, equipment selections, and operation records remain available in Account entry
- **AND** BIS does not activate it until the user explicitly selects it

#### Scenario: Offline logout
- **WHEN** the operator is unreachable but local cleanup can be verified and the required acknowledgements are current
- **THEN** logout can complete without a wallet transaction or operator request

#### Scenario: Unresolved send
- **WHEN** the active profile requests logout while its send is pending or uncertain
- **THEN** backup acknowledgement alone is insufficient; separate pending-loss acknowledgement is required
- **AND** successful logout removes only that profile's local recovery information without cancelling the send or removing other profiles

#### Scenario: Payable invoice or unresolved receipt
- **WHEN** supported receiving operations contribute unresolved recovery state to the active profile's pending-operation inventory
- **THEN** explicit player logout requires the same current pending-loss acknowledgement and does not claim network cancellation
- **AND** Admin Reset remains guarded while receipt recovery is unresolved
