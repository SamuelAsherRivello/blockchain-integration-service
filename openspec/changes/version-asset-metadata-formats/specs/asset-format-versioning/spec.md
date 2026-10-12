# Spec Delta

## Purpose

Define a durable, explicit compatibility contract for immutable BIS asset metadata so supported formats can evolve without silently misinterpreting prior holdings.

## ADDED Requirements

### Requirement: Explicit immutable BIS asset format version
Every newly minted BIS-managed asset SHALL carry `bisAssetFormatVersion` with the exact string value of the registry's current version. The initial current version SHALL be `0.0.1`. Adding this marker SHALL preserve the existing BIS metadata field names, scalar values, structured metadata JSON transport, asset supply, and mint/burn semantics.

#### Scenario: Current-format asset is minted
- **WHEN** Admin or another BIS-managed caller mints an asset using the current format
- **THEN** its chain metadata contains `bisAssetFormatVersion: "0.0.1"`
- **AND** existing supported metadata fields retain their current values and representation

### Requirement: Version resolution is truthful and non-destructive
BIS SHALL resolve each holding as an explicit supported version, a recognized unversioned legacy shape, an unknown explicit version, or malformed/unsupported metadata. A recognized unversioned holding whose complete metadata validates as the unchanged `0.0.1` contract SHALL resolve as compatible `0.0.1`; BIS SHALL NOT write to, relabel on-chain, or otherwise mutate that holding. Unknown or malformed version markers SHALL not be treated as a supported version.

#### Scenario: Existing compatible holding has no marker
- **WHEN** a pre-versioning holding contains metadata that validates as the unchanged `0.0.1` contract but no format marker
- **THEN** Admin can resolve it as compatible `0.0.1` without changing the asset

#### Scenario: Future marker is encountered
- **WHEN** a holding contains `bisAssetFormatVersion` not registered by the installed BIS version
- **THEN** BIS reports it as unknown/unsupported without interpreting it through a different format handler

### Requirement: Registered formats own compatibility behavior
For each supported asset format, BIS SHALL use one authoritative compatibility definition for metadata decoding, validation, classification, catalog minting, and Admin operations. A format handler SHALL reject malformed values and SHALL not infer values from presentation text, names, tickers, or catalog guesses.

#### Scenario: Two registered versions coexist
- **WHEN** a later registered format differs from `0.0.1` and Admin selects either version
- **THEN** the selected version's handler alone validates and operates on its compatible holdings
- **AND** a holding is not processed by the other version's handler

### Requirement: Successor formats declare a migration policy
Every registered successor format SHALL declare which supported earlier formats it can migrate and a deterministic per-holding replacement mapping. Automatic upgrade SHALL be enabled by default for each declared compatible predecessor; a format designer SHALL be able to explicitly disable it. The mapping SHALL preserve the owning account, network, stable item identity, exact positive quantity, and only the meaning the successor format explicitly supports.

#### Scenario: New format enables its default upgrade
- **WHEN** a successor format is registered with a compatible predecessor and no explicit opt-out
- **THEN** its migration policy enables automatic upgrade from that predecessor
- **AND** the registry provides the deterministic replacement metadata for each eligible holding

#### Scenario: New format opts out of automatic upgrade
- **WHEN** a successor format explicitly disables automatic upgrade from an earlier version
- **THEN** older compatible holdings remain version-scoped for Admin operations
- **AND** non-Admin consumers do not treat them as latest-format items

### Requirement: Automated migration is recoverable and non-destructive
For an eligible automatic upgrade invoked by Admin, BIS SHALL durably bind the source holding, target format, replacement operation, currently logged-in Player Wallet, active Game Wallet, and network before mutation. The active Game Wallet SHALL mint and deliver one mapped replacement per source holding to the Player Wallet before BIS submits the guarded retirement/burn of that old holding. It SHALL never delete, hide, or claim migration of an old holding solely from a local flag, a missing response, or a replacement request. An unavailable player, Game Wallet, funding source, or explicit auto-upgrade opt-out SHALL leave the old holding intact and report a safe pending/unavailable migration state.

#### Scenario: Automatic migration completes
- **WHEN** an operator invokes Upgrade all player items with an active Game Wallet, a logged-in Player Wallet, and the latest format enables automatic upgrade
- **THEN** BIS mints and delivers one verified mapped latest-format replacement to the Player Wallet before retiring each old holding
- **AND** subsequent latest-only consumers use the verified replacement

#### Scenario: Migration is interrupted after replacement delivery
- **WHEN** replacement delivery succeeds but old-holding retirement has an unknown or unavailable outcome
- **THEN** BIS preserves durable recovery evidence and does not issue another replacement
- **AND** it does not falsely report that the old holding was retired
