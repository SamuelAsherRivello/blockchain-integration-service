# A5 Account Activity verification

Date: 2026-09-03. SDK: @arkade-os/sdk 0.4.67. Implementation is present; live confirmation and outgoing/spent examples remain pending.

## Implemented behavior

- Account Activity immediately below Account Details, opening Account Activity with Account ID above Transactions / Copy and a single read-only text area.
- All SDK-returned history, including incoming/outgoing and spent records, is normalized without filtering to current UTXOs. SDK wallet history has no pagination argument; no additional completeness is claimed beyond its returned records.
- Dated records sort newest first. Undated pending entries precede dated history; other undated entries follow, retaining SDK order. No invented timestamp or output index.
- Bitcoin confirmation comes from boarding coin status or SDK boarding history's block timestamp; history.settled is not used as proof of Bitcoin confirmation. Offchain records use distinct settlement labels. Unknown status remains unavailable.
- ReadonlyWallet, in-memory repositories, SDK providers and subscriptions only. No payments, settlement, direct explorer fetch, or persistent transaction storage.
- Notifications and a 15-second SDK reconciliation read update the open dialog. Freshness errors clear displayed text. Back, logout/reset, account replacement and disposal invalidate callbacks and stop observation.

## Verified

- Production build/typecheck succeeded. Integration Node tests passed, including normalization, ordering, spent/outgoing preservation, outpoint ambiguity, duplicates, observer failure/disposal, late acquisition, stale callbacks and account lifecycle.
- Chrome on http://127.0.0.1:5173/: A5 opens the production Account flow; exact menu placement, title, Account ID, text area, disabled story navigation and Copy success were observed.
- The SDK default explorer (mempool.signet.arkade.sh) returned empty history/coins for the saved account. Activity explicitly configures the SDK EsploraProvider to use mempool.space/signet/api, matching the supplied link. Both explorers reported the same Signet block tip (height 320557, hash 0000000baeae92838e9f40765f6ca7cb174c07ee87c2e3b0509505837a575412), but their mempool observations differed. The production dialog displayed a pending deposit with a real transaction ID and output index. It changed automatically from 403638 sats to 398325 sats and later 390895 sats, with different SDK-reported identifiers, without Refresh or funding actions. These were observations, not fixtures; no reason for the transaction changes is inferred.
- tests/activity-host.html passed in Chrome: 24 fixture lines, a single text area, exact Copy-all contents, clipboard failure, no horizontal card overflow at 360px, unavailable/empty states, Retry, Back and reopening. The host mounts production UI and uses an isolated Core dependency seam; it does not touch saved accounts.
- Existing Account/Details tests passed. No secret values were printed, copied, or included in evidence.

- The read-only SDK verification page, using the same explicit Esplora configuration, returned pending boarding history plus matching coin status and subsequently displayed SDK notification: utxo. This independently verifies live SDK event delivery, not just the reconciliation timer.

## Still pending

- Observe a real pending-to-Bitcoin-confirmed transition through this wallet's SDK.
- Observe real outgoing and spent history in the current saved account. Their mapping/retention is covered by isolated tests; no transactions were initiated to create evidence.

## Apply recheck — 2026-09-03

- The production Chrome Account Activity dialog freshly loaded `289715 sats | Incoming | Confirmed | 7daae59de96dc9c52fca2127b69707c97f6c5892f293c0158b377451ce0b2ab8:858` for account `38a4…e803`. Refresh and Copy were enabled after loading. This verifies live confirmed-state rendering against the earlier SDK confirmed coin observation; it does not establish that this same transaction's pending-to-confirmed transition was observed while the dialog was open.
- All six activity tests passed, and strict validation of `add-a5-inspect-activity` passed.
- `documentation/User Story Diagrams.md` is currently zero bytes. Its previous A5 synchronization cannot be verified or shipped in this state, so task 3.3 is reopened pending recovery/reconstruction of the intended document. The empty file was left untouched; no missing draft content was guessed.
- No payments, funding, settlement, logout, or reset were initiated. Live transition evidence remains pending, and outgoing/spent live examples remain unavailable in the observed account. The change has not been synced or archived.


The implemented UI is usable now. These pending live checks prevent reporting the entire OpenSpec verification task complete. Earlier A2/A6 storage and A4 funded-balance verification notes remain unchanged.


Loading/Refresh refinement: Account Details shows Loading... in each loading field (including Network while the detail reads are pending). Account Activity shows Loading... inside Transactions and includes a matching Refresh button immediately above Back, disabled during reads. No More Information field or separate loading paragraph is added. Verified all five Details loading values in Chrome.
