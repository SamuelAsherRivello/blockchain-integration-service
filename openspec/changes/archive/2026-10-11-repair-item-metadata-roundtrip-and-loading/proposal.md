# Proposal

## Why

The structured item metadata change passes arrays directly into Arkade's scalar/byte metadata encoder, which rejects them before issuance. Listings decode custom hex fields without parsing structured JSON, and inventory requests can remain pending indefinitely, preventing the recording workflow.

## What Changes

- Encode structured metadata at the Arkade boundary and validate/decode it on fresh listings, retaining chain-provided gameplay authority.
- Bound shared inventory work, deduplicate active requests, prevent background refresh loops after failure, and make Retry initiate one fresh attempt.
- Render readable Retry and Cancel actions for inventory failures; Cancel dismisses without loading or clearing wallet data.
- Verify minting, listings, purchase, and gameplay using matching Player/Game Wallet networks and real transaction evidence.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `asset-api`: define structured metadata transport and round-trip validation.
- `marketplace-inventory-cache`: define bounded single attempts and explicit retry/cancel behavior.

## Impact

Integration Arkade metadata adapter and shared inventory lifecycle; Marketplace inventory coordinator, subscription triggers, and error presentation; Admin catalog acceptance; separate game's integration consumption and gameplay acceptance. Builds/tests and public browser evidence belong under ignored output folders. Existing recovery journals remain authoritative; no automatic burns or blind resubmissions are authorized.
