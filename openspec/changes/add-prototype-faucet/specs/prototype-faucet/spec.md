# Spec Delta

## Purpose

Provides a clearly labeled, development-only page for requesting bounded Arkade test funds on Signet or Mutinynet. It keeps faucet custody and funding operations separate from BIS product APIs while giving local developers one predictable funding workflow.

## ADDED Requirements

### Requirement: Prototype package is visibly separate from BIS product surfaces
The faucet SHALL be exposed as a package named `prototype-faucet` and SHALL identify itself as experimental development tooling on the page and in its documentation.

#### Scenario: Prototype page is opened
- **WHEN** a developer opens the faucet route
- **THEN** the page identifies itself as a prototype faucet and does not present itself as the BIS integration, Admin, or Marketplace product

#### Scenario: Product package is consumed
- **WHEN** a consumer imports `@bis/integration`
- **THEN** no faucet UI, faucet server API, or faucet custody operation is added to that product package's public API

### Requirement: User can choose an Arkade test network
The page SHALL allow the developer to choose Signet or Mutinynet before entering a funding request.

#### Scenario: Network selection
- **WHEN** the developer selects Signet or Mutinynet
- **THEN** the page displays that network as the active destination context and uses only its configured Arkade operator for validation and funding

#### Scenario: Network provider mismatch
- **WHEN** the selected operator reports a different network or cannot be verified
- **THEN** the request is unavailable and the page does not enable funding or claim readiness

### Requirement: Arkade destination is validated for the selected network
The funding workflow SHALL accept only a syntactically valid Arkade address whose encoded operator identity matches the selected network's verified Arkade operator.

#### Scenario: Valid selected-network address
- **WHEN** the developer enters a valid Arkade address for the selected network
- **THEN** the page marks the destination valid and enables amount selection and request submission

#### Scenario: Wrong-network or malformed address
- **WHEN** the developer enters a malformed address or an address for the other supported network
- **THEN** the page explains that the address is invalid for the selected network and prevents submission

### Requirement: Funding amounts are bounded
The faucet SHALL offer bounded Arkade satoshi amounts, initially 50,000, 100,000, and 200,000 sats, and SHALL reject any amount outside the configured prototype and operator limits before signing or sending.

#### Scenario: Supported amount
- **WHEN** the developer selects an available amount within the current limit
- **THEN** the page enables a request containing the exact selected satoshi amount

#### Scenario: Amount exceeds available limit
- **WHEN** the selected amount exceeds a configured faucet or operator limit
- **THEN** the page disables or rejects the request with a safe limit explanation and performs no network send

### Requirement: Funding uses protected server-side custody
The faucet SHALL perform signing and Arkade sending outside the browser, and SHALL not expose recovery phrases, private keys, wallet configuration secrets, or raw signed transaction material to the page, logs, or public diagnostics.

#### Scenario: Browser requests funding
- **WHEN** a valid page request is submitted
- **THEN** the server validates the request again, uses the configured network faucet wallet, and returns only a sanitized operation result

#### Scenario: Missing server liquidity or configuration
- **WHEN** the server cannot access a funded faucet wallet or required network configuration
- **THEN** the request is reported unavailable or failed without exposing secret material or claiming that funds were sent

### Requirement: Operation status is truthful and safe
The page SHALL distinguish validation failure, rate limiting, unavailable service, rejected submission, pending delivery, and verified success; an HTTP acknowledgement alone SHALL NOT be displayed as received funds.

#### Scenario: Accepted but unverified request
- **WHEN** the server accepts a send request but delivery has not been verified
- **THEN** the page shows a pending state with a public operation identifier when available

#### Scenario: Verified delivery
- **WHEN** the server verifies the Arkade operation and destination amount on the selected network
- **THEN** the page shows success with the exact network, amount, destination summary, and public transaction identifier

#### Scenario: Rejected or unavailable request
- **WHEN** the request is rejected, rate-limited, or the provider is unavailable
- **THEN** the page shows an actionable safe reason and does not show success

### Requirement: Ordinary on-chain BTC is excluded from the first slice
The prototype SHALL not submit ordinary Mutinynet or Signet on-chain BTC funding in the initial capability.

#### Scenario: User seeks on-chain funding
- **WHEN** the developer views the initial faucet page
- **THEN** the page identifies Arkade as the available rail and does not provide an on-chain BTC send control
