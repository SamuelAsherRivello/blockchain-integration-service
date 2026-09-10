# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers and portfolio reviewers use the demo to operate a split admin workspace and inspect the same production integration UI a game host renders.

## Product Purpose

Make the reusable integration independently demonstrable and testable without running the Babylon game, while retaining real Signet workflows wherever the integration touches Arkade.

## Positioning

The demo pairs game-event/admin controls with a portrait runtime preview that mounts the production integration rather than a duplicated mock UI.

## Operating Context

The local Vite app provides development and review flows for account, payment, asset, activity, game-wallet, marketplace-catalog, and preview behavior. It publishes the verified marketplace catalog for the sibling marketplace package during local development.

## Capabilities and Constraints

- React and TypeScript Vite application.
- Split workspace: admin/development controls beside a 9:16-style runtime preview.
- Game events may be simulated in the harness; wallet operations are real Signet behavior.
- Signet only, Arkade SDK only, and no custom application server.
- The demo must use the integration package's public API and production React components.
- Recovery phrases are sensitive and must never be entered in chat, source control, or configuration.

## Evidence on Hand

- [Package README](README.md) documents the demo role and local development flow.
- `src/SplitWorkspace.tsx` implements the adjustable admin/runtime composition.
- The test suite contains focused browser-host and integration behavior fixtures.

## Product Principles

- Demonstrate production behavior, not a lookalike mock.
- Keep real wallet boundaries explicit and safe for testers.
- Make game-facing events and resulting UI state inspectable.
- Keep the integration understandable to developers and credible to portfolio reviewers.

## Accessibility & Inclusion

Admin and preview controls expose labeled, keyboard-operable interactions and preserve clear status/error feedback for asynchronous workflows.
