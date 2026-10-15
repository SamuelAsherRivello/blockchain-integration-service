# Spec Delta

## ADDED Requirements

### Requirement: Swap action reflects verified eligibility
Review Transfer SHALL be enabled only when the selected direction has a current verified eligible-funds result and the entered positive amount can be reviewed under that result. Total balance alone SHALL NOT enable Review Transfer when inputs are unconfirmed, reserved, unsupported, or otherwise unavailable.

#### Scenario: Total Bitcoin balance has no eligible inputs
- **WHEN** Bitcoin total balance is positive but the live transfer availability result reports no confirmed eligible funds
- **THEN** Review Transfer is disabled and the UI explains that eligible funds are unavailable

#### Scenario: Eligible funds become available
- **WHEN** a fresh direction-specific availability read verifies eligible unreserved funds for the selected amount
- **THEN** Review Transfer becomes enabled and opens a live quote review

#### Scenario: Availability is unavailable
- **WHEN** the transfer availability check cannot verify policy, account state, or input eligibility
- **THEN** Review Transfer remains disabled and no quote request is started by the disabled action
