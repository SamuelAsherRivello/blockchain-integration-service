# Spec Delta

## Purpose

Provide autonomous scenario preparation and lifecycle verification across registered BIS applications and the game, using the private test-wallet foundation.

## ADDED Requirements

### Requirement: Independent owned ecosystem interaction

Owned test sessions SHALL support registered BIS applications and the game, including public UI interactions beyond a fixed scenario catalog. Actions SHALL revalidate mode, exact origin, identity and network, retain product guards and private recovery handling, and preserve separate application persistence.

#### Scenario: Game and noncatalog interaction

- **WHEN** a registered test pair is restored into the game and a noncatalog interaction is requested
- **THEN** the runner uses the production Account integration with verified public package provenance and muted automated game URLs
- **AND** no browser databases, journals or recovery phrases are exported between applications

### Requirement: Verified scenario readiness and idempotent preparation

Readiness SHALL distinguish verified empty, ready, dirty, pending, incomplete and unavailable per network. Preparation SHALL use existing funds first and retain operation/asset IDs for funding or issuance. Failed reads and funding acknowledgements SHALL NOT establish readiness.

#### Scenario: Used or unreadable empty fixture

- **WHEN** an empty-labeled fixture has holdings or its current state cannot be read
- **THEN** it is reported dirty or unavailable, not erased or drained to claim emptiness

#### Scenario: Partial preparation retries

- **WHEN** preparation resumes after partial funding, minting or delivery
- **THEN** original IDs are reconciled and completed targets are not duplicated
- **AND** unrelated holdings remain untouched unless deliberately targeted

### Requirement: Separate verified funding workflows

The runner SHALL support BTC/Arkade funding through supported registered-wallet or faucet flows with exact destination, network, amount and fee evidence. It SHALL distinguish acknowledgement from verified recipient funds and report interactive prerequisites without claiming autonomous success.

#### Scenario: New account requires funding

- **WHEN** an agent-created account lacks required spendable funds
- **THEN** the runner selects an authorized source and verifies recipient evidence before reporting funded readiness
- **AND** an unknown prior response cannot cause replacement funding

### Requirement: Complete half-onboarding conversion

Onboarding SHALL use the separately delivered production route with verified network and 50% configuration before automatic submission. It SHALL capture intent beforehand, preserve pending windows, verify both settlement legs and re-read BIS independently. It SHALL NOT be described as a funding source.

#### Scenario: Complete conversion

- **WHEN** an authorized account has eligible BTC on either supported network
- **THEN** completion requires the intended Arkade output and matching Bitcoin remainder from the original inputs
- **AND** intermediate whole-input Arkade balance alone is insufficient

#### Scenario: Missing dependency or pending window

- **WHEN** network behavior is unverified or onboarding remains unresolved
- **THEN** that scenario stays unavailable or pending without resetting or switching away from its recovery state

### Requirement: Scenario recovery and conservative rotation

Payment, mint/delivery, burn and contract claim/refund scenarios SHALL retain original operation identity and product safeguards. Rotation SHALL require verified zero balances/holdings and no unresolved work, archive encrypted old generations, and preserve recovery continuity.

#### Scenario: Pending or funded rotation

- **WHEN** rotation targets a funded, pending or unreadable account
- **THEN** rotation is refused without replacing its identity or deleting its journals

#### Scenario: Unknown scenario result

- **WHEN** a scenario's submission response is lost
- **THEN** recovery reconciles the original request without duplicate signing or replacement operation

### Requirement: Live ecosystem acceptance is independently evidenced

Acceptance SHALL cover supplied-account lifecycle and agent-created create/fund/onboard/use on both networks across registered applications and the game, plus real user-selected joined inspection/navigation/detach followed by owned work. Reports SHALL separate isolated, live, unavailable and unperformed cases and verify build exclusions.

#### Scenario: Partial live matrix

- **WHEN** only some application/network cells succeed
- **THEN** remaining cells stay explicitly incomplete, including the live Swap Review-control failure until verified

#### Scenario: Joined-to-owned transition

- **WHEN** real human-session inspection and safe navigation finish
- **THEN** detach preserves user state and subsequent owned work does not inherit joined authority or export secrets

#### Scenario: Production artifact verification

- **WHEN** final applications are built
- **THEN** release artifacts contain no fixture secrets, vault/profile files, automatic fixture login or fixture control endpoints
