# Design

## Deferred execution boundary

The 2026-10-29 user decision makes this a future hosted-Mutinynet change. Its two-hosted-network design below remains prospective. Current release routing is Mutinynet/Local and Signet/Server, with independent regression and real contract evidence. No task in this proposal is a prerequisite for Local Mutinynet. Keep its incomplete hosted-signing criteria and original evidence unchanged.

## Current execution ownership

The 2026-10-29 takeover section of the BIS program ledger supersedes historical owner/thread assignments and obsolete package-version observations in this document. It does not supersede contract guarantees or safety requirements. Use the actual accepted candidate version, archive hash and source evidence rather than a historical 0.0.27/0.0.29/0.0.30 observation.

The server/BIS owner follows the execution order in proposal.md. One owner writes BIS runtime/release files, one writes game runtime/release files, and the coordinator writes the shared program ledger. Only the assigned financial-slot owner may operate protected acceptance wallets. The other owner can prepare wallet-free code, fixtures, synchronization and browser observations.

Preflight the exact test command, browser cache and private temporary-path requirements with a small affected check. Reuse unchanged-source evidence, run focused checks during fixes, and run required integrated checks after the candidate is frozen. Do not start competing suites or replace real hidden-tab or network evidence with injected state.

## Context

See `proposal.md` for motivation and scope. The Signet release establishes the deployed service, API, storage, and consumer wiring. Current implementation work already includes network-aware identity selection, but deployed acceptance has not proven Mutinynet configuration or signing. Keep test identities, authorization, caps, and storage isolated by network.

## Goals / Non-Goals

**Goals:** Establish equivalent, separately evidenced Signet and Mutinynet service behavior; make the selected network and signer identity explicit across consumers; safely expand public hosted signing after both networks pass.

**Non-Goals:** Move operation preparation, submission, journals, or recovery into the service. Resolve Treasure contract recovery or the original B2 output. Enable mainnet or production treasury keys.

## Decisions

- Keep a separate private three-slot pool for each network. Evaluate candidates in configured priority order against fresh, operation-appropriate balance data; confirmed Bitcoin and Arkade-spendable sats remain distinct.
- Keep signer selection and all persisted state network-scoped. Never use the other network as fallback, and pin each in-flight operation to the identity that created it.
- Enable hosted Mutinynet signing only after deployed identity, policy, quota, concurrency, replay, and real signing acceptance passes. Until then, hosted Mutinynet signing remains unavailable while consumers retain the separately qualified Local Mutinynet workflow.
- Use existing free-tier Vercel and datastore resources. Recheck current plan eligibility and limits without upgrading or moving secrets into source control, Pages, or chat.
- Reuse the Signet release as the baseline and record each network's receipts and checks separately. A test on one network cannot satisfy the other network's acceptance task.

## Risks / Trade-offs

- **Provider or indexer state differs by network** → verify fresh balances and signing paths against each network's actual endpoints; unknown results do not qualify a candidate.
- **Shared hosted state can cross network boundaries** → include network in every key, grant, reservation, and request comparison, then exercise concurrent and replay cases independently.
- **Mutinynet acceptance may expose server or contract limitations** → leave hosted Mutinynet disabled until the limitation is fixed and the full affected acceptance is rerun.
- **Signet and Mutinynet could be mistaken for one identity** → show network and public identity together in diagnostics and consumer UI.

## Migration Plan

1. Complete and retain the Signet release.
2. Configure Mutinynet using its own private test identities and state namespace; preserve the active Signet configuration.
3. Verify deployment health, identity, policy rejection, caps, replay protection, cold-start/concurrent behavior, and real approved test-network signing on each network.
4. Enable both networks in BIS and Stealth & Steel only after the two-network acceptance report is complete; publish matching package and Pages releases.
5. Roll back by disabling Mutinynet hosted signing independently; preserve its operation evidence and leave Signet operational. Disable both only if shared-service correctness is affected.
