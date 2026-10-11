# Proposal

## Why

C.G.2 reuses fixed v3 mint operation IDs after C.G.3 burns the catalog. The mint API correctly returns the historical successful result, but subsequent ownership verification fails at Shoes I. Public Signet evidence confirms valid structured metadata and zero supply for the previous nine assets.

## What Changes

- Select durable batch generations from scoped mint history; retain operation IDs during retry and recovery.
- Permit a new generation after every previously issued batch asset is independently verified fully burned; never infer burning from missing wallet holdings.
- Preserve structured BIS equipment metadata and require fresh verified ownership before reporting completion.
- Make historical completion versus current submission clear in Admin diagnostics.
- Verify an owned test-wallet batch in Admin and its Game Wallet inventory in Marketplace, correcting session address selection where needed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marketplace-catalog`: safe batch generations, legacy v3 recovery, and logged-in Game Wallet inventory acceptance.

## Impact

Admin catalog orchestration and tests; a narrow BIS-owned mint-history/public-supply preparation API; Marketplace session inventory source and focused tests. Existing wallet journals, C.G.1, trophy rewards, metadata schema, cache TTL, and generic same-operation idempotency remain unchanged. No release or publication is included.
