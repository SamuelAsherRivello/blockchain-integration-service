## Context

The repository already has a root npm workspace, three published BIS packages, runtime version labels derived from package metadata, README route cache-busters, and a GitHub Pages workflow that builds and stages two routes. See `proposal.md` and `specs/release-versioning/spec.md` for the motivation and observable contract. The standalone onboarding spike is a separate package and is not copied into the Pages artifact.

## Goals / Non-Goals

**Goals:**

- Make the root package version the single source of truth for the published BIS version.
- Synchronize package, lockfile, runtime, README, and release-check inputs from that source.
- Make the first published version `0.0.1` and validate exact patch-only progression.
- Add a repeatable local/CI check that catches drift before Pages deployment.
- Keep the existing two-route Pages topology and immutable asset paths unchanged.

**Non-Goals:**

- Creating npm publications, GitHub Releases, Git tags, or a new release server.
- Versioning the standalone onboarding spike as part of the published BIS release.
- Changing wallet behavior, public package APIs, asset metadata URLs, or application routing.

## Decisions

1. **Use the root `package.json` as the authority.** It already anchors the workspace and lockfile. Published workspace manifests and their internal dependency ranges will be synchronized to it, while validation treats mismatches as errors. A separate version file was rejected because it would add another source of truth without improving the existing npm workflow.

2. **Keep version synchronization explicit and reviewable.** Add a repository script/check that reads the authoritative version, validates the in-scope manifests and lockfile, checks the runtime-facing version source, and checks both README cache-busters. A release task updates all required text/metadata together; it does not silently mutate files during CI.

3. **Validate transitions against the last published baseline.** The check will accept the initial `0.0.1` baseline and thereafter require exactly one patch increment from the recorded prior release marker. It will reject semver-shape violations and accidental jumps rather than auto-correcting them.

4. **Extend existing Pages verification instead of replacing deployment.** The current build, staging, workflow, and route verification remain the delivery path. Version checks run before deployment, and the existing route verifier is extended or paired with a version-aware check so both routes and immutable assets remain covered.

5. **Keep release identity separate from catalog schema versions.** Values such as Marketplace catalog `version: 2` are data/schema versions, not BIS release versions, and must not be rewritten by this change.

## Risks / Trade-offs

- [Existing local or archived references use older BIS versions] → Limit synchronization to the active published surfaces and explicitly exclude historical OpenSpec evidence and the standalone spike; do not rewrite historical records.
- [A package is added to the published Pages build later] → Require the release validation's in-scope package list to be updated in the same reviewed change.
- [A release is pushed without updating the version] → Make the pre-release check fail when the candidate version is unchanged from the prior published marker; retain manual workflow dispatch only for intentional redeployment of the same artifact.
- [External consumers depend on `1.0.0` package metadata] → This repository's packages are private and the change does not publish to npm; record the `0.0.1` transition in release documentation and validate the packed/public package outputs.
