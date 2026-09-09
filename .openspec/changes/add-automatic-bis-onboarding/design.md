## Context

See `proposal.md` for motivation and scope. BIS already has durable profile-scoped transfer records, a registration boundary, selected-batch correlation, session workers and shared reservations. Its `context.ts` currently ties balance fetching to visible account pages; automatic onboarding requires an account-lifecycle owner instead. The spike's simpler global state is not suitable for reuse.

Current `arkade/boarding.ts` quotes partial onboarding with `Ramps.onboard(..., requestedAmount)`. The captured operator source in `output/reports/boarding-debug/operator-service.go` rejects onchain inputs combined with onchain outputs. The spike demonstrated 12,000 sats boarded and 6,000 returned through separate zero-fee Signet settlements. This is bounded evidence for the route, not proof of reliability for new BIS execution, arbitrary fee schedules, or interrupted signing. Both packages currently declare SDK 0.4.71; actual loaded SDK and operator behavior must be recorded during live acceptance.

Current specs prohibit automatic signing during inspection, require manual transfer confirmation, and use confirmed Bitcoin receipts for manual withdrawal completion. This change introduces a narrowly named automatic-onboarding exception. Generic SDK automatic settlement stays disabled. Manual transfer, cancellation and Admin acceptance remain independent.

The [H1 post-mortem and three-run follow-up](../../../BIS/documentation/User%20Story%20Diagrams.md#h1-three-run-robustness-follow-up), recorded 2026-09-09, add stronger recovery evidence:

| Frozen Bitcoin | Exact spendable Arkade | Exact Bitcoin return | Step 5 | Total through spike Step 6 |
| ---: | ---: | ---: | --- | --- |
| 45,242 sats | 22,621 sats | 22,621 sats | 2m 25s | 12m 30s |
| 33,333 sats | 16,666 sats | 16,667 sats | 2m 25s | 12m 32s |
| 11,111 sats | 5,555 sats | 5,556 sats | 2m 25s | 12m 28s |

All three reached Step 6 with original inputs and exact receipts; both shared commitments confirmed in Signet block 321342. All recovered automatically after a development reload during signing, without account recreation, extra funding or recovery clicks. The recorded final verification was 89 spike tests and both production builds passing. This is existing post-mortem evidence, not tests or explorer checks rerun during this planning update.

The total mean is (750 + 752 + 748) / 3 = 750 seconds, or 12m 30s. Step 6's extra final confirmation/receipt verification took 3m 42s each. That interval is not a measured BIS saving: the exact first-spendable timestamp was not recorded. The three share settlement batches and include reload recovery. Their 2m 25s Step 5 versus the earlier cohort's 26m 58s is an observed 24m 33s difference, not a controlled speedup; the earlier interval includes failures and live investigation.

## Goals / Non-Goals

**Goals:** One durable parent operation, provable transitions between two settlements, account-scoped background observation, and one shared definition of final funds usable by ordinary payment paths.

**Non-Goals:** Continuous rebalancing, configurable percentages, arbitrary-fee routing, repairing all historical operations, silently migrating manual transfers into automatic work, resuming cryptographic sessions without a supported safe path, or executing when the browser is closed. The spike reset and plaintext recovery controls do not enter production UI.

## Decisions

### 1. Own execution in Core for the active player account

Add an onboarding coordinator beside the existing session transfer worker. `context.ts` starts it after successful activation/restoration and invalidates its account generation on replacement, logout or disposal. Closing Balance or switching preview stories does not stop its worker. Public state is provider-neutral status/progress; SDK types and signing remain in the adapter.

Use an account/network/operator-scoped Web Lock and durable owner generation for financial transitions. Revalidate ownership at every external mutation boundary. A second tab observes the journal; it cannot submit either leg concurrently. If exclusive ownership or storage durability cannot be established, inspect only. Old callbacks cannot mutate a new account or register after a closed attempt gate.

Rejected alternative: starting from the details component, which would delay onboarding until navigation and recreate workers on remount.

Keep long-lived worker ownership distinct from short checkpoint mutation locks. Never reacquire a non-reentrant checkpoint lock from a save call already inside that lock. Perform network observations outside checkpoint critical sections, then reacquire and revalidate account/attempt ownership before committing results. The spike reproduced a real nested-lock deadlock; tests must use a queued lock implementation rather than a permissive lock stub. A timed-out storage transaction remains quarantined until its actual completion; timeout alone cannot publish success or release its write guard.

### 2. Freeze a one-time 50% plan at the first valid eligible snapshot

On activation, load the scoped journal before selecting funds. A complete record remains complete after later spending; this records completed setup, not a promise that the account always has a positive balance. Without a record, freshly verified unreserved spendable Arkade funds can establish `already-ready` with no invented boarding history. Existing unresolved records are reconciled first and never reclassified solely from a total balance.

Otherwise observe deposits to the active account's derived boarding address. Unconfirmed deposits are visible immediately, individually. Once eligible confirmed, unexpired, unreserved inputs support the complete route, freeze their exact outpoints and amounts. Let `T` be their sum, `A = floor(T / 2)` the Arkade target and `B = T - A` the Bitcoin return. Unconfirmed funds and later deposits are excluded. Do not wait for every deposit to confirm when a valid eligible snapshot already exists.

Validate zero fees, both output minima, expiry margins, conservation and operator limits before boarding. Too-small funding waits for more funds with an explanation; unsupported fees/limits pause without substituting a different allocation. Once submission may have occurred, the frozen plan never changes. Returned Bitcoin is excluded from automatic reboarding, including after reload.

Define the selection deterministically: take all confirmed eligible unreserved boarding inputs returned by the same complete assessment, sort by outpoint for stable comparison, and freeze that set under the mutation lock. Do not quietly choose a smaller subset to fit operator limits. Immediately before the first submission gate, revalidate the exact inputs, amounts, confirmation/expiry, reservations and policy against fresh evidence. If the snapshot is invalid while registration is still provably impossible, retire the unsent draft and reassess automatically. After `submitting`, preserve the frozen plan and reconcile any change; a disappeared input or lost confirmation is not proof of failed submission. This avoids both stale-input spending and a permanently stuck unsent draft after ordinary funding changes.

Rejected alternatives: recomputing from total balance each tick (changes the promise), automatically halving later deposits (not account setup), or relying on the SDK quote as operator acceptance proof.

### 3. Journal a parent and independently durable legs

Add a versioned public operation record scoped to profile/network/operator, containing parent ID, allocation policy/version, frozen inputs and amounts, owned destination references, completion evidence and two leg records. Each leg records its exact inputs/expected outputs, attempt ID, phase, intent/batch/commitment identifiers when known, sanitized diagnostics, observations and timestamps. Store no recovery material, signed proofs or nonces.

Parent phases are awaiting-funding, awaiting-eligible-funds, boarding, returning, verifying-spendability and complete. A separate observation/execution condition reports checking, running, recovering or blocked without erasing financial evidence. Each attempt progresses prepared → submitting → registered → receipt-verified, or authoritative terminal rejection. Persist and verify `submitting` before the registration call; a failed write forbids that call.

Leg 1 boards all `T` to owned Arkade outputs, with no Bitcoin outputs. Verify exact input ancestry and owned receipts. Under the same mutation policy, hand reservations from consumed Bitcoin inputs to those receipts. Leg 2 uses only these receipts to return `B` to the same Bitcoin boarding address and leave `A` in owned Arkade change. Preserve asset metadata and output indexing checks even though newly boarded receipts are expected to be asset-free. Never add an unrelated asset-bearing input to make the route work.

Use the proven direct settlement shape for this exact return; do not silently invoke an additional withdrawal-preparation route. Existing manual preparation remains separate. Any adapter incapable of constraining inputs pauses before mutation.

Close the gap before receipt persistence as well as the handoff itself. The current shared reservation reader enumerates known input outpoints; a newly visible first-leg output is not protected by its spent Bitcoin input's reservation alone. Every mutation path must reconcile/classify candidate outputs against unresolved onboarding parents before selection, under the shared account mutation policy. Persist the parent's expected output ownership and ancestry constraints before submission. Until verified receipt handoff, exclude any candidate that could be an intermediate receipt; allow only candidates proven independent. If evidence cannot distinguish them, explain the affected hold rather than allowing an SDK-spendable aggregate to override it. Recheck at submission so a payment quote obtained before the receipt appeared cannot bypass this protection.

### 4. Complete on verified final spendability, independently of confirmations

The automatic parent completes only when leg 2's authoritative commitment/receipt evidence proves the exact frozen input spend and Bitcoin destination/amount, and fresh SDK evidence identifies owned final Arkade outputs totaling `A` as spendable (excluding recoverable/unrolled/expired funds). Under the shared mutation lock, durably save the verified handoff and release onboarding holds on those final outputs. Then refresh ordinary payment availability. This transition does not require either Bitcoin commitment to have a block confirmation.

Do not reuse manual `succeeded` or `liveBoardingState` as the parent predicate: they currently mix completion with Bitcoin confirmation. Keep separate fields for setup complete, leg transaction confirmation and current payment eligibility. The temporary `T` receipt from leg 1 stays reserved and cannot satisfy completion. Unrelated Arkade funds cannot satisfy this parent's `A` receipt predicate.

After durable completion, a payment can consume the final outputs; later reconciliation uses recorded receipt/descendant evidence rather than requiring them to remain unspent. A later spend or unavailable balance read does not restart onboarding. An outstanding Bitcoin confirmation tracker cannot reserve the final Arkade target or globally disable payments. Initial final evidence unavailable means Pending, with verification unavailable, never inferred Complete.

Use one durable revision as the source of truth for final completion and reservation release. Reservation projections must derive from it or verify they have consumed the same revision, rather than depend on two independent writes finishing together. Repeating a completion callback or replaying reconciliation is idempotent. If the durable transition succeeds but the UI update fails, reload reconstructs Complete and the released target without another settlement. Post-completion payments still require fresh eligibility: unavailable or invalidated network evidence can block an individual payment without resetting setup or automatically onboarding again.

### 5. Recover automatically only at proven safe boundaries

Observe funding and known transactions every five seconds while healthy, coalescing requests with no overlap. Prefer existing SDK events for timely progress. Give reads bounded deadlines, retry with backoff (5, 10, 20, 40, then 60 seconds with jitter), and restore normal cadence after success. Closing an event stream restarts observation; it does not prove signing resumed. Session signing deadlines remain operator-schedule-aware.

Correlate events at the adapter boundary before the SDK can treat unrelated batch failures as this intent's failure. Select a batch only when its intent hashes contain the current registered intent; retain that selected batch ID for progress and failure checks. Ignore failures belonging to earlier or other batches, including previous attempts on the same input topics. A real selected-batch failure still reaches recovery. Operator “intent confirmations” means participation acknowledgements in this failure category, not Bitcoin block depth; diagnostics distinguish an acknowledgement attempt from a received acknowledgement.

Renew the progress watchdog only upon selection of this intent or activity attributable to its selected batch. Unrelated stream traffic cannot defer the deadline, and an idle stream cannot evade it. Start with a bounded wait before selection; support the stream being primed before registration resolves. The spike's five-minute watchdog regression was reproduced in tests, not observed as a five-minute stall in the successful three-run cohort. Retain operator-aware budgets rather than treating five minutes as a universally correct BIS deadline.

Attribution is necessary but not sufficient for renewal: deduplicate replayed events and require a new acknowledged action, stage, or protocol progress identifier. Repeated selection, heartbeat, or identical signing events cannot renew the progress deadline. Keep an absolute attempt deadline derived from the operator session budget as a second bound, so apparently matching traffic cannot extend execution indefinitely. Out-of-order lower-stage events never erase stronger evidence. Timeout still means stop local execution and reconcile, not proof of terminal financial failure.

On timeout, close/abort the actual event source and await the old signer and SDK cleanup before another worker or wallet connection can start. An unresolved cleanup retains ownership protection while its status remains inspectable. Transport deadlines include response-body consumption and caller cancellation. Observation backoff does not override provider Retry-After floors or the separately persisted cooldown for settlement recovery; shrinking all delays is not a fix for incorrect batch attribution.

On restart, reconcile before any mutation. A leg durably proven never submitted can continue automatically under the original fixed plan. A definitive operator rejection permits a bounded new attempt only when evidence proves it could not have registered or later settled and the cause has cleared. Unsupported shape/fee failures do not spin in retries. Preserve attempt history.

Missing registration response, elapsed time, missing history, unspent inputs or SDK cancellation labels are not terminal proof. These remain reserved while observation retries. Interrupted signing can resume only using a proven exact-operation path with valid retained session state; otherwise reconcile and report the actual blocker. There is no general-purpose automatic re-registration or cancellation fallback.

Treat recovery after a document reload as a separate boundary from in-session signing continuation. The spike demonstrated SDK-supported recovery tied to the original frozen inputs and verified operation evidence after prior cleanup, without preserving old ephemeral signing state. Port the proven recovery preconditions and reconcile receipts before invoking that supported path; never resume stale nonces or assume a reload proves terminal failure. Add a dedicated reload-during-signing acceptance case, rather than covering only an unsubmitted second leg.

**Implementation recovery policy:** After the user instructed implementation to continue, this delivery retains BIS's conservative recovery contract. Observation restarts automatically, and a next leg durably proven never submitted continues automatically. Ambiguous submitted attempts remain Pending with their original inputs reserved. The spike's `deleteIntent` plus re-registration fallback is not enabled: its successful reload cohort does not prove terminal finality or exact-operation signing continuation. The installed SDK offers no demonstrated safe replacement protocol for this case. A signing reload is therefore a reconciliation case, not a promise that the original signer can resume.

New Arkade receipts arriving after first-leg verification remain conservatively held until return attribution resolves. Previously verified independent Arkade receipts and newly independent Bitcoin UTXOs remain selectable; receipt ancestry that cannot exclude the return leg cannot release funds early. This deliberately favors safety over concurrent spending of newly received Arkade funds during an unresolved return.
Guard callbacks at provider, signing, event, persistence and worker-finalization boundaries, including rejected async handlers. Preserve stage, safe error code, attempted/acknowledged action, SDK version and validated public IDs. Do not persist raw messages or payloads. A successful poll updates verification freshness without deleting a prior execution error.

### 6. Present a compact inspection page

In Balance, place the exact onboarding button directly above `Get Recovery Phrase`; preserve access to manual transfer elsewhere. Display Start? only after a verified funding-needed assessment, Pending for checking/funding detected/active/recovering/blocked work, and Complete for durable completed setup or verified already-ready. On first read failure use Pending with unavailable detail rather than imply no funds exist.

Details have five compact stages: CPU Account ready; USER Fund account; CPU Confirm incoming funds; CPU Move funds to Arkade; CPU Spendable funds ready. Show the boarding address, Copy and `Open faucet and fund` linking to `https://www.google.com/search?q=signet+bitcoin+faucet`. No manual fauceted acknowledgement or transfer-start click is needed. Explain the automatic 50% allocation near funding and the frozen sats once known.

Show immediate local operation evidence before a network transaction ID exists. Distinguish `Preparing`, `Registered`, `Unconfirmed`, `Confirmed`, and `Verification unavailable`; do not turn an operation ID into an explorer link. Filter all cards and callback results by the active account and parent/leg identity. Each transaction's confirmation comes from its own evidence, not a wallet aggregate.

Ballpark ranges are guidance (account seconds, funding user-dependent, deposit confirmation roughly 10–60 minutes, settlements seconds to minutes per operator schedule). Optional measured stage averages use completed, fully observed samples only; late-start, interrupted and partial samples are identified and excluded. Timing never drives recovery or completion. Keep formulas and public diagnostics expandable rather than verbose in each stage.

Record separate milestones for funding detected, eligible funding, each registration/participation acknowledgement, each finalization, final spendability with released holds, and Bitcoin confirmation. Keep recovery-inclusive cohorts separate from normal uninterrupted averages; show sample counts, SDK/build identity and interruption markers for comparisons. External confirmation waits must not inherit a 5–15-second client-verification estimate. Do not seed BIS's local averages with the spike's 12m 30s total or promise it as a deadline.

Stop normal five-second work when no onboarding or confirmation work remains; an empty-account funding observer remains active until eligibility changes. While recovering, show the actual next scheduled check and last successful verification, with the affected condition and an automatic/manual-action distinction in details. A countdown reaching zero triggers a bounded check, not a success transition. Historical diagnostics remain expandable and cannot visually override current successful recovery.

The page opens as a prepared local status shell and remains interactive through network waits. Automatic checks never cover gameplay with a Pending Operation Dialog. Recovery copy names what actually restarted: “Connection restored. Status checks restarted—no action needed.” A real blocker states what is unresolved and keeps receiving/inspection available; no fabricated promise of eventual recovery.

## Risks / Trade-offs

- Two settlements temporarily move all selected funds to Arkade and create an interruption boundary → reserve only attributable receipts and persist both legs before they can submit.
- Operator changes can invalidate the demonstrated route → validate both legs against current policy and require fresh BIS Signet acceptance; no generic success claim from the spike.
- Cross-tab crashes and lost responses leave uncertainty → durable submitting gates, exclusive ownership, read-only reconciliation and no time-based replay.
- Bitcoin confirmations can lag final Arkade usability → separate confirmation records from final-output holds and test an actual payment before confirmation when the network permits.
- Local journal loss cannot guarantee reconstruction of the original 50% plan → ordinary reload retains records; explicit acknowledged logout follows existing cleanup semantics, never claims to cancel a transfer, and restored incomplete evidence is not guessed.
- Persistent operator failure may need investigation → show a truthful blocker; “no action needed” applies only while an actual safe automatic recovery path is running.

## Migration Plan

Introduce the coordinator behind its delivery gate until route, concurrency and reservation tests pass. Add new versioned onboarding records without rewriting manual transfer history. Existing manual pending records keep their identity and reservations; unknown legacy inputs continue to block conflicting spending. Include onboarding journals in existing pending-loss accounting and explicit logout cleanup. Do not expand Admin reset authority.

Update story X7 and scoped spec exceptions together. Run automated regressions and a fresh funded BIS demo flow, including navigation/reload and both legs. Record public transaction IDs, exact final amounts, SDK version and real payment availability; label incomplete live checks honestly. Enable automatic execution only after the guard tests pass, with live acceptance completed before reporting delivery.

Keep the served build stable during an ordinary funded acceptance cohort. An earlier idle observation can race automatic funding confirmation, so it does not establish that editing the served source is safe. Run controlled reload/failure cases as separately labeled recovery acceptance; retain their full elapsed durations and original account/input identities. Existing spike passes supply regression targets, not completed BIS task checkboxes.

Rollback disables new onboarding and new leg execution but retains records, reservations and read-only reconciliation. Never remove journals or roll back durable schema by discarding pending work. Completed final-output handoffs remain usable; uncertain operations stay protected.
