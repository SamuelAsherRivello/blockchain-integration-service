## Why

Games need to earn and query wallet-owned achievements through BIS without mounting achievement UI. A combined C1/C4 demonstration will exercise that public API directly from Admin before pay-to-play work.

## What Changes

- C1 calls a public earn API with the exact string ``achievement-`level-one` ``. The active player wallet issues a real Signet asset to itself and supplies any required sats; no Claim dialog or other BIS runtime UI opens.
- Repeated earning of an owned achievement returns `already-owned` without another issuance. Missing accounts return `account-required` without opening account UI.
- C4 calls a public list API returning recognized achievements owned by the active wallet, including after restoration. Errors are distinct from an empty collection.
- Admin gains a non-clickable C1 container with an Earn button, a C4 View Achievements button, and an always-visible Admin Console showing public results. These actions do not change Runtime Preview.
- Add D. Possible refactors / D1. Game-controlled wallet or issuer as a brief documentation-only future idea requiring more specification.
- B remains deferred. C1 now includes direct issuance, superseding the earlier opportunity-only assumption. Separate C2 claim UI, broad C3 recovery UI, C5 rewards, and game-controlled issuance remain outside this change; safe repeat/uncertain-outcome handling for this API remains necessary.

## Capabilities

### New Capabilities
- `achievement-api`: UI-independent player-wallet achievement issuance, ownership queries, typed results, and duplicate protection.

### Modified Capabilities
- `story-driven-demo`: Admin-only C1/C4 API demonstrations and persistent console, preserving account demonstrations and preview behavior.

## Impact

Implementation will affect integration public exports, core orchestration, Arkade adapters, and integration-demo Admin composition and styles. No game repository, custom application server, new dependency, or achievement overlay is required. User-story documentation and design discussion must reflect this revised C1/C4 flow without claiming delivery before verification.

The installed SDK exposes issuance, balances with assets, and asset metadata queries. Funded issuance/list/restoration against the configured Signet operator is not yet verified; implementation begins with that feasibility gate. Proposed API names, metadata format, and conservative retry mechanics are implementation design choices, not additional user-confirmed product decisions.
