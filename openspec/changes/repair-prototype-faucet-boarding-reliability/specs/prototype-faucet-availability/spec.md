# Spec Delta

## Purpose

Provides reliable, read-only availability information for the development faucet and ensures the local page can reach its server boundary without requiring a second undocumented process.

## ADDED Requirements

### Requirement: Read-only faucet hydration
The faucet SHALL read configured network addresses and wallet balances without submitting onboarding, settlement, or funding operations.

#### Scenario: Wallet has boarding funds but settlement is unavailable
- **WHEN** the operator can read the faucet wallet but fee estimation for onboarding is unavailable
- **THEN** the page displays the public faucet addresses and the wallet’s total/available balance, while funding remains unavailable or not ready

#### Scenario: Explicit refresh
- **WHEN** the developer changes the network or activates Refresh
- **THEN** the page re-reads addresses and balance for only the selected network without changing wallet state

### Requirement: Local API availability
The standalone faucet development entry point SHALL start the local faucet API when it is not already healthy and SHALL reuse an already healthy API without starting a duplicate process.

#### Scenario: Standalone page start
- **WHEN** the developer starts the faucet’s documented Vite command and port 5190 is not serving the faucet health endpoint
- **THEN** the API starts from the package’s server entry point and the page can load its data through the configured proxy

#### Scenario: API already running
- **WHEN** the faucet health endpoint is already healthy
- **THEN** the development entry point reuses it and does not create a second listener

### Requirement: Truthful read and funding states
The page SHALL distinguish readable wallet data from unavailable funding capability and SHALL never present a balance read as proof that onboarding or a later request succeeded.

#### Scenario: Readable but not spendable balance
- **WHEN** total boarding funds are readable and available Arkade funds are zero
- **THEN** the page shows both values and keeps the funding request disabled with an actionable readiness state

#### Scenario: Operator read failure
- **WHEN** address or balance reads fail because the selected operator is unavailable or mismatched
- **THEN** the page shows a sanitized unavailable state and offers Refresh without exposing raw provider payloads

### Requirement: Onboarding is explicit and isolated
Automatic onboarding SHALL occur only as part of an explicit funding request or separately authorized operational action; address and balance reads SHALL not trigger onboarding retries or fee-estimation calls.

#### Scenario: Balance refresh during fee outage
- **WHEN** fee estimation is unavailable during a balance refresh
- **THEN** the refresh completes with the last fresh read result or a read-specific unavailable state and does not create an intent

#### Scenario: Funding request after readable balance
- **WHEN** the developer submits a valid bounded request and the wallet has no spendable Arkade balance
- **THEN** the server may attempt onboarding as part of the request and reports pending or unavailable truthfully based on operator evidence

### Requirement: Safe diagnostics and lifecycle cleanup
The faucet SHALL keep startup and operator failures bounded and sanitized, and a development API started by the standalone page SHALL be terminated when that page’s server closes.

#### Scenario: API startup failure
- **WHEN** the API cannot start or become healthy within the startup wait
- **THEN** the page remains usable enough to show an actionable unavailable state and no secret or raw provider payload is exposed

#### Scenario: Standalone server shutdown
- **WHEN** the Vite development server closes after it started the faucet API
- **THEN** its child API process is terminated without affecting an API process that was reused
