# Design

## Context

The prototype faucet already has separate address, balance, and funding endpoints, but the wallet adapter currently routes balance reads through a preparation path that may attempt Arkade onboarding. The standalone package Vite configuration proxies API calls but does not start the API, while the shared root launcher has its own startup behavior. The existing `prototype-faucet` contract remains the funding boundary; this change adds availability and read-only reliability around it.

## Goals / Non-Goals

**Goals:**

- Make address and balance hydration read-only and safe during operator fee-estimation outages.
- Make the standalone package command self-contained without duplicating a healthy API.
- Preserve separate truthful states for total boarding funds, spendable Arkade funds, and funding readiness.
- Verify both populated networks and operator-unavailable states in browser automation.

**Non-Goals:**

- Changing Arkade operator fee configuration or promising that an external operator can onboard funds while its estimator is unavailable.
- Moving faucet secrets to the browser, adding a public deployment, or adding an arbitrary manual onboarding control.
- Changing the existing bounded funding amounts, address validation, rate limits, or operation-verification contract.

## Decisions

### 1. Keep balance reads separate from preparation

The wallet adapter will obtain the wallet and call its read-only balance method for `/balance`. The existing preparation path remains available to explicit send requests, where onboarding is necessary to make a request spendable. This prevents a read from creating intents or failing solely because fee estimation is down.

Alternative: keep preparation inside balance and hide the error in the client. Rejected because it makes a harmless read mutate external state and masks a valid boarding balance.

### 2. Start the API in the standalone Vite lifecycle

The package Vite configuration will probe the health endpoint before spawning the API. It will only own and terminate the child process it started; a healthy pre-existing process is reused. The shared root launcher remains authoritative for the multi-package development server and can continue its own API startup logic.

Alternative: require developers to run a second command. Rejected because the package’s documented standalone entry point then presents a broken page by default.

### 3. Preserve distinct balance semantics

The response will continue to expose sanitized numeric fields for total and available balances. The UI will show both, but request readiness will depend on spendable available balance and the requested amount. A readable total with zero available is not treated as funding success.

Alternative: display only available balance. Rejected because it hides confirmed boarding liquidity that explains why onboarding is the next required operation.

### 4. Test provider failure through the boundary

Unit/API tests will inject a wallet whose read succeeds while preparation fails, proving that balance remains readable. Browser tests will route successful network responses and operator failures through the actual page, then verify network switching and Refresh. Live operator checks remain evidence, not deterministic test fixtures.

## Risks / Trade-offs

- [A standalone Vite process may be killed without closing cleanly] → Keep API lifecycle cleanup best-effort and retain the health probe so the next run can reuse or replace it.
- [A reused API may use stale code or environment] → Health reuse is limited to the documented local port; operators can restart it explicitly when configuration changes.
- [Total boarding sats may appear while no Arkade sats are spendable] → Label total and available separately and keep request readiness tied to available balance.
- [A live operator can fail after deterministic tests pass] → Keep live verification separate and map the exact safe error without claiming conversion success.
