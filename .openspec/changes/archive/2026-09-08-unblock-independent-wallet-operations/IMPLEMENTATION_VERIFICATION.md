# Implementation evidence — 2026-09-08

Implementation is in progress; this report does not declare all change tasks complete.

## Delivered behavior

- Payments and sends exclude the union of reserved whole inputs. Known unrelated reservations no longer cause the blanket wallet-operation guard.
- Send journals retain multiple operations and target reconciliation by operation ID. A versioned reservation snapshot preserves legacy records; this is not yet a replacement canonical journal for every operation type.
- Unknown legacy inputs retain an explained hold. Read-only transaction reconstruction is attempted where a transaction ID is available.
- B1 availability comes from verified funds and the configured recipient, independently of whether Account is open.
- C1 checks the game wallet's fresh mint availability. An unfunded wallet disables C1 with `(Awaiting Balance)`; availability refreshes without submitting a mint. Player reservations do not block game-wallet minting.
- Concurrent edits introduced a mint destination selector and renamed C1 to Mint Asset & Send. Those edits are preserved. The live mint below predates that rename and verifies mint ownership, not a subsequent asset transfer.

## SDK input support

| Path | Control inspected in installed SDK/adapters | Result |
| --- | --- | --- |
| Send/B1 | Explicit `selectedVtxos`, followed by submitted transaction inspection | Unreserved input selection supported |
| Boarding/withdrawal | Explicit quoted input set | Shared reservation filtering implemented; complete live verification outstanding |
| Asset issuance | Public issuance API has no explicit input selector | Game-wallet mint works when that wallet has no reservations. Same-wallet reserved inputs produce `Mint input selection unavailable`; independent minting in that case remains undelivered |

## Live Signet evidence

The following actions were submitted through the production browser UI, not test fixtures:

1. B1 operation `0410e2a4-05cd-486e-9c4a-4c25734515d6` succeeded for 1,000 sats, fee 0. Transaction: `7839fd5ca5a53a0a35f3800f05f73f047e88c18c3b3ae53c821b716c1a72fa39`. The displayed game balance increased from 37,000 to 38,000 sats.
2. C1 operation `e4fa1b47-32bf-4615-a2df-804f215bf546` reported Asset minted. Transaction: `e92fd904dbfc9e0a35e3e6d1f3557362bc5e2925118c75bbe63a38d70c2c33c2`. The mint owner was game profile `3956bdeb9842957794ef9d7f7895880497160fa03af777d62abf1c4810aa0be6`.

The prior player transfer `3253e5d4-863f-4fa3-8093-e30533632fa0` was observed pending before these actions. A final browser comparison of its full recovery record and actual live payment input exclusion remains outstanding; this report does not claim the transfer resolved or that task 6.2 is complete.

## Automated verification

- Core isolated test run: 317 passed, zero failed.
- Final focused wallet reservation, game-wallet, send adapter, Admin C1 and mint destination run: 28 passed, zero failed.
- Final `npm run build`: passed; existing bundle-size warning remains.
- The unrestricted whole-suite attempt did not complete because a browser/documentation test server port collided. It is not reported as passing.

## Outstanding verification and restrictions

The full multi-operation canonical migration, reconstruction adapter coverage, all mutation-race cases, production narrow recovery layout, current-account public reservation totals, live disjoint transfer/send input evidence, and account-clearing policy reconciliation remain open. Existing acknowledged logout behavior must be reconciled with this change's clearing requirements before claiming completion.

Prepared draft discard is implemented without deleting recovery records; submitted cancellation is not implemented. The operator's deletion API alone does not establish active-batch exclusion or terminal replay semantics. Cancellation tasks remain open. Same-wallet independently funded issuance remains unsupported until input selection can be enforced.
