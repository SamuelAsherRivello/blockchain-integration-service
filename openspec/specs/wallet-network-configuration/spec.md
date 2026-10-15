# wallet-network-configuration Specification

## Purpose

Defines BIS-owned wallet network and operator capability policy so wallet operations can consistently decide whether they are available, safely reviewable, and safe to submit on the active network.

## Requirements

### Requirement: Supported network configuration is owned by BIS
BIS SHALL own the supported Player Wallet network definitions, including labels, operator endpoints, explorer URLs, faucet metadata, and any operation-specific capability flags used by the app. Wallet operations SHALL use the active account's network configuration and SHALL reject provider responses that report a different network before signing, submitting, saving success, or displaying operation-specific readiness.

#### Scenario: Active network operator is used
- **WHEN** a Player Account is active on Signet or Mutinynet
- **THEN** balances, addresses, quotes, submissions, recovery checks, explorer links, and availability reads use that network's configured operator and metadata

#### Scenario: Provider reports a different network
- **WHEN** the configured operator response reports a network other than the active account network
- **THEN** the requested operation is unavailable before signing or submission and the existing account records remain unchanged

### Requirement: Operator policy is normalized before capability decisions
BIS SHALL normalize operator policy values before wallet operations decide capability availability. Empty string, integer zero, decimal zero, and other validated zero-equivalent fee encodings SHALL be treated as zero; malformed, unknown, nonzero, or unsupported values SHALL be classified distinctly. Operations that only support zero fees SHALL accept zero-equivalent policy values and SHALL block unsupported values before review or confirmation with an actionable reason.

#### Scenario: Decimal zero fee remains supported
- **WHEN** the active operator reports intent fees as `0.0` and the operation supports zero fees only
- **THEN** BIS treats the policy as zero and does not show a fee-schedule-changed error solely because of decimal formatting

#### Scenario: Unsupported nonzero fee blocks safely
- **WHEN** the active operator reports a nonzero fee for an operation whose fee math has not been verified
- **THEN** BIS blocks quote review or submission before any network mutation and explains that the current operator terms are unsupported

#### Scenario: Policy parse failure is not spendability
- **WHEN** operator policy cannot be parsed or verified
- **THEN** BIS reports policy verification unavailable and does not advertise the operation as spendable or ready

### Requirement: Capability checks are fresh and operation-specific
BIS SHALL expose operation-specific capability results derived from the active network, reported operator policy, freshness, and the operation's supported routes. Capability results SHALL distinguish unsupported network, provider mismatch, unsupported fee terms, unavailable policy read, insufficient funds, pending reservations, and stale review. A successful capability check SHALL NOT authorize later submission unless the submission boundary revalidates the same policy and reviewed terms.

#### Scenario: Availability reason before blocked review
- **WHEN** a user opens a wallet operation whose active network/operator terms are unsupported for that operation
- **THEN** the UI shows a specific unavailable reason before the user reaches a confirmation that would fail for the same policy

#### Scenario: Submission revalidates policy
- **WHEN** the user confirms a previously reviewed wallet operation
- **THEN** BIS rereads or otherwise revalidates the active policy, account, inputs, and reviewed terms before submission

#### Scenario: Policy changes after review
- **WHEN** operator policy changes between review and confirmation
- **THEN** confirmation rejects the stale review and requires a fresh review without submitting funds

### Requirement: Safe diagnostics and privacy
Network and operator capability diagnostics SHALL be secret-free and allowlisted. They SHALL NOT persist or display recovery phrases, private keys, signed proofs, raw provider payloads, or arbitrary error text. Public diagnostics MAY include the active network, configured operator identity, static capability status, and sanitized reason codes.

#### Scenario: Raw provider error contains private data
- **WHEN** an operator or SDK error includes arbitrary payloads while policy or capability checking fails
- **THEN** persisted and displayed diagnostics contain only safe reason categories and do not expose the raw payload
