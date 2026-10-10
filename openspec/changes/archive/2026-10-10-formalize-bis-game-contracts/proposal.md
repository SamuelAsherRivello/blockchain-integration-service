# Proposal

## Why

BIS exposes a game-neutral host interface but spreads game-to-BIS communication across a concrete facade, public internals, controller factories and subscriptions. The agreed `IBis`/`IBisGame` boundary needs a working, tested, exportable implementation before the separate game can adopt and release it.

## What Changes

- **BREAKING for game consumers:** export `IBis`; make `BisService` implement it and privately own context, wallets, LTO, UI, subscriptions and workflow controllers.
- Keep `IBisGame` as the only BIS-to-game runtime contract, retaining explicit session/continuation/reward methods and adding `onBisEvent` for safe snapshots, Account dismissal, restart and operation/effect notifications.
- Publish readonly provider-neutral DTOs with system names `IBis…`/`Bis…` and BIS-promoted game integration names `IBisGame…`/`BisGame…`. No additional shared controller interfaces or DTO classes are required.
- Cover lifecycle, Account state, capabilities, continuation, trophy collection, equipment, limited-time contracts, reset and cleanup through named `IBis` methods; expose neither wallet credentials nor mutable internal objects.
- Capture origin sessions before asynchronous reward/payment work, report financial status separately from effect receipts, and suppress stale delivery after reset/disposal without cancelling or replaying financial operations.
- Preserve existing operation economics, generic asset APIs, Admin/Marketplace behavior, recovery semantics and guest play. Other consumers may retain explicitly supported lower-level public APIs; these are not the promoted game boundary.
- Update all affected current documentation, including the BIS deep dive, project/design/package boundary documents, package READMEs, layer guidance/examples, smoke runbook and cross-repository links.
- Use the Pages-only process explicitly confirmed on 2026-10-09: each BIS update pushed to `main` deploys both Admin and Marketplace together through the existing Pages workflow, independently of game publication. Synchronize the next `0.0.N` version and both demo cache-busters, run all tests/builds/runtime checks, verify both deployed demos, then export only the built integration workspace with commit/version/hash provenance for game C088. Do not create tags, GitHub Releases, or new release workflows.

## Capabilities

### New Capabilities

- `bis-package-export`: a verified build/export tied to a successful versioned BIS Pages release and consumable without the source checkout.

### Modified Capabilities

- `bis-game-contract`: the complete two-interface game boundary, named safe DTOs, notifications, private composition ownership and session-bound workflow/effect handling.

## Impact

`BIS/packages/integration` public exports, facade, DTO projections, workflow/event adaptation and tests; consumer compatibility tests for Admin and Marketplace; affected current documentation; synchronized release manifests/lockfile/README cache-busters; the built export supplied to the game's same-named C088 change.

This is planning, not a completed implementation or acceptance claim. Release choice is confirmed; exact next versions and source commits are determined from authoritative remote state during apply. Financial changes, new networks/providers, unrelated Slidev extraction, secret handling, and live wallet spending are out of scope.
