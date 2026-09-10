## Context

See [proposal.md](proposal.md) for the motivation. BIS already has encrypted, browser-local game-wallet storage, a local game-wallet controller, and a local LTO controller. The production composition currently opts into a hosted controller whenever it receives a `serviceUrl`; that routes G2 through a BIS wallet service, which is why a static preview or consumer game can become unavailable without producing the expected local lifecycle feedback.

The runtime Account UI currently owns player-wallet create/restore and has no game-wallet setup route. The integration demo separately creates a game-wallet controller for Admin. Stealth & Steel similarly supplies a service URL rather than composing the local controller into both its BIS UI and its treasure session.

## Goals / Non-Goals

**Goals:**

- Make one local game-wallet selection a first-class BIS runtime dependency that can be used by Admin F1, Account F2, Admin F3, and G2.
- Let a standalone game use F2 to set that selection, then use direct Arkade operations for real LTO funding, claim, and refund without a BIS app server.
- Preserve separation between player and game wallets, privacy of recovery material, and interruption-free gameplay.
- Make wallet changes stable by epoching G2 presentation state and beginning the new selection only on a later run.

**Non-Goals:**

- Sharing a wallet selection across browser origins, browser profiles, devices, or separately deployed sites.
- Adding an end-user game-wallet balance, address, or boarding surface; those remain F3 Admin concerns.
- Replacing Arkade operator connectivity, simulating contract results, or providing server-independent expiry cleanup while the browser is closed.
- Preserving an alternate hosted-wallet runtime after the local-controller migration. The obsolete wallet-service package and its hosted adapters are removed as part of this change.

## Decisions

### 1. One origin-scoped controller is explicitly composed into all BIS surfaces

The host creates one `createBisGameWallet` instance without `serviceUrl`, scoped to its player-profile reader, then provides that same instance to the mounted BIS Account UI, F1/F3 Admin composition, and the LTO factory. The controller remains the sole writer to the existing encrypted game-wallet store and continues its same-origin storage subscription.

The public UI composition gains an optional game-wallet capability rather than teaching the player `BisContext` to own a second identity. This keeps player-account state and events free from game wallet identities while allowing Account UI to observe and mutate the game-wallet controller. The game-facing LTO API remains free of Arkade-specific types; its host contract stays sessions, IDs, results, and subscriptions.

Alternative considered: create a second F2-only storage record and synchronize it with Admin. Rejected because it would introduce merge/ordering ambiguity, fail the required F1/F2 shared selection, and risk stale game state.

### 2. F2 is a narrow sibling of the player onboarding flow

Add a dedicated Account subview reached from Balance immediately after `Get Recovery Phrase`. Its unselected state offers Create Game Wallet and Restore Game Wallet. It reuses private phrase validation, masked entry, recovery disclosure, and explicit Continue commitment behavior from player onboarding, but uses the game-wallet controller only. Its selected state exposes only `Log Out Game Wallet`; logout returns to the same unselected subview without remounting the app.

The F2 rendering model receives only controller state and mutation methods. It does not receive the Admin F3 actions, payment recipient, or balance/addresses, so those cannot surface accidentally through the user-facing page.

Alternative considered: reuse the existing player Account create/restore pages with a mode flag. Rejected because a mode flag would couple player lifecycle/public events to the game signer and makes it easy to expose player-specific information in F2. Shared lower-level phrase widgets and account derivation remain reusable.

### 3. Rename by responsibility, retaining F1/F2 data compatibility

The integration demo Admin labels F1 as `Game Wallet` and F3 as `Board Game Wallet`; the old Admin board story number is retired. F1 import/logout and F2 create/restore/select call the same controller. F3 reads that controller but retains Admin-only public details, funds, and boarding UI.

Existing stored wallet identities are preserved by the controller; the compatibility work changes labels and composition rather than creating or exporting a new secret format. An Admin and Runtime Preview share immediately only if they are the same browser origin, as required by browser storage.

Alternative considered: have F1 write a file or static package config for consuming games. Rejected because it cannot give a deployed browser runtime mutation access and would violate the required per-origin user-facing F2 setup model.

### 4. G2 always chooses the local LTO path

Remove `serviceUrl` and the hosted-controller branch from the F1/F3 Admin demo, Runtime Preview, and Stealth & Steel BIS integration. `createBisLto` uses the already available local contract persistence, reservation, reconciliation, and direct Arkade spend adapters. It emits its own pending/confirmed funding, claim, and refund notifications through `context.showToast`; the mounted BIS UI is the single renderer. Once all callers and tests use that path, remove the wallet-service package and service-only code.

No game-owned request, hosted event polling, or `/__bis/wallet` fallback remains in the G2 path. The host starts a normal game session first, then invokes the public local LTO request in the background. Missing player or game-wallet readiness returns unavailable/no offer and is intentionally not elevated into an interruption or separate game warning.

Alternative considered: retain the hosted controller but add an unavailable toast. Rejected because it explains the failure without satisfying the no-BIS-server requirement, and it leaves deployed games dependent on Admin/service topology.

### 5. Selection changes use a G2 epoch boundary

The game-wallet controller exposes a non-secret selection identity/version change to its consumers. The treasure session captures the selection identity/version at Start. If it changes during that run, the active run keeps its captured signer and no newly selected wallet is used mid-operation. On the next Start, the host creates a new G2 epoch: it clears prior presentation/session references and filters local contract interaction to the captured new wallet identity. This deliberately gives the user a clean start instead of exposing stale history under another wallet.

The local contract ledger remains available only for safe reconciliation of any already submitted operation. It is not used to revive old G2 controls or history after the epoch boundary. This distinction avoids claiming that changing the UI has erased an external contract while meeting the requested player-facing clean restart.

Alternative considered: migrate open G2 records to the new wallet or offer a recovery dialog. Rejected because either could submit a mismatched action, mix history across wallets, or reduce stability at the moment of a wallet change.

## Risks / Trade-offs

- [A selected game wallet cannot be shared automatically with another origin] → F2 is present in every user-facing BIS host and explicitly owns standalone-game setup; same-origin Admin/Preview sharing remains automatic.
- [Browser closure prevents timed automatic cleanup] → persist sanitized records before submission and reconcile at the next mounted context/start; never claim cleanup happened while closed.
- [A wallet change leaves a real old contract on Arkade] → retain it only for bounded reconciliation while hiding it from the replacement wallet's G2 presentation and blocking cross-wallet actions.
- [F2 reuses recovery behavior] → reuse the established private UI/storage boundaries, add tests that public context events, logs, and Admin console values contain no recovery material.
- [Removing service composition can regress current demo wiring] → cover local factory selection, no-network-service requests, toast delivery, and both preview and consumer browser flows before considering the migration complete.

## Migration Plan

1. Extend the local controller/composition API and add F2 while preserving existing encrypted game-wallet records and F1 import behavior.
2. Change integration-demo and Stealth & Steel composition to omit `serviceUrl`; wire the one local controller to F2, F1/F3, and G2.
3. Add controller, UI, LTO, and treasure-session tests, then build BIS and consume the generated package in Stealth & Steel.
4. Browser-verify Runtime Preview and Stealth & Steel with no BIS wallet service running: F2 setup/logout, normal play without a game wallet, and a funded local G2 flow with pending/confirmed toasts.
5. Remove the wallet-service package, hosted adapters, root service script, service-only tests, and obsolete documentation/configuration after the local route has been verified.
6. Roll back by restoring the previous package version/configuration only if the local direct path proves unsupported. Do not silently fall back to a hosted endpoint at runtime; report direct Arkade readiness accurately.
