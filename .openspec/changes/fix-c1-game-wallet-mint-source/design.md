# Design

## Context

The current Admin C1 adapter chooses one wallet from the destination selector and calls that wallet's generic mint method. The Game Wallet already has an independent signer and funding path, while asset delivery already provides a guarded source-to-recipient transfer boundary. See `proposal.md` and the C1/asset-api spec deltas for the required behavior.

## Goals / Non-Goals

**Goals:**

- Make Game Wallet the only C1 issuance source.
- Preserve a clear, independently selectable destination.
- Reuse existing Arkade issuance, asset-delivery, reservation, and pending-operation safeguards.
- Make a Game-to-Player flow recoverable across issuance and delivery uncertainty.
- Keep the generic game-facing boundary free of Arkade-specific types.

**Non-Goals:**

- No automatic Game Wallet funding, wallet creation, recovery-phrase handling, or server-side signer.
- No change to Marketplace H1/H2, C2 trophy collection, or ordinary Player Wallet self-mint behavior outside C1.
- No new control-asset or reissuance capability.

## Decisions

1. **Represent source and destination separately at the C1 boundary.** The Admin form will carry a fixed source role (`game`) and an editable destination role (`player` or `game`). The source selector is intentionally visible for operator clarity but has one disabled value, preventing accidental Player Wallet funding. A single destination-only parameter was rejected because it hides the funding wallet and caused the current ambiguity.

2. **Compose issuance and delivery in one C1 operation.** For Game Wallet destination, the operation calls Game Wallet issuance and completes when the asset is owned there. For Player Wallet destination, the operation first issues with Game Wallet, then transfers the exact newly issued quantity to Player Wallet using the existing asset-delivery path. Direct Player Wallet issuance was rejected because it violates the requested source guarantee.

3. **Use a C1 operation journal with explicit phases.** Persist the original request, source profile, destination profile, mint operation ID, delivery operation ID when needed, current phase, and public transaction evidence. The mint operation ID remains the caller-visible identity; the delivery phase gets a deterministic child identity derived from it. A retry resumes/reconciles the recorded phase and never repeats a confirmed phase.

4. **Keep validation and funding authoritative in production operations.** The Admin UI may block missing wallets and stale session identities, but it will not use a cached balance as a final veto. Game Wallet issuance rechecks current eligible unreserved spendable inputs. Player destination delivery rechecks its address, source ownership, exact quantity, reservations, and wallet identity before submission.

5. **Return phase-aware public results.** Results may expose source and destination profile IDs, asset ID, quantity, issuance transaction ID, delivery transaction ID, and safe status/error codes. Recovery phrases, signing material, raw SDK exceptions, and private transaction payloads remain excluded.

## Risks / Trade-offs

- [Two transactions instead of one for Player delivery] → The C1 journal and deterministic delivery operation ID make the second phase retry-safe and prevent duplicate issuance or delivery.
- [Issuance succeeds but delivery is uncertain] → Preserve the source asset and operation record, return outcome-unknown, and require reconciliation before another attempt; never claim Player ownership from issuance alone.
- [Player identity changes during delivery] → Revalidate both wallet identities at phase boundaries and invalidate the Admin session if either changes.
- [Existing C1 pending records use destination-scoped shape] → Add a compatibility/recovery discriminator; treat records that cannot prove the new source/destination/phase contract as unresolved rather than replaying them.
- [Arkade SDK capability or address constraints differ across wallets] → Verify the current Signet source-to-destination asset-transfer path with focused live/fixture tests before reporting the change complete.

## Migration Plan

1. Add the source/destination request and result types while preserving compatibility adapters only where needed for existing non-C1 callers.
2. Implement the Game Wallet issuance plus optional Game-to-Player delivery coordinator and journal migration/reconciliation.
3. Update the Admin dialog and console logging to expose fixed source and selected destination.
4. Update focused unit, integration, and browser-host tests, then synchronize the main OpenSpec and user-story documentation after verification.
5. If rollout must be reverted, keep the new records readable and disable new C1 submissions rather than replaying old pending operations through the previous single-wallet semantics.
