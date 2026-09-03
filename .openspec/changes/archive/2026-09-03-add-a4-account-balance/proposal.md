## Why

The active Account dialog identifies the account but cannot show its funds. Deliver a small reusable A4 balance feature without coupling release to transaction history, game achievements, or funding flows.

## What Changes

- Split Account into the Account menu (Account Details, Log Out, Back) and Account Details (identity/network, available/total balances, Refresh, Back to Account).
- Fetch on entry to Account Details and on manual refresh. Show loading and unavailable states without substituting zero for failure.
- Keep balance results in the current presentation only; do not persist a balance cache or show previous amounts after a failed refresh, including amounts fetched earlier in the same dialog.
- Retain the existing shortened Account ID, Log Out confirmation, and Back. A balance-service failure does not invalidate a locally verified account.
- Add an Account Balance Admin demonstration using the real production API and synchronize story documentation during implementation.
- Split the former full A4 menu scope: A5 history, assets/achievements, custom rendering, and receiving/funding details remain separate deferred features, with no placeholder menu actions.

## Capabilities

### New Capabilities
- `account-balance`: Live Signet available/total balance retrieval, ephemeral state, refresh, failures, and lifecycle isolation.

### Modified Capabilities
- `account-entry`: Route active accounts to the lean A4 dialog while preserving account identity, creation/restoration, and logout behavior.
- `story-driven-demo`: Add the production A4 demonstration and document the reduced scope and deferred stories truthfully.

## Impact

Implementation will touch integration core state/public API, the Arkade adapter, production Account UI, and the demo catalog. Reuse the pinned Arkade SDK 0.4.67 and existing dependencies; no server, storage migration, payments, or game-repository work is planned. Document the approved split in user stories and design discussion during implementation. Funded Signet balance correctness and the SDK's fresh-read behavior remain verification gates, not capabilities already proven by this proposal.
