# Design

## Context

See proposal.md for the checkpoint boundary. The user supplied four reusable test identities and standing test permission on Signet and Mutinynet. Current production browser persistence includes encrypted secrets and separate operation journals; copying localStorage is not a login strategy.

## Goals / Non-Goals

Deliver a verifiable developer-tooling foundation. Do not equate synthetic tests, command parsing, faucet acknowledgements, or a dropdown with successful live funding/onboarding. Full ecosystem coverage belongs to complete-agent-test-wallet-acceptance.

## Decisions

- Shared's server-only allowlisted loader reads canonical .env.local with process-environment precedence. Legacy faucet fallback applies only when the canonical file is absent. Unlike duplicated package secrets, this gives one explicit input source without exporting generated credentials.
- Runtime recovery lives in an external DPAPI vault with restricted permissions, locks and atomic replacement. Protection failure blocks access; no plaintext fallback.
- Owned profiles are application/pair/network scoped. Restore Player then Game through production UI, validating exact origin and public identity/network markers. Unlike journal copying, this preserves each application's persistence boundaries.
- Joined Marketplace attachment requires an explicitly selected CDP page. Only public inspection and allowlisted navigation are permitted; matching a fixture never grants owned authority. Detach disconnects without closing or logging out the user.
- Durable submitting records precede side effects. Unknown outcomes retain reservations; replay reconciles original operation IDs instead of resubmitting. Standing permission removes repeated approvals, not product input/fee/recovery guards.
- Onboarding restoration and Swap-to-Bitcoin are bounded foundations. The former is not a complete public scenario; the latter has isolated coverage but outstanding live Review-control failure.

## Risks / Trade-offs

- [Windows-specific protection] → Fail closed on unsupported protection; use disposable sentinel fixtures in tests.
- [Network/provider availability] → Record unavailable or pending, never infer zero or settlement.
- [Concurrent proposals] → Commit only milestone-owned files/hunks; preserve unrelated working changes.
- [Partial acceptance mistaken for completion] → Keep milestone.md and follow-up tasks explicit about unfinished cases.

## Migration Plan

Populate Shared locally, import privately, and retain external encrypted vaults and owned profiles. Existing legacy secrets are not deleted. Rollback code without clearing vaults, profiles or pending journals. Archive/sync is separate from this requested local commit.
