# Design

## Context

The repository already uses npm workspaces, ESM, Vite, React, TypeScript 7, and a strict root typecheck for the principal integration, Admin, and Marketplace source trees. The remaining JavaScript is distributed across seven workspace packages and `BIS/scripts`: browser source and fixtures, Node-only servers and CLI helpers, Vite configuration, and a large `.mjs` test suite. The package boundaries and runtime responsibilities described in the proposal must remain unchanged.

## Goals / Non-Goals

**Goals:**

- Establish `.ts`/`.tsx` as the only authored executable source extension in every BIS workspace and repository script area.
- Typecheck converted browser, Node, configuration, fixture, test, and CLI code with strict settings appropriate to each runtime.
- Preserve ESM resolution, Vite routes, npm workspace commands, test isolation, public exports, storage formats, and wallet/Arkade behavior.
- Make the conversion staged and independently verifiable so failures can be isolated by package and runtime.

**Non-Goals:**

- Changing runtime behavior, public API semantics, Arkade workflows, wallet persistence, network support, or deployment routes.
- Converting the separate Stealth & Steel game repository, vendored dependencies, generated output, Markdown-only examples, or historical OpenSpec artifacts.
- Introducing a new application server, shared runtime abstraction, or cross-package architectural refactor.

## Decisions

### 1. Convert by runtime boundary, then by package

Use four migration lanes: Vite/browser code (`.js`/`.jsx` → `.ts`/`.tsx`), Node package code (`.mjs` → `.ts`), tests/fixtures (`.mjs`/`.jsx` → `.ts`/`.tsx`), and repository tooling (`BIS/scripts/*.mjs` → `.ts`). Complete and verify `integration`, `integration-admin`, and `marketplace` first, then the prototype packages and `shared`, then root tooling. This keeps the public integration boundary stable while exposing type gaps in the smaller experimental packages.

Alternative considered: rename every file in one mechanical pass. Rejected because it would combine browser, Node, Vite, test-runner, and CLI failures and make it difficult to distinguish import-path errors from type-modeling errors.

### 2. Use one shared strict baseline with explicit runtime overlays

Retain the root strict compiler options for production integration code and add shared base/solution configuration that includes all authored TypeScript. Add narrow overlays for browser/Vite, Node, and test code to supply the correct globals and module behavior. Use `allowJs: false` in the final checked source set and a repository audit that fails if authored `.js`, `.jsx`, `.mjs`, or `.cjs` remains in the migration scope.

Alternative considered: a single permissive `checkJs` migration. Rejected because it would preserve JavaScript semantics and leave the highest-risk scripts and tests weakly typed. Temporary per-lane exclusions may be used during implementation, but the final configuration must not rely on them.

### 3. Preserve direct Node execution with the repository's supported runtime

First verify the supported Node version and its TypeScript execution behavior. Prefer Node's existing strip-types execution path for erasable TypeScript in direct server, test, and CLI commands, using explicit `--experimental-strip-types` where required by the supported version. If a file needs enums, namespaces, or other non-erasable syntax, either rewrite it to erasable TypeScript or route that narrow entrypoint through a checked build step; do not add a runtime dependency merely to execute ordinary TypeScript.

Alternative considered: add `tsx` or compile every script to a generated directory. Rejected as the default because it adds dependency/runtime drift or changes the current direct-command workflow. A focused exception remains available if the supported Node matrix cannot execute a required construct.

### 4. Model boundaries instead of using blanket `any`

During conversion, type external and unstable boundaries explicitly: `process.env`, CLI argument vectors, JSON/config payloads, browser `postMessage` and storage values, HTTP request/response bodies, Arkade SDK results, React props, and test doubles. Keep Arkade-specific types behind the existing adapter boundary and keep the game-facing/public integration API free of Arkade-specific types. Use `unknown`, discriminated unions, narrow adapters, and test-only fakes where data is not trusted; record any unavoidable SDK typing gap locally rather than weakening the global compiler.

### 5. Treat renames as a dependency-graph migration

After each lane, update imports, package exports, npm scripts, Vite config references, test globs, root launchers, documentation commands, and workflow checks together. Search both tracked filenames and string references before deleting the old extension. Do not leave duplicate JavaScript compatibility files, because the desired end state is one authoritative TypeScript source per module.

## Risks / Trade-offs

- [Node cannot execute a converted file or its TypeScript syntax directly] → Verify the supported Node version first, restrict source to erasable syntax, and use a narrowly scoped build/runtime exception only where proven necessary.
- [Filename changes break hidden script, test, or documentation references] → Run tracked-reference searches and the full route/test/build matrix after each lane; add an extension-audit check to prevent stale references.
- [JavaScript behavior changes during type annotation] → Convert in small units, preserve control flow and serialization exactly, and compare focused tests before and after each package.
- [Type modeling exposes inaccurate existing assumptions] → Fix the local boundary or fixture contract, never silence the issue with repository-wide `any`, `skipLibCheck` expansion, or disabled strictness.
- [Prototype packages have intentionally independent runtime behavior] → Keep their package-local configs and routes intact; share only compiler conventions and verification helpers.
- [Current working-tree edits overlap migration targets] → Before implementation, snapshot the baseline and migrate only files selected after reconciling the user's in-progress changes; preserve unrelated changes and do not include them in a commit.

## Migration Plan

### Milestone 1 — Code conversion and handoff

1. Capture the tracked JavaScript inventory and establish the supported Node/TypeScript/Vite command matrix without changing runtime code.
2. Add shared compiler/runtime configuration and an extension/reference audit in a way that initially reports, rather than hides, remaining JavaScript.
3. Convert `integration`, `integration-admin`, and `marketplace` source, fixtures, tests, and config references. Use focused checks during conversion as needed, but reserve final verification for Milestone 2.
4. Convert `prototype-onboarding`, `prototype-faucet`, `prototype-sandbox`, and `shared`, including Node server/CLI entrypoints and package command references.
5. Convert `BIS/scripts` and root command references.
6. Confirm the authored-code conversion is complete, all package exports and command references point to the new TypeScript files, and the first-milestone diff is reviewable. Pause for user verification, then commit Milestone 1 before proceeding.

### Milestone 2 — Verification and hardening

7. After the user-approved Milestone 1 commit, confirm no in-scope JavaScript remains and no stale extension references remain.
8. Run strict typechecking, every package build, the complete unit/API/browser matrix, route verification, and relevant Playwright/smoke checks.
9. Review generated files, dependency changes, secrets, unrelated edits, public type boundaries, and documentation; fix verified defects and rerun affected checks.

Rollback is a source-control revert of the migration commits, performed lane by lane if necessary. The Milestone 1 handoff provides a stable review/commit point before Milestone 2 changes. No persisted-data, wallet, network, or deployment migration is required.

## Open Questions

- The exact minimum Node version and whether all CI/preview hosts support native TypeScript stripping must be confirmed at implementation start; this may select the narrow runtime exception described above but does not change the migration scope.
