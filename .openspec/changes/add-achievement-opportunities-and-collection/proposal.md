## Why

BIS needs generic asset minting and ownership queries that hosts can use without mounting BIS UI. The Admin demo will exercise a complete mint-then-list round trip with real Signet assets and public console output.

The user reports Arkade balance is available. Fresh spendability and live issuance still need implementation-time verification. The 2026-09-04 decision replaces game-specific achievement naming, fixed single-unit rewards, and name-based duplicate suppression with generic asset operations and an editable Admin mint form.

## What Changes

- C1 becomes Mint Asset: an Admin button opens a large dark modal inspired by the supplied reference, with an asset summary, Name, Ticker, Amount, Decimals, Icon URL, and Control Asset fixed to None.
- Mint explicitly issues the entered supply to the active wallet using that wallet's spendable funds. Control asset creation, selection, and reissuance are excluded.
- C4 becomes List Assets: an Admin button calls the public API and prints all positive owned asset holdings, including assets not created by BIS. No game-specific filtering.
- Public methods are UI-independent and use generic asset types. All amounts cross the public boundary as exact decimal strings.
- Both operations show pending/results/errors in the existing Admin Console. No Runtime Preview content is mounted, cleared, or changed.
- Three Admin-only quick-fill buttons populate Achievement: Level 1, Achievement: Level 2, or Achievement: Level 3, using tickers LVL1/LVL2/LVL3, amount 1, decimals 0, blank Icon URL, and Control Asset None. They leave fields editable and never submit automatically; BIS assigns no game-specific meaning to these example names.
- Protect retries by mint operation ID, not asset name. Intentional separate mints may use identical names; an uncertain attempt must not be silently resubmitted.
- B, C2 claim UI, broad C3 recovery UI, C5 payouts, and D1 external/game-controlled issuance remain deferred.

## Capabilities

### New Capabilities
- `asset-api`: Generic asset minting, exact quantities, ownership queries, and operation-based retry protection.

### Modified Capabilities
- `story-driven-demo`: Admin-only mint form, list button, and console, preserving all existing account demonstrations and Runtime Preview behavior.

## Impact

Changes affect integration core/Arkade/public exports and demo Admin composition/styles. No game repository, custom server, or new dependency is required. A large in-page Admin modal is the proposed presentation choice for the user's optional new-window idea; it avoids popup blocking and a second application session.

Proposal, requirements, design, and tasks are revised together. The two initial unconnected asset modules from the interrupted apply attempt must be reconciled with this contract; no implementation task is complete. Historical feasibility evidence remains historical until fresh checks succeed.
