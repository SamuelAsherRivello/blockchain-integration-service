# Tasks

## 1. Read-only faucet state

- [x] 1.1 Separate the faucet wallet balance read from onboarding preparation so `/api/faucet/balance` never creates intents, estimates settlement fees, or mutates wallet state; verify with a wallet fixture where `getBalance` succeeds and preparation fails.
- [x] 1.2 Preserve sanitized address and balance responses for configured wallets, including total boarding sats and available Arkade sats, while mapping operator and configuration failures to safe codes; verify API tests contain no raw provider payloads or secrets.
- [x] 1.3 Keep explicit funding requests on the existing preparation/send path and ensure a readable zero-available balance disables requests without claiming onboarding success; verify request tests cover readable-but-not-spendable state.

## 2. Standalone API lifecycle

- [x] 2.1 Add a standalone Vite lifecycle probe that reuses a healthy local faucet API and starts one child API process only when the health endpoint is unavailable; verify repeated startup does not create a duplicate listener.
- [x] 2.2 Track ownership of a child API process and terminate only a child started by the Vite server on shutdown; verify an externally started API remains running and a child-started API is cleaned up.
- [x] 2.3 Bound API startup readiness and preserve a usable page when startup fails; verify the standalone command reports an actionable unavailable state instead of hanging indefinitely.

## 3. Faucet page behavior

- [x] 3.1 Hydrate addresses and balances independently for the selected network, cancel stale requests, and refresh both values after network selection or the explicit Refresh action; verify Playwright shows distinct Signet and Mutinynet data after switching.
- [x] 3.2 Render total and available balances with truthful readiness messaging, including a populated boarding balance with zero spendable Arkade balance; verify the request button stays disabled until the actual selected amount is spendable.
- [x] 3.3 Keep error and loading states actionable without exposing provider details, recovery material, or the removed informational notice; verify the rendered page contains no secret-entry control or obsolete notice text.

## 4. Documentation and verification

- [x] 4.1 Update the prototype faucet package README with the single-command standalone workflow, read-only balance semantics, and the distinction between wallet balance and spendable Arkade balance; verify every command and path exists.
- [x] 4.2 Add deterministic API and lifecycle tests for healthy reuse, child startup, cleanup, read-only balance success during fee-estimation failure, and safe unavailable errors; verify `npm test --workspace @spike/prototype-faucet` passes.
- [x] 4.3 Run Playwright against the standalone faucet route and verify initial populated state, both network selections, manual Refresh, unavailable response handling, no unexpected console errors, and no obsolete notice text; retain only privacy-safe diagnostics under `output/reports/prototype-faucet/`.
- [x] 4.4 Run `npm run build --workspace @spike/prototype-faucet`, `npm run typecheck`, and OpenSpec strict validation; verify unrelated working-tree changes remain untouched.
