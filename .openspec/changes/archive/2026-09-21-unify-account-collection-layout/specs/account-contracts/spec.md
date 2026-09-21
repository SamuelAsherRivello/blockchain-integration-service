# Spec Delta

## MODIFIED Requirements

### Requirement: Contracts navigation and details
Account Details SHALL offer Contracts with an Assets-style list and individual Contract Details. The list SHALL include every account-relevant BIS-tracked agreement, including unresolved funding, claims, refunds, uncertain operations and terminal claimed, refunded or failed contracts. It SHALL show `No contracts.` only for a known empty complete account list. Each closed row SHALL use shared compact geometry with a leading toast status icon and six emoji-value fields: operation/type, cost, purpose, current status, role, and expiration. Pending rows use toast information-blue; done, warning, and error states use their truthful matching palettes. Hover/focus/selection add black outlines without changing the status background. Contract IDs and references remain in details/reports. Details SHALL show sanitized identity/amount/state/deadline and related transaction information and follow existing accessible wallet-page loading and error conventions.

The Contracts list page SHALL use the same 456px compact parent-card height, 3.5-row list viewport, persistent vertical scrollbar, stable scrollbar gutter, and visible Back footer as Assets and Transactions. Every contract row SHALL have the same rendered width and height as every asset and transaction row.

#### Scenario: Expired refund pending
- **WHEN** an offer expires but its refund is unverified
- **THEN** its blue row shows operation, cost, purpose, refunding status, role, and expiration beside the information glyph and remains visible

#### Scenario: Verified terminal state
- **WHEN** a claim or refund is verified
- **THEN** the agreement remains visible in Account Contracts with its terminal financial status, final operation and copyable sanitized evidence

#### Scenario: Consistent account collections
- **WHEN** the user opens Assets, Contracts or Transactions and their details
- **THEN** all six pages use a consistent title, body, copyable field, scroll content and Back arrangement
- **AND** each list reserves the same 3.5-row scroll area even when empty, keeps its scrollbar visible, and uses equal-width equal-height rows

#### Scenario: Empty or short contract list
- **WHEN** the contract query returns zero, one, or two contracts
- **THEN** the Contracts list still reserves the full 3.5-row viewport and keeps its vertical scrollbar visible

#### Scenario: Narrow contract row
- **WHEN** one of the six contract values exceeds its cell at a supported narrow width
- **THEN** the value is contained without horizontal overflow and its complete value remains available in Contract Details and copyable reports
