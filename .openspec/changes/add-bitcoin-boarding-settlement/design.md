## Context

The three-balance Account Details UI and D4 mockups are delivered. The user requested actual transfers in both directions. Current funds are settled in Arkade. Existing signing-wallet readers inherited SDK automatic boarding; those readers must become read-only.

## Goals / Non-Goals

Implement chosen-amount, explicitly confirmed same-account Signet transfers in both directions, with truthful quotes and durable recovery. No external sending (D3), automatic boarding, asset transfer, dependency upgrade, secret persistence, or guarantee of automatically completing an interrupted signing session.

## Decisions

- Total = SDK boarding total + full Arkade total. Spendability is separate. Validate safe integer amounts and reject inconsistent/degraded reads. No stale/zero fallback on failure.
- Account Details puts Bitcoin <-> Arkade above Recovery Phrase. The keyed transfer component resets on leaving/account replacement; Back from review returns to entry. Direction changes invalidate quotes. One-sat adjustment from zero; Max comes from eligible inputs.
- All inspection uses ReadonlyWallet with a read-only identity. The transfer signing wallet is created for explicit confirmation with settlementConfig false; other authorized mutation adapters must also disable automatic settlement. SDK defaults must not initiate background settlement from readers.
- Quote using SDK Ramps with a capture-only settle facade: onboard selected confirmed unexpired Bitcoin inputs, or offboard selected spendable asset-free VTXOs. Exclude recoverable/unrolled/locked funds. A reverse destination is derived by this wallet's getBoardingAddress, never supplied externally. This matches the Bitcoin balance's boarding definition and existing script/exit conditions. Read-only SDK output construction validates the address format; actual confirmed receipt remains a live gate.
- Support the verified zero fee schedule only. Reject changed expressions/rates instead of inventing costs. Validate operator output limits and minimum change. Exact input/output/direction/fee fingerprints plus account and resulting balances are revalidated before signing. Quotes expire after 60 seconds. No silent full-balance substitution.
- Persist validated public operation data before settlement preparation. Phases are prepared, submitting and registered; terminal outcomes are succeeded, not-submitted, or verified-failed. The latter requires authoritative evidence tied to this attempt proving it cannot subsequently settle; an error or SDK cancellation label is insufficient. The journal contains no phrase, signing key, MuSig secret or signed proof. Legacy pending records without a phase stay uncertain.
- One same-origin Web Lock serializes submission, recovery and clearing. Before the provider registration call, synchronously verify the current attempt/account/deadline, persist submitting, then call the network once. Persist its returned intent ID. Wrap registration errors to prevent SDK duplicate-intent cancellation/re-registration; disable automatic cancellation.
- Deadline/finally closes the attempt gate. Late preparation cannot create a record or register after the lock is released. Under the lock, abandoned prepared records can become not-submitted because registration could not yet have occurred. A late response for a submitting record can update that same record's public IDs, but never a replacement operation.
- Submitting/registered records remain pending through timeout, missing history, unspent inputs and SDK cancelled labels. Do not replay them. Reconcile on hydration, opening Account Transfer and periodic/manual status checks. Only verified success or authoritative proof of terminal failure can resolve them. Verify the installed SDK/operator's evidence and finality guarantees before implementing a failure transition; if unavailable, retain uncertainty. Unknown outcomes may require operator investigation; no force-clear exists.
- Diagnose the user's existing attempt before a new live submission. Inspect only the relevant public operation data and read-only operator/chain evidence. The reported 1,000-sat balance is not proof of spendability or of failure. Distinguish quote review, submitting, registered/waiting, awaiting chain confirmation, verification unavailable, verified success and verified failure where evidence supports those distinctions. Preserve sanitized failure categories instead of swallowing all diagnostic information. Never infer a submitted attempt from a UI busy flag. Check Status reconciles the existing attempt without signing or submitting. A verified failure releases guards under the mutation lock and requires a fresh quote and explicit confirmation; it never automatically retries.
- Boarding success requires confirmed Bitcoin input consumption, exact owned Arkade receipt from that commitment and exact Bitcoin change. Reverse success requires recorded VTXOs spent with matching settledBy, exact confirmed Bitcoin receipt to the derived destination and exact Arkade change. Preserve successful operation state if a later balance refresh fails. Refresh active balances/Activity; opening Activity always reads fresh history.
- UI and API expose both directions independently after quote/recovery tests pass; neither automatically authorizes a transaction. Admin D4 uses the production public API and preserves the logged-out chooser.

## Verification sequence

Verify SDK read-only quotes, storage/registration boundaries, contention, reload, late outcomes, profile isolation, clearing guards and real-browser review controls. Then verify actual user-confirmed Signet transactions. Because funds are now all Arkade, the live sequence can be reverse first, then boarding. Both tests and fresh Activity/balance verification remain required. Run the separate achievement feasibility gate afterward; do not count prior externally initiated boarding as an app confirmation-flow test.

## Risks / Trade-offs

- A lost response after registration can remain unresolved indefinitely without authoritative evidence. Expose pending and public operation IDs; block resubmission/clearing and permit status checks.
- The Bitcoin destination remains a boarding script, with its existing cooperative/exit conditions. Keep this visible; no new ordinary Bitcoin wallet is being introduced.
- Browser storage loss is outside the same-origin journal guarantee. Never clear journal records as a recovery shortcut.
- Changing operator fees temporarily disables new quotes until fee handling is verified. Already-submitted operations remain recoverable.

## Migration Plan

No account identity migration. Existing pending journal records remain conservative. Deploy read-only readers and tested bidirectional adapters; record actual live verification separately. Do not discard unresolved records during rollback or claim unknown operations failed.
