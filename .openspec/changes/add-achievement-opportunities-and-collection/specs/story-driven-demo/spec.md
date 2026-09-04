## MODIFIED Requirements

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and nonempty categories. It SHALL begin without a selected story, including after refresh. Existing implemented Account demonstrations SHALL remain available. This slice SHALL add Assets / C1 Mint Asset and C4 List Assets and omit unimplemented categories and stories. The Admin heading SHALL be followed by User Stories and a working Documentation link in development and production builds. It SHALL NOT show Interactivity.

#### Scenario: Initial demo
- **WHEN** the demo loads
- **THEN** existing account demonstrations and C1/C4 asset controls are available with empty Runtime Preview and no filler cards or empty categories

## ADDED Requirements

### Requirement: Admin mint form
C1 Mint Asset SHALL open an Admin-owned form with Name, Ticker, Amount, Decimals, optional Icon URL, an Unverified asset summary, and read-only Control Asset: None. Name/ticker/amount SHALL be required. The form SHALL use editable defaults of an asset, ASSET, 1, and 0 respectively, with blank Icon URL. Existing/New control-asset choices SHALL NOT be offered. Only an explicit valid Mint action SHALL call the generic production mint API. Pending/results/errors SHALL appear in Admin Console. Pending submission SHALL disable edits and duplicate submission; bounded unknown outcomes SHALL preserve the request and operation ID for reconciliation.

#### Scenario: Edit and mint
- **WHEN** the user opens C1, edits valid fields, and clicks Mint
- **THEN** the public API receives those values with no control asset and Admin Console shows pending followed by the returned result
- **AND** the form summary before success is not represented as wallet ownership

#### Scenario: Invalid or cancelled form
- **WHEN** inputs are invalid or the user dismisses the idle form
- **THEN** no mint is submitted and relevant validation or ordinary Admin controls remain available

### Requirement: Admin example presets
The Admin mint form SHALL offer three quick-fill buttons labeled Achievement: Level 1, Achievement: Level 2, and Achievement: Level 3. Each SHALL populate the matching name, ticker LVL1/LVL2/LVL3 respectively, amount 1, decimals 0, blank icon URL, and Control Asset None. Fields SHALL remain editable. Presets SHALL only modify the form and SHALL NOT submit, query, or establish ownership. They SHALL be disabled during submission or while an unresolved request must remain immutable. Example labels SHALL remain in the demo; BIS SHALL apply no achievement-specific meaning or rules.

#### Scenario: Use a preset
- **WHEN** the user selects Achievement: Level 2 in an idle form
- **THEN** the form contains that name, LVL2, amount 1, decimals 0, empty icon URL, and None
- **AND** nothing is submitted until the user separately clicks Mint

### Requirement: Admin list and preview isolation
C4 List Assets SHALL call the generic production listing API and show its actual result in Admin Console, including an explicit empty array. Neither C1 nor C4 SHALL navigate, mount, clear, or change Runtime Preview. Existing account-flow restrictions SHALL be preserved. A mint form SHALL be outside the runtime container and use accessible labels, focus containment/restoration, idle dismissal, and responsive scrolling.

#### Scenario: Mint then list
- **WHEN** mint succeeds and the user then clicks List Assets for the same account
- **THEN** a fresh returned list contains that same asset ID and exact quantity
- **AND** Runtime Preview remains unchanged throughout

#### Scenario: Logged-out request
- **WHEN** an asset API is invoked without an account
- **THEN** Admin Console displays account-required and no account dialog opens automatically

### Requirement: Always-visible Admin Console
The existing Console region SHALL remain visible from initial load and show labeled pending operations and public API responses or sanitized errors. It SHALL include originating account and operation IDs where known, render text safely, scroll, and retain bounded transient history. Refresh and successful Reset Client SHALL clear its history; stale completions from a previous client SHALL be ignored.

#### Scenario: Reset with late output
- **WHEN** a new client replaces an old client and the old request later completes
- **THEN** the new console does not append that stale result

### Requirement: Delivery evidence and documentation
C1/C4 documentation SHALL describe generic mint/list APIs and Admin-only presets. Preserve story/step IDs with superseded annotations where necessary. Live mint/list, restoration, retry safety, exact amounts, independent-host parity, and browser behavior SHALL have supporting evidence before completion is claimed. Unperformed checks SHALL remain pending. B/C2/C3/C5 and D1 issuer scope SHALL remain deferred.

#### Scenario: Report delivery
- **WHEN** this slice is reported complete
- **THEN** the revised behavior has supporting evidence and unrelated pending work is not reported complete
