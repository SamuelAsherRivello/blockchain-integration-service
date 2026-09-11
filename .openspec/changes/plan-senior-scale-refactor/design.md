## Context

See [proposal.md](proposal.md) for motivation. The existing architecture already enforces the right high-level boundary: `@bis/integration` separates `core`, `ui`, and `arkade`; the React demo consumes public exports; and Stealth and Steel dynamically loads only the published BIS package through `runtime/integration/bis-account.js`.

The cost is concentrated in two composition roots. BIS `core/context.ts` is a 1,093-line factory with many feature dependencies and lifecycle responsibilities. The game `runtime/main.js` is a 1,844-line scene assembler that imports systems, owns setup, and contains diagnostics. Both repositories have broad automated coverage (83 BIS tests and 152 game tests), so the refactor can rely on characterization and boundary tests rather than change behavior.

Constraints: retain the Frontend/Core/Arkade responsibility split; retain Signet-only and real-operation policies; keep Arkade types out of the game; keep the game playable without an account; do not expose secrets; and do not add dependencies merely for code organization.

## Goals / Non-Goals

**Goals:**

- Make ownership, dependency direction, lifecycle, and public-versus-internal APIs obvious at the file boundary.
- Make a newcomer able to start at one BIS source class, follow five numbered comments, and understand how a game crosses the BIS boundary without seeing Arkade implementation details.
- Make small feature work local: a new account feature, React panel, game system, or host bridge should have a predictable home, a matching template, and focused tests.
- Preserve current public APIs and all documented runtime behavior while extracting modules incrementally.

**Non-Goals:**

- Replacing React, Babylon Lite, Arkade, Vite, Node's test runner, or the existing two-repository model.
- Changing wallet, payment, asset, LTO, persistence, account, UI, or gameplay behavior.
- Converting every module to a class, performing a wholesale folder rewrite, or adding a monorepo/shared source tree.
- Claiming production custody, changing Signet feasibility, or inventing a backend.

## Decisions

### 1. Use one public BIS composition class, with compatibility adapters

Introduce `BisGameServices` as the documented showcase class in the integration package. It is the protocol-neutral game-facing façade and its source owns only composition, lifecycle, public method delegation, and event subscription. Its source contains exactly these chronological comments:

1. define the protocol-neutral public contract;
2. assemble core, UI, and Arkade adapters at one composition boundary;
3. wait for durable account hydration before accepting actions;
4. translate verified workflow results into safe game events; and
5. dispose subscriptions, UI, and operation controllers in ownership order.

The README links directly to this source as the recommended entry point. Existing `createBisContext`, `createBisUi`, controller factories, and exported types remain compatible adapters through the migration. The class does not expose an Arkade account, recovery phrase, or SDK type.

**Why this over making `context.ts` the showcase:** the current factory is a valuable implementation seam but mixes composition, feature orchestration, state projection, and cleanup. A thin façade gives readers a stable narrative without forcing an unsafe immediate rewrite. **Why this over a class-only rewrite:** functional feature modules remain appropriate for stateless validation and pure mapping; a class is reserved for lifecycle ownership.

### 2. Extract by vertical feature and explicit lifecycle ownership, not by file size alone

Within BIS, preserve `core`, `ui`, and `arkade`, but make each operation family own its state projection, cancellation/observation, and focused tests. `context.ts` becomes a narrow coordinator that composes feature controllers and publishes immutable state; Arkade remains behind adapters; UI components consume view models/actions rather than SDK details. Split demo startup from individual admin stories so `App.tsx` composes rather than owns each workflow.

Within the game, retain current gameplay/character/system organization. Reduce `main.js` to bootstrap plus `createGameRuntime` composition; move scene assembly, level session lifecycle, debug drawing, and screen/UI wiring behind named controllers. Keep `runtime/integration/` as the only directory importing `@bis/integration`; host modules continue to own pause/focus/game-policy behavior and BIS continues to own wallet workflows.

**Why this over a new shared cross-repository package:** a shared implementation layer would blur the deliberate repository boundary. Shared meaning is expressed through the package API, contract tests, and documentation instead.

### 3. Make templates and reports executable guidance

Create exactly three template families in each repository's existing documentation area:

- BIS: a core TypeScript feature module, a React/TSX view component, and a Node test;
- game: a JavaScript runtime controller, a JavaScript DOM/UI module, and a Node test.

Each template states purpose, allowed dependencies, public contract, mutable-state/lifecycle ownership, error/cancellation policy, disposal behavior, and colocated test convention. Existing files are migrated in small reviewed batches only when touched by this refactor; templates are guardrails, not a style-only bulk rewrite.

Create cohesive `Project Refactor Thoughts` reports in the BIS and game documentation folders. They distinguish observed strengths and risks from recommendations, name the allowed cross-repository import direction, define the showcase-tour contract, and link to the counterpart report.

### 4. Verify architecture continuously with existing tools

Use TypeScript checking, current Node tests, package builds, game tests, and targeted browser smoke checks as migration gates. Add lightweight repository tests that fail if the game imports BIS internals or Arkade directly, if the showcase comments are not exactly numbered 1–5, or if the published package cannot satisfy the game integration adapter. Prefer static path/export checks over a new linting or architecture dependency.

## Risks / Trade-offs

- [Compatibility wrapper accidentally diverges from the class] → characterize current factory behavior first, have adapters delegate one direction only, and remove none until a later explicitly approved major-version plan.
- [Feature extraction changes async/cancellation ordering] → retain abort/version guards with their state owner; migrate one operation family at a time with its existing regression tests.
- [Game refactor hides render or initialization timing regressions] → retain current browser smoke checks and add a focused bootstrap/scene-lifecycle smoke test before moving diagnostics.
- [Templates become stale boilerplate] → give each template a short maintenance owner/rule, link it from the README, and update it when a convention changes in the same change.
- [Cross-repo releases become mismatched] → test the game adapter against the packed BIS artifact and stage library release before changing the game dependency reference.

## Migration Plan

1. Capture baseline commands, public exports, integration boundaries, and the two analysis reports; create templates before migrations.
2. Add `BisGameServices` and the README tour as additive, compatibility-preserving code; characterize its lifecycle and public event behavior.
3. Extract BIS feature controllers in independent batches, each retaining current behavior and tests; reduce `context.ts` only after its dependencies have an owner.
4. Refactor the demo composition, then reduce game `main.js` by extracting bootstrap/session/diagnostic controllers without moving BIS policy outside `runtime/integration/`.
5. Run full repository and cross-repo contract verification after every batch; package BIS and verify the game against the resulting artifact before adopting it.

Rollback is additive and commit-granular: keep old factories as delegates, preserve existing package exports, and revert only the completed extraction batch if a test or browser check regresses. No persisted record schema, wallet data, or public game event changes are part of this plan.
