## Context

See proposal.md for motivation. AccountAssets currently owns confirmation, calls onBurn once, and keeps burning true until onRefresh finishes. Its usePendingNotice combines burning and Assets loading, while AssetIcon independently registers image loading. client.tsx wires context.burnAsset and the busy state. Core burnAsset preserves account-generation checks and the wallet mutation lock and returns either burned with a transaction ID or a safe error. The shared toast queue already supports info/success, FIFO and context lifetime handling. Existing pending-operation-host tests explicitly require Burning... through refresh and must change.

The user explicitly reconfirmed keeping Are you sure? before submission. This change supersedes only the burn-progress portion of the 2026-09-04 pending-dialog decision. Other dirty files and active changes remain outside this proposal. No new SDK capability is required or claimed; existing live burning is user-reported working, not reverified in this planning turn.

## Goals / Non-Goals

**Goals:** Separate burn feedback from covering progress while retaining the existing confirmation and operation protections; make post-burn refresh and optional image preparation unable to recreate the removed overlay.

**Non-Goals:** Alter SDK burn, quantity validation, persistent intent, reconciliation, error acknowledgment, public wallet types, unrelated loading prompts, or toast timing globally.

## Decisions

1. Keep runtime burn notifications at the explicit UI action boundary, connected to the existing context toast entry point through client.tsx. Capture attempt identity and account generation, emit pending once after OK and success once for burned, before awaiting refresh. Avoid adding notifications to every headless burnAsset call or render effect, which would expand scope or replay messages.
2. Keep per-attempt in-flight protection and current wallet mutation guards independently of overlay state. Preserve existing local busy controls for this small change; host gameplay remains usable because no burn backdrop makes the runtime inert. This avoids introducing navigation/recovery redesign merely to remove a spinner.
3. Distinguish burn-origin refresh from ordinary initial loads. Suppress its progress registration, including image readiness registrations for the refreshed view; use the existing data retry policy and safe image fallback. Do not globally remove AssetIcon or Assets loading prompts. This is necessary because removing only Burning... would otherwise expose Loading... in its place.
4. Preserve error registration separately from pending visibility. Unknown outcomes use the existing explanatory OK dialog and durable lock. Refresh errors remain read errors after an already confirmed burn; they cannot trigger another submission or turn verified success into an uncertain burn.
5. Use text-only default-duration messages Asset burn (Pending) and Asset burn (Confirmed), info and success respectively. A normal short pending toast avoids a new persistent-toast lifecycle. Confirmation describes the current burned result, not chain settlement. The wording is a proposed minor default; the confirmation-before-burn behavior is explicitly confirmed by the user.

## Risks / Trade-offs

- [A separate loading registration recreates the overlay] → Test delayed holdings refresh and uncached or failing artwork through production UI.
- [Fast results or effect replay duplicate feedback] → Emit from the single action path, guard each attempt and verify FIFO with immediate completion.
- [A late callback reports for a replacement account] → Preserve context/account generation checks as well as component lifetime checks before notification and refresh.
- [Pending toast expires during a slow operation] → Keep burn actions guarded after toast exit; do not equate notification duration with operation lifetime.
- [Parallel toast changes drift] → Use the current four-type API and limit edits to burn producers and their delta requirements.

## Migration Plan

Apply UI/wiring changes and focused tests, then update affected README descriptions and the later-decisions document. No data migration or new dependency is required. Verify the production UI in an isolated browser fixture without real burn submissions. Store screenshots/reports under output/screenshots/burn-toasts/ or output/reports/burn-toasts/. Any live verification must be separately identified and must never be replaced with a simulated production result. Rollback, if needed, is an additive follow-up restoring the prior presentation without altering wallet records.


## Event-driven asset observation (user-requested during apply)

The installed SDK exposes RestIndexerProvider.subscribeForScripts/getSubscription/unsubscribeForScripts and ArkAddress receive/subdust scripts. Subscribe through a transient readonly wallet; events for new, spent and swept outputs trigger a fresh read. One initial read after subscription closes its setup gap. Core owns coalescing, account/session invalidation and background state, and no periodic timer requests assets. Remove asset refresh from the existing periodic payment-history callback; local successful mutations still notify it. Stream failure leaves manual Refresh/reopen available. The current single-identity account address model is covered; no HD or custom-contract wallet capability is claimed. Existing node_modules declarations and implementation were inspected; live subscription delivery remains unverified.
