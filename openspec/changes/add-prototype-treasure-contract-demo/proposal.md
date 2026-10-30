# Proposal

## Required release step 9, 2026-10-29

The user explicitly requires the complete Sandbox Treasure Hunt, not wallet opening plus unavailable stubs. Finish all four existing routes: Create 22, Check 23, Claim 24 and Reject 25. Vet their shared real contract lifecycle, original terms, transaction evidence and recovery on Signet and Mutinynet. Implement and test locally before the coordinated release, then verify the four deployed pages as final step 9. No page is complete while its supported contract operation remains an unimplemented placeholder.

Retain the standalone Arkade SDK workflow and Setup Wallet 2, with no BIS Account, login, or signing-service dependency. This teaching flow has its own wallet path on both networks and does not use the BIS Local/Server modes. Use the same canonical real compiled Treasure contract implementation used by BIS and contract-derived outputs. Same-wallet test roles are permitted. Preserve original wallet data and unresolved operations, and use only eligible registered test-wallet inputs for acceptance.

## Why

The Prototype Sandbox currently teaches the real Conditional Vault lifecycle as its only smart-contract example. Adding the production Treasure contract gives developers a second approachable contract example that demonstrates a time-limited reward while sharing the canonical contract implementation and preserving truthful network and transaction status.

## What Changes

- Add a Treasure Hunt smart-contract demo group to the Prototype Sandbox beside Conditional Vault.
- Demonstrate starting an explicit 1,000-sat, 90-second treasure offer, inspecting its current state, and claiming or rejecting a matching offer through the Arkade SDK.
- Use the selected network's supported contract mode without a mode input or silent fallback.
- Use Setup Wallet 2 through the same Arkade SDK wallet helper as the other prototype demos, without a BIS Account, login, or service dependency.
- Keep game-only chest placement, collisions, dialogue, pause behavior, and session orchestration out of the sandbox; the sandbox presents developer controls for the same generic contract lifecycle.
- Report pending, unavailable, expired, rejected, claimed, and unknown outcomes from real API/provider evidence without fabricating success or automatically retrying uncertain financial actions.
- Expose network choices only when this standalone contract flow supports them, and identify each network's actual contract/validation behavior and limitations.
- Keep each executable demo source in the required `Arrange`, `Act`, `Assert` section order and synchronize the package README and demo registration.

## Capabilities

### New Capabilities

- `prototype-treasure-contract-demo`: A standalone Arkade SDK teaching flow for creating, inspecting, claiming, and rejecting a time-limited treasure contract with the canonical compiled contract implementation.

### Modified Capabilities

None.

## Impact

The change affects `BIS/packages/prototype-sandbox` navigation, route rendering, source registration, contract lifecycle presentation, package documentation, and focused deterministic tests. The demo uses the standalone Arkade SDK wallet path and the same canonical pure compiled-contract implementation as BIS; it does not consume BIS Account/login/server APIs, copy the game-owned runtime/session/UI, or introduce another contract compiler. Live Signet and Mutinynet acceptance remains distinct from deterministic UI/SDK tests.
