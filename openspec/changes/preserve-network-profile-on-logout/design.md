# Design

## Context

See [proposal.md](proposal.md). The account store already keeps encrypted account envelopes and a profile collection per network, while an `activeProfile` record controls automatic activation. The existing logout mutation deletes both the active selection and the selected profile, including profile-scoped browser preferences. The restoration confirmation change treats membership in that same network-scoped collection as proof that a profile is locally known.

## Goals / Non-Goals

**Goals:**

- Disconnect an active Player Wallet while keeping its encrypted profile and durable, profile-scoped recovery records available on that network.
- Retain the existing generation, locking, cross-context notification, stale-work invalidation, and host-restart guarantees.
- Make the retained profile eligible for the existing-profile restoration path only after the user explicitly enters its phrase.

**Non-Goals:**

- Automatically choosing, exposing, or reactivating a retained profile after logout or reload.
- Changing the selected-network preference, network isolation, game-wallet behavior, or the existing explicit reset/removal facilities.
- Introducing server-side account registration, account discovery, or an on-chain transaction requirement.

## Decisions

### Separate active-session state from saved-profile ownership

The logout storage mutation will remove only the `activeProfile` selection and advance the generation/logout receipt, leaving the encrypted `profile:<id>` envelope and `profiles` collection intact. The existing load contract already returns no account when no active profile is selected, so this produces the required logged-out state without a new persistent model.

Deleting the profile and recreating it at the next restore was rejected because it turns a session action into silent destructive persistence cleanup and makes an existing local profile indistinguishable from first setup.

### Preserve profile-scoped journals on logout

Logout will not clear the active profile's local operation, onboarding, or recovery journals. This maintains recovery continuity for unsettled operations and keeps the retained profile internally consistent when it is restored again. The current force-reset/removal path remains responsible for deliberately destructive cleanup.

Clearing only selected journals while retaining the profile was rejected because it could discard recovery information while presenting logout as non-destructive.

### Reuse explicit phrase restoration to reactivate retained profiles

After logout, the UI remains in its existing logged-out entry state. A user who supplies a valid phrase must still pass operator verification; if the derived profile is present in the selected network collection, the existing restore path activates it without the first-local-profile confirmation. The different-network case remains a separate store and therefore follows first-local-profile confirmation.

Automatically reactivating the last profile on reload was rejected because it would negate logout as a meaningful session boundary.

## Risks / Trade-offs

- [Retained local wallet material is mistaken for an active session] → keep `activeProfile` absent after logout, retain the logged-out UI, and cover reload/cross-context behavior.
- [A stale asynchronous operation reactivates the retained profile] → preserve generation advancement, locks, logout receipts, and stale-operation checks; add regression tests for concurrent contexts.
- [A future destructive command inadvertently adopts the new logout semantics] → make tests distinguish non-destructive logout from explicit reset/removal and keep the destructive cleanup isolated.
- [A phrase appears usable across networks] → retain separate network stores and test that the other network still requires its own first-local-profile confirmation.

## Migration Plan

No data migration is required. Existing encrypted profiles remain readable. After deployment, the next logout leaves existing profiles retained and inactive; users who previously logged out must restore once because those profiles were already deleted. Rolling back restores the prior destructive logout behavior but does not invalidate retained profiles.
