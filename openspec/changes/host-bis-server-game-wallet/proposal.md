# Proposal

Milestone 2 only. Deferred until [add-bis-server-game-wallet](../add-bis-server-game-wallet/proposal.md) is implemented, released and accepted. Despite this change's identifier, Vercel hosting is already a milestone 1 deliverable; this follow-up expands the hosted service's responsibilities.

## Why

Milestone 1 provides local/Vercel game signing while browsers still own complete transaction workflows. Moving selected complete operations to bis-server will centralize issuance coordination and make interrupted work recoverable through durable server operation records.

## What Changes

- Reuse the already deployed bis-server and signing safeguards. Do not repeat milestone 1's server creation, Vercel provisioning, banner, fallback or three-consumer release as prerequisites to completing milestone 1.
- Add full server-owned mint/delivery preparation, input selection, signing, submission and reconciliation behind explicit operation capabilities.
- Extend minimal signing-state coordination into durable operation intent, progress, receipts and exact-request idempotency. Preserve uncertain outcomes across process restarts and client closure.
- Add scoped operation grants and owner controls, atomic issuance quotas and server-defined item policies. Client gameplay events remain untrusted eligibility input.
- Keep local operations behind the same Vite origin and hosted clients on Pages calling Vercel. Unsupported hosted operations remain explicit; existing manual source and operation-pinning rules continue.

## Capabilities

### New Capabilities

- `bis-server-wallet-operations`: Server-owned game-wallet operations, durable recovery, exact retries, grants and capability-based client integration.

### Modified Capabilities

None. This adds an operation API alongside milestone 1's signer API. If implementation needs to change existing economy or host requirements, revise the affected specs before that expansion.

## Impact

Affects bis-server service/storage and integration operation adapters, plus deployment/client configuration for migrated capabilities. It depends on milestone 1's public identity, authorization, signing coordination and three released consumers. The adjacent game may need a verified integration package refresh when this follow-up is released.

Proposed first operations are mint and delivery; proposed storage reuses the selected milestone 1 provider. This proposal does not change trophy fee payer, reward eligibility, marketplace economics, gameplay authority or introduce a general account system. Independent background workers, saved games and cloud progression remain outside this scope. Hosted recovery is request-driven unless a later requirement authorizes a durable worker.

Current work priority is milestone 1 only. Creating these planning artifacts does not start or authorize implementation or deployment of milestone 2.
