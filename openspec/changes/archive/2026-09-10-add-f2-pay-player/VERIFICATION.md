# F2 verification — 2026-09-08

## Implemented

F2 sends 1000 sats through the F1 controller and asset-preserving SDK adapter using the existing sender-scoped send journal and mutation locks. Public correlation metadata is written before submission; F1 send recovery survives player cleanup. F3 boarding now also respects unresolved sends. `getPaymentRecipient()` obtains the active player's public destination without opening Account.

An independent read-only account-session observer handles incoming sats and own transfers. It silently baselines history, correlates known F2 sender IDs, uses Unknown User otherwise, deduplicates pending/final stages and transaction identity changes, and aborts/clears notifications on account replacement or disposal. Bitcoin final requires confirmation evidence. No success toast is produced from a send promise or balance delta.

## Automated evidence

- Initial notification test failed because the new module did not exist, then passed after implementation. Sandbox test-worker spawning required either in-process focused tests or supported escalation.
- Final `node --test --test-timeout=30000 BIS/packages/integration/tests/*.test.mjs`: **304 passed, 0 failed**. Includes receipt stages, baseline, sender correlation, stale identity, pending retry protection, journal retention, observer lifecycle and existing adapter/asset/wallet tests.
- `npm run build`: **passed**, including typecheck and both production bundles. Existing large-chunk warning remains.
- `openspec validate add-f2-pay-player --strict`: **passed**.
- Bounded demo suite: **6 passed, 2 failed**. Both failures are in `admin-assets.test.mjs`, whose regular expressions expect labels directly after the ID span; current concurrent `StoryAction` markup wraps labels in `span.story-label`. F2 does not change StoryAction or those assertions. The initial unbounded whole-suite run was interrupted after these failures and lingering server handles; bounded/core runs supplied the results above.

## Browser evidence

Local verification server: `http://127.0.0.1:5176/` (temporary localhost test port; not the remote preview/tunnel).

- Actual demo route loads and exposes F2 greyed out/disabled without a player or imported sender.
- Isolated `/tests/f2-payment.html` uses the production GameWalletPanel, game-wallet controller, context observer and shared UI with test-only account/SDK doubles; it performs no network payments.
- Fixture login enables F2. One click increments submissions to 1 and disables F2 and wallet controls while awaiting completion. Completing the fixture shows a 1000-sat receipt toast and enables the action again.
- Incoming 2345-sat fixture displays `Unknown User Sent You 2345 Sats (Pending)`, then `Unknown User Sent You 2345 Sats`; final toast coexists with Account open inside the 360×640 runtime. Actual demo also uses its existing 50% preview scale.
- Known sender formatting and transaction/player/amount matching are covered by focused tests; this fixture intentionally supplies no known-sender metadata.

## Remaining acceptance

Task 4.3 remains unchecked: no live two-wallet Signet payment was performed. The verification browser had no imported funded F1/player accounts. Real sender debit/fees, exact receiver credit and real receipt toast must be observed before reporting live acceptance complete. No credentials were read, copied or logged, no account was funded, and fixture evidence is not live payment evidence.
