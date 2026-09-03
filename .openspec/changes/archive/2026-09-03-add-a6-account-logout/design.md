## Context

See proposal.md for motivation. The inspected core has creation, hydration, cancellation, generation-protected persistence, and an admin-only reset. Production Log Out is disabled. Storage reset deletes the identity envelope and increments its generation; broadcasts trigger hydration in other contexts. Admin reset also empties presentation, so invoking it directly would give logout the wrong destination.

The current Arkade adapter uses transient repositories and disposes its wallet within createAccount(), including late completion after cancellation. A6 therefore needs no new Signet/operator capability or retained-wallet disconnect call. No live operator capability is claimed or required by this local operation.

## Goals / Non-Goals

**Goals:** Preserve the existing context/UI boundary; add guarded logout with observable state, durable completion, and reusable production presentation. Keep secrets out of public state/events and Admin.

**Non-Goals:** Recovery access, A3, A4, payments, network cleanup protocols, new dependencies, and game-repository changes. The acknowledgement is a player assertion, not proof of a backup.

## Decisions

### Separate logout orchestration from admin reset

Proposed additive API: openLogoutConfirmation(), setLogoutBackupAcknowledged(boolean), confirmLogout(), and cancelLogout(), plus logout-specific handling in retry(). Track confirmation/working/error states in core so remounts and multiple consumers cannot bypass the guard. Keep acknowledgement non-secret and reset it on each fresh opening, cancellation, completion, or profile invalidation. UI uses a labeled native checkbox and existing production light styling; the screenshots establish behavior, not a dark-theme redesign.

Reuse a narrowly scoped storage-clearing primitive, but preserve Account and its preceding host view during logout. Do not recreate the whole client or clear Admin selection. Directly reusing Admin reset would incorrectly empty the preview and conflate distinct actions.

### Bind confirmation to the account being cleared

Capture profile identity and storage generation at confirmation. Extend the private clearing primitive with an optional expected-generation guard checked atomically before clearing. Keep admin reset's current broad semantics separate. Invalidate prior asynchronous work and serialize logout submission. A stale confirmation must reconcile and reopen for the new account rather than clear it. Existing save generation protection prevents old creation work from reintroducing cleared material.

### Treat completion as a durable result

Wait for the clearing transaction, then reconcile absence before reporting success. Retain a local operation/version token across asynchronous steps. Suppress competing hydration from replacing the working/error dialogue, but reconcile queued storage notifications before publishing final state. If clearing or confirmation of absence fails, show a secret-free error with Retry and retain acknowledgement for that attempt; allow unchecking to disable further submission. While working, disable checkbox, Back, and submission. After an error, Back can reconcile stored state before returning to Account; it must not assert the old profile still exists if clearing may already have committed.

Retry first reconciles storage: if already absent, finish the original logout; if the original account remains, retry guarded clearing; if replaced, abandon the stale attempt and require a fresh confirmation. This avoids deleting a newly created account following an ambiguous earlier result. An unguarded retry was rejected for that reason.

### Notify hosts after the transition

Proposed additive event: accountDisconnected with the former public profileId. Publish after confirmed absence for each active-to-absent transition, including another context's logout, once per observing context. Initial empty hydration does not emit disconnection. Use existing subscriptions and disposal guards; no Arkade types or secret fields enter the public API. A direct profile replacement is reconciled without treating a stale logout as permission to clear the replacement.

The host remains responsible for gameplay. A6 only signals availability and returns to the existing logged-out Account dialogue; it does not redefine eligibility within a connected run. Future payment and game-run changes must define those policies before adding their operations.

### Demonstrate production behavior

Add Account / Log Out to the existing Admin catalog. Selecting it opens Account through the public production API: an existing account offers logout; no account shows the normal chooser. Never fabricate an account. Preserve selection on successful logout. Restore remains visibly disabled. Verify the same flow in a plain host without demo styles.

## Risks / Trade-offs

- Clearing can commit before a subsequent read fails -> keep failure truthful and reconcile on Retry; never assume rejection means the identity remains.
- Cross-tab changes race confirmation -> atomic generation guard and fresh confirmation for replacements.
- Unsaved recovery phrase means lost access -> mandatory acknowledgement and warning, with no claim that backup was verified. Recovery access is explicitly separate.
- Real-storage deletion is prohibited for agent execution by repository rules -> use storage doubles for automated lifecycle tests; provide a manual disposable-Signet-account browser checklist and keep that verification pending until user evidence exists.
- Existing consumers may exhaustively match event/phase unions -> update public exports, examples, and type checking with the additive contract.

## Migration Plan

No storage schema migration or new dependency is required. Implement and verify the new state/API, then enable the action and Admin story together. Update story documentation and package/API notes before reporting completion. If withdrawn, an additive follow-up can disable the entry action without rewriting history; previously cleared account material is not recreated.

## Open Questions

Pending-payment reconciliation and game-specific connected-run eligibility are deferred to their owning features because no such operations exist in this slice. A separate future feature may expose recovery-phrase access; A6 does not depend on it. These deferrals do not block this local logout design.
