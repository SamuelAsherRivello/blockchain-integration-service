# Spec Delta

## Purpose

Provide private Server-mode Signet Game Wallet signing through bis-server locally and on Vercel while preserving the Local Mutinynet browser Game Wallet and browser workflow ownership.

## ADDED Requirements

### Requirement: Private server game signing identity
bis-server SHALL load its game mnemonic only on the server and expose public identity and authorized signatures. Player Wallet signing SHALL remain client-owned. Recovery phrases, private keys and secret nonce material SHALL NOT enter public responses, logs, browser bundles or static routes.

#### Scenario: Local and hosted configuration
- **WHEN** bis-server runs locally or on Vercel with valid private environment configuration
- **THEN** BIS can use its public game identity and request game signatures without importing its mnemonic
- **AND** invalid server configuration reports an error without generating or funding a replacement identity

### Requirement: Isolated Preview signer configuration
On Vercel Preview deployments, bis-server SHALL resolve private signer, owner-token, owner-network allowlist, signing-cap and Redis configuration only from their `BIS_PREVIEW_`-prefixed counterparts. Missing Preview values SHALL remain missing; Production values SHALL NOT be used as fallback. Production and local configuration SHALL ignore `BIS_PREVIEW_` values.

#### Scenario: Preview configuration cannot fall back to Production
- **WHEN** a Preview deployment has Production variables but lacks one or more `BIS_PREVIEW_` counterparts
- **THEN** the missing Preview values remain unset and the deployment reports the corresponding configuration as unavailable
- **AND** no Production wallet, owner token, cap, or Redis credential is selected

#### Scenario: Preview credentials are isolated from Production
- **WHEN** a Preview deployment has `BIS_PREVIEW_` values and a Production deployment has the ordinary variable names
- **THEN** Preview uses only its Preview-prefixed values and Production continues to use only ordinary values
- **AND** Preview wallet secrets do not become accessible to Production

### Requirement: Network-specific Local and Server resolution
BIS SHALL select Local on Mutinynet without probing a BIS server, and Server on Signet. Server mode SHALL use bounded lifecycle probes of the known API. An unreachable Signet server SHALL report its actual connection failure while keeping Server selected and preserving pending authority. This release SHALL NOT expose a Local/Server mode toggle or switch Signet work to a browser Game Wallet.

#### Scenario: Local Mutinynet with a configured server
- **WHEN** the user selects Mutinynet while a BIS server endpoint is configured, stopped or unreachable
- **THEN** existing local Game Wallet create/restore/login and all previously enabled actions remain available
- **AND** the client sends no BIS server identity, connect, planning, grant or signing request for that Local workflow

#### Scenario: Signet Server stopped or absent
- **WHEN** the configured local or Vercel endpoint fails to connect or reaches the bounded connection timeout
- **THEN** BIS keeps Server selected, reports the connection failure and offers Retry
- **AND** it does not offer a Local Game Wallet mode or silently activate a saved browser wallet

#### Scenario: Reachable configuration error
- **WHEN** the server responds with incompatible game/network/API, invalid signer configuration or rejected authorization
- **THEN** BIS displays that specific error rather than treating it as an absent server

#### Scenario: Probe lifecycle
- **WHEN** player or network changes supersede a probe
- **THEN** late replies cannot change the replacement scope and compatible probes are coalesced
- **AND** player logout does not delete or log out the server identity

### Requirement: Signet-only hosted wallet selection
This release SHALL configure hosted Game Wallet signing for Signet only. Mutinynet SHALL use Local and retain its existing feature set without requiring BIS server access. Public and owner-authenticated Production routes SHALL reject hosted Mutinynet signing. Signing and recovery SHALL retain the original network/profile without balance-driven replacement. Any future hosted Mutinynet enablement requires separate qualification.

#### Scenario: Signet signer is configured
- **WHEN** a published consumer selects Signet and the private Signet identity is configured
- **THEN** it resolves the Signet server identity and requests only Signet-scoped signatures
- **AND** existing operations remain bound to the identity that created them

#### Scenario: Mutinynet hosted signer is not released
- **WHEN** a published consumer selects Mutinynet for this release
- **THEN** it enters the existing Local flow without first attempting hosted signing
- **AND** it does not silently use the Signet identity or sign for Mutinynet

#### Scenario: Owner credentials cannot bypass the Mutinynet release boundary
- **WHEN** an owner-authenticated connect, planning, authorization, signing, or recovery request selects Mutinynet during proposal 1
- **THEN** bis-server rejects the request under the same Signet-only Production boundary
- **AND** Preview can use a separate `BIS_PREVIEW_OWNER_SIGNING_NETWORKS` allowlist without inheriting or widening Production access

### Requirement: Signing parity with client-owned operations
Server mode SHALL replace only the Game Wallet signing identity. Existing preparation, submission, provider reads, journals and reconciliation SHALL remain client-owned. Required transaction, message and signer-session methods SHALL work remotely for existing enabled workflows. Signatures SHALL NOT establish financial confirmation or alter fee payer, trophy eligibility or reward policy.

#### Scenario: All enabled features retain behavior
- **WHEN** applicable wallet, payment, asset, Marketplace, continuation or Treasure actions run in Mutinynet Local or Signet Server
- **THEN** they retain their established amounts, destinations, ownership, asset change, user feedback and recovery behavior
- **AND** an enabled action is not removed or disabled merely to satisfy the release checklist

#### Scenario: Existing game-wallet transaction
- **WHEN** a current workflow prepares a transaction
- **THEN** the client obtains server signatures, submits through its existing network adapter and checks network evidence
- **AND** its journal, confirmation and recovery rules remain effective

#### Scenario: Stateful signing
- **WHEN** a workflow requires a multi-step signing session
- **THEN** each signature is bound to the exact authorized transcript without nonce reuse
- **AND** unsupported methods or lost sessions report explicit errors, not successful workflow completion

### Requirement: Source-pinned recovery across Local and Server modes
Operations SHALL retain source, endpoint, game identity, network, player scope and operation ID. Pending or uncertain operations SHALL remain bound to their original signer and recovery evidence. Returning server availability SHALL NOT silently replace a wallet or operation source during work.

#### Scenario: Server disappears mid-operation
- **WHEN** a server signing response or connection is lost
- **THEN** the original operation is not re-signed or replayed through a Local wallet
- **AND** independent Signet work reports the unavailable Server rather than changing the unresolved operation's source

#### Scenario: Server returns
- **WHEN** the Signet server becomes reachable after an outage
- **THEN** the selected mode remains Server and any retry is scoped to its original operation
- **AND** old operation evidence is not reassigned

### Requirement: Hosted signing coordination and authorization
Hosted signing SHALL validate server-verifiable scope and enforce server-defined signing policies and atomic quotas. Owner actions SHALL require private authentication absent from Pages bundles. Cross-instance coordination SHALL prevent conflicting input signing, changed-request replay and nonce reuse. Local files and warm-instance memory SHALL NOT be the sole hosted coordination authority.

#### Scenario: Concurrent or interrupted signing
- **WHEN** separate hosted instances receive duplicate/conflicting requests or a signing session spans restarts
- **THEN** shared coordination returns the exact prior result, safely resumes, or explicitly refuses the unresolved request
- **AND** lease expiry alone never authorizes a conflicting spend or nonce reuse

#### Scenario: Unauthorized public request
- **WHEN** a client requests arbitrary, over-budget, wrong-network or unauthorized signing
- **THEN** bis-server rejects it before signing
- **AND** Origin allowlisting alone does not grant signing authority
