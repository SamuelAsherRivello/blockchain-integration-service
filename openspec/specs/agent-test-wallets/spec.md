# agent-test-wallets Specification

## Purpose

Provide private local test-wallet identity and session tooling with durable recovery accounting, without transferring test authority to human browser sessions.

## Requirements

### Requirement: Canonical private developer configuration

Shared SHALL provide a secret-free .env.local.template and Node-only allowlisted loader. Populated files SHALL be excluded from Git, AI and triage and denied by the shared Vite server. Process values SHALL take precedence; legacy faucet fallback SHALL apply only when the shared file is absent.

#### Scenario: Canonical configuration exists

- **WHEN** a server consumer loads the shared configuration
- **THEN** it receives only selected keys and does not fill missing canonical entries from legacy secrets

### Requirement: Protected registered test inventory

Runtime recovery SHALL be encrypted for the Windows user outside repository and served roots. Import and creation SHALL bind public identities and generations to private vault entries, reject duplicate/conflicting roles and unsupported networks, and expose no recovery material.

#### Scenario: Protection or binding fails

- **WHEN** protection is unavailable or a manifest mismatches its encrypted identity
- **THEN** access fails closed without plaintext fallback or secret output

#### Scenario: Registration repeats

- **WHEN** supplied slots are privately imported again
- **THEN** existing identities remain unchanged and registration submits no financial operation

### Requirement: Owned test session foundation

The runner SHALL restore distinct Player/Game identities through production UI in dedicated application/pair/network profiles for Admin and Marketplace. It SHALL verify exact origin, identity and network before permitted actions, preserve product guards, and never silently restore after explicit logout.

#### Scenario: Explicit lifecycle

- **WHEN** an owned account is logged out and reloaded
- **THEN** it remains logged out until explicit restoration

### Requirement: Standing authorization and durable operation accounting

Registered test identities SHALL inherit standing permission on Signet and Mutinynet without mandatory renewed approvals, budgets or expiry. Revocation SHALL block new submission. Implemented financial workflows SHALL save original operation scope before side effects and retain reservations for pending or unknown outcomes.

#### Scenario: Lost acknowledgement

- **WHEN** an implemented submission has an unknown result
- **THEN** retry reconciles its original operation without replacement submission

### Requirement: Restricted joined Marketplace session

Joined sessions SHALL require explicit page selection and permit public inspection and allowlisted navigation only. They SHALL deny secret access, account/network changes, financial mutation and automatic-submission routes, even for a registered test identity. Detach SHALL preserve the user's browser state.

#### Scenario: Joined identity matches a fixture

- **WHEN** a joined page has a registered test identity
- **THEN** joined restrictions still apply and detach does not close or log out the page

### Requirement: Honest verification boundary

Evidence SHALL distinguish isolated tests, observed live outcomes, pending/unavailable states and unperformed cases. The tooling SHALL introduce no production fixture endpoint or secret export. Partial Swap/onboarding implementation SHALL NOT establish completed conversion or ecosystem acceptance.

#### Scenario: Live conversion remains incomplete

- **WHEN** isolated conversion tests pass but the live Review step is unavailable
- **THEN** the milestone records the limitation and carries live acceptance to the follow-up
