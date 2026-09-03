## Purpose

Allow host games to earn and query player-wallet achievements through a public API without requiring BIS achievement UI or a custom application server.

## ADDED Requirements

### Requirement: Earn through a UI-independent public API
BIS SHALL accept a nonempty achievement string and issue one real, non-reissuable Signet asset to the active player's wallet, using that wallet for any required funding. The identifier SHALL be preserved exactly. Results SHALL distinguish earned, already owned, and failure or uncertain outcomes. Calling the API SHALL NOT mount, open, or change BIS UI. Completion SHALL require a confirmed successful issuance outcome; local records alone SHALL NOT establish ownership.

#### Scenario: Earn an achievement
- **WHEN** an active funded account earns a not-owned achievement and issuance completes successfully
- **THEN** the caller receives an earned result identifying the achievement and issued asset
- **AND** a subsequent successful ownership query includes it without an intervening Claim step

#### Scenario: No account
- **WHEN** earning is requested without an active account
- **THEN** BIS returns an account-required error without opening a dialog, queuing an award, or issuing an asset

#### Scenario: Invalid input or insufficient funding
- **WHEN** the identifier is empty or the wallet cannot fund issuance
- **THEN** the caller receives a distinct invalid-input or insufficient-funds error without fabricated success

### Requirement: Safe repeated earning
BIS SHALL check current wallet ownership before issuance. If the requested achievement is already owned, BIS SHALL return already-owned without issuing another asset. Concurrent calls within the same browser origin SHALL NOT create duplicate awards. An uncertain prior submission SHALL be reconciled before any retry can issue another asset; if its outcome cannot be determined, BIS SHALL return outcome-unknown rather than retry issuance automatically.

#### Scenario: Repeat after success or restoration
- **WHEN** the active wallet already owns the recognized requested achievement, including after restoring that wallet
- **THEN** earning returns already-owned and does not submit a new issuance

#### Scenario: Concurrent requests
- **WHEN** two same-origin callers request the same achievement for the same account concurrently
- **THEN** at most one issuance is submitted and callers receive consistent results or a pending outcome

#### Scenario: Interrupted submission
- **WHEN** issuance may have been submitted but success is not yet established, including after reload
- **THEN** retry reconciles that operation and does not treat an empty or failed wallet read as proof that another issuance is safe

### Requirement: List real owned achievements
BIS SHALL expose a UI-independent query returning a JSON-serializable list of recognized achievements held by the active wallet, including their achievement identifiers and asset identifiers. Recognition SHALL use versioned achievement metadata, not every wallet asset or a name prefix alone. A successful empty query SHALL return an empty list. Unavailable ownership or required metadata reads SHALL return an error instead of an empty or silently partial list. No account SHALL return account-required. Restoration SHALL not require a browser-local achievement catalog to rediscover owned achievements.

#### Scenario: List after earning
- **WHEN** a wallet holds recognized achievement assets and listing succeeds
- **THEN** the result contains their exact achievement identifiers and asset identifiers and excludes unrelated assets

#### Scenario: Empty wallet versus failed query
- **WHEN** a successful wallet query finds no recognized achievements
- **THEN** the caller receives an empty list
- **AND** a failed query instead produces an unavailable error without stale data represented as current

#### Scenario: Restored wallet
- **WHEN** the same wallet is restored in a clean browser profile and its assets are queried
- **THEN** its recognized owned achievements are discovered from wallet assets and metadata

### Requirement: Account isolation and public output
Achievement APIs SHALL expose no recovery material, signing keys, raw secret-bearing SDK objects, or Arkade-specific public types. Results SHALL identify their originating account. Logout, account replacement, or disposal SHALL prevent stale results being applied to a different active account and prevent new submissions under the obsolete session. Already submitted transactions SHALL NOT be represented as cancelled solely because the UI or session closed. Failures SHALL leave ordinary gameplay and existing account access usable.

#### Scenario: Account changes during a request
- **WHEN** the account changes while a request is in flight
- **THEN** no result is attributed to the replacement account and no additional submission starts under the old session

#### Scenario: Public result logging
- **WHEN** a host logs an API result
- **THEN** the result is JSON-serializable, identifies the originating account where applicable, and contains no secrets
