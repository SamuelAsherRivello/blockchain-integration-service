# Spec Delta

## ADDED Requirements

### Requirement: Admin wallet operations expose shared availability reasons
Admin-controlled Game Wallet operations SHALL use the same active Player Wallet, Game Wallet, network, durable reservation, and fresh-evidence rules as their corresponding runtime operations. Each disabled or rejected operation SHALL expose a safe reason identifying the blocking category, and a successful readiness check SHALL be revalidated before signing or submission.

#### Scenario: Logged-in wallets are not sufficient by themselves
- **WHEN** both wallets are logged in but the active network differs, a provider read is unavailable, or a durable reservation blocks the requested operation
- **THEN** Admin reports the specific blocking reason and does not submit the operation
- **AND** unrelated receiving, inspection, or recovery actions remain available where their own prerequisites are satisfied

#### Scenario: Fresh readiness enables the matching Admin action
- **WHEN** the current Player Wallet and distinct Game Wallet have matching active-network state, fresh public evidence, sufficient eligible funds, and no conflicting operation
- **THEN** the corresponding Admin operation becomes available
- **AND** it uses only the current wallet scope and inputs verified at confirmation

#### Scenario: A stale unavailable result settles
- **WHEN** an Admin availability check reports unavailable because a transient prerequisite failed and that attempt completes
- **THEN** a later explicit operation with the same current wallet scope rechecks fresh state
- **AND** it does not replay the earlier unavailable result from transient memory alone
