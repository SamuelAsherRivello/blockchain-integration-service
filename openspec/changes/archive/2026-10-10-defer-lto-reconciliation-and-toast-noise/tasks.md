# Tasks

## 1. Trigger-aware BIS reconciliation

- [x] 1.1 Add explicit reconciliation intent and feedback scope to the provider-neutral LTO controller, preserving durable record formats and existing operation guards; verify TypeScript compilation and existing LTO unit tests pass.
- [x] 1.2 Remove eager reconciliation and unconditional polling from controller construction, then add active-operation monitoring that starts only after an explicit offer/action and stops at terminal or lifecycle completion; verify a recreated controller performs no provider-backed reconciliation on construction.
- [x] 1.3 Preserve targeted cleanup, reservation, and exact receipt verification for explicit status checks, new offer starts, claims, rejects, refunds, and active operations; verify unresolved records remain durable and competing starts remain blocked in recovery/concurrency tests.

## 2. Operation feedback and Admin contract surface

- [x] 2.1 Make passive reads and startup restoration silent while retaining truthful pending, unknown, unavailable, and terminal contract projections; verify an unchanged pending funding record produces no toast after controller recreation.
- [x] 2.2 Update Admin Contracts navigation/details to read on entry and expose an explicit selected-contract status check/reconcile action without reconciling unrelated records; verify browser coverage for empty, pending, uncertain, terminal, and unavailable contract states.
- [x] 2.3 Keep D.P.2 Start LTO as the explicit Admin funding trigger and route funding progress to the story state/Console rather than a generic startup toast; verify refresh/mount does not create an offer and an explicit Start LTO still does.
- [x] 2.4 Add or update Admin unit/browser tests for explicit Claim, Reject, and Refund feedback, including no repeated `Offer funding pending` toast across refreshes; verify the relevant package test command and browser check pass.

## 3. Game-facing treasure lifecycle contract

- [x] 3.1 Update the public provider-neutral lifecycle documentation/types so a game starts a level-scoped offer explicitly and can inspect the exact session contract at chest interaction; verify no Arkade-specific type is exposed in the public package surface.
- [x] 3.2 Update the BIS treasure demo controller to keep Admin demo sessions explicit, preserve the deadline/session binding, and avoid adopting unrelated or previous sessions; verify existing treasure-session tests cover start, stale attempt, wallet change, and exact-contract matching behavior.
- [x] 3.3 Coordinate the separate game consumer to start funding at level start, keep gameplay nonblocking, query the exact offer at chest interaction, and show preparation/no-offer/unavailable states in game UI; verify the consumer’s integration tests or documented manual browser flow against the revised package.
- [x] 3.4 Define and verify the user-visible toast matrix: no startup funding toast, optional pending feedback only after explicit Claim/Reject or active operation presentation, and verified claim/refund feedback only once per presentation session; verify claim/reject and reload scenarios in host and game acceptance tests.

## 4. Integrated verification and documentation

- [x] 4.1 Update LTO, Contracts, treasure-demo, and toast behavior documentation to describe deferred reconciliation, explicit triggers, and the distinction between durable recovery and user feedback; verify internal links and status wording remain accurate.
- [x] 4.2 Run the affected BIS package typecheck/build and focused LTO/Admin browser tests; verify no test expects provider reconciliation or a pending toast solely from application startup.
- [x] 4.3 Perform an end-to-end refresh/reopen matrix with an unresolved funding record, explicit Contracts inspection, explicit status check, Admin Start LTO, game level start, chest interaction, Claim, and Reject; verify no unnecessary startup toast and no duplicate funding/claim/refund submission.
