# Spec Delta

## ADDED Requirements

### Requirement: Automatic onboarding uses shared wallet network policy
Automatic onboarding SHALL use wallet-network-configuration to evaluate the active network, operator, zero-fee support, limits, and freshness before freezing a funding plan, before each leg review boundary, and before any leg can register. Zero-equivalent fee encodings SHALL remain eligible for the existing zero-fee route; unsupported policy SHALL pause onboarding with a specific reason and preserve any already-submitted leg for reconciliation.

#### Scenario: Zero-equivalent onboarding policy
- **WHEN** the active operator reports all onboarding-relevant fees as validated zero-equivalent values
- **THEN** automatic onboarding may continue its existing zero-fee assessment and submission rules without blocking on formatting differences

#### Scenario: Unsupported onboarding policy before first leg
- **WHEN** the active operator reports unsupported fee terms before automatic onboarding registration begins
- **THEN** onboarding does not register any leg and reports the policy blocker without changing the frozen allocation

#### Scenario: Unsupported onboarding policy between legs
- **WHEN** the first leg has been submitted and the return leg's current policy is unsupported
- **THEN** onboarding preserves and reconciles the submitted leg while pausing the unsubmitted leg with an explicit policy reason

