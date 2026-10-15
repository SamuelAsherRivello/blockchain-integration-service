## 1. Durable operation model and allocation

- [x] 1.1 Add provider-neutral onboarding state and a versioned parent/two-leg journal in integration Core; verify serialization, account/network/operator scoping, corrupt-record handling and legacy manual-record preservation with isolated tests.
- [x] 1.2 Implement one-time assessment, already-ready classification and frozen 50% allocation; verify zero/insufficient funding, odd sats, individually confirmed deposits, later deposits and completed accounts that subsequently spend all funds.
- [x] 1.3 Add exclusive coordinator ownership and durable submission gates using the shared mutation policy; verify competing tabs, closed attempt gates, storage write failures and late callbacks cannot submit duplicate or obsolete work.
- [x] 1.4 Keep checkpoint locks short and non-reentrant, with observations outside them and timed-out writes quarantined until actual termination; verify with a real queued-lock harness that nested saves cannot deadlock and late writes cannot release guards prematurely.
- [x] 1.5 Make eligible-input selection deterministic and revalidate the complete frozen set at the submission boundary; verify input disappearance, lost confirmation, new competing reservations and changed limits retire only provably unsent drafts, while uncertain submissions retain the original plan for reconciliation.

## 2. Supported settlement route and diagnostics

- [x] 2.1 Add the automatic boarding route in the Arkade adapter using all frozen inputs and no Bitcoin outputs; verify intent shape, input/output conservation, zero fees, dust, expiry and operator-limit rejection before any mutation.
- [x] 2.2 Add attributable first-leg receipt verification and exact-input Bitcoin return construction; verify both legs independently, exact target/remainder, owned destinations, selected-batch correlation, asset/output-index invariants and exclusion of unrelated funds.
- [x] 2.3 Preserve registration failure categories at the original boundary and guard provider, signing, event, persistence and finalization callbacks; verify synchronous and asynchronous errors are caught, sanitized, persisted by leg, and not erased by a successful poll.
- [x] 2.4 Implement final receipt/spendability verification separately from Bitcoin confirmation; verify the temporary first-leg balance cannot complete onboarding, wrong receipts are rejected, and verified final outputs can complete while commitments remain unconfirmed.
- [x] 2.5 Carry over intent-hash and selected-batch event filtering before SDK failure handling; port regressions from the spike settlement-lifecycle tests for earlier/unrelated batch failures, real selected-batch failures, participation acknowledgement versus attempt, and stream startup before registration returns.

## 3. Reservation continuity and automatic recovery

- [x] 3.1 Integrate parent/leg reservations with wallet-reservations and all supported spending paths; verify Bitcoin inputs hand off to intermediate receipts without a spending gap, and unrelated unreserved funds and assets remain protected and usable as appropriate.
- [x] 3.2 Persist final-output handoff and refresh shared payment availability without waiting for Bitcoin confirmation; verify actual payment selection can use released outputs, failed persistence retains holds, and later payment consumption does not regress completed setup.
- [x] 3.3 Implement read-only reconciliation before every resumed transition and automatic continuation of provably unsubmitted legs; verify interruption before registration, between legs, and after receipt observation but before persistence resumes the correct work only.
- [x] 3.4 Implement safe observation retries and bounded replacement only for proven terminal retryable rejections; verify lost registration acknowledgements, timeouts, missing history and unspent inputs never permit replay, and unsupported signing recovery reports a truthful blocker.
- [x] 3.5 Make only attributable intent selection or selected-batch activity renew the recovery watchdog; verify continuous unrelated events cannot postpone timeout, matching progress still renews it after stream priming, and timeout aborts the actual source before awaiting cleanup.
- [x] 3.6 Port supported reload recovery preconditions from the successful spike while retaining BIS journals and reservations; verify delayed SDK disposal prevents replacement connection/signing, original inputs survive reload during signing, response-body hangs are bounded, and provider cooldown floors survive restart.
- [x] 3.7 Protect newly visible intermediate receipts before exact-outpoint persistence by classifying payment candidates against unresolved parents; verify payment/receipt races, quotes created before receipt arrival, unavailable ancestry and independently funded payments across two cooperating contexts.
- [x] 3.8 Make durable completion and final reservation release share one authoritative revision; inject failures before/after persistence and before UI refresh, and replay callbacks to verify no duplicate settlement or timing sample, residual target hold, or premature output release.

## 4. Account lifecycle and observation

