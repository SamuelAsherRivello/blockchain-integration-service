## MODIFIED Requirements

### Requirement: Contracts navigation and details
Account Details SHALL offer Contracts with an Assets-style list and individual Contract Details. The list SHALL include every account-relevant BIS-tracked agreement, including unresolved funding, claims, refunds, uncertain operations and terminal claimed, refunded or failed contracts. It SHALL show `No contracts.` only for a known empty complete account list. Each closed row SHALL use shared compact geometry with a leading toast status icon and six emoji-value fields: operation/type, cost, purpose, current status, role, and expiration. Pending rows use toast information-blue; done, warning, and error states use their truthful matching palettes. Hover/focus/selection add black outlines without changing the status background. Contract IDs and references remain in details/reports. Details SHALL show sanitized identity/amount/state/deadline and related transaction information and follow existing accessible wallet-page loading and error conventions.

#### Scenario: Expired refund pending
- **WHEN** an offer expires but its refund is unverified
- **THEN** its blue row shows operation, cost, purpose, refunding status, role, and expiration beside the information glyph and remains visible

#### Scenario: Verified terminal state
- **WHEN** a claim or refund is verified
- **THEN** the agreement remains visible in Account Contracts with its terminal financial status, final operation and copyable sanitized evidence

#### Scenario: Consistent account collections
- **WHEN** the user opens Assets, Contracts or Transactions and their details
- **THEN** all six pages use a consistent title, body, copyable field, scroll content and Back arrangement
- **AND** lists reserve a 276px scroll area even when empty and Account Details provides equal-width Assets, Contracts and Transaction buttons in one row with ellipsis for constrained labels
