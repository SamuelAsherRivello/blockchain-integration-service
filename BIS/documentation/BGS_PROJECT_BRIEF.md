# Blockchain Integration Service project brief

## Purpose

Blockchain Integration Service (BIS) is a proof-of-concept TypeScript and React integration layer for browser games. It gives a game a small, game-neutral surface for account, wallet, asset, payment, and contract-related workflows while keeping gameplay, scenes, and gameplay consequences in the consuming game.

The project is intended for development and portfolio exploration, not production custody or financial-service claims. It has no custom application server. Network-dependent outcomes must remain truthful: an unavailable, pending, or failed provider result is never presented as success.

## Product boundaries

- `@bis/integration` owns the public library, production account UI, core state, browser persistence, and Arkade adapters.
- Game hosts own mounting, gameplay pause/effects, host-specific restart behavior, and their own presentation outside the BIS UI.
- `@bis/integration-admin` is a development harness and portrait preview that consumes only the integration package’s public API.
- Marketplace and onboarding packages are separate consumers or experiments; they do not define the reusable library contract.
- Recovery phrases, signing material, and provider-specific implementation types stay inside the private wallet boundary. Public state, events, diagnostics, and reports must not expose them.

## Current technical direction

The repository uses React, TypeScript, Vite, npm workspaces, and the Arkade SDK. BIS supports the project’s configured Signet and Mutinynet workflows. Browser-local persistence is origin-scoped; it is not a substitute for production-grade custody controls. Games must remain usable without an account when their own design permits it.

Public consumers use documented exports such as context/UI creation and the game-services facade instead of private source imports. The host-facing contract is deliberately protocol-neutral. Arkade details remain behind adapters so that a game is not required to model wallet internals or financial state.

## Verification and change control

Use the root README for current setup and verification commands. Automated tests and type checks provide evidence within their stated scope; live wallet or network acceptance requires separate, privacy-safe evidence. The [user-story diagrams](User%20Story%20Diagrams.md), package READMEs, and OpenSpec records identify detailed feature scope and verification limits.

This brief records durable product boundaries. Dated implementation decisions, acceptance evidence, and proposed work belong in [OpenSpec](../../openspec/) rather than being copied here.

## Non-goals

- A BIS-operated backend or custody service.
- Claims of production payment, security, or cheat-resistant gameplay guarantees.
- Exposing wallet secrets or Arkade implementation details through the public game contract.
- Making blockchain connectivity mandatory for ordinary game play.
