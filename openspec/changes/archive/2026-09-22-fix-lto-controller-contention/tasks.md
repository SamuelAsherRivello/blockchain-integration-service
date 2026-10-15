# Tasks

## 1. LTO Service Coordination

- [x] 1.1 Add focused failing coverage for same-session idempotency, stale readiness failures, fresh-session retry after readiness returns, and cooperating-controller same-key starts; verify `npm.cmd exec --workspace @bis/integration -- node --test tests/lto-service.test.mjs` fails only on the intended pre-fix assertions.
- [x] 1.2 Narrow in-memory attempt caching so it deduplicates only the exact active session request while preserving durable per-session attempt markers; verify repeated same-session starts still submit at most once.
- [x] 1.3 Ensure fresh sessions enter the existing cleanup/allocation path after an earlier readiness-failed session and that exactly one cooperating controller obtains the durable slot; verify `tests/lto-service.test.mjs` passes.
- [x] 1.4 Confirm prior-offer cleanup and unresolved refund behavior remain unchanged; verify existing replacement, end-during-funding, unknown-claim, logout-recovery and reservation tests still pass in `tests/lto-service.test.mjs`.

## 2. Treasure/G2 Session Behavior

- [x] 2.1 Add or update treasure-session coverage proving a losing session cannot adopt another session's contract and cannot submit Claim; verify `npm.cmd exec --workspace @bis/integration-demo -- node --test tests/treasure-session.test.mjs` passes.
- [x] 2.2 Update G2/browser fixture expectations for cooperating demo starts if needed; verify `npm.cmd exec --workspace @bis/integration-demo -- node --test tests/lto-browser-check.mjs` passes when the local fixture server is available, or document why browser fixture verification was not run.

## 3. Validation

- [x] 3.1 Run focused regression commands for the affected areas: `tests/lto-service.test.mjs`, `tests/treasure-session.test.mjs`, and any updated browser fixture; verify all run commands and results are recorded in the final implementation summary.
- [x] 3.2 Validate the OpenSpec change with `openspec validate fix-lto-controller-contention --strict`; verify the change passes before requesting review.
