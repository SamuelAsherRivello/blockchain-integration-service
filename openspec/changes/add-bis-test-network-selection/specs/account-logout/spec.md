## MODIFIED Requirements

### Requirement: Confirmed local logout
Confirmed Player Wallet logout SHALL, after the existing backup acknowledgement and any required pending-loss acknowledgement, clear the selected active player's account material, that profile's operation and recovery journals, and the active Game Wallet selection and in-memory state for the same selected network. The Game Wallet logout SHALL stop subscriptions and prevent further provider, asset, onboarding, payment, or contract work from the former signer. Cleanup SHALL preserve unrelated browser data, remote wallet assets and submitted remote operations, and encrypted records that are not active for the selected network; it SHALL never claim remote cancellation or completion. Confirmed cleanup SHALL invalidate live sessions for both active wallets, leave no player or game wallet active, and request host-owned restart; ordinary gameplay SHALL remain available. The production UI SHALL not direct the user to select, view, or manage any remaining saved profile. Admin Reset SHALL retain its unresolved-operation guards.

#### Scenario: Player logout also logs out Game Wallet
- **WHEN** the player completes confirmed logout while a same-network Game Wallet is active
- **THEN** both Player Wallet and Game Wallet become logged out and their live data/subscriptions are removed
- **AND** no new Game Wallet operation can start until it is logged in again

#### Scenario: Game Wallet cleanup fails
- **WHEN** Player Wallet clearing cannot confirm the paired Game Wallet logout
- **THEN** BIS reports logout failure without a successful-disconnection event or partial-success claim
- **AND** it requires a fresh confirmed retry

#### Scenario: Successful logout and reload
- **WHEN** the player completes the required acknowledgements and paired cleanup succeeds
- **THEN** the selected profile and its recovery journal are absent, neither wallet is active, and the host receives the restart request
- **AND** reloading the same origin retains only permitted inactive same-network records and does not restore the removed account

#### Scenario: Logout while other profiles are saved
- **WHEN** the logged-out identity is one of several saved player profiles on the selected network
- **THEN** the other profile and its profile-scoped state remain retained without becoming active
- **AND** the production UI does not show a profile list, selection action, or profile-management wording

#### Scenario: Offline logout
- **WHEN** the operator is unreachable but paired local cleanup can be verified and required acknowledgements are current
- **THEN** logout can complete without a wallet transaction or operator request

#### Scenario: Unresolved send
- **WHEN** the active profile requests logout while its send is pending or uncertain
- **THEN** backup acknowledgement alone is insufficient; separate pending-loss acknowledgement is required
- **AND** successful cleanup does not cancel the send

#### Scenario: Pending local operation requires acknowledgement
- **WHEN** the active profile has pending account work and opens Log Out
- **THEN** the production confirmation requires the existing pending-loss acknowledgement before paired cleanup
- **AND** saved identities that are not active do not weaken, satisfy, or appear in that acknowledgement

#### Scenario: Payable invoice or unresolved receipt
- **WHEN** supported receiving operations contribute unresolved recovery state to the active profile's pending-operation inventory
- **THEN** explicit player logout requires the same current pending-loss acknowledgement and does not claim network cancellation
- **AND** Admin Reset remains guarded while receipt recovery is unresolved
