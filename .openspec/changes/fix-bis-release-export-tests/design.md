# Design

## Context

See `proposal.md` for the failure list. The export workflow requires the full BIS test suite to pass before packing `@bis/integration`, and the current tree has one pre-existing dirty marketplace CSS file. The first sandboxed run failed with Windows `spawn EPERM`, but the elevated retry reached real test failures and assertion drift.

## Goals / Non-Goals

**Goals:**

- Make `npm.cmd test` pass without weakening the BIS export contract.
- Separate production regressions from stale implementation-detail assertions.
- Keep fixes scoped to the failing tests and the code they directly exercise.
- Preserve current user-facing specs unless a failing test exposes a concrete mismatch with those specs.

**Non-Goals:**

- Do not create a package export, import into Stealth & Steel, publish Pages, tag, commit, or push as part of this change.
- Do not rewrite marketplace design beyond what is needed to satisfy existing marketplace behavior.
- Do not add wallet operations, secrets, or network-dependent acceptance.

## Decisions

- Treat release version `0.0.7` as the candidate version when repairing `release-version.test.mjs`.
  - Rationale: root package metadata and `check:release` already report `0.0.7`; the failing assertion expecting `0.0.2` is stale against the active release metadata.
  - Alternative considered: downgrade metadata to `0.0.2`; rejected because it would violate the current release sequence and package state.

- Re-run focused failing tests before editing broad surfaces.
  - Rationale: several failures were timeout-shaped and may be sensitive to Vite SSR runner state; a focused rerun can identify deterministic failures before changing production code.
  - Alternative considered: edit all named modules immediately; rejected because timeout failures may be symptoms of one import/runtime issue.

- For marketplace and pending-dialog failures, decide from specs whether production or test text is stale.
  - Rationale: `pending-operation-dialog` now permits safe contextual error text and OK; the current UI adds copy affordances around that text. `marketplace-catalog` describes responsive catalog behavior rather than the exact regex used by a static CSS assertion.
  - Alternative considered: revert UI/CSS to satisfy old regexes; rejected unless the current UI violates the existing specs.

- Keep timeout fixes local to the import/test boundary.
  - Rationale: long Vite SSR imports can be caused by test helper lifecycle, module-runner contention, or accidental import cycles. Fix the helper or module boundary that causes the hang, not unrelated account logic.
  - Alternative considered: raising timeouts; rejected unless the implementation is correct and the test needs a narrowly justified budget.

## Risks / Trade-offs

- Stale regex tests may be updated too broadly -> Mitigation: update only assertions that conflict with current specs and add coverage for the user-visible behavior they were meant to protect.
- Timeout failures may not reproduce every run -> Mitigation: run the focused tests and the full suite after changes, and note any environment-only limits separately.
- Dirty marketplace CSS may be user work -> Mitigation: inspect before editing and preserve unrelated style changes unless they directly cause the failing marketplace test.
- Export pressure may tempt skipping validation -> Mitigation: keep the export blocked until `check:release`, tests, and build pass.
