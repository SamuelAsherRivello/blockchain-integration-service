# bis-package-export Specification

## Purpose
Provide a reproducible, verified integration-package export from a tested BIS release so a separate game can consume its working public contract without depending on a mutable source checkout.

## Requirements

### Requirement: Export contains working public game contracts

BIS SHALL export a versioned integration archive containing built runtime code, its public stylesheet, public type entrypoints, `IBis`, `IBisGame`, supporting DTOs and package metadata. The archive SHALL be usable outside the BIS checkout through documented package exports.

#### Scenario: A standalone consumer checks the export
- **WHEN** a consumer installs the exported archive without a BIS source link
- **THEN** runtime, stylesheet and public contract types SHALL resolve successfully
- **AND** internal-only dependencies SHALL not be required as consumer imports

### Requirement: Export is attributable to the released implementation

Each export SHALL record package version, originating released commit, archive SHA-256, packed-file inventory and verification evidence. Its source SHALL be the intended commit verified on the authoritative remote branch, not an unpinned branch or unrelated dirty working tree.

#### Scenario: Export accompanies a successful BIS Pages deployment
- **WHEN** the new BIS version is built and deployed successfully
- **THEN** the exported package SHALL correspond to that implementation/version
- **AND** the handoff SHALL identify its exact commit, hash and contents

### Requirement: BIS release uses the existing versioned Pages process

BIS SHALL synchronize its `0.0.N` release version across the required manifests/lockfile, advance both demo cache-busters, and publish both Admin and Marketplace together through its existing push-to-`main` Pages workflow. Their stable `/admin/` and `/marketplace/` routes and issued root `/assets/` URLs SHALL remain supported. Release completion SHALL require successful deployment and verification of both apps. This process SHALL be independent of game publication and SHALL not require tags, GitHub Release assets or manual release dispatch.

#### Scenario: The next BIS version is published
- **WHEN** intended tested BIS changes are committed and pushed to `main`
- **THEN** the push-triggered deployment SHALL publish both demo applications without requiring a game update
- **AND** their observed release identity SHALL match the exported integration package

#### Scenario: Deployment does not succeed
- **WHEN** the workflow fails or either published route is not the expected application/version
- **THEN** BIS SHALL not report the release or downstream handoff gate as complete

### Requirement: Export verification covers behavior and consumer compatibility

BIS SHALL pass its full supported test suites, typechecks, production builds and public-package checks before the handoff is accepted. Runtime verification SHALL include ordinary no-account UI behavior and shall distinguish browser evidence from live financial acceptance. Failed tests SHALL not be accepted as a successful release gate.

#### Scenario: All release checks succeed
- **WHEN** BIS completes verification of the new boundary
- **THEN** the recorded evidence SHALL include test commands/results, packed-package checks, build results and browser checks
- **AND** no wallet credentials, fabricated transaction success or automatic wallet operations SHALL be used

#### Scenario: An unrelated failure prevents a full green run
- **WHEN** a supported full suite fails outside the changed boundary
- **THEN** the failure SHALL be reported and resolved within authorized scope or explicitly escalated
- **AND** the full-green requirement SHALL not be silently narrowed to focused tests