- [x] 4.1 Start the coordinator from successful player activation/restoration in context.ts, independently of Balance visibility; verify eligible funding starts work without account-page navigation and normal navigation does not recreate or stop the worker.
- [x] 4.2 Add coalesced healthy five-second checks, bounded read deadlines, failure backoff and event observation where supported; verify no overlapping polling, stream restart does not claim signer restart, and obsolete account/disposal callbacks are ignored.
- [x] 4.3 Integrate new journals with pending-loss counting and existing acknowledged logout cleanup while preserving Admin guards; verify with storage doubles that ordinary reload retains work, explicit logout follows existing semantics and no network cancellation is invoked.
- [x] 4.4 Keep Bitcoin confirmation tracking independent after parent completion; verify neither final spending availability nor completed setup regresses because confirmation is pending, history is temporarily unavailable, or a final output has been spent.
- [x] 4.5 Deduplicate matching progress, preserve monotonic stages and enforce an absolute operator-aware attempt deadline; verify duplicate selection/signing events cannot renew a stall, reordered events cannot erase stronger evidence and timeout never authorizes financial replay.
- [x] 4.6 Stop onboarding polling after setup and required confirmation work finish while preserving other observers; verify reload reconstructs work correctly and completed setup does not bypass a later payment's fresh eligibility check.

## 5. Balance entry and onboarding details

- [x] 5.1 Add the exact three-state Onboarding button immediately above Get Recovery Phrase in Balance and wire details/Back navigation; verify placement, initial unavailable assessment, completed state and preserved manual transfer navigation in UI tests.
- [x] 5.2 Build the five compact CPU/USER stages with current boarding address, Copy, minimal Signet faucet search URL and fixed-50% explanation; verify no manual fauceted or transfer-start action is required and no spike reset or recovery-secret controls are copied.
- [x] 5.3 Render immediate local operation progress and account/leg-scoped transaction cards; verify no fabricated IDs, one confirmed plus one unconfirmed deposit, separate settlement confirmations, stale account responses and no prior-account cards.
- [x] 5.4 Add nonblocking recovery copy, last successful verification, next expected event and expandable diagnostics/timing; verify the page stays navigable during errors, normal foreground dialog behavior remains intact, and partial/late-start measurements cannot enter any displayed average.
- [x] 5.5 Record registration, participation acknowledgement, finalization, final spendability/release and Bitcoin confirmation as separate milestones; verify sample counts and recovery markers, distinguish recovery-inclusive cohorts from uninterrupted averages, and do not import the spike's 12m 30s total as a BIS deadline or use a seconds-only estimate for block confirmation.
- [x] 5.6 Show the actual next-check countdown, last verified time and current recovery condition without historical errors overriding current progress; verify provider cooldown changes update the schedule and countdown expiry never marks an operation complete.

## 6. Regression and real Signet acceptance

- [x] 6.1 Run npm test and npm run build from the repository root; verify existing manual boarding/recovery, reservation, asset, context and payment regressions pass alongside the new onboarding tests, and record any pre-existing unrelated failures separately.
- [ ] 6.2 Verify the actual BIS demo in a browser with an unfunded account, funding detection, mixed transaction confirmations, account switching, multi-tab observation and navigation during work; capture public-only evidence under output/screenshots/automatic-bis-onboarding and confirm no account-page visit is needed to initiate onboarding.
- [ ] 6.3 Complete a fresh automatic zero-fee BIS Signet onboarding through both legs on a stable served build; record loaded SDK/build version, frozen amounts, public commitment IDs, exact Bitcoin return and final Arkade receipt in a verification artifact. Do not edit served source based only on a prior idle snapshot. Keep this task open if real evidence is missing; spike results do not satisfy it.
- [ ] 6.4 Use the final Arkade target in a normal explicitly requested BIS payment and verify the real receipt without an onboarding-imposed wait; record whether Bitcoin confirmation was still pending and retain deterministic before-confirmation coverage regardless of live block timing.
- [x] 6.5 Update X7 and delivery documentation with verified supported behavior, unresolved operator limits and rollback/recovery instructions; run openspec validate add-automatic-bis-onboarding --strict and keep historical manual-operation/cancellation acceptance distinct from this delivery.
- [ ] 6.6 Run separately labeled live recovery cases for reload during signing and restart between legs; verify automatic recovery without reset, extra funding or recovery clicks where supported, exact original-input/final-output attribution and no duplicate submission. Preserve full elapsed times including interruption and distinguish these cases from the ordinary stable-build run.

Implementation evidence and supported recovery limits: [verification.md](verification.md). Live acceptance tasks 6.2–6.4 and 6.6 remain open until real BIS funding, settlements and spending are observed. Local journal writes are synchronous; their short critical sections cannot outlive an artificial promise timeout. Timed SDK operations retain signer ownership through actual termination instead.
