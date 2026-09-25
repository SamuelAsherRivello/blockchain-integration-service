## MODIFIED Requirements

### Requirement: Contracts navigation and details
Account Details SHALL offer Contracts with an Assets-style list and individual Contract Details. The list SHALL include unresolved funding, claims, refunds and uncertain operations, and show `No active contracts` only for a known empty list. Each closed contract row SHALL use the shared item-row geometry and show a leading toast status icon followed by six fields in a two-column by three-row grid. The visible fields SHALL contain only an emoji, separator, and value: operation/type (`⚙️`), cost (`🪙`), purpose (`🎯`), current financial or eligibility status (`⏳` for a pending example), role (`👤`), and expiration (`📅`). Every emoji SHALL have a programmatic accessible label. The row SHALL NOT show the contract ID or host reference; complete sanitized identity, amount, state, deadline, references, and related transaction information SHALL remain in Contract Details and copyable reports.

Pending or unresolved contract rows SHALL use the existing toast information-blue background/border and information status glyph. A done state that remains present SHALL use the existing toast success-green background/border and success glyph; warning and error states SHALL use the corresponding existing toast palette and glyph when truthful. Hover and keyboard focus SHALL add a black outline without changing the status background. A selected row, when present in the list, SHALL use a stronger persistent black outline without changing that background. Contract Details SHALL continue to follow existing accessible wallet-page loading and error conventions.

#### Scenario: Expired refund pending
- **WHEN** an offer expires but its refund is unverified
- **THEN** its blue closed row shows operation, cost, purpose, refunding status, role, and expiration as six emoji-value fields beside the toast information glyph
- **AND** it remains visible and is not presented as closed

#### Scenario: Verified terminal state
- **WHEN** a claim or refund is verified
- **THEN** the agreement leaves the active list while its financial activity and internal deduplication evidence remain available

#### Scenario: Consistent account collections
- **WHEN** the user opens Assets, Contracts or Transactions and their details
- **THEN** all six pages use a consistent title, body, copyable field, scroll content and Back arrangement
- **AND** lists reserve a 276px scroll area even when empty and Account Details provides equal-width Assets, Contracts and Transaction buttons in one row with ellipsis for constrained labels

#### Scenario: Interact with a contract row
- **WHEN** the row is hovered, keyboard-focused, or retained as selected
- **THEN** the appropriate black outline appears while the status-colored background remains unchanged

#### Scenario: Narrow contract row
- **WHEN** one of the six contract values exceeds its cell at a supported narrow width
- **THEN** the value is contained without horizontal overflow and its complete value remains available in Contract Details and copyable reports
