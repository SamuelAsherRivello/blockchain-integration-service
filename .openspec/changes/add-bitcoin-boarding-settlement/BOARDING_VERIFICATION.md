# Transfer implementation and verification — 2026-09-04

## Current status

### Pending withdrawal investigation and recovery fixes

Read-only inspection on 2026-09-04 found operation `43eb8d6e-a4a0-403f-b759-44cdb0673ef3`, operator intent `21bb686b-ef2e-4654-87eb-999e3e9ee716`, registered for Arkade-to-Bitcoin 1000 sats, with no recorded commitment transaction. The live account balance was Arkade 289715, Bitcoin 0. Its recorded VTXO `a65cba83578de653d7304ed9317b76219b90fade60d89c4a4a84541d455a89ed:0` was unspent and the destination history contained no withdrawal receipt. These observations do not prove the intent failed or cannot later settle. No journal was cleared and no new transfer was submitted.

Installed SDK 0.4.67 exposes registration, acknowledgement, signed deletion, and a batch event stream, but no read-only intent-by-ID terminal-status lookup. Its local intent reconciliation can label an intent cancelled based on local state or expiry; those labels do not supply the finality proof this app requires. The SDK creates registration messages with `expire_at: 0`. A batch failure alone likewise does not prove this registered intent cannot participate later. See [official intent lifecycle](https://docs.arkadeos.com/arkd/components/intent-system). Therefore no verified-failed transition is enabled. Task 3.2b uses its explicit conservative fallback.

Concrete recovery handoff: provide the two public IDs above to the Signet operator and request the accepted intent's batch/commitment outcome, or authoritative evidence of terminal failure and inability to settle. Do not send recovery material or signed proofs. If a commitment exists, Check Status must verify the chain receipt and consumed inputs. Operator advice or an error string is not an automatic journal-clear command. If recovery needs signed cancellation or resumed signing, that requires a separately scoped explicit action; neither is performed by Check Status. No operator outreach has been sent.

Two core regression tests failed before correction and passed afterward using `node --test packages/integration/tests/boarding-recovery.test.mjs`: the hardcoded two-minute lifetime could end before the advertised session, and failed reconciliation hid the recorded pending attempt from callers. The timeout now covers the advertised next session end plus two session durations and one minute of network grace, with a three-minute minimum. Quote expiry still gates registration. This fixes a reproduced scheduling risk; the original attempt's interruption cause remains unproven because its old implementation did not retain diagnostics.

Submission now preserves only allowlisted interruption categories. Public status includes the recorded phase and verification availability. The UI no longer creates a pending state before a record is known, keeps new confirmation disabled after an unknown status check, and distinguishes registered, transaction-recorded, and verification-unavailable states. The isolated browser fixture reproduced false pending after confirmation rejection plus status failure, then passed after correction. It also verifies preserved reverse direction/amount, uncertain-state guards and verified completion. Fixtures do not submit live funds.

Validation: `npm run build` passed; `node --test packages/integration/tests/*.test.mjs` passed 90 tests. Actual Signet withdrawal/return completion remains blocked by the unresolved registered attempt. The authoritative-failure/retry test branch remains unverified because no supported finality evidence source has been established; task 3.2c remains open for that branch.

Both Bitcoin-to-Arkade and Arkade-to-Bitcoin quote/review/explicit confirmation paths are implemented. The blanket submission flag is enabled after recovery safeguards passed, but an unresolved record blocks further submissions. An actual registered withdrawal attempt is now observed; its completion is not verified. Tasks 2.4 and 3.3 remain open; achievement feasibility (2.5) remains separate.

## Current balance and correction

Fresh read-only SDK data reported online/live, Bitcoin boarding 0, settled Arkade 289715, available Arkade 289715, total 289715, no gated/intent-locked/recoverable balance. The original 289715-sat deposit (transaction `7daae59de96dc9c52fca2127b69707c97f6c5892f293c0158b377451ce0b2ab8`, output 858) was spent by `438f487ba60562e628e4cb5de8d25320d4cc8b7f5ecfefd1f4f7d502fb29413c`, confirmed at height 320632, 2026-09-04 07:09:32 UTC. The initiating wallet/client is not established.

Correction to the earlier status: disabled Transfer UI did not prove that no funds could move. Existing account, balance, address and funding-address adapters used signing wallets without overriding SDK default automatic boarding. These paths now use ReadonlyWallet and read-only identities. Activity is also given a read-only identity. The explicit transfer adapter uses a signing wallet with automatic settlement disabled. The concurrently added asset-mutation adapter was also given settlementConfig false and a small readonly-wallet type compatibility fix so it cannot reintroduce background boarding. No new transaction was explicitly confirmed by the agent during this work.

## SDK and quote evidence

Installed SDK: `@arkade-os/sdk` 0.4.67. Operator network Signet; boarding exit delay 15552000 seconds, minimum onchain output 330 sats, minimum Arkade output 1 sat. Returned intent fee expressions are empty; transaction fee rate is `0`. The adapter rejects changed fee schedules.

Before the deposit was spent, a read-only SDK Ramps facade verified confirmed, unexpired boarding inputs and these exact plans without signing or submitting:

| Direction/request | Bitcoin output/change | Arkade output/change | Fee |
| --- | ---: | ---: | ---: |
| Bitcoin to Arkade, 1000 | 288715 | 1000 | 0 |
| Bitcoin to Arkade, Max | 0 | 289715 | 0 |

After the balance moved, the production Account Transfer UI successfully retrieved a live Arkade-to-Bitcoin quote for 1000 sats, fee 0, projected Bitcoin 1000, Arkade 288715, Total 289715. The same identity's getBoardingAddress is passed to Ramps.offboard, which accepts it as an onchain destination and constructs exact Bitcoin output plus Arkade change. This is the same boarding destination already tracked by this account's Bitcoin reader; actual reverse receipt remains a live test.

Source references: [SDK Ramps documentation](https://docs.arkadeos.com/wallets/advanced/ramps), [intent system](https://docs.arkadeos.com/arkd/components/intent-system). The current installed implementation is authoritative for the inspected version.

## Recovery verification

The independent journal records prepared before settlement preparation and submitting immediately before network registration, then operator intent/commitment IDs when known. Web Locks serialize mutation and clearing. A closed/expired attempt cannot register later. Abandoned prepared operations can safely become not-submitted under the lock. Submitting/registered operations remain unresolved through errors, reloads and missing history. They are never blindly retried, and SDK cancelled labels do not release the guard.

Confirmed chain plus exact receipt/change evidence resolves success. Reverse additionally verifies the original VTXOs' settledBy commitment. No secret signing material or signed proofs are stored. Unprovable registration outcomes can require operator investigation; this limitation is explicitly represented as pending, not hidden behind a global feature disable.

Tests cover partial/change constraints, stale review/account/fees/expiry, prepared recovery, registration write boundary, duplicate calls, reload reconciliation, timed-out/late callbacks and results, storage corruption/write failure, replacement operations, account isolation, exact boarding/reverse completion evidence, and read-only adapter regression guards. Build/typecheck and 76 tests (74 integration plus 2 documentation/TOC) passed. Browser harness verifies both directions' quote rendering and confirmation readiness, Max, Back, reopening, failed balance clearing and layout without submitting transactions.

## Remaining live steps

1. Review and explicitly confirm a chosen Arkade-to-Bitcoin amount in Account Transfer; current Bitcoin balance is zero.
2. Wait for verified status; inspect fresh Bitcoin/Arkade balances and Activity. Verify Bitcoin remains onchain across refresh/reopen.
3. Review and explicitly confirm Bitcoin-to-Arkade using the now-confirmed Bitcoin funds; verify status, balances and Activity again.
4. Record both actual transfer IDs/outcomes and complete tasks 2.4/3.3 only then.
5. Resume the separate achievement feasibility gate.

The browser tool's transaction policy requires the user to perform the final financial confirmation. No faucet request, reverse transfer or other money movement is automatically performed to create a test fixture.

## Live operation observed during handoff

A 1000-sat Arkade-to-Bitcoin operation appeared in the shared account journal during browser verification: operation `43eb8d6e-a4a0-403f-b759-44cdb0673ef3`, operator intent `21bb686b-ef2e-4654-87eb-999e3e9ee716`. It is registered/pending, with no commitment ID yet recorded. The agent did not click Confirm Transfer. Fresh reads still reported Bitcoin 0 and settled/available Arkade 289715. This proves registration occurred, not completion. Keep task 3.3 open and do not submit another transfer or force-clear the record. UI reload now restores the pending operation's direction and amount. Typecheck and all 14 focused quote/recovery tests passed after that presentation fix.

## Account Activity status follow-up

The user requested showing transfer status in the Transactions field. Activity now merges validated same-account operation records into fresh SDK history: undated pending operations appear first, matched commitment rows are annotated without an extra duplicate, and operation/intent IDs are explicitly distinguished from transaction IDs. Copy-all includes the status. SDK failure clears SDK rows but can retain an explicitly local operation alongside the history-unavailable notice. Foreign-account records are excluded. Build and all 80 integration tests passed, including new status/deduplication/isolation cases.
