## Why

BIS currently requires a manual transfer journey, and its partial boarding quote can produce the mixed Bitcoin-input/Bitcoin-output intent rejected during Spike #1. Players need onboarding that starts when funding is available, recovers safely, and finishes when their intended Arkade funds can actually be spent.

## What Changes

- Start an account-scoped onboarding coordinator on player login or account activation, independently of opening any account page. Use a fixed 50% of a frozen eligible Bitcoin input total for this version.
- Use the demonstrated two-settlement route: board the selected Bitcoin total, then return the non-target remainder to the same account's Bitcoin address using only attributable first-leg receipts. Never include Bitcoin outputs in the Bitcoin-input boarding intent.
- Add `Onboarding: Start?`, `Onboarding: Pending`, or `Onboarding: Complete` immediately above `Get Recovery Phrase` in Accounts Details → Balance. Opening it inspects progress; it does not authorize or restart a transfer.
- Provide five compact stages: Account ready, Fund account, Confirm incoming funds, Move funds to Arkade, and Spendable funds ready. Funding includes the account address, Copy, and a Signet faucet search. Show both settlement legs and individual transaction confirmation in details.
- Define completion as verified final target Arkade funds being spendable and free of onboarding holds. Do not wait for Bitcoin block confirmation once this predicate is met. Continue Bitcoin confirmation tracking separately.
- Persist parent operation and leg boundaries; automatically restart bounded observation work and continue a provably unsubmitted leg. Reconcile uncertain submissions without replay. Preserve safe callback diagnostics and use reassuring, evidence-supported recovery copy.
- Carry over the spike's tested batch isolation: only the current intent's selected batch can fail its execution or renew its progress deadline. Abort the actual event source on timeout and await signer/SDK cleanup before recovery. Prevent nested checkpoint-lock deadlocks and overlapping connections after reload.
- Extend shared reservations and account isolation so intermediate receipts cannot be spent by another operation, while final target funds become usable immediately upon verified handoff.
- Keep manual Swap, sends, cancellation and Admin wallet workflows under their existing authorization contracts. Explicitly scope the new automatic behavior as an onboarding exception to current read-only and manual-transfer specifications.

## Capabilities

### New Capabilities

- `account-automatic-onboarding`: Account activation, fixed allocation, durable two-leg execution, automatic safe recovery, progress details and spendability-based completion.

### Modified Capabilities

- `account-balance`: Onboarding entry and separation of automatic onboarding observations from foreground balance reads.
- `account-boarding-settlement`: Explicit automatic-onboarding exception to manual signing, retry and completion rules.
- `wallet-operation-availability`: Reservation continuity through onboarding and release of verified final target funds before Bitcoin confirmation.
- `pending-operation-dialog`: Nonblocking onboarding details and recovery, without covering the game throughout network settlement.

## Impact

Primary work is in `BIS/packages/integration/src/core` (context lifecycle, durable records, reservations, availability), `src/arkade/boarding.ts` and adapter helpers (route, evidence, callback boundaries), and `src/ui` (Balance entry and onboarding details). The integration demo provides real Signet acceptance. Existing lifecycle, quote, recovery, reservation and context tests provide regression coverage. Game-facing types remain provider-neutral; no new server or dependency is planned. SDK 0.4.71 is the currently declared baseline, not proof that any transaction shape is accepted.

This proposal advances story X7. It overlaps existing boarding, withdrawal-recovery, preparation and independent-payment changes; reuse their safeguards without claiming their outstanding live acceptance is closed. Manual partial-transfer repair and historical stuck-operation resolution are not bundled into this onboarding change.

The [H1 three-run follow-up](../../../BIS/documentation/User%20Story%20Diagrams.md#h1-three-run-robustness-follow-up) records three exact-amount, confirmed Step 6 successes: 12m 30s, 12m 32s and 12m 28s overall, with Step 5 taking 2m 25s each. All three recovered automatically from a development reload without account resets, extra funding or a recovery click; the post-mortem records 89 passing spike tests and both builds passing. These results strengthen the recovery evidence. They are a shared-batch, interrupted cohort, not three independent clean timing samples or completed BIS acceptance. BIS still finishes on final spendability rather than the spike's additional Bitcoin-confirmation wait.

Planning defaults: onboarding is a one-time setup per account, not an automatic rebalance for every deposit. Existing accounts with freshly verified spendable, unreserved Arkade funds and no unresolved onboarding operation are already ready; this creates no invented transfer history. Support the observed zero-fee route first; changed fees or invalid dust/limits pause with a specific explanation rather than change the 50% promise. These defaults are documented in design and specs; no further product decision is required for this proposed scope.
