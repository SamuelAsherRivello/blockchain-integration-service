## Context

See [proposal.md](proposal.md) for motivation and scope. Inspection on 2026-09-09 used the current working tree, including earlier uncommitted spike improvements. This is a standalone JavaScript/Vite app consumed by both the port-5186 entry and the demo's `/spike1/` entry; it does not use BIS wallet services.

### Observed behavior and gaps

| Area | Existing safeguard | Gap found in current code |
| --- | --- | --- |
| Bootstrap / Step 1 | Encrypted identity and isolated window database | `window-runtime.js` awaits ownership/storage before `main.js` installs error listeners. Rejected initialization can prevent the app from rendering. `start()` reports connection failure but schedules no reconnect. |
| Step 2 | Copy address, explicit faucet navigation, automatic deposit observation | Opening the faucet starts timing even when a popup fails. Clipboard fallback exists, but funding and external-faucet failures have no consistent step-level diagnosis. |
| Step 3 | Five-second checks; stale-account check in `refreshIncoming()` | No app deadline for its `Promise.all`; a hanging member leaves `incomingBusy` true. History and UTXO reads overlap with workflow reads. |
| Step 4 | Fresh Signet/fee/amount checks and frozen inputs before settlement | A snapshot is saved while phase remains `idle`; a preparation error can let a later tick recapture a changed input set. Validation errors are repeatedly rediscovered without a durable blocked checkpoint. |
| Step 5 | Signing lease, automatic transient retries, exact-input recovery, lost-acknowledgement reconciliation | Error classification is a short name allowlist. Guarded callbacks log and swallow failures. The five-minute stream watchdog does not cover every request or stuck cleanup; successful unrelated events can keep a stream alive without stage progress. |
| Step 6 | Confirmed input spend, exact Bitcoin return, linked spendable receipts | Reconciliation waits for all balance/coin/tip/info reads and history, even when some are not needed in the current phase. Initial `tick()` must finish before the refresh interval is installed. |
| Persistence / restart | Atomic encrypted-account archive and replacement; identity guard | `save()` mutates memory before the write completes. Network work runs inside the operation lock. Failed preference writes after restart's durable commit can skip reload; restart's failure path has already stopped its timer. |
| Timing / tests | Elapsed total plus step averages; settlement lifecycle tests and window tests | No leg/request/backoff/handoff breakdown. Existing VM fixtures bypass the real bootstrap and storage; the signing test lock double is not a real queued lock. |

