# B1 native-sat burn feasibility — 2026-09-04

## Outcome

Blocked: a supported native-sat burn with verified completion and reconciliation has not been established. Do not begin runtime implementation or claim that the existing asset burn meets B1. No transactions were submitted and no funds were moved.

## Evidence

- Installed `node_modules/@arkade-os/sdk/package.json` reports version 0.4.67.
- `dist/index-DU5o_hz7.d.ts:5696` defines BurnParams with an existing assetId and an asset quantity. This is not a native-sat amount API.
- `dist/chunk-AEWJU6NZ.js:7103` selects coins carrying the requested asset and subtracts asset quantity. The output construction around lines 7163–7172 returns totalBtcSelected to the wallet's own address alongside the asset extension. It does not burn the requested quantity of sats.
- `packages/integration/src/arkade/assets.ts:71` invokes that assetManager.burn API. Existing BIS asset burning therefore cannot be reused as native-sat burning.
- `dist/index-DU5o_hz7.d.ts:5526` defines sendBitcoin with a destination address and amount. A transfer is not proof of native destruction, and choosing a sink destination is a scope decision expressly excluded from silent substitution in this proposal.
- Official [asset operation documentation](https://docs.arkadeos.com/wallets/operations/assets/get-started) places burning under assetManager. The [IAssetManager reference](https://arkade-os.github.io/ts-sdk/interfaces/IAssetManager.html) describes burning an existing asset; that generated reference identifies itself as 0.4.65, so the installed 0.4.67 source above is the version-specific evidence.

## Limits and next decision

## Expanded burn-address research (user requested)

The user subsequently authorized investigating burn addresses and confirmation, beyond the asset-manager API. Read-only public network research succeeded; no wallet was opened and no transaction was submitted.

### Public service and server evidence

- Live GET https://signet.arkade.sh/v1/info on 2026-09-04 returned network signet, dust 330, vtxoMinAmount 1, vtxoMaxAmount -1, utxoMinAmount 330, maxOpReturnOutputs 3, and txFeeRate 0. This is a configuration snapshot, not a burn quote or guarantee of all fees. The advertised version was empty, so the deployed server revision cannot be matched to upstream source.
- Pinned public [server output validation](https://github.com/arkade-os/arkd/blob/f863e484719344edbe4a8d10cf5fe994b123f2c0/internal/core/application/service.go#L4894) rejects nonzero extension outputs (line 4936), requires special sub-dust outputs below dust (4959), rejects nonzero ordinary OP_RETURN outputs (4980), and requires Taproot format for ordinary outputs above dust (5022). These are upstream source findings, not a live submission test.
- Consequently, a simple 1,000–10,000 sat ordinary OP_RETURN burn is not supported by that validation. Splitting into special sub-dust outputs is not an established solution: these have protocol-specific semantics and the advertised count is three. Three outputs each below 330 cannot carry the minimum 1,000 sats.
- Installed SDK sendBitcoin validates an Arkade address, checks its network/operator context, derives its output script and submits an offchain transaction. A conventional Bitcoin burn address cannot simply be supplied to this offchain method.
- The SDK exposes lower-level offchain construction and indexer getVirtualTxs/getVtxos APIs. Those supply possible transaction/output verification primitives, not evidence that a custom burn is supported.

### Candidate and confirmation distinction

A deterministic Arkade sink destination with no known spend key is a candidate for making funds inaccessible to the player without maintaining a second wallet. It still needs address/script construction review and live operator acceptance. Do not call it permanent destruction of base-layer BTC: Arkade batch expiry and operator sweep semantics must be accounted for. Installed SDK cash documentation explicitly describes unclaimed batch-expired notes being swept by the server; discarding a destination key is therefore not a proof that the Bitcoin supply was burned.

To validate a sink payment, persist the request and expected output before submission, confirm operator finalization, independently fetch/decode the resulting virtual transaction, compare destination script and exact sat amount, and reconcile input spending/change. A balance decrease or returned transaction identifier alone is insufficient. Keep unknown outcomes pending. A permanent Bitcoin burn additionally needs proof of an unspendable base-layer output and its confirmation, which a finalized virtual payment alone cannot supply.

### Result

Research rules out the straightforward ordinary OP_RETURN route in the inspected upstream offchain validator. An Arkade sink payment remains a plausible but unverified alternative, not a confirmed native-sat burn. No live burn success is claimed. The material next decision is whether B1 requires irreversible base-layer destruction or only a confirmed payment to a sink inaccessible to the player. The latter may fit the intended demo, but changes the meaning of success and must be stated explicitly before implementation/live validation.

This is not proof that all custom protocol scripts or lower-level transaction construction make native-sat destruction impossible. It establishes that the identified supported burn API is for assets and does not satisfy B1. Custom script/operator acceptance, amount limits, fees, authoritative completion and recovery for native-sat burning remain unverified.

Task 1.1's investigation/report is complete with a blocked conclusion. The feasibility gate has not passed; task 1.2 and runtime tasks remain open. Under the approved proposal and apply workflow, stop for a user decision: investigate a custom native-sat burn path further, or revise B1 to a real payment to a configured recipient. Do not introduce a second wallet, sink transfer or simulated result without that decision.

## Subsequent user decision

The user explicitly authorized the generated-recipient fallback and asked to implement and validate it. This resolves the historical decision gate above. A fresh test identity supplies the destination address without ever saving or activating that recipient. Results must be called sink payment, not proven destruction of Bitcoin. Existing exact-output send validation and zero-fee enforcement are reused; no live success is implied by this authorization.
