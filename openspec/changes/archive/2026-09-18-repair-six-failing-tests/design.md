## Context

See `proposal.md` for the motivation and failure inventory. The current failures span the demo Admin panel, production account collection UI, account restoration, boarding cleanup, and public LTO lifecycle tests. Existing specifications already define the intended behavior, so the implementation should first determine whether each failure is a stale assertion/fixture or a real regression.

## Goals / Non-Goals

**Goals:**

- Make each of the six named failing tests express the current production contract.
- Keep test doubles complete enough to exercise the same public component/controller boundaries as production.
- Preserve cancellation invalidation, wallet-role separation, durable recovery, and truthful unavailable states.
- Finish with focused evidence for each failure and a clean full-suite build/typecheck run.

**Non-Goals:**

- No new wallet, Arkade, LTO, or account capability.
- No weakening of lifecycle guards merely to satisfy a test.
- No real Signet operations, external network calls, recovery phrases, or release/version changes.
- No cleanup of unrelated OpenSpec changes or dirty worktree files.

## Decisions

1. **Classify each failure against the existing requirement before editing.**
   - The F2 Admin assertion will follow the current readiness guard if the Admin game-wallet contract requires a connected Player Wallet; only the arrow-only affordance itself must remain stable.
   - The collection test will provide a minimal valid `BisContext` fixture (`getState` and the required network/profile state) rather than making `AccountContracts` hide production reads from an invalid test object.
   - The account-entry label failure will use `account-entry` as the authority: the current requirement names `⚡ Create Account` and `⚡ Restore Account`, so implementation wording should be restored unless a direct current decision in the repository supersedes that requirement.
   - The boarding cleanup failure will repair the IndexedDB transaction double to model abort/error completion deterministically; production cleanup must continue to surface durable storage failure and preserve unresolved identity/journals.
   - The LTO public-factory test will preserve default creation and explicit `creationEnabled: false` rollback coverage. If the fixture is not satisfying the documented readiness preconditions, fix the fixture or factory option propagation; do not bypass readiness or network boundaries.
   - The delayed-restoration test will assert the documented invalidation boundary: after Back, disposal, replacement, or reset, the stale operation may finish internally but cannot save, activate, or emit `accountConnected`.

2. **Prefer the smallest scoped change.**
   Update stale assertions and incomplete doubles when production already matches the contract. Edit production code only when a focused test demonstrates that it violates the existing requirement. Avoid broad refactors across account, contract, or wallet modules.

3. **Verify in increasing scope.**
   Run each affected test file in isolation, then the six-failure set together, then `npm test`, `npm run typecheck`, and `npm run build`. The final report must distinguish test repairs from implementation fixes and record any remaining failure with its exact assertion.

## Risks / Trade-offs

- [Risk] A test may be stale while the current requirement has intentionally changed → Mitigation: inspect the full existing spec and nearby tests before changing either side; do not silently rewrite the contract.
- [Risk] Async fixtures can pass alone but fail under the full runner due to shared globals → Mitigation: restore mocked globals in `finally`, use deterministic deferred gates, and run the full suite after focused tests.
- [Risk] Relaxing an abort or cancellation assertion could permit stale wallet state → Mitigation: retain explicit assertions that no save, activation, event, or competing operation occurs after invalidation.
- [Risk] The public LTO test could accidentally reach a real provider → Mitigation: retain the fetch guard and isolated Vite boundary stubs; assert that all calls remain inside the injected seams.
