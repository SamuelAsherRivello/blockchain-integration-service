# Spec Delta

## ADDED Requirements

### Requirement: Account Transfer amount-entry feedback placement
The Account Transfer entry view SHALL display `Swap between your balances.` beneath its title. It SHALL render exactly one standalone status line below the sats amount control and before its actions. When the selected transfer source has a verified positive available balance and the entered amount is zero, the default status SHALL be exactly `Set amount above.` Direction, availability, pending-operation, recovery, over-limit, and invalid-amount guidance SHALL replace that default in the same status line when applicable. Failures returned after the user starts review or confirmation SHALL use the operation error prompt rather than an additional inline text field.

#### Scenario: Zero amount with an available source balance
- **WHEN** the selected Account Transfer source has a verified positive available balance and its amount is zero
- **THEN** its single status line reads `Set amount above.`

#### Scenario: Pending transfer with zero amount
- **WHEN** Account Transfer has a pending operation and its entry amount is zero
- **THEN** the single status line reads `See Transactions for any pending transfers.`
