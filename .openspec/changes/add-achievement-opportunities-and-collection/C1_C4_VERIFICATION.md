# C1/C4 achievement verification

## Planning status update — 2026-09-04

The user reports Arkade balance is now available and requests the C1/C4 reward-then-view proposal. The funding blockers below describe earlier checks and must not be presented as a newly verified blocker. Live spendability, asset issuance, fresh listing, and restoration remain unverified; task 1.1 will recheck them during implementation. No transaction was attempted and no implementation task was completed by this planning update.

## Feasibility gate — 2026-09-03

Status: blocked on a funded Signet account. Task 1.1 remains incomplete; no achievement API or Admin implementation has been made.

- A live GET of https://signet.arkade.sh/v1/info succeeded and reported network signet, dust 330, vtxoMinAmount 1, and txFeeRate 0. These advertised values do not prove asset issuance support or a fixed transaction cost.
- Inspected installed @arkade-os/sdk 0.4.67, dist/chunk-AEWJU6NZ.js, AssetManager.issue: it reads spendable VTXOs with recoverable outputs excluded, selects against wallet.dustAmount, builds the asset metadata/output, and submits an offchain transaction. The 330-sat selection threshold is funding backing, not a claim that issuance consumes a 330-sat fee.
- In the existing Chrome demo at http://127.0.0.1:5173/?skipIntro=true, opened A4 Account Balance, then Account Details. The saved account displayed a completed live balance response of 0 available sats and 0 total sats. No recovery material was accessed or displayed.
- No issuance, funding, settlement, account replacement, logout, or reset was attempted. No successful asset issuance/list/restoration round trip is claimed.

## Required to resume

A funded test Signet account with sufficient spendable Arkade VTXOs is needed for the first task. Restore any required test recovery phrase directly in the app, never in chat. After funding is available, verify actual issuance with the agreed metadata, fresh holdings and metadata reads, and rediscovery after restoring the same identity before proceeding past the gate.

All ten implementation tasks remain unchecked. Existing A-story verification status is unchanged.

## Funded account recheck — 2026-09-03

The user reported a balance and requested continuation. A fresh production Account Details read for profile `38a4…e803` showed **289,715 total sats and 0 available sats**. The existing read-only SDK host at `/tests/activity-sdk.html` independently returned an online/live connection and one confirmed Bitcoin boarding output:

- Transaction: `7daae59de96dc9c52fca2127b69707c97f6c5892f293c0158b377451ce0b2ab8`, output 858, value 289,715 sats.
- SDK history: `RECEIVED`, `tag: boarding`, `settled: false`, with empty commitment and Ark transaction IDs.
- Installed SDK `getBalance()` includes boarding funds in total but derives available funds from offchain holdings. `AssetManager.issue()` selects spendable VTXOs with recoverable outputs excluded, against the wallet dust amount.

The funding has arrived and is Bitcoin-confirmed, but it has not become spendable Arkade funding. Task 1.1 is still blocked on that distinction; no asset issuance was attempted. Boarding/settlement is not implemented in the current BIS context and is outside this achievement change's tasks. The next scope decision is whether to add the boarding step needed to convert these test funds into spendable Arkade VTXOs. No credentials were displayed, and no settlement, logout, reset, or account replacement was performed. All achievement implementation tasks remain unchecked.

## Admin funding follow-up

The user subsequently requested an Admin button labeled Fund 1000 Sats. It is implemented through createBisAdminContext(context).fund1000Sats(), using the active wallet's Signet Arkade receive address and the faucet endpoint used by the [official Arkade wallet](https://github.com/arkade-os/wallet/blob/master/src/lib/faucet.ts). It posts exactly 1000 sats, has a pending state, rejects missing accounts and concurrent calls, and never fabricates balance changes or automatically retries. Success means request accepted, not confirmed receipt.

On 2026-09-03 the faucet healthcheck returned HTTP 502. A real browser request through the new button displayed pending, then Funding was not confirmed; the existing preview and balance were unchanged. Successful funding remains unverified and the achievement feasibility gate remains blocked. Build and 39 existing tests passed; two additional funding tests passed for request amount/network/failure handling and account/duplicate/disposal behavior.

The Admin funding button now opens https://signetfaucet.com/ rather than calling the API faucet. `getFundingAddress()` returns the active wallet's public Bitcoin boarding address with account-change guards. The site was inspected and does not consume an address URL parameter; the app attempts clipboard copying and displays the address if clipboard access fails. Build passed and the updated button/manual-copy fallback was observed in Chrome. Prefilling the external form is not supported. No faucet claim or boarding transaction was submitted by this change.

## Generic asset implementation check — 2026-09-04

- Implemented generic public mintAsset, listAssets, getPendingAssetMint and validateMint APIs; no BIS achievement types or game rules. Added exact decimal conversion, optional metadata, no controlAssetId, same-origin wallet locking, public durable request records and guarded submission. SDK automatic settlement is disabled for minting.
- Added C1 Mint Asset and C4 List Assets to the current Admin layout. Native dark dialog follows the reference, with fixed None and three editable quick-fill examples. Each of Level 1/2/3 was checked in Chrome: matching name/ticker, amount 1, decimals 0, blank Icon URL. Only Mint submits; presets did not issue anything.
- Live List Assets returned success with assets: [] for account 38a4…e803. Runtime Preview remained empty. The dialog was visually inspected at the normal browser viewport and scrolls to its final action.
- Attempted one explicit Level 1 mint (operation 82767f98-9bac-45a5-a2d3-bea4e870bf51). It returned code busy before the asset adapter submitted. No asset issuance is claimed.
- Account Transfer then displayed 289,715 Arkade sats, 0 Bitcoin sats and an existing registered unresolved Arkade-to-Bitcoin transfer for 1,000 sats. Transfer ID: 43eb8d6e-a4a0-403f-b759-44cdb0673ef3; operator intent: 21bb686b-ef2e-4654-87eb-999e3e9ee716. Its Check Status action reported completion not verified. The asset implementation preserves this guard; no record was deleted or bypassed and no new transfer was submitted.
- Build/typecheck passed. All 87 integration tests passed, including 7 asset tests for exact amounts, validation, non-BIS/metadata-free holdings, JSON-safe quantities, corrupt/unavailable records, request binding, unresolved-operation blocking, independent same-name IDs, headless parity, error sanitization, account changes and missing locks.

### Still pending

Real minted/nonempty list round trip, restored-identity holdings after issuance, actual same-ID issuance retry, adapter submission timeout/concurrency fault injection, mobile layout/focus checks, and full console reset/late-result browser checks. The registered transfer must be resolved before attempting another mint. Unchecked tasks remain explicit; the change is not ready to archive.
