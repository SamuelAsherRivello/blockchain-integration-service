## Context

See [proposal.md](proposal.md) for motivation and [admin-batch-operations spec](specs/admin-batch-operations/spec.md) for the behavior contract. The existing demo composes G. Contracts and H. Marketplace into `AdminPanel` through its `contracts` slot; Console is rendered later by `AdminPanel` from App-owned `consoleLines`. `MarketplacePanel` currently performs real game-wallet mint, burn, and list actions, but it has no exposed batch-session lifecycle that another control can safely clear or restart.

## Goals / Non-Goals

**Goals:**

- Add one isolated, in-memory Admin batch-session controller and render its exact requested section and controls before Console.
- Make repeated clicks safe and make Console feedback clearly distinguish local UI state from a real marketplace operation.
- Reuse existing Admin section, story-card, Console, focus, and responsive styles.

**Non-Goals:**

- Connect the controls to H1/H2/H3, Arkade SDK batches, browser storage, remote cancellation, transaction recovery, or game-facing APIs.
- Add a confirmation dialog, a wallet prerequisite, an account/network lookup, a dependency, or a new visual language.

## Decisions

### 1. Keep Batch Operations as a demo-local component

Add a focused `BatchOperationsPanel` under `integration-demo/src/admin/` and compose it after `MarketplacePanel` in the existing `contracts` slot. The component owns a discriminated local state of either no session or one newly created session. This produces the requested `04. Batch Operations` placement without extending the reusable integration package or coupling a UI affordance to wallet state that it cannot safely control.

Alternative considered: attach the controls to `MarketplacePanel` and reuse its `busy` state. Rejected because that state represents real mint/burn/list work; clearing it could visually or semantically misrepresent an unresolved financial operation.

### 2. Make local lifecycle effects explicit and non-persistent

`Start New Batch` creates a fresh opaque in-memory session marker, replacing the previous marker if one exists. `Clear Last Batch` removes that marker and is disabled when it is absent. The state exists only for the mounted Admin component; it is never put in local storage, a wallet operation record, the game-facing API, or a Marketplace record. A reload therefore begins with no active local batch session.

Alternative considered: give the button direct Arkade batch semantics or persist a record for later recovery. Rejected because this checkout exposes no safe public API that creates, clears, or cancels an Arkade batch, and durable remote-operation state must not be cleared from an Admin convenience control.

### 3. Use a synchronous interaction latch plus native button state

Each action takes a short local transition lock before changing state and reporting feedback. The lock is represented in React state for disabled rendering and in a ref for same-turn duplicate protection, then released after the local update and Console append are scheduled. `Start New Batch` remains available when idle; `Clear Last Batch` is unavailable until a local session exists. No active Player or Game Wallet is required because the actions are not wallet operations.

Alternative considered: use only React's `disabled` state. Rejected because two same-turn programmatic or rapid activation events can observe an earlier render before the disabled property updates.

### 4. Route feedback through App's bounded append path

Pass an `onLog` callback from `App` to `BatchOperationsPanel` that appends one structured, local-only entry to `consoleLines` while retaining the existing bounded-history behavior. The messages identify whether a session started, replaced, or cleared and state that the effect is local. They contain no session secret, recovery phrase, address, wallet ID, asset ID, or claim of a network result.

Alternative considered: add a second local status area inside the panel. Rejected because the existing Admin Console is the project-wide inspection surface and a second log would make a local action appear disconnected from the normal workflow.

## Risks / Trade-offs

- [The word "batch" could be mistaken for an Arkade or Marketplace batch] → title and Console feedback explicitly label the state as local, and the component has no wallet/controller dependency.
- [Future batch functionality may need durable recovery] → retain the component boundary so a separately proposed capability can replace the local state with a vetted domain model rather than reinterpreting it implicitly.
- [Rapid repeat activation could produce confusing log entries] → guard in the event handler with both a ref latch and disabled native controls.
- [The extra section crowds the narrow Admin panel] → reuse `StorySection` and `StoryButton` markup, then cover narrow layout and keyboard operation in the focused host/browser checks.

## Migration Plan

1. Add the isolated panel and compose it after the current Marketplace section, passing only the local Console append callback.
2. Add focused host/component coverage for exact text, initial disabled state, start/replace/clear behavior, duplicate guard, no-wallet operation, reload reset, keyboard activation, and narrow layout.
3. Run the repository test suite, typecheck/build, and browser smoke check the real Admin panel.
4. Roll back by removing the demo-only component and composition. No wallet, network, storage, or remote operation migration is required.
