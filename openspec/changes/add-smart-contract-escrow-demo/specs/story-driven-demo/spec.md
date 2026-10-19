# Spec Delta

## ADDED Requirements

### Requirement: Smart contract demo navigation
The Admin UI SHALL place a `Smart Contracts - 1` section immediately after Assets with four ordered escrow actions. The actions SHALL be enabled only when their real escrow operation and prerequisites are available; the demo SHALL not present placeholder success or simulated financial outcomes.

#### Scenario: Smart contract section order
- **WHEN** the Admin implementation sections render
- **THEN** `Smart Contracts - 1` appears immediately after `C. Assets` and before the existing Contracts section
- **AND** its controls appear in the order Send Escrow, Check Escrow, Approve Escrow, Receive Escrow

#### Scenario: Escrow action availability
- **WHEN** the escrow controller or required wallet is unavailable
- **THEN** the affected action is disabled with an accessible reason
- **AND** the demo does not log or display a successful financial result

#### Scenario: Escrow action reports a real outcome
- **WHEN** an enabled escrow action is activated
- **THEN** the Admin Console reports its actual pending, confirmed, unavailable, expired, or failed outcome without secrets