Installed `@arkade-os/sdk` resolves to root `node_modules`, version **0.4.71**. Its declarations expose `notifyIncomingFunds`, `onchainProvider.watchAddresses`, `RestArkProvider.onServerInfoChanged`, and `dispose()`. The explorer watch documents WebSocket-to-polling fallback. `getInfo`, `getCoins`, and the underlying SDK fetch implementation inspected in `dist/chunk-2ZX4Z2IP.js` and `dist/chunk-E5JNYFOF.js` provide no general request deadline; ordinary provider methods do not accept an AbortSignal. The settlement event stream does accept a signal. The [official SDK repository](https://github.com/arkade-os/ts-sdk) is the upstream reference; implementation must target the installed declarations, not assume the latest default branch matches them.

A read-only request to the [Signet operator info endpoint](https://signet.arkade.sh/v1/info) on 2026-09-09 returned `network=signet`, `txFeeRate=0`, empty intent-fee fields, minimum UTXO 330 sats, and minimum VTXO 1 sat. It supplied no `roundInterval` value in that response. This confirms the current zero-fee premise only; refresh constraints before signing. No faster batch cadence or new transaction shape was demonstrated during planning.

The README records three funded acceptance examples, including two 33,333-sat allocations yielding 16,666 Arkade sats and 16,667 Bitcoin sats. The earlier browser check showed a last observed total of 21m 11s; the user reports four recent successes. These are observations with different provenance, not a reconstructed four-run dataset. Per-leg latency must be measured before attributing the twenty-minute duration.

## Goals / Non-Goals

**Goals:** Keep the existing transfer/evidence model while making each asynchronous boundary recoverable or explicitly paused; distinguish durable truth from presentation; bound concurrent work and client handoff delays; make future timing decisions evidence-based.

**Non-Goals:** Implement production BIS onboarding, change its separate proposal, reduce confirmations, change the 50% default, automatically fund from a faucet, migrate to a new operator, implement exits/nonzero-fee support, or promise progress while the browser is closed or dependencies are permanently unavailable.

## Decisions

### 1. One step coordinator with explicit recovery outcomes

Extract orchestration from `main.js` into a small coordinator with injected clock, storage, and provider ports; keep UI rendering outside critical transitions. Each boundary reports an allowlisted operation label, step, phase/leg, and outcome: `retry-read`, `retry-preparation`, `reconcile`, `wait-external`, or `pause`. Keep the existing financial phases compatible and add a durable `prepared` checkpoint so successful input capture cannot be silently replaced after a preparation failure.

| Failure class | Proposed action |
| --- | --- |
| Timeout, offline, temporary HTTP failure during safe work | Retry after 5, 10, 20, 40, then 60 seconds, with up to 20% positive jitter; persist retry state. |
| Rate limiting | Respect Retry-After/provider cooldown even when it exceeds the normal cap; suppress duplicate notification/manual-refresh triggers. |
| Uncertain submission or known transient signing failure | Reconcile first; retain existing 30-second exponential recovery delay capped at five minutes, with positive jitter, and retry only through the existing SDK recovery authorization after cleanup. |
| Unknown error in provably read-only/unsubmitted work | At most three diagnostic rechecks, then pause with safe reason/context; successful validation permits continuation of the same checkpoint. |
| Unknown error after submission could have started | Continue bounded read-only reconciliation; do not classify it as retryable signing just because its name is unfamiliar. |
| Changed server digest/configuration | Refresh and revalidate the original inputs against current info; never blindly replay a request built with old configuration. |
| Invalid proof, network, fees, amount, expiry, identity/storage integrity | Persist a paused reason; continue safe observation where useful, resume only after the blocking condition is explicitly revalidated. |
| Optional timing, preferences, rendering or clipboard failure | Report locally; keep the financial workflow independent. |

Normal Bitcoin confirmation or faucet waiting is not an error and consumes no retry budget. Healthy observation alone does not reset a failed signing attempt's backoff. A completed checkpoint resets only its own retry policy. `navigator.onLine` is a scheduling hint, not proof of connectivity. Online/visibility/pageshow signals coalesce a fresh read and retain retry/rate-limit floors.

Alternative rejected: retry every thrown error indefinitely. It would amplify programming defects and repeatedly submit invalid or ambiguous requests. A safe visible pause is the fallback when automatic progress cannot be justified.

### 2. Bootstrap first; bound real work rather than only a UI promise

Add a minimal bootstrap entry that renders a loading/error shell, installs resource/error/rejection listeners, then dynamically imports initialization. Move window/database setup out of top-level awaited exports into explicit retryable functions, so a failed module evaluation does not permanently poison initialization retries. Required capability failures preserve the original URL and storage; optional diagnostics never become a boot prerequisite.

Proposed defaults: 10-second database-open deadline, 10-second storage-transaction deadline, 10-second short lock-acquisition deadline, and 30-second nonstream HTTP request/body deadline. Show the responsible dependency when exceeded. Abort queued lock requests; do not steal held leases. Observe IndexedDB blocked, error, abort, versionchange, and late-open success; close a connection arriving after its attempt was abandoned. A timed-out write is uncertain until its transaction outcome or durable readback resolves it, not permission to repeat identity creation.

Because installed provider methods lack general signal injection, install a narrowly scoped transport wrapper in the dedicated spike document before SDK initialization. It delegates to the native fetch, covers only configured SDK provider origins, preserves Request/init semantics and caller abort signals, and applies deadlines through body consumption. Streaming endpoints remain under the existing stream lifecycle policy. It records only operation categories, duration, HTTP status and Retry-After, never bodies or full request URLs. It does not retry HTTP mutations. A timed-out mutation is an uncertain submission and follows reconciliation. Do not install this wrapper in the main BIS demo document or alter node_modules. Tests must verify nonmatching requests are untouched and the wrapper is installed only once.

Keep short network-free critical sections: take a checkpoint/revision under lock, read network data outside the lock, then reacquire and validate account/revision/freshness before saving or submitting. Coalesce observation work, retaining at most one active attempt and one follow-up per dependency. If an SDK operation cannot be cancelled, quarantine its late result and do not accumulate replacements; an unresponsive signer/cleanup remains a visible signing pause with independent observation. Startup retries dispose failed/late wallet instances before activating another. The refresh scheduler starts independently of the initial network read.

Retain the existing five-minute stream inactivity watchdog initially. Add stage-progress timestamps and distinguish event activity from meaningful progress. At a progress deadline, reconcile and report; do not tear down an active batch solely because a local estimate expired. Tune actual cancellation deadlines only with evidence that the chosen stage is safely recoverable.

Alternative rejected: `Promise.race` around `settle()` followed by a new `settle()`. A rejected UI promise would leave the original signer alive.

### 3. Durable checkpoints and fences control progression

Build the next operation value locally; commit it in IndexedDB; only then publish it to the coordinator. Persist a schema version, monotonic revision, window/account identity, frozen input snapshot, percent/target, leg, attempt key, retry state, and safe last-checkpoint metadata. Optional timing writes run after commit and outside operation locks.

All network and SDK callbacks capture `{windowId, accountId, revision, attemptKey, leg}`. Compare the relevant identity and attempt fields before applying a result; concurrent observation revisions require revalidation rather than blindly overwriting a newer transition. Critical callbacks propagate a persistence failure to the coordinator's uncertainty handling even if the SDK does not await callback promises. Presentation callbacks remain guarded and nonblocking. Distinguish observed acknowledgements from durable ones; if a critical write fails after a mutation, pause further signing and reconcile after storage recovery.

Restart remains a confirmed, always-enabled user action. Separate durable archive/replacement from best-effort preference reset. If the archive/replacement succeeded, reconnect to that identity even if preferences or timing fail. If its outcome is unknown, read it back before permitting another restart commit. If it failed, resume the old account's scheduler. Old callbacks must not write the new operation. Archiving does not cancel the old operator-side transfer.

Alternative rejected: resetting to idle, clearing all state, or recapturing inputs on every error. Those approaches can change the user's selected transfer and hide a pending result.

### 4. Events request fresh evidence; phase-specific reads reduce latency

Use one managed incoming-funds subscription per wallet and the existing settlement events/completion promises to schedule immediate coalesced observations. Reconnect/dispose subscriptions with the wallet lifecycle. Retain a five-second healthy polling fallback because a notification may be lost or may report new funds without confirmation changes. Provider errors use backoff rather than continuing the healthy cadence.

Split readiness evidence from optional full-history presentation. Deduplicate equivalent in-flight reads within an observation generation and use the SDK's own live connection state. Do not substitute cached data for required fresh validation. Before a new submission, revalidate current inputs, fee/limit/network configuration, and account revision. For later phases, request the exact transaction/receipt evidence needed; optional balance or history formatting cannot gate a transition. Fetch independent evidence concurrently. Revalidate after an invalidation event instead of reusing an earlier generation.

After a signing promise has terminated, immediately request reconciliation, then prepare the next leg as soon as its original attributable inputs are eligible. Target less than one second of client scheduling delay after evidence validation in a responsive foreground tab. Missing notifications still progress within the normal five-second check interval plus request duration. Already-running healthy settlement is not restarted to try to enter a quicker batch.

Alternative rejected: polling every few hundred milliseconds. It raises load across n windows and cannot make blocks arrive sooner. Provider switching is also excluded: another operator is not a recovery endpoint for this operation.

### 5. Keep Step 6 honest; measure the critical path

Keep the existing `verifiedReceipt` confirmation predicate. Add a separate observed milestone for the exact attributable final target being spendable; it requires final-leg identity/input linkage and exact amounts, not merely an equal wallet balance. Until required confirmations exist, display "Target funds spendable; waiting for Bitcoin confirmation" and keep total completion timing active.

Extend timing records additively with named event timestamps, observation/request durations, retry count and delay, and browser lifecycle gaps. Include account-ready, faucet-open requested, deposit-first-observed, eligible-funding, prepared, and for each leg registration, batch stages, commitment observed and confirmation observed; also target-spendable and fully-verified. Deduplicate repeated events and recover timing from durable checkpoints when possible. Preserve old samples as legacy totals without manufacturing missing breakdowns.

Report external waits and client handoffs without double-counting overlapping requests. A hidden tab is not proof the browser was suspended; an unexplained observation gap stays labelled unobserved. Record client-observed timestamps separately from chain block times and unavailable operator times. Show total sample count, median/range of comparable completed runs, last observed duration, and incomplete/recovering outcomes. Separate 100% full-board runs from two-leg percentage runs in comparisons.

The likely safe gain is seconds of normal polling/handoff overhead and potentially minutes lost to faults or unnecessary retry waits. Missing a batch boundary could make seconds valuable, but that is a hypothesis to measure. Skipping the return leg would change allocation; skipping confirmations would change completion. Neither is part of this proposal. The separate BIS proposal can use the new spendability measurement to quantify its different readiness definition.

### 6. Verification targets actual boundaries

Extend focused coordinator tests with fake time and queued Web Locks, but also test real bootstrap/storage paths in a browser or realistic IndexedDB environment. For every asynchronous boundary inject: a single rejection, repeated transient failures, never-resolving work, a late success after timeout, and a late result after restart. For mutations additionally inject before durable save, after durable save/before call, after server acceptance/before acknowledgement, and after acknowledgement/before local save. Cover both settlement legs and full-board mode.

Assert exact frozen inputs/target, no concurrent signer, no completed-leg replay, rate-limit compliance, bounded outstanding requests/listeners, durable reload behavior, usable error states, and redacted diagnostics. Keep simulation confined to isolated tests; production UI must not simulate financial success.

For performance, replay identical event timelines before/after and compare client transition delays and provider call counts. Require no increase in redundant read calls and no deliberate poll wait after eligible events. The user's later acceptance instruction selects the four funded 50% runs recorded in task 6.3: monitor those exact accounts, fix observed failures, and accept once all four verify Step 6. Do not deliberately interrupt those runs. Reload/connectivity fault injection remains a separate part of the broader test matrix. Retain exact sats, both public commitments, error/retry counts and timing breakdowns. Test funding remains user-directed. Record incomplete runs and infrastructure blockers honestly; live acceptance stays unchecked until the evidence exists. Four successes are a regression check, not a probability guarantee.

## Risks / Trade-offs

- [Timeout too short during a slow valid response] → Configurable tested defaults, rate-limit-aware backoff, body-aware cancellation, and uncertainty handling for mutations.
- [Transport wrapper changes SDK request behavior] → Restrict it to the standalone document and configured origins; preserve caller semantics; exercise current SDK integration paths and both Vite entries.
- [Cancelled HTTP request still succeeded server-side] → Preserve attempt context, wait for signer cleanup, and reconcile original inputs before SDK recovery.
- [Optional diagnostics fail while recording an error] → Bounded in-memory fallback and minimal DOM status; no recursive error-reporting loop or dependence on diagnostic persistence.
- [Browser throttling or closure prevents timers/signing] → Persist checkpoints and deadlines, reconcile on resume, and label wall-clock gaps; no background-execution guarantee.
- [Migration or overlapping changes overwrite existing behavior] → Additive record evolution and this spike's own namespace; maintain auto-onboarding, confirmed always-enabled Restart, isolated windows, and current URL semantics.
- [Faster-looking averages hide failed runs or changed confirmation time] → Include incomplete outcomes and comparable route cohorts; separate synthetic handoff tests from public live evidence.

## Migration Plan

1. Introduce versioned optional coordinator/recovery/timing fields without deleting existing identity, account archives, operations, or timing history. Treat existing pending attempts without enough metadata conservatively as requiring reconciliation. An idle legacy record with frozen inputs must be inspected and retained, not recaptured automatically.
2. Route both spike entries through bootstrap; verify legacy first-window ownership, independently opened windows, reload and BFCache behavior. Keep `btcAddress` as public display metadata, never identity input.
3. Enable the coordinator under the existing automatic flow, then notifications and timing breakdowns. Preserve the current financial receipt tests throughout.
4. If rollback is required, pause new signing and retain new-format pending operations for the compatible reader/recovery path. Do not load an older writer against an unknown/new financial phase, discard snapshots, clear storage, or reset funds to obtain a clean run.

## Open Questions

- What portion of comparable live run duration is final Bitcoin confirmation versus operator batches? The specified instrumentation resolves this; no latency promise depends on the answer.
- Which notifications reliably accompany confirmation changes on the configured Signet explorer? The five-second fallback is required regardless, so this only tunes the measured event path.
- Does five minutes remain an appropriate inactivity threshold for each operator signing stage under load? Retain the existing threshold until stage evidence supports a change; a shorter threshold is not an assumed speedup.
