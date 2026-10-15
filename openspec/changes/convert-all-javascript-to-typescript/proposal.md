# Proposal

## Why

BIS is predominantly TypeScript, but its repository still contains JavaScript and JavaScript-module source across the integration packages, prototype packages, shared package, tests, and repository tooling. Converting those files to TypeScript will establish one checked language baseline, make refactors safer through consistent type checking, and reduce the current split between TypeScript production code and untyped JavaScript support code.

This is a repository-wide maintainability refactor. It must preserve current runtime behavior, public package boundaries, browser/server separation, and all existing wallet, Arkade, test, and development workflows.

Implementation is intentionally divided into two milestones. Milestone 1 converts the authored code and updates its wiring so it can be reviewed and committed independently. Milestone 2 performs repository-wide verification and hardening after the user verifies the Milestone 1 working copy.

## What Changes

- Convert tracked `.js`, `.jsx`, and `.mjs` implementation, test, fixture, helper, and package-script files within every `BIS/packages/*` workspace and `BIS/scripts/` to `.ts` or `.tsx` as appropriate.
- Preserve each file's current runtime classification: browser modules remain browser-compatible, Node-only utilities remain Node-compatible, Vite configuration remains loadable by Vite, and executable scripts retain their command-line entry behavior.
- Add or extend package and repository TypeScript configuration so all converted packages and scripts are type-checked with appropriate DOM, Node, React, and test types without weakening the existing strict integration typecheck.
- Update package exports, npm scripts, Vite configuration references, imports, test discovery globs, documentation examples, and generated/release helpers to point to the renamed TypeScript files.
- Add explicit types for previously implicit JavaScript boundaries, including environment/configuration input, Arkade adapter results, browser message/storage values, server request/response data, test fixtures, and CLI arguments.
- Keep generated artifacts, dependency code, and the separate Stealth & Steel game repository out of scope.
- **BREAKING**: Remove JavaScript source entrypoints only after all in-repository consumers and package metadata resolve to their TypeScript replacements; do not preserve duplicate JavaScript compatibility copies.
- Milestone 1 ends when all in-scope authored source, tests, scripts, configuration, imports, exports, and command references have been converted or updated; implementation pauses for user review before the verification milestone begins.
- Milestone 2 contains final audit, full build/test/browser verification, cleanup review, and documentation reconciliation. It starts only after the user confirms the Milestone 1 working copy and the converted code has been committed.

## Capabilities

### New Capabilities

None. This change introduces no new runtime capability.

### Modified Capabilities

None. Existing runtime requirements and public behavior remain unchanged; this is a pure source-language and verification-tooling refactor.

## Impact

The affected areas are `BIS/packages/integration`, `integration-admin`, `marketplace`, `prototype-faucet`, `prototype-onboarding`, `prototype-sandbox`, and `shared`, plus `BIS/scripts` and relevant root configuration. The current baseline includes 22 `.js`, 3 `.jsx`, and 217 `.mjs` tracked files, alongside 120 `.ts` and 88 `.tsx` files. The largest conversion effort is in the integration and prototype test suites and in the Node-based scripts.

The migration changes source filenames and build/test invocation paths but should not change exported APIs, persisted data formats, wallet behavior, network behavior, deployment routes, or package responsibilities. Verification must include strict typechecking, all affected package builds, the complete test suite, route smoke checks, and focused browser/runtime checks for both browser and Node entrypoints.
