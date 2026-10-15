# Design

## Context

See `proposal.md` for motivation. The current package set lives under `BIS/packages/` and is entirely browser/client-oriented: the integration library, Admin/demo app, Marketplace app, and standalone onboarding spike all run without a custom application server. The existing source layout already has ownership hints (`integration/src/core`, `integration/src/arkade`, `integration/src/ui`, `integration-demo/src/admin`, `integration-demo/src/preview`), but those hints are inconsistent across packages and are not mirrored by tests.

The target convention uses `client/` to mean not-server browser code. This keeps the name accurate for BIS, where “runtime” could imply a game loop or engine runtime, and where future `server/`, `worker/`, or tooling folders should remain possible without ambiguity.

## Goals / Non-Goals

**Goals:**

- Move each package toward `src/client/` as the home for browser-side implementation.
- Mirror client ownership in `tests/client/` so test locations explain the layer under test.
- Preserve public package exports, especially `@bis/integration` and `@bis/integration/style.css`.
- Keep the existing package set and package names unchanged.
- Document layer ownership with short `README.md` files where a boundary is easy to violate.
- Keep the change mechanical enough to review and verify package-by-package.

**Non-Goals:**

- No new product behavior, wallet behavior, network behavior, or Marketplace behavior.
- No dependency additions.
- No migration of generated folders such as `dist/`, `node_modules/`, `.vite*`, `.playwright-cli`, or ignored `output/`.
- No reorganization of OpenSpec specs or story taxonomy as part of this change.
- No public API renaming for consuming games or demos.

## Decisions

### Use `client/` as the top-level source/test convention

Move browser-side package implementation under `src/client/` and mirror tests under `tests/client/`.

Alternative considered: `runtime/`, matching the ASCII RPG pattern. Rejected because BIS is not a game runtime and the user clarified that the intended meaning is client-side, not server-side.

### Keep package identities stable

Do not rename `@bis/integration`, `@bis/integration-demo`, `@bis/marketplace`, or `@spike/balance-onboard`. The change is inside each package, not a workspace/package rename.

Alternative considered: broader package-level renaming. Rejected because the requested convention concerns folder organization and because changing package names would create unnecessary downstream churn.

### Map existing ownership into layer folders

Use layer names that preserve current responsibility boundaries while making them more consistent:

- `integration/src/client/bridge-layer/`: public host-facing coordination and adapters that connect consumers to internal state/UI.
- `integration/src/client/wallet-layer-arkade/`: Arkade SDK identity, address, balance, transaction, asset, send, transfer, and network-facing implementation details.
- `integration/src/client/wallet-layer-game/`: local game wallet selection, restoration, payments, and game-wallet-specific coordination.
- `integration/src/client/operation-layer/`: durable operation journals, pending/recovery flows, quote/fingerprint handling, and submission/reconciliation orchestration shared across wallet flows.
- `integration/src/client/state-layer-core/`: core context lifecycle, immutable public state snapshots, subscriptions, events, and cross-layer state reduction.
- `integration/src/client/ui-layer-react/`: private React components, CSS, assets, and UI-only helpers.
- `integration-demo/src/client/admin-layer/`: Admin story catalog, controls, console, and development utilities.
- `integration-demo/src/client/preview-layer/`: 9:16 preview host, scaling, and production UI mounting.
- `integration-demo/src/client/bridge-layer/`: glue between Admin selections, preview mounting, and integration public APIs.
- `marketplace/src/client/marketplace-layer/`: Marketplace list/detail/checkout orchestration.
- `marketplace/src/client/inventory-layer/`: inventory, ownership, equipment/loadout, and catalog state shaping.
- `marketplace/src/client/account-layer/`: BIS account/wallet integration points used by Marketplace.
- `*/src/client/ui-layer-react/`: package-local React UI and CSS.

Alternative considered: feature folders such as `account/`, `assets/`, `marketplace/`, and `payments/`. Rejected as the main convention because existing BIS features often cross wallet, operation, state, and UI boundaries; layer folders make ownership and test mirrors clearer.

### Keep assets stable unless references are updated together

Public assets under `public/` remain in place by default. Package-private UI assets may move under their owning `ui-layer-react/assets/` folder only when imports and build references are updated in the same implementation step.

Alternative considered: move every asset into `src/client`. Rejected because public URL contracts and GitHub Pages asset paths are sensitive.

### Add ownership READMEs at boundary-heavy layers

Add short layer README files, especially in `integration`, following the ASCII RPG habit of documenting what belongs and what must stay out. These READMEs should be operational guardrails, not long architecture essays.

Alternative considered: one package-level README update only. Rejected because folder-local guardrails are more likely to be seen during future edits.

## Risks / Trade-offs

- Import churn breaks builds or tests -> Move one package/layer at a time, run focused searches for old paths, and verify builds/tests after path rewrites.
- Public exports accidentally change -> Keep `src/index.ts` or equivalent package entrypoints stable, and verify consuming packages still import through package public APIs.
- Test fixtures or browser hosts break due to moved relative paths -> Mirror tests under `tests/client/` and update Vite/test HTML references in the same step as each move.
- Asset URL regressions affect Pages/demo output -> Keep `public/` assets fixed unless the implementation updates every reference and verifies the built output.
- Layer names become too granular -> Start with the proposed layers, but avoid creating empty folders unless they clarify an imminent move or need a README boundary.

## Migration Plan

1. Inventory current files and imports under each `BIS/packages/*` package, excluding generated folders.
2. Create the target `src/client/` and `tests/client/` folders package-by-package.
3. Move `@bis/integration` internals first while preserving its public entrypoints and style export.
4. Move `@bis/integration-demo` after integration exports are stable, updating Admin/preview imports and test hosts.
5. Move `@bis/marketplace` after shared integration imports are verified.
6. Move `@spike/balance-onboard` last because it is intentionally experimental and isolated from production integration.
7. Add/update layer README files while moving code, keeping them short and enforceable.
8. Run package builds/tests and repository-wide searches for obsolete folder references.

Rollback is ordinary Git reversal before commit. After commit, rollback should be a normal forward commit restoring the previous paths or correcting missed references; do not rewrite history.
