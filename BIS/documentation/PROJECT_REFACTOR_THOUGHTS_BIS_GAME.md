# Project Refactor Thoughts — BIS Game

## Purpose and standard

This is an analysis-only proposal for Stealth and Steel (`babylon-lite-stealth-grid`) as the BIS consumer. The goal is not to turn the game into a library-shaped application; it is to make a long-lived Babylon/WebGPU game legible, testable, and independently evolvable while preserving its thin BIS integration.

Read the companion [Project Refactor Thoughts — BIS Library](PROJECT_REFACTOR_THOUGHTS_BIS_LIBRARY.md) for the producer-side plan. The final game copy belongs in `STEALTH_STEEL/documentation/` when its companion game-repository change is approved.

## Observed strengths

- The game is intentionally independent: gameplay remains available without a BIS account or connectivity.
- `runtime/integration/bis-account.js` dynamically loads only `@bis/integration` and its public stylesheet. It correctly keeps pause, focus trap, fullscreen host placement, restart behavior, and game policy on the game side.
- The game already has meaningful modular structure under characters, systems, gameplay, AI, UI, and integration. It also documents important cross-cutting contracts such as the canonical grid and render depth.
- The integration has narrow adapters for different policies: account hosting, pay-to-continue, level reward, and treasure session. This is the correct direction for keeping BTC workflows out of ordinary game code.
- The test base is unusually strong for a prototype: 152 Node test files plus browser smoke checks cover gameplay, rendering-adjacent behavior, publishing, and BIS integration paths.

## Risks to address

| Observation | Long-term cost | Refactor response |
| --- | --- | --- |
| `runtime/main.js` is 1,844 lines and imports scene assembly, gameplay coordination, UI, integration, and diagnostics. | Initialization order and frame-level coupling are difficult to review; a localized change can affect unrelated systems. | Reduce it to bootstrap plus `createGameRuntime`; extract scene/session composition and diagnostic drawing behind named controllers. |
| The main module has a broad import graph. | Dependency direction is visible only after reading the whole file. | Give every runtime controller one responsibility and import direction; keep composition at the outer edge. |
| `bis-account.js` owns both DOM hosting/focus lifecycle and BIS session composition. | The game-to-BIS boundary is correct but two lifecycle concerns are intertwined. | Keep it in `runtime/integration/`, split host-shell mechanics from the public-package session adapter, and retain one owner for pause/focus/restart policy. |
| Debug drawing and production scene startup coexist. | Debug work can make production startup harder to follow or accidentally influence it. | Put diagnostics behind an explicitly injected diagnostic controller that is optional at runtime and testable independently. |

## Proposed game target shape

```text
bootstrap/main
   │ creates one game runtime
   ▼
game runtime composition
   ├── scene and level-session lifecycle
   ├── gameplay and character systems
   ├── UI and input controllers
   ├── optional diagnostics
   └── integration adapters ──► @bis/integration public API only
```

The game must continue to own gameplay conditions, checkpoints, chest collision, rewards presentation, pause behavior, focus, and restart. BIS must continue to own account workflow, price/payment execution, contract lifecycle, and verified result delivery. The only allowed direction is game → published BIS API. BIS must not import game source, and game code outside `runtime/integration/` must not import BIS or Arkade.

The game is not required to create a second showcase class. Instead, its README should point to the BIS `BisGameServices` tour for the reusable integration story and to its own `createGameRuntime` composition module for game startup. This keeps the shared approach consistent without forcing object-oriented style into JavaScript gameplay code.

## Documentation and templates

During implementation, add `STEALTH_STEEL/documentation/Code Templates/` with three maintained templates:

- `runtime-controller.js.md` for a stateful game system with `dispose()` ownership;
- `dom-ui-module.js.md` for a game-owned UI/focus/input module; and
- `node-feature-test.js.md` for focused Node tests.

They mirror the BIS templates' intent—purpose, allowed dependencies, contract, mutable state, cancellation/timers, cleanup, errors, and verification—while remaining idiomatic to the game's JavaScript/Babylon architecture.

## Implementation sequence and acceptance bar

1. Create a companion OpenSpec change in the game repository using this report as its baseline; do not make game edits from the BIS repository change.
2. Add templates and dependency-boundary tests before moving runtime modules.
3. Extract bootstrap/session/diagnostic controllers from `main.js` in small batches, retaining character, grid, and gameplay contracts.
4. Split the BIS host shell from public-package session composition without moving pause or gameplay policy into BIS.
5. Test against the packed BIS artifact and run the existing Node suite, browser smoke tests, build, and release checks.

The refactor is acceptable only when gameplay behavior, rendering lifecycle, test coverage, and game-without-account behavior are preserved; the game has no Arkade dependency or direct BIS-internal import; and a reviewer can identify game composition and the public BIS seam quickly.

## Deliberate non-goals

This plan does not move gameplay into BIS, replace Babylon Lite, convert the game to TypeScript or React, change art/Tiled assets, add an application server, or alter payment/reward/game rules.
