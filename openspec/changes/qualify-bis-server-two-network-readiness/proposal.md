# Proposal

## Deferred hosted-network scope, 2026-10-29

The current release requires Local Mutinynet and Server Signet. This proposal remains future **hosted Mutinynet** qualification and is not required to ship or restore the Local Mutinynet flow. Its existing unfinished tasks and guarantees remain incomplete. Do not enable hosted Mutinynet, wait for it during the current release, or mark this proposal complete by replacing hosted acceptance with Local-wallet results. Current Local regression and release work belong to `add-bis-server-game-wallet` and the linked Treasure/Sandbox changes.

## Execution takeover, 2026-10-29

The user requested replacement ownership, minimum calendar time and a two-hour completion target. Reuse this change and its acceptance criteria; do not restart its implementation or migrate unfinished requirements into a nominally completed replacement. The server/BIS execution chat owns this change under the current takeover section of the BIS program ledger.

Retain the Signet release prerequisite. Prepare independent deterministic and configuration work concurrently; enable Mutinynet only after its existing per-network acceptance passes. The original Treasure B2 output does not by itself block unrelated server verification.

The execution target ends at 15:28 UTC on 2026-10-29. This target does not waive live evidence, spending limits or uncertain-operation preservation. Report an exact external blocker once, continue independent authorized work, and reopen the blocked action only when its recorded prerequisite changes.

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
