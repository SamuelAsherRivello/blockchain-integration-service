# F3 receipt feedback verification

Implemented visible receipt-driven Balance loading and explicit Confirmed receipt toast. User approved confirming verified spendable Arkade receipt rather than batch settlement. The adapter matches fresh owned spendable outputs by transaction ID, unique output indices and exact amount; balance changes alone never confirm receipt.

Tests first: wallet-subscription and payment-notifications failed on missing loading and missing Confirmed wording. Additional adapter/notification regressions failed on missing spendable-receipt verification. Final focused run: 37/37 passed. Typecheck and production build passed. Logs are in output/reports/f3-receipt-feedback/.

Broader integration run: 400 tests, initially 396 passed. One expected wording assertion was updated and passes in focused verification. Three other failures remain in boarding-recovery (2) and continuation (1), areas with pre-existing concurrent edits; this change does not repair them. Root npm test stalled after documentation tests with a Vite websocket port collision and was interrupted. No claim of a fully green repository suite.

Live check: the user clicked F3 after automatic browser review required user action. Observed game balance 53000 -> 52000 sats and player Arkade balance 266715 -> 267715 sats; Admin reported Payment sent. User explicitly confirmed both loading and Confirmed toast appeared. User accepted balance updating at Pending before the queued Confirmed toast. No claim that this represented batch settlement. Exact first receipt transaction ID was not captured before further user operations.

Isolated production-component UI check: observed Loading with Pending toast, ready 3000 sats, Confirmed toast with no new loading, and no replay after repeated observation. Fixture is clearly marked test-only and performs no wallet/payment work. Screenshots: output/screenshots/f3-receipt-feedback/. Closed-page behavior and account replacement are covered by automated tests.
