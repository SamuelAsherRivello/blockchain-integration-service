## Context

See proposal.md and the completed public catalog change. Current BIS browser accounts are local; no hosted service is permitted. The public catalog's registered game-wallet address is safe to publish, but a game wallet's signing material is not.

## Goals / Non-Goals

**Goals:**

- Prove a real local transfer between separately active Player and Game Wallet browser sessions.
- Preserve public browse and guest gameplay while applying only active, owned selections.
- Keep game-facing APIs independent of Arkade types and private wallet state.

**Non-Goals:**

- Remote marketplace settlement, shared inventory coordination, player-to-player resale, custody, or fees.
- Silent use of a different logged-in game wallet as the official published address.

## Decisions

### Same-browser two-wallet proof of concept

Trading is available only after both roles have independently completed the established browser-local account lifecycle. The logged-in game wallet signs the game side; the player signs the player side. This meets the serverless constraint but deliberately cannot make a remote visitor trade against an unattended game wallet.

### Marketplace controls delegate authentication to BIS

Marketplace owns the role-specific call-to-action buttons and the trading context they unlock. Each call-to-action opens the existing BIS UI and role lifecycle instead of recreating recovery-phrase inputs, import logic, account state, or logout controls. This keeps wallet security behavior in one tested implementation and prevents the Marketplace from diverging from BIS account semantics.

### Registered address plus transparent session override

The static catalog's address remains the public default. A different successful Game Wallet Login changes only the in-memory browser trade context and is visibly identified as an override. This supports local demos without mutating published configuration.

### Loadout is an account preference guarded by ownership

Selections are persisted with the BIS account, revalidated after ownership refresh, and sent to the game in a small public game-facing model. Ownership does not automatically equip an item.

### Balance values and settlement mechanics remain implementation-gated

The existing Arkade surface must be verified to support a safe two-party asset-and-sats exchange with recoverable receipts before a trade button is implemented. Numeric tier effects also require explicit game-balance values before milestone five. The alternatives—simulated settlement or arbitrary balance values—are rejected.

## Risks / Trade-offs

- [Two independent transfers are not proven atomic] → Validate the supported Arkade primitive first; if it cannot satisfy the receipt contract, stop and update this proposal rather than claim a completed trade.
- [A local game-wallet session is unavailable to normal remote visitors] → Label the feature a local proof of concept and retain anonymous static browsing.
- [Ownership changes after equipment selection] → Revalidate ownership and clear only the affected active selection.
- [Tier values alter game balance] → Set and test approved numeric values before the game milestone.

## Migration Plan

1. Build and deploy the catalog proposal first.
2. Verify the serverless two-wallet exchange capability on Signet before exposing trading controls.
3. Add BIS loadout API/UI, release the package, and then update the packaged game consumer.
4. Roll back the game integration by ignoring the optional loadout; guest gameplay remains intact.

## Open Questions

- The exact numeric speed, damage, and damage-reduction value for each tier must be approved before milestone five implementation.
- The supported Arkade settlement sequence must be demonstrated on Signet before milestone three implementation.
