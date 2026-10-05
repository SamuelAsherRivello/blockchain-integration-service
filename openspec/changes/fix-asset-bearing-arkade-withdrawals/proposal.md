## Why

Account Transfer can show a positive Arkade balance yet reject withdrawal because BIS excludes outputs carrying assets, even when their sats are SDK-spendable. The reported 280715-sat balance exposes this gap; withdrawing sats must preserve the player's assets.

## What Changes

- Allow SDK-spendable asset-bearing inputs for same-account Arkade-to-Bitcoin transfers, retaining every asset in owned Arkade change.
- Make Max reserve the current minimum required for asset change; reject amounts that would consume that reserve.
- Bind exact asset inventories to quotes, verify the prepared asset allocation before registration, and persist asset-change evidence for recovery.
- Require confirmed Bitcoin receipt and exact retained assets before reporting success; preserve legacy journals and uncertain outcomes.
- Return a durable registered result promptly, continue signing in the background, and direct the player to Transactions.
- Before every additional balance transfer in either direction, ask Yes/Cancel about all pending amounts; reserve individual input sets and preserve independent records.
- Track release readiness and actual user-confirmed Signet acceptance separately from local automated verification.

The preceding task already implemented this behavior locally and updated the main spec and the broader `add-bitcoin-boarding-settlement` change. This proposal formalizes the focused fix and remaining acceptance work; it does not claim a new implementation or a deployment. Its delta retains those existing requirements and makes eligibility errors and legacy recovery scenarios explicit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-boarding-settlement`: Asset-preserving reverse eligibility, withdrawable Max, exact inventory verification, compatible recovery, and actionable reserve errors.

## Impact

Affected areas are `BIS/packages/integration/src/arkade/boarding.ts`, the core boarding quote/asset/record/reconciliation modules, `BIS/packages/integration/tests/boarding-assets.test.mjs`, and the demo transfer browser harness. The internal quote separates full input sats from withdrawable Max; existing records remain readable. The public context adds getPendingAccountTransfers and per-confirmation acknowledgedPendingIds. No SDK upgrade or backend is proposed.

The published game's consumer update is a release dependency in its separate repository. Its exact revision and release procedure must be verified before delivery; this planning request authorizes neither changes there nor publication or transactions. The broader boarding change retains its forward-transfer and other outstanding gates. No journal clearing, asset burning, automatic funding or recovery bypass is included.

## Confirmed Admin-first scope update

The user requested the registered/submitted interaction and repeat-transfer warning in Admin first. This authorizes implementation and local Admin verification now; published-game delivery remains separate. A pending transfer is not a global prohibition on further balance transfers, but its inputs remain reserved until verified.
