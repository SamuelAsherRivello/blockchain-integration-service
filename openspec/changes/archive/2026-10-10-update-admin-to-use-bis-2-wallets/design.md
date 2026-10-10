# Design

## Context

See [proposal.md](proposal.md) for the motivation and behavior scope. The current Admin composition creates one Player context and one Game Wallet controller, passes the latter into both Admin panels and the mounted Runtime UI, and refreshes it when the Player identity or network changes. A.G.3 separately probes live boarding evidence and currently maps any probe exception to an undifferentiated `unknown`/`Status Unavailable` presentation.

The implementation must preserve encrypted browser storage, durable operation journals and reservations, same-origin synchronization, public-only projections, and the game-facing API's independence from Arkade-specific types.

## Goals / Non-Goals

**Goals:**

- Establish and test the existing one-context/one-controller composition as an explicit invariant rather than relying on component wiring alone.
- Give Admin operations a current wallet scope containing the Player Wallet identity, Game Wallet identity, active network, and controller generation/selection version.
- Normalize safe readiness and failure categories at the integration boundary so Admin can explain unavailable operations without leaking provider internals or secrets.
- Invalidate or reject stale Admin reads, quotes, and submissions when either wallet or the active network changes.
- Verify recovery after transient reads and ensure a settled unavailable attempt does not poison a later fresh attempt.

**Non-Goals:**

- No new wallet storage namespace, recovery format, signing service, or application backend.
- No automatic boarding, automatic payment submission, or bypass of explicit quote/confirmation actions.
- No changes to the game-facing BIS contract to expose Arkade SDK types or Admin-only diagnostics.
- No claim of live Signet success from isolated fixtures; live acceptance remains an explicit verification task.

## Decisions

### 1. Keep the shared controller as the single source of Game Wallet truth

Admin and Runtime Preview will continue to receive the same Game Wallet controller created beside the Player context. The implementation will add characterization tests and, where necessary, a narrow composition assertion rather than introducing synchronization between separate Admin and Runtime wallet instances. This avoids duplicate selection state, stale cross-surface storage reads, and identity merge behavior.

Alternative considered: create an Admin controller and a Runtime controller that synchronize through storage events. Rejected because it creates two in-memory operation generations and can allow one surface to prepare work for a wallet that the other surface has already replaced.

### 2. Bind Admin work to a neutral wallet scope

Before an Admin read, quote, or mutation proceeds, capture a scope containing the current Player profile, Game profile, active network, and Game Wallet selection version. Revalidate that scope immediately before any signing or submission and discard stale results after an account, network, selection, or controller-generation change. The scope remains public metadata only and contains no recovery material.

Alternative considered: rely on profile IDs at final submission only. Rejected because a changed network, replaced controller, or stale prepared quote could still carry incompatible addresses, reservations, or provider assumptions into the operation.

### 3. Use a typed diagnostic category instead of parsing UI strings

The integration layer will classify readiness failures into stable public categories such as `wallet-read`, `provider-read`, `network-mismatch`, `role-conflict`, `insufficient-funds`, `unresolved-operation`, `pending`, and `confirmed`. Admin may render human-readable messages, but operation logic will use the category and bound scope. Provider errors and raw SDK details remain out of public state unless already safe and explicitly normalized.

Alternative considered: keep the existing generic message and improve only the label text. Rejected because the UI would remain unable to distinguish a failed live boarding probe from an unavailable wallet balance, making recovery and acceptance testing ambiguous.

### 4. Treat live boarding evidence as a read-only prerequisite

A.G.3 will continue to use fresh transaction evidence only to establish waiting or confirmed boarding states. A failed evidence read will produce provider/live-evidence unavailability, clear stale waiting state, retain Details access, and never imply either confirmation or permission to submit. Existing durable boarding records remain recovery inputs rather than proof of current live state by themselves.

Alternative considered: fall back to the persisted boarding record when the provider is unavailable. Rejected because it would violate the evidence-based boarding contract and could disable or enable the action based on stale state.

### 5. Verify at three levels

Focused controller tests will cover scope changes, retries, role/network isolation, reservations, and transient unavailable recovery. Admin component tests will cover shared-controller rendering and category-specific diagnostics. Browser verification will use two distinct real Signet identities, record public profile/address/network evidence, and exercise representative Admin actions without recording recovery phrases or private data.

## Risks / Trade-offs

- [A provider failure remains genuinely unavailable] -> Show the specific safe category and preserve retry/Details paths; do not fabricate balance or boarding state.
- [A scope revalidation disables an operation after the operator prepared it] -> Require a fresh explicit review/confirmation rather than silently retargeting the operation.
- [Admin and Runtime are opened on different origins or builds] -> Report same-origin/session boundaries in diagnostics and verify the served route/version before live acceptance; do not attempt cross-origin wallet synchronization.
- [Existing tests rely on generic unavailable strings] -> Keep stable machine-readable categories and update only the presentation assertions that intentionally change.
- [Current working-tree edits are unrelated or incomplete] -> Implementation must preserve those edits and limit changes to the approved files after the proposal is reviewed.
