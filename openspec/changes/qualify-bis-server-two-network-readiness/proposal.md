# Proposal

## Why

The Signet release provides a working hosted BIS server and game integration on one network. Operators and players also need the same verified behavior on Mutinynet before both networks can be presented as supported.

## What Changes

- Qualify Signet and Mutinynet hosted signer identity, authorization, test-wallet selection, and existing signing workflows independently.
- Configure separate private identity pools and state namespaces for both networks; preserve fresh balance checks and original-identity pinning for operations.
- Close network-specific reliability, provider, policy, and published-consumer gaps found during qualification.
- Update BIS and Stealth & Steel to expose hosted signing on both networks only after each network passes its acceptance checks.
- Verify the final release across local development, Vercel, BIS Pages, and Stealth & Steel Pages with deterministic tests separated from live network evidence.

## Capabilities

### New Capabilities

- `bis-server-network-qualification`: Independent hosted wallet selection and acceptance for Signet and Mutinynet.

### Modified Capabilities

- `pages-demo-deployment`: Publish and verify both network signers through the already released BIS and game consumers.

## Impact

Targets the BIS server deployment configuration and tests, network-aware game-wallet client behavior, Vercel state/policy configuration, and the matching Stealth & Steel integration. Depends on completion of [the Signet release proposal](../add-bis-server-game-wallet/proposal.md). No wallet operations are part of this proposal until the release plan identifies a bounded test and reconciles any pending operation first. The unresolved Treasure B2 output belongs to the separate Treasure follow-up, not this BIS change.
