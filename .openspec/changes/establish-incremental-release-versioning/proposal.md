## Why

The repository has no single enforced release-version process: the root and published BIS workspaces currently declare `1.0.0`, README cache-busters repeat that value, and the Pages workflow deploys on every `main` push without creating a versioned release record. Establishing `0.0.1` as the baseline now will make the published Admin and Marketplace artifacts identifiable and make each later published update advance predictably by one patch digit.

## What Changes

- Define `0.0.1` as the initial published BIS version for the root project and the published Admin, integration, and Marketplace package metadata.
- Define the release increment rule as `0.0.N` to `0.0.(N+1)` for every subsequent published update; major and minor components remain `0.0` unless a separately approved versioning change supersedes this rule.
- Establish one authoritative release-version value and require dependent package metadata, lockfile metadata, runtime `BIS: v<version>` displays, README Pages cache-busters, and release documentation to stay synchronized.
- Document the current release flow accurately: test and build, update the version and release markers, commit and push to `main`, allow the Pages workflow to publish both routes, then verify the workflow and both public routes.
- Add validation that rejects inconsistent release versions, stale route cache-busters, accidental version jumps, and published output that does not expose the intended version.
- Preserve the existing Admin `/admin/` and Marketplace `/marketplace/` routes, immutable root `/assets/` URLs, and the workflow's current behavior of deploying Pages without automatically creating tags or GitHub Releases.

## Capabilities

### New Capabilities

- `release-versioning`: Defines the authoritative BIS release version, patch-only increment policy, synchronized version surfaces, and release verification contract.

### Modified Capabilities

- None.

## Impact

- Root and published workspace `package.json` files, the npm lockfile, runtime version display, README release instructions and Pages links, release/version documentation, and release-validation scripts/tests.
- GitHub Pages deployment remains the delivery mechanism; no new runtime API, wallet behavior, dependency, server, tag, or GitHub Release is required.
- Assumption for this proposal: the standalone `@spike/balance-onboard` package remains an independently versioned internal spike (`0.0.0`) because it is not part of the two-route published Pages artifact. It will be included only if a later decision expands the release boundary.
