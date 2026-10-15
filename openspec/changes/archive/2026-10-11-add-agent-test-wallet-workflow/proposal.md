# Proposal

## Why

Provide a reusable, privately configured test-wallet tooling foundation so subsequent proposals can build on a committed milestone. The user requested this checkpoint on 2026-10-11; full ecosystem implementation and live acceptance continue separately.

## What Changes

- Deliver Shared's canonical secret-free template and server-only configuration loader, backported faucet launch paths, and Git/AI/triage/Vite exclusions for populated files.
- Deliver encrypted Windows-user vaults, four-slot private import, generated test-account registration, distinct Player/Game assignments, and identity-bound standing test authorization on Signet and Mutinynet.
- Deliver durable operation reservations and conservative retry/reconciliation, initial owned Admin/Marketplace restoration and lifecycle workflows, payment/funding runners, and explicit read-only joined Marketplace sessions.
- Include the implemented Swap-to-Bitcoin runner and onboarding restoration seam as foundations, not completed live conversion acceptance.
- Include public session markers, network-correct transfer bookkeeping, logout reservation classification, and the isolated Swap availability regression fix.
- Record the boundary and known limitations in milestone.md. Move unfinished implementation and the full live acceptance matrix to complete-agent-test-wallet-acceptance.

## Capabilities

### New Capabilities

- `agent-test-wallets`: Private test identity configuration, owned-session tooling, restricted joined sessions, and durable operation accounting.

### Modified Capabilities

None. Existing production guards remain authoritative; these adapters do not add an account bypass.

## Impact

Developer tooling, Shared, faucet server entry points, narrow integration fixes, tests and workflow documentation. Supplied plaintext configuration remains local; generated runtime recovery stays encrypted outside the repository. No hosted signing service, published fixture endpoint, mainnet support, or human-profile takeover.

This completed foundation does not claim game integration, unrestricted owned interactions, preparation/rotation, asset/contract scenarios, complete onboarding, or both-network live acceptance. Those remain in the linked follow-up; the original scope is preserved there.
