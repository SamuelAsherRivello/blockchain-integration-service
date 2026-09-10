## Why

BIS Account works in its own demo, but the stealth game does not consume BIS yet. The first cross-project smoke test must prove that the game's Settings menu opens the real, complete Account experience while ordinary gameplay remains independent of account access.

## What Changes

- Add a game-owned ⚡ Account action to Settings, opening the existing production BIS Account UI through public package APIs.
- Package and consume the local BIS integration in `babylon-lite-stealth-grid`, including its stylesheet and React peers, without copying components or importing the demo or private core/Arkade modules.
- Coordinate Account navigation, modal focus, pause/input ownership, startup failure and cleanup with the existing game Settings lifecycle.
- Replace BIS-forced logout reloads with a public restart request after confirmed cleanup. Each host owns its restart action; the game invokes its own restart routine and the BIS demo handles its own reload.
- Establish BIS-first setup and a repeatable two-project browser smoke test for A1 entry, A2 creation, A3 restoration, A4 balance/account access, A5 transactions and A6 logout. Preserve access to every existing Account menu destination; additional asset/send/receive/swap routes receive navigation checks, not new financial acceptance scope.
- Capture package provenance, exact local URLs/tunnels, browser-origin storage separation, isolated regression checks, and explicit live/manual evidence in a shared runbook owned by BIS with a game README pointer during implementation.

- Follow-up UI acceptance: eliminate whole-window/dialog scrolling and all internal scrolling except Transactions and Assets lists. Seed-word screens must fit with a shorter warning displayed on at most one line. First shorten the warning at the current scale; try a temporary 80% embed only if screens still do not fit. Permanent CSS reductions require user review. Validate the user's observed Windows Chrome view of 743 × 1321 at 100% zoom and the available area on their Android phone; no Android minimum viewport has been confirmed.

- Follow-up presentation: put BIS above every game control with a full-screen translucent black input-blocking backdrop; show Account ID with Copy only on Accounts Details; move the game-owned Account button above the volume controls and match the BIS button appearance using game-owned CSS.
- Multi-game filtering and a user-facing Game ID belong to a separate future proposal, not this implementation.

## Capabilities

### New Capabilities

- `game-account-smoke-test`: Public-package consumption, Settings-to-Account lifecycle, host-owned restart after logout, and cross-project acceptance for the existing Account suite.

### Modified Capabilities

None as separate delta files. The new capability adds the host restart contract while retaining existing account-logout cleanup, truthful completion and context-reconciliation requirements. It supersedes the implementation/documentation's direct browser-reload mechanism, not its cleanup guarantees or historical verification gaps. The design identifies affected game Settings/pause specs for reconciliation during implementation.

## Impact

- BIS: logout storage/context notifications, public restart event, demo host handler, integration package build/pack verification, public API consumer fixture, package documentation and cross-project smoke runbook. No new wallet operations or provider changes. **BREAKING** host responsibility: consumers that relied on BIS reloading the browser must handle the restart request explicitly.
- Game: `package.json`/lockfile, a thin BIS host adapter, `src/main.js`, `src/ui/settings-ui.js`, host layout/styles and focused tests. The game remains JavaScript/Babylon; React is used only by BIS's mounted root.
- Planning is centralized in BIS `.openspec/changes/smoke-test-bis-to-game/`; this proposal describes work in both repositories. The sibling game's files remain untouched during planning.
- Confirmed stopping point: user-story group A and the full existing Account menu. No pay-to-continue button, death/revival/checkpoint changes, achievement gameplay hooks, admin panel, deployment or live financial mutation testing. Live account tests use a disposable Signet profile with user-managed recovery material.
- Confirmed interview decisions: Account Back returns to Settings; BIS requests restart and the game controls execution; use a fixed package snapshot; test a fresh live account plus isolated populated-data fixtures; require the user's Windows browser with narrow-screen, keyboard/mouse and fullscreen checks. Follow-up feedback adds the user's Android browser as a no-page-scroll acceptance target; a wider multi-browser matrix remains outside scope. BIS server port 5174 maps to Windows 15174; game server port 5175 maps to Windows 15175. The original integration decisions are settled; follow-up UI sizing and presentation decisions are being refined through the user-invoked Grill Me interview.

## Planning Status

Proposal, design, delta spec and tasks incorporate the five confirmed interview decisions. The user authorized finishing the integration smoke test on 2026-09-06. Implementation and local verification in both projects are in scope; Git operations remain separately restricted.
