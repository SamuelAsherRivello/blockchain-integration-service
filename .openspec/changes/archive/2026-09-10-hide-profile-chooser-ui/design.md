## Context

See [proposal.md](proposal.md) for the motivation and the delta specs for the behavior contract. The shared Account UI currently imports `AccountProfiles`, derives a profile-chooser rendering branch from `BisState.profileChooser` and `savedProfiles`, and renders a Profiles button from the active Account menu. `createContext` and account storage separately own the encrypted collection, active selection, profile-scoped records, and public selection methods.

## Goals / Non-Goals

**Goals:**

- Make every Account UI state independent of the saved-profile collection for routing and visible copy.
- Retain the existing core collection, active-account lifecycle, scoped record isolation, and callable selection behavior.
- Cover both visible absence and retained multi-identity behavior with focused regression tests.

**Non-Goals:**

- Change IndexedDB schema, encrypt/decrypt logic, stored identity count, selection semantics, or operation ownership.
- Remove `savedProfiles`, `profileChooser`, `openProfileChooser`, or `selectProfile` from the core public context contract.
- Hide the existing Accounts Details Account ID field, alter game-wallet UI, or change Signet/Arkade behavior.

## Decisions

### 1. Make the shared Account renderer the sole UI boundary

Remove the Account renderer's profile-chooser branch, its Profiles action, and the now-unreferenced chooser component and CSS. A state with no active account will always render the standard logged-out Account actions, regardless of `savedProfiles`. This ensures Admin, Marketplace, and game consumers of the shared production UI all inherit the same hidden presentation.

Keeping the component mounted but visually hidden was rejected because it would retain inaccessible controls and profile wording in the rendered DOM. Reworking profile management into a smaller dialog was rejected because the requested outcome is no profile UI.

### 2. Preserve core multi-profile capability unchanged

Leave storage collection reads/writes, active identity selection, `profileChooser` state, and context selection/creation/restoration guards in core. Existing callers can still programmatically opt into the selection capability, and per-identity journals remain scoped as today. The production Account renderer simply stops invoking or displaying that capability.

Removing core state or automatically deleting dormant identities was rejected because it would disable the requested multi-profile feature and risk loss of separately scoped records.

### 3. Treat Account ID as the approved identity display, not profile management

Keep the existing Accounts Details Account ID field and Copy behavior untouched. Remove only UI copy and controls that identify, enumerate, add, or switch profiles. This maintains the established account-details contract while eliminating the visible profile-management feature.

Removing all identity displays was rejected because it would broaden the requested UI change and conflict with the existing Account ID specification.

### 4. Split regression coverage by rendering and core behavior

Replace the chooser-rendering assertion with a shared Account UI rendering test that proves profile strings and selectable saved IDs are absent while ordinary logged-out actions remain available. Retain and adjust core profile-collection tests so explicit programmatic selection, duplicate-safe create/restore, and logout preservation still work without depending on UI navigation through the chooser.

## Risks / Trade-offs

- [A no-active state with retained identities still routes to the removed chooser] → Make the shared renderer route only on the active account and verify this state with a focused rendering test.
- [Removing UI imports accidentally removes the underlying capability] → Keep core public APIs and existing collection/browser tests; add assertions that selection and scoped records still survive.
- [Profile wording remains in an accessible label or stale stylesheet/component] → Remove the chooser component and its dedicated selectors, then search the shared UI bundle/source and run UI tests for visible copy.
- [Account ID is mistaken for prohibited profile-management UI] → Limit the retained field to the already specified Accounts Details route and test that no chooser or profile-management labels appear elsewhere.

## Migration Plan

1. Remove the shared Account UI chooser rendering and dedicated presentation artifacts without touching persisted storage.
2. Update focused rendering and core tests, then run the integration test subset and production build.
3. Verify a logged-out Account state with retained local identities and an active Account state in a browser host; confirm ordinary Create/Restore and Account ID details still work while profile controls never render.
4. Roll back by restoring the UI-only changes in a new additive commit; no stored data migration or recovery is required.
