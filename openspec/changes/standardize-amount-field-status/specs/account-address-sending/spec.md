# Spec Delta

## ADDED Requirements

### Requirement: Send amount-entry feedback placement
The Send entry view SHALL display `Send balance to another address.` beneath its title. It SHALL render exactly one standalone status line below the sats amount control and before its actions. When verified spendable Arkade funds are positive and the entered amount is zero, the default status SHALL be exactly `Set amount above`. Recipient and clipboard feedback SHALL replace that default in the same status line when applicable. Failures returned after the user starts review or confirmation SHALL use the operation error prompt rather than an additional inline text field.

#### Scenario: Zero amount with spendable funds
- **WHEN** the Send entry view has verified positive spendable Arkade funds and its amount is zero
- **THEN** its single status line reads `Set amount above`

#### Scenario: Recipient validation with an entered amount
- **WHEN** the recipient is invalid and the Send entry view renders an amount control
- **THEN** recipient validation replaces the default in the single status line
