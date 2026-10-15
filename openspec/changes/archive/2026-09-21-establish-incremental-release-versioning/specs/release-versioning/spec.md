## Purpose

Provides a deterministic version contract for the BIS source, published packages, runtime labels, and two-route GitHub Pages release so every published update can be identified and verified.

## ADDED Requirements

### Requirement: Published BIS uses a patch-only release sequence

The published BIS release version SHALL use three numeric components in the form `0.0.N`. The initial published version SHALL be `0.0.1`, and each later published update SHALL increment only `N` by exactly one. Major or minor component changes SHALL require a separately approved versioning policy change.

#### Scenario: Initial published baseline

- **WHEN** the release-versioning change is applied to the current repository baseline
- **THEN** the published BIS version is `0.0.1`

#### Scenario: Subsequent published update

- **WHEN** the currently published version is `0.0.N` and a new update is released
- **THEN** the new published version is exactly `0.0.(N+1)`

#### Scenario: Version jump is rejected

- **WHEN** a candidate release changes the major or minor component, decrements `N`, or increases `N` by more than one
- **THEN** release validation fails and identifies the version transition as invalid

### Requirement: Published version surfaces remain synchronized

The root release metadata SHALL be authoritative for the published BIS version. The root metadata, published `@bis/integration`, `@bis/integration-demo`, and `@bis/marketplace` package metadata, lockfile root/workspace metadata, runtime `BIS: v<version>` labels, and both README Pages cache-busters SHALL represent the same release version. The standalone onboarding spike SHALL remain outside this published version contract unless the release boundary is explicitly expanded.

#### Scenario: Candidate metadata is consistent

- **WHEN** release validation examines the candidate source tree
- **THEN** every in-scope package and generated/runtime/documentation version surface equals the authoritative root release version

#### Scenario: Stale route marker is detected

- **WHEN** either the Admin or Marketplace README destination contains a cache-buster different from the authoritative version
- **THEN** release validation fails and names the stale route marker

### Requirement: Pages release verification covers both published routes

The release process SHALL require the existing test and production build checks before publishing, deployment of both Admin and Marketplace routes through the existing GitHub Pages workflow, a successful workflow run, and verification that both public routes return their intended applications. Release verification SHALL preserve the existing Admin `/admin/`, Marketplace `/marketplace/`, and root `/assets/` delivery paths and SHALL NOT require automatic Git tags or GitHub Releases.

#### Scenario: Valid release is verified

- **WHEN** tests and builds pass, the Pages workflow succeeds, and the public Admin and Marketplace routes load their intended applications with the candidate version
- **THEN** the release is considered verified

#### Scenario: One route fails verification

- **WHEN** either published route is unavailable, serves the wrong application, or exposes a version different from the candidate
- **THEN** release verification fails and the release is not reported complete
