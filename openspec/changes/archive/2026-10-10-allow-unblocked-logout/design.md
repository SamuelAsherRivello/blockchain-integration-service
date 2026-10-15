# Design

## Context

The Account Log Out dialog currently mixes warning discovery, acknowledgement state, and permission to submit. The context also treats pending-operation snapshots and Game Wallet reset as hard preconditions, while browser mutation coordination rejects an operation when an exclusive lock is unavailable. See `proposal.md` and the `account-logout` delta for the desired contract.

## Goals / Non-Goals

**Goals:**

- Make the Player Log Out action submit-able with zero through three applicable warnings.
- Preserve concise, truthful warnings and the existing progress/failure/reconciliation model.
- Clear only the selected Player profile, invalidate its cached/live state, and preserve other profiles and separate Game Wallet data.
- Keep Admin Reset's unresolved-operation protections unchanged.

**Non-Goals:**

- Cancelling, claiming, or reconciling remote transactions during logout.
- Changing the Game Wallet's own explicit reset flow or introducing Arkade types into the game-facing API.
- Making unsupported browser primitives silently appear safe; infrastructure failures still produce a truthful cleanup failure.

## Decisions

### Separate warning presentation from submission authorization

The React confirmation will build a small warning list from the current non-secret state. The backup reminder remains the lead copy, while pending-operation and separate Game Wallet warnings are conditional. Acknowledgement setters remain usable for accessibility and telemetry, but the final action's disabled state depends only on an in-flight logout operation. This keeps zero-warning and partially acknowledged states equivalent from the cleanup engine's perspective.

Alternative considered: retain the gates and add bypass paths for individual errors. Rejected because every new warning or storage edge case could recreate the same lockout.

### Make Player cleanup independent of warning snapshots

`confirmLogout` will validate that the confirmation still targets the same active profile, then invoke Player storage cleanup without requiring acknowledgement booleans, a stable pending count, or a successful Game Wallet reset. Pending records are local recovery information; cleanup removes the selected profile's records and never sends a cancellation or completion claim. Warning counts are advisory and may change after the dialog opens.

Alternative considered: silently refresh the checkboxes until the snapshot is stable. Rejected because it still makes a changing operation set a user-visible gate.

### Preserve separate Game Wallet state on Player logout

Player logout will not make Game Wallet reset part of its success condition. If the Game Wallet is present, the dialog warns that it is separate and remains saved; its own reset remains an explicit operation. This avoids deleting unrelated wallet data and avoids reporting Player logout failure when a separate wallet is unavailable.

Alternative considered: attempt a best-effort reset and ignore failure. Rejected because an ignored partial reset is difficult to explain and can destroy data the user did not request to remove.

### Serialize cleanup without rejecting lock contention

The logout cleanup path will retain exclusive mutation coordination, but it will queue behind an active compatible mutation instead of using an `ifAvailable` rejection for normal contention. Once the lock is acquired, it will clear the selected profile and perform the existing read-back/invalidation checks. The no-Web-Locks case remains an explicit infrastructure failure rather than risking concurrent storage corruption.

Alternative considered: bypass locks for logout. Rejected because a simultaneous write could resurrect the cleared profile or corrupt journals.

### Keep cache and context reconciliation on the confirmed boundary

Successful cleanup continues to invalidate the profile-scoped read coordinator/background cache, publish the active-to-absent transition once, and request host restart only after read-back confirms the profile is absent. A failed cleanup leaves the account active and follows the existing retry dialog path.

## Risks / Trade-offs

- [Risk] A user can log out without checking a warning and lose local recovery material. → Keep the concise lead copy and applicable warnings prominent; retain the existing confirmation page and never expose secrets.
- [Risk] A pending network operation may continue after local records are removed. → Preserve the explicit warning and never claim cancellation or completion; operation recovery remains an operator/network concern.
- [Risk] Waiting for a browser lock can make logout appear pending. → Show the existing `Logging out...` state and prevent duplicate submission until the serialized cleanup finishes.
- [Risk] A browser without Web Locks still cannot guarantee cross-context safety. → Report a truthful cleanup failure and keep the account active rather than performing unsafe unlocked mutation.

## Migration Plan

1. Update the delta spec, UI, context, storage cleanup, and focused tests.
2. Run typecheck, focused logout/storage tests, OpenSpec validation, and the relevant browser checks.
3. Rollback is a code revert; no persisted schema migration is required. Existing stored Player and Game Wallet records remain compatible.
