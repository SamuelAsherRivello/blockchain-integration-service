# account-contracts Specification

## Purpose

Let an account inspect its BIS-tracked unresolved contracts and use eligible operations without exposing private contract material or game-specific UI.

## Requirements

### Requirement: Generic account contract query
BIS SHALL expose a provider-neutral contract query with stable IDs, type, host reference, role, amount, status, eligibility, deadline and evidence freshness. The query SHALL be read-only with respect to funds and SHALL distinguish a verified empty result from unavailable data. It SHALL return only account-relevant BIS-tracked agreements, without assuming every contract is a treasure LTO.

#### Scenario: Unrelated offer
- **WHEN** the host queries an account containing multiple contract purposes
- **THEN** it can select its exact session contract and ignore unrelated records without querying secrets or submitting transactions

#### Scenario: Provider unavailable
- **WHEN** live contract evidence cannot be read
- **THEN** BIS reports unavailable or stale evidence explicitly rather than reporting an empty list or enabling an unverified action

### Requirement: Contracts navigation and details
Account Details SHALL offer Contracts with an Assets-style list and individual Contract Details. The list SHALL include unresolved funding, claims, refunds and uncertain operations, and show `No active contracts` only for a known empty list. Each closed row SHALL use shared compact geometry with a leading toast status icon and six emoji-value fields: operation/type, cost, purpose, current status, role, and expiration. Pending rows use toast information-blue; done, warning, and error states use their truthful matching palettes. Hover/focus/selection add black outlines without changing the status background. Contract IDs and references remain in details/reports. Details SHALL show sanitized identity/amount/state/deadline and related transaction information and follow existing accessible wallet-page loading and error conventions.

#### Scenario: Expired refund pending
- **WHEN** an offer expires but its refund is unverified
- **THEN** its blue row shows operation, cost, purpose, refunding status, role, and expiration beside the information glyph and remains visible

#### Scenario: Verified terminal state
- **WHEN** a claim or refund is verified
- **THEN** the agreement leaves the active list while its financial activity and internal deduplication evidence remain available

#### Scenario: Consistent account collections
- **WHEN** the user opens Assets, Contracts or Transactions and their details
- **THEN** all six pages use a consistent title, body, copyable field, scroll content and Back arrangement
- **AND** lists reserve a 276px scroll area even when empty and Account Details provides equal-width Assets, Contracts and Transaction buttons in one row with ellipsis for constrained labels

### Requirement: Eligible actions share the production workflow
Contracts actions SHALL enforce the same identity, readiness, deadline and operation guards as host calls. Player Claim/Reject and game-wallet Refund SHALL be offered only when the supported contract path allows them. No generic Burn or debug bypass SHALL appear. Contract completion SHALL NOT interrupt game runtime with a modal.

#### Scenario: Claim from Contracts
- **WHEN** the player invokes an eligible Claim from Contract Details
- **THEN** BIS uses the same claim controller as the host and reports pending/verified completion without bypassing contract requirements

#### Scenario: Competing or expired action
- **WHEN** an action is already pending or no longer eligible
- **THEN** duplicate/invalid submission is prevented and the current state is visible
