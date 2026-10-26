# Tasks

Milestone 2 only, deferred. Start after add-bis-server-game-wallet is released and accepted and the user explicitly selects this follow-up. Vercel deployment and the initial three-consumer release are milestone 1 work.

## 1. Durable operation records

- [ ] 1.1 Extend milestone 1 signing storage with normalized operation intent, stage, reservations and receipt records; verify atomic creation, changed-request rejection and concurrent exact-request joins, and document the schema/migration.
- [ ] 1.2 Implement restart-safe recovery and evidence-controlled reservation release; verify timeout/lease expiry never causes conflicting reuse and retained milestone 1 requests remain recoverable.

## 2. Complete mint and delivery service

- [ ] 2.1 Move mint preparation/input selection/signing/submission/reconciliation into a complete server operation; verify deterministic input/error/concurrency behavior and document its versioned public API.
- [ ] 2.2 Add complete server delivery and stage-aware mint-to-delivery continuation; verify a lost mint acknowledgment or failed delivery cannot repeat minting and the returned receipt matches verified network evidence.
- [ ] 2.3 Extend grants, server item policies and atomic quotas for full operations; verify recipient/item/scope/expiry rejection, exact-retry quota behavior and private owner controls, and document gameplay trust limits.

## 3. Client integration and acceptance

- [ ] 3.1 Advertise full-operation capabilities and adapt BIS consumers while preserving source/protocol-pinned old recovery; verify unsupported actions and no-server manual fallback, and document local/hosted operation differences.
- [ ] 3.2 Run appropriate package tests/typecheck/build plus approved real-network mint/delivery acceptance locally and through Vercel; verify duplicate requests, client closure, restart and lost-response recovery, with separate deterministic/live evidence under output/reports/bis-server/milestone-2/.
- [ ] 3.3 Release the updated service/integration through existing workflows when selected, refresh the verified game package if required and verify actual deployed capabilities; deliver a milestone 2 report without claiming changed trophy economics or autonomous background execution.
