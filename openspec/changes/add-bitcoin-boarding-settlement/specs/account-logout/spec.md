## ADDED Requirements

### Requirement: Protect unresolved transfers
Once transaction execution is supported, Log Out and Reset SHALL be blocked while a transfer is unresolved, including after restart and across same-origin contexts. Merely editing a transfer without submission SHALL NOT block account clearing.

#### Scenario: Form without submission
- **WHEN** the player has only entered an amount without submitting a transfer
- **THEN** normal account clearing remains available through its existing confirmation flow

#### Scenario: Unresolved submission
- **WHEN** a submitted transfer has not been reconciled
- **THEN** account clearing is blocked with an explanation until resolution
