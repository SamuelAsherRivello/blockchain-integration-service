# Proposal

## Required release step 9, 2026-10-29

The user explicitly requires the complete Sandbox Treasure Hunt, not wallet opening plus unavailable stubs. Finish all four existing routes: Create 22, Check 23, Claim 24 and Reject 25. Vet their shared real contract lifecycle, original terms, transaction evidence and recovery on Signet and Mutinynet. Implement and test locally before the coordinated release, then verify the four deployed pages as final step 9. No page is complete while its supported contract operation remains an unimplemented placeholder.

Retain the existing direct Arkade SDK workflow and Setup Wallet 2, with no BIS Account or signing service dependency. This teaching flow remains Direct on both networks; the main BIS/game network split does not replace it with a hosted signer. Use a real compiled contract and contract-derived outputs. Same-wallet test roles are permitted. Preserve original wallet data and unresolved operations, and use only eligible registered test-wallet inputs for acceptance.

## Why

The Prototype Sandbox currently teaches the real Conditional Vault lifecycle as its only smart-contract example. Adding the production treasure LTO flow gives developers a second, approachable contract example that demonstrates a time-limited reward while reusing BIS behavior and preserving truthful network and transaction status.

## What Changes

- Add a Treasure Hunt smart-contract demo group to the Prototype Sandbox beside Conditional Vault.
- Demonstrate starting an explicit 1,000-sat, 90-second treasure offer, inspecting its current state, and claiming or rejecting a matching offer through the Arkade SDK.
- Use the selected network's supported contract mode without a mode input or silent fallback.
- Use Setup Wallet 2 through the same SDK wallet helper as the other prototype demos, without a BIS Account or service.
- Keep game-only chest placement, collisions, dialogue, pause behavior, and session orchestration out of the sandbox; the sandbox presents developer controls for the same generic contract lifecycle.
- Report pending, unavailable, expired, rejected, claimed, and unknown outcomes from real API/provider evidence without fabricating success or automatically retrying uncertain financial actions.
- Expose network choices only when the current BIS implementation supports them, and identify each network's actual contract/validation mode and limitations.
- Keep each executable demo source in the required `Arrange`, `Act`, `Assert` section order and synchronize the package README and demo registration.

## Capabilities

### New Capabilities

- `prototype-treasure-contract-demo`: A network-backed sandbox teaching flow for creating, inspecting, claiming, and rejecting a time-limited treasure contract through BIS public APIs.

### Modified Capabilities

None.

## Impact

The change affects `BIS/packages/prototype-sandbox` navigation, route rendering, source registration, contract lifecycle presentation, package documentation, and focused deterministic tests, plus `BIS/packages/integration` public request types and LTO mode propagation. The sandbox consumes the public BIS API; it does not copy the game-owned runtime/session/UI or introduce a parallel contract implementation. Live Signet and Mutinynet acceptance remains distinct from deterministic UI/API tests. The game-side treasure production work is still WIP, so implementation must verify current public BIS API and network capability before claiming parity or readiness.
