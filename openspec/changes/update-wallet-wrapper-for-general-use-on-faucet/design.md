# Design

## Context

The current BIS wallet layer already separates Arkade operations from game-facing state, but the prototype faucet creates its own SDK wallet in server code and calls the SDK ramps helper directly. The BIS onboarding adapter also contains browser-specific locks, browser mutation coordination, and browser-scoped records, so it cannot be imported unchanged into the faucet. See `proposal.md` and the shared capability delta for the required behavior.

The current Signet operator is an external prerequisite. A healthy quote or policy response is not sufficient: the operator must successfully create the commitment transaction before the faucet can report available Arkade funds.

## Goals / Non-Goals

**Goals:**

- Define a shared, consumer-neutral boundary for Arkade reads, onboarding preparation, exact settlement, status, and reconciliation.
- Keep Arkade SDK types inside the integration boundary and keep game-facing APIs provider-neutral.
- Allow browser BIS wallets and the server faucet to inject their own persistence, locking, cancellation, and lifecycle behavior.
- Reuse one settlement implementation so the faucet does not diverge from Player Wallet and Game Wallet behavior.
- Make operator capability failures explicit and verifiable in unit tests and Playwright.

**Non-Goals:**

- Repairing the external Signet operator in this change.
- Moving existing Bitcoin boarding UTXOs between operators.
- Introducing simulated balances, fake transaction IDs, or a second wallet protocol.
- Reworking the marketplace product UI beyond switching its wallet operations to the shared public boundary where necessary.

## Decisions

### 1. Extract a low-level scoped service, not the whole Game Wallet controller

The shared service will own public wallet reads, input assessment, policy validation, settlement submission, event/status normalization, transaction history, and reconciliation. Player/Game Wallet controllers will continue to own account roles, browser state, UI subscriptions, and game-specific operations.

This is preferred over making the faucet instantiate `createBisGameWallet`, because the Game Wallet controller requires browser storage and Player Wallet role coordination. It also avoids exposing a server faucet as a fake game wallet.

### 2. Inject consumer dependencies

The service will receive a scoped account/operator configuration and dependency interfaces for persistence, exclusive mutation ownership, cancellation, and lifecycle cleanup. Browser adapters will provide browser implementations; the faucet will provide server-safe implementations.

This is preferred over importing browser globals into server code or duplicating the settlement algorithm. The service must not persist or return recovery phrases.

### 3. Use exact settlement for submission and retain existing onboarding contracts

Preparation may use SDK quote information, but the submission boundary will build and submit the exact validated input/output plan through the shared settlement path. Existing onboarding requirements for confirmed inputs, policy checks, reservations, attribution, recovery, and verified spendability remain authoritative.

This is preferred over retaining the faucet's direct `Ramps.onboard()` mutation path, because that path does not provide the BIS operation journal or reconciliation guarantees.

### 4. Normalize errors without hiding their cause

The service will map SDK/operator failures into stable categories such as `operator-unavailable`, `policy-unsupported`, `settlement-rejected`, `outcome-unknown`, and `complete`, while retaining safe diagnostic detail for logs and UI. `fee-estimation-unavailable` will remain an operator capability failure and will never become a successful or spendable state.

This is preferred over passing raw SDK errors through every consumer or converting all failures to generic `Unavailable`.

### 5. Treat the faucet as a real server consumer

The faucet will use a durable operation record keyed by network, wallet identity, and operation identity, plus process-level exclusivity. Its HTTP API will expose current public status and transaction evidence, while secret material remains server-only.

For the initial implementation, a small file-backed or equivalent server-safe record store may be used if it matches repository conventions; the abstraction must allow replacement without changing settlement behavior.

### 6. Verify real capability before claiming completion

Tests will separate operator capability checks from client behavior. Playwright acceptance will pass only when the configured operator produces real commitment/Arkade evidence and the faucet displays a positive available balance. If the operator still returns `fee-estimation-unavailable`, Playwright will verify truthful failure/retry behavior instead of treating that run as success.

## Risks / Trade-offs

- [External operator remains unavailable] → Keep the faucet in an explicit unavailable state, retain its boarding funds, and block success claims until a real settlement succeeds.
- [Browser and server persistence semantics differ] → Keep persistence and locking injected and test each adapter independently; never share browser storage assumptions with the faucet.
- [A lost response creates an ambiguous submission] → Persist the attempt before mutation, reconcile transaction history and operator state, and prohibit replay until the outcome is known.
- [SDK upgrade changes settlement behavior] → Pin the existing SDK during extraction and run the full shared-service and Playwright suite before considering an upgrade.
- [Marketplace has product-specific wallet roles] → Have marketplace code consume the neutral service through existing BIS controllers; do not make the neutral service own marketplace UI or role selection.

## Migration Plan

1. Add the shared service and dependency contracts without changing existing consumers.
2. Adapt the BIS onboarding implementation to the service and preserve current browser records and locks.
3. Adapt the faucet to the service, replacing its direct ramps mutation and adding server operation persistence.
4. Route any remaining Marketplace settlement/onboarding calls through the BIS public integration boundary.
5. Run unit and integration tests, then run Playwright against a healthy operator and separately verify the unavailable-operator path.
6. Roll back by restoring the prior consumer adapters only if the new service cannot preserve existing wallet records or operation evidence; do not delete wallet data or retry ambiguous operations during rollback.

## Open Questions

- The exact durable server persistence mechanism for the faucet can be selected during implementation if it preserves the specified operation identity, recovery, and secret-handling guarantees.
