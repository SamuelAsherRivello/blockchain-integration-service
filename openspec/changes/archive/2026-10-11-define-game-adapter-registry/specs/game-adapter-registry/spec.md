# Game Adapter Registry Specification

## Purpose

Provide a narrow BIS-owned registration and validation seam for the companion game so autonomous browser acceptance can target a known path, muted URL, and public BIS package provenance without weakening private wallet or profile boundaries.

## ADDED Requirements

### Requirement: Registered game adapter is exact and public

The runner SHALL define one explicit game adapter with path `/blockchain-stealth-and-steel-game/`, search `?muteMusic=true&muteSFX=true`, package `@bis/integration` version `0.0.20`, and the evidence-backed public artifact hash. The adapter SHALL contain no recovery phrase, signing key, browser profile path, or wallet journal.

#### Scenario: Configure a game origin

- **WHEN** `test-wallets init --origin <exact-loopback-origin>` configures applications
- **THEN** the vault SHALL contain one idempotent game registration with the exact path and muted search
- **AND** a second origin or changed port SHALL be a separate registration rather than an implicit rewrite

### Requirement: Owned game sessions retain isolation checks

The owned runner SHALL accept the game only through the registered adapter and SHALL revalidate exact origin, pathname, search, network, identity, and registration before inspection or action. It SHALL preserve independent persistent-profile locking and private recovery handling.

#### Scenario: Game URL or origin changes

- **WHEN** a game page has a different origin, pathname, or search from its registration
- **THEN** the session SHALL fail closed with a public context error
- **AND** it SHALL not export recovery material or use another application's storage

### Requirement: Public provenance is verifiable without secrets

The runner SHALL verify the expected package name, version, artifact hash, and evidence path from public text before reporting the game adapter as provenance-ready. Failed or missing evidence SHALL remain unavailable and SHALL NOT be replaced by a caller-provided version.

#### Scenario: Provenance evidence is incomplete

- **WHEN** the evidence omits or changes any expected public provenance field
- **THEN** verification SHALL fail closed
- **AND** no wallet or browser operation SHALL be initiated
