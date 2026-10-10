# Spec Delta

## ADDED Requirements

### Requirement: Mint failures retain actionable categories
Generic minting SHALL preserve distinct safe categories for insufficient spendable funds, reserved inputs, unavailable verification, unsupported input selection, invalid metadata, coordination failure, and outcome-unknown work.

#### Scenario: Funded wallet cannot select inputs
- **WHEN** a wallet has positive funds but the mint adapter cannot select eligible unreserved inputs
- **THEN** minting returns a specific unavailable or unsupported-input reason and performs no submission

#### Scenario: Invalid marketplace metadata
- **WHEN** a mint request contains malformed or incomplete marketplace metadata
- **THEN** minting returns invalid-input before opening the network submission boundary

### Requirement: Fresh listing remains generic and complete
Fresh listing SHALL return every positive holding, including generic and legacy assets, while marketplace classification separately rejects holdings that fail the authoritative metadata contract.

#### Scenario: Malformed item metadata
- **WHEN** a fresh holding contains malformed marketplace metadata
- **THEN** the generic list includes the holding with safe available fields and the marketplace classifier excludes it from item inventory

#### Scenario: Metadata read failure
- **WHEN** required asset details cannot be read
- **THEN** listing returns unavailable rather than an empty or partial success
