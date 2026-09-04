# D3a implementation prerequisite findings — 2026-09-04

Apply paused during task 1.1. No production edits, tests, signing, submission or balance migration were performed. Task 1.1 remains unchecked because full fee/recovery verification is incomplete.

## Material source-balance mismatch

- `packages/integration/src/arkade/balance.ts`, `readFreshBalance`, defines `bitcoinSats` as `balance.boarding.total`, not an ordinary onchain key-wallet balance.
- Installed `@arkade-os/sdk` 0.4.67, `dist/chunk-AEWJU6NZ.js:19820`, constructs `OnchainWallet` using `p2tr(pubkey, undefined, network)`; its `getCoins()` queries that address. Its `send` at line 19910 selects those coins, builds/signs a key-spend transaction and broadcasts it. It does not spend the displayed boarding deposits.
- The similarly named `Wallet.sendBitcoin` at line 14428 is a deprecated Arkade-address sender, not a Bitcoin-address sender. The name alone is not evidence of the planned route.
- Therefore the proposal's Bitcoin-to-Bitcoin route cannot be implemented by substituting OnchainWallet while displaying the existing Bitcoin balance. A different source/account address would require additional receiving/balance design; spending boarding deposits directly needs separately verified contract-spending rules. Neither is silently authorized by the existing design.

## Other sending paths and recovery

- `Wallet.send` at line 15609 accepts selected VTXOs; selection must respect SDK spendability gates. This establishes an input-binding primitive, not verified full fee/restart behavior.
- `Ramps.offboard` at line 17014 obtains spendable VTXOs, deducts input/output fees and calls settlement. Exact recipient amount requires verified gross-up and change accounting.
- Official [Sending Payments](https://docs.arkadeos.com/wallets/operations/sending-payments), read during this apply attempt, documents direct Arkade sends, Ramps collaborative withdrawal to Bitcoin and pending finalization. It does not establish direct spending of this app's boarding balance via OnchainWallet.
- D4 has a shared Web Lock (`bis-signet-wallet-mutation`) and a durable boarding record. On the latest inspection, `boardingSubmissionEnabled` is true; the earlier disabled-flag finding is superseded. Its `BOARDING_VERIFICATION.md` records an unresolved registered withdrawal, which independently blocks mutations. D3a must preserve that guard. No D4 files were changed.

## Required decision before continuation

The user subsequently authorized scope reduction and explicitly invoked apply for sending. The selected reduced delivery is Arkade-to-Arkade only, with no Bitcoin source selector, Bitcoin destination route, Lightning controls, or unavailable placeholder form. This removes the Bitcoin-source redesign decision; it does not relax explicit confirmation, exact amounts/fees, recovery, or live verification. The original proposal/design/specs/tasks still describe the three-route scope and must be reconciled before implementing the reduced delivery. No original task has been marked complete.

## Follow-up apply inspection

- Inspected the current source, all change artifacts, project brief, later decisions, D4 verification and cancellation tasks. No production code was edited and no wallet operation was performed.
- Installed SDK 0.4.67 `Wallet.send` accepts selected VTXOs and constructs recipient/change outputs. Its submission helper validates the returned transaction identity and awaits `finalizeTx`. This supports investigating the reduced direct-send route; it is not live completion evidence.
- `finalizePendingTxs` first checks a repository pending flag. Existing adapters use transient repositories. Calling that method on a newly created wallet without a durable recovery design must not be represented as proven restart recovery.
- The D4 verification record reports unresolved operation `43eb8d6e-a4a0-403f-b759-44cdb0673ef3`. This follow-up read the recorded evidence, not live browser account state. `cancel-pending-transfer` has all implementation tasks unchecked.
- End-to-end verification needs an explicitly selected, usable Signet sender and recipient. For the recorded account, first reconcile the existing transfer or explicitly undertake its separately scoped cancellation workflow. Alternatively, the user can select a separate clean test account/browser profile without clearing the existing account or its journal. No cancellation, funding, account replacement, or recipient selection is inferred from the send implementation request.

Apply remains paused at prerequisite 1.1. No new unavailable UI has been added; the existing Send placeholder has not been replaced. The feature is not complete.
