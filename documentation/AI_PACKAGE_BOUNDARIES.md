# AI Guide: Integration vs Integration Demo

Status: draft for user validation. This guide restates the established package split and proposes a practical placement checklist; it does not authorize new features or settle open API/lifecycle decisions.

Sources: [original project brief](BGS_PROJECT_BRIEF.md), [confirmed design decisions](design-discussion.md), and the package READMEs. Use [User Story Diagrams](User%20Story%20Diagrams.md) for intended journeys, not as proof of implemented behavior. Later confirmed decisions take precedence over this draft.

## The rule to remember

**`integration` is the reusable product. `integration-demo` is a host used to demonstrate and exercise that product.**

If the real game needs the integration behavior, it must not have to copy code from the demo to obtain it. Conversely, development controls and preview framing must not ship as part of the integration's runtime UI.

```text
Real game (separate repository)       integration-demo
Gameplay + thin integration hooks    Admin controls + preview host
                |                         |
                +------------+------------+
                             |
                             v
                integration public exports
                             |
                +------------+------------+
                |            |            |
                UI          Core        Arkade
                React       Workflows   SDK adapter
                overlays    state/events Signet operations
```

The diagram shows ownership, not permission for UI or hosts to bypass Core and call the SDK directly.

## Where code belongs

| Location | Owns | Must not own |
| --- | --- | --- |
| `packages/integration/src/ui` | Production React overlays, account/payment/achievement screens, loaders, user-facing errors, component styling and UI interaction state | Demo admin controls, preview framing, Babylon gameplay, direct SDK orchestration |
| `packages/integration/src/core` | Public behavior/contracts, workflow orchestration, account/operation state, availability, Signet-only policy, events and callbacks | Demo scenario state, level rules, checkpoint selection, DOM layout, vendor-specific UI assumptions |
| `packages/integration/src/arkade` | Arkade SDK adapter, wallet creation/restoration, connectivity, payments, assets, SDK-specific network operations and result translation | Game rules, React screens, admin controls, fabricated transaction results |
| `packages/integration/src/index.ts` | Deliberate public exports for consumers | Accidental exposure of every internal component, SDK object, or private wallet material |
| `packages/integration-demo/src/admin` | Development controls, simulated game-event inputs, checkpoint/price inputs, timestamped public event output | Wallet creation, payment logic, claim logic, direct SDK calls, overrides that manufacture successful wallet operations |
| `packages/integration-demo/src/preview` | Demo host container, 9:16 viewport, game placeholder, mounting the production integration UI | Copies of account/payment/achievement screens, a second integration state machine |
| `packages/integration-demo/src/App.tsx` and demo styles | App header, split-screen composition, demo layout, admin/preview styling | Production overlay styling or reusable wallet behavior hidden inside the demo |
| Separate game repository | Gameplay, levels, death/win detection, checkpoint context, prices chosen by the game, applying confirmed integration events to gameplay | Arkade SDK details or duplicated integration workflows |

Package-local build configuration stays with the package it builds. Cross-package architecture documentation belongs in `documentation/`, not inside runtime code. Do not edit generated `dist/` files as source.

## Feature placement examples

| Feature/change | Put in `integration` | Put in `integration-demo` |
| --- | --- | --- |
| Account | Production chooser, create/restore UI, recovery warning, profile workflow, SDK wallet adapter | Admin entry point that opens the same account experience; preview mounts it |
| Balance | Wallet query adapter, balance state, loading/unavailable handling, production display | Optional read-only display through an approved public surface; no separate wallet query |
| Pay-to-play / paid continuation | Price/checkpoint confirmation overlay, payment workflow, pending/failure handling, confirmed success event | Simulate death, supply sample checkpoint and price, display returned events |
| Achievements | Claim/list UI, workflow and asset adapter, completion event | Simulate level completion or another achievement opportunity and invoke the public API |
| Activity | Player-facing Activity screen and supported integration activity state; `No-chain`, `on-chain`, `off-Chain` classifications where known | Developer event log showing public payloads and timestamps; this is not the player's Activity screen |
| Developer diagnostics | Separate read-only public diagnostics API exposing deliberately selected non-secret integration state | Admin diagnostics display consuming that API; no private imports or direct SDK inspection |
| Error handling | Reusable operation errors, recovery state and user-facing feedback | Display errors returned by the package; trigger legitimate scenarios without faking SDK outcomes |
| Layout | Styling and behavior of the production overlay inside its host | Portrait frame, split-screen sizing, headings, surrounding demo chrome |

The Account entry point may be placed by the host once that contract is agreed. Its production account experience remains in `integration`; a developer button that opens it belongs in demo `admin`.

## Dependency and state rules

1. The demo consumes `@bis/integration` and its public stylesheet export. Do not deep-import `integration/src/ui`, `core`, or `arkade` to bypass the public boundary.
2. `integration` must not import `integration-demo`, its state, or game-specific code. It must function without the demo being present.
3. Keep Arkade-specific calls and types behind the adapter. The game-facing contract uses neutral inputs/results, not SDK wallet objects or protocol-specific types.
4. Keep reusable account/payment/claim state in `integration`. The demo owns scenario inputs, preview controls, and its display of emitted events; those are not an alternative source of wallet truth.
5. Use the same production components and workflows in the demo and the real game. Do not add a `demoMode` that changes payment success, wallet behavior, or asset ownership.
6. The running harness may simulate a death, level completion, or checkpoint. Once a runtime operation reaches Arkade, it uses real Signet behavior. No simulated transaction outcomes in the running demo. Automated tests may use isolated SDK fakes as defined below.
7. Never put recovery phrases, private keys, credentials, or wallet secrets in public events, demo logs, screenshots, examples, or committed files. Debug visibility does not justify exposing private material.

