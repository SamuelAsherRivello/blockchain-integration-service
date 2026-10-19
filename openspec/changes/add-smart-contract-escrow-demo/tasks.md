# Tasks

## Contract model and public boundary

- [x] Add provider-neutral escrow identifiers, statuses, approval flag, deadline, role, fee, and evidence DTOs to the integration contract surface.
- [x] Add durable escrow persistence with a distinct purpose and migration-safe versioning.
- [x] Implement Send Escrow with a caller-supplied unique ID, `approveUponCreation`, two-minute funding, quote capture, and taken-ID failure.
- [x] Implement repeatable Check Escrow with all lifecycle statuses, approval state, stale/unavailable/not-found fallbacks, and derived time remaining.
- [ ] Verify Arkade SDK and Signet support for sender approval; implement separate idempotent Approve Escrow using the supported signature or settlement path.
- [x] Implement Receive Escrow as the actual payment with recipient/deadline/approval guards, idempotent terminal fallbacks, and confirmed terminal state.
- [x] Implement sender refund/recovery after expiry and expose its actual fee and result.
- [x] Reconcile pending, expired, refunded, and uncertain escrow operations without treating missing reads as success.

## Admin demo and documentation

- [x] Add `Smart Contracts - 1` after Assets with the four ordered controls and truthful availability guards.
- [x] Connect each control to the provider-neutral escrow API and report sanitized outcomes in Console.
- [x] Show amount, sender, recipient, status, two-minute time remaining, fee quote/final fee, and evidence freshness.
- [x] Update current user-story documentation and diagrams with the new section and four calls.

## Verification

- [x] Add unit tests for lifecycle transitions, repeated checks, expiration, wrong recipient, duplicate mutation, and fee classification.
- [x] Add Admin rendering tests for order, labels, disabled reasons, and Console routing.
- [x] Run compile, lint, and relevant integration tests. (Compile/build and targeted tests pass; this repository does not define an `npm run lint` script.)
- [ ] Verify the real Signet workflow for funding, repeated status checks, approval, receipt, timeout, and fee evidence; record unavailable capabilities explicitly.
