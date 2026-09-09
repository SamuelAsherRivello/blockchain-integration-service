## ADDED Requirements

### Requirement: Onboarding reservation handoff and final spendability
Every wallet mutation path SHALL honor automatic onboarding's frozen input and intermediate-receipt reservations across tabs and ordinary restart. Verified receipt handoff SHALL durably transition the parent's holds before another operation can select its outputs. Final target outputs SHALL become available as soon as account-automatic-onboarding verifies them spendable and persists their release; unconfirmed Bitcoin commitments SHALL NOT impose an additional hold on those outputs or globally disable independently funded payments. Existing unrelated reservations and asset preservation SHALL remain enforced. A failed persistence or unknown input set SHALL retain the affected spending protection with a specific reason.

#### Scenario: Payment during intermediate boarding
- **WHEN** the first-leg receipt is SDK-spendable but reserved for the Bitcoin-return leg
- **THEN** a payment cannot select it, while independent verified unreserved inputs remain usable

#### Scenario: Payment before Bitcoin confirmation
- **WHEN** the final target handoff is durable and its fresh eligible funds cover a normal payment while the Bitcoin return is unconfirmed
- **THEN** the payment can use those final outputs without waiting for that confirmation or logging out

#### Scenario: Handoff write fails
- **WHEN** final receipt evidence cannot be durably saved
- **THEN** the target is not advertised as released and automatic read-only recovery keeps checking the original operation

#### Scenario: Another tab races return registration
- **WHEN** two cooperating contexts attempt to submit the same onboarding return leg
- **THEN** only one can own its reserved inputs and cross the registration boundary