## Confirmed boundary: developer diagnostics

The user approved a separate read-only public diagnostics API owned by `integration`. The demo may use it to inspect non-secret state beyond what the real game needs, without enlarging the normal game-facing API.

- Integration Core owns the diagnostic contract and selects safe state to expose; SDK-specific collection stays behind the Arkade adapter. The demo owns only its diagnostic presentation.
- Diagnostics must not expose secrets, mutable internal references, SDK wallet objects, or commands that alter wallet/workflow state. The demo still cannot import private integration modules.
- Exact exported names, module path, fields, and subscription lifecycle remain to be designed. This approves the ownership boundary, not implementation or a new package.

## Confirmed boundary: test-only SDK fakes

The user approved fake SDK responses in automated tests to exercise failures and edge cases. This does not introduce a fake blockchain mode into the running demo or production integration.

- Keep fakes and fixtures in test code, outside runtime exports and application bundles. Integration behavior tests belong with `integration`; demo tests verify host composition and use of public contracts.
- Tests may supply controlled success, failure, pending, and malformed responses at the SDK/adapter boundary. Runtime code must not import test fakes or offer a demo switch that substitutes them for real Signet operations.
- Passing a fake-backed test proves the tested handling logic, not SDK compatibility or real transaction success. Verify real Signet behavior separately before claiming a wallet workflow works end to end.

## AI checklist before changing a feature

1. Identify the requested user story and approved scope. A future flow in a diagram is not authorization to implement it.
2. Name the owner of each part: gameplay/host, integration UI, integration Core, integration Arkade, demo admin, or demo preview.
3. Check the existing public API. If the host needs a new capability, propose or implement an approved public contract rather than reaching into internals.
   Route developer-only state inspection through the separate read-only diagnostics API, not the normal game-facing API or private imports.
4. Keep integration behavior and its verification with the integration package; keep demo composition checks with the demo. Cross-package checks should exercise the consumer boundary. Exact test layout can evolve with the feature.
   Keep SDK fakes isolated to automated tests and distinguish fake-backed results from real Signet verification.
5. Verify that the demo exercises the real production surface and that the integration does not depend on demo code or styles.
6. Report which package changed and why. Link changed documents using clickable paths. Flag unresolved ownership rather than silently inventing a contract.

## Current implementation vs future scope

Observed in this checkout when this guide was drafted:

- `integration/src/index.ts` exports `GameOverlay`. That production component owns Account and the "Feature coming soon" dialog.
- `integration-demo/src/preview/GamePreview.tsx` imports `GameOverlay` and `@bis/integration/style.css`, then supplies the portrait host frame. `App.tsx` composes admin and preview.
- Core and Arkade directories are placeholders. The SDK dependency is installed; wallet and transaction workflows are not implemented. Do not refer to the brief's proposed methods/events as existing exports.

Open decisions to preserve:

- The full mounting, focus, resize, pause, and disposal contract between the real game and integration. Current demo composition is an example, not a settled universal lifecycle API.
- Future logout, run eligibility, payment operation identifiers, and broader public event contracts. A2 now implements account hydration/persistence and safe accountConnected events.
- Payment recipients/funding, achievement issuance/identity, and verified Arkade Signet capabilities. Folder placement does not prove these flows are feasible.

## Validation target

The key boundary to approve is: **all reusable player-facing integration UI and wallet workflows live in `integration`; the demo supplies inputs, hosts that UI, and observes public outputs. Gameplay stays in the game.**

After approval, a short reference from the repository's `AGENTS.md` can make this guide discoverable for future AI feature work. No such instruction-file change is included in this draft.

## Feedback and artifact updates

This document is the working artifact for the boundary review. The user has requested that confirmed review feedback be incorporated into it, not left only in the interview transcript.

- Update the affected ownership rules, examples, and checklist together when the user settles a boundary decision. Preserve the distinction between existing decisions, new confirmed conclusions, and proposals.
- Show a concise summary of each revision and always provide a clickable link to this document for validation. Do not treat a document update as authorization to implement features or edit other instruction files.
- Keep unchosen recommendations unresolved. The separate read-only diagnostics API and isolated test-only SDK fakes are confirmed above; other open decisions are not implicitly approved.

## Implemented public surfaces and style boundary

Use `createBisContext()`, `createBisAdminContext(context)`, and `createBisUi(context)` from the public package. The UI mounts into a positioned host container; Runtime Preview UI never uses admin-only controls. Admin subscribes to production context first; admin reset is a narrow fallback, not arbitrary state access. Demo reconstructs handles and clears its selected story after reset.

Production light styling and centering live in `integration/src/ui/overlay.css`; dark page, story navigation, and viewport framing live in `integration-demo/src/style.css`. The demo must not override production styles. Hosts own container placement; BIS does not emulate the game's settings menu.

The admin catalog contains implemented demonstrations only, and hides empty categories. Each new feature must update both its demonstration and the user-story document, including partial/dependent paths. A1 demonstrates entry. A2 adds real creation, recovery, origin-local encrypted persistence, and the minimal active dialogue with enabled Log Out. A4 owns the lean balance dialog (available/total sats and Refresh, with no persisted or stale fallback) and A6 functional logout. Admin first-run reset clears BIS-owned account storage; real deletion-based verification is manual. A2 is not yet reported fully complete.
