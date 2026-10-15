# Proposal

## Why

The prototype faucet can have a configured and funded wallet while the page reports that its addresses or balance are unavailable. Its balance read currently shares a mutating onboarding path, so a temporary Arkade operator fee-estimation failure can hide a valid wallet balance and make diagnosis difficult. The standalone faucet page also depends on a separately started API process, which makes the documented local entry point appear broken when only its Vite server is running.

## What Changes

- Separate faucet address and balance reads from onboarding and settlement side effects.
- Keep read-only balance responses available when the operator can read wallet state but cannot currently estimate an onboarding commitment fee.
- Start or reuse the local faucet API from the standalone Vite development entry point, while preserving the shared root launcher behavior.
- Expose bounded, actionable availability states for missing configuration, operator failures, fee-estimation failures, and stale onboarding state without leaking provider payloads or wallet secrets.
- Preserve automatic onboarding only for an explicitly requested funding operation; balance refreshes must never submit or retry financial settlement.
- Add deterministic tests for read-only hydration, startup/reuse behavior, safe error mapping, and retry behavior.
- Add Playwright coverage for initial loading, populated Signet/Mutinynet address and balance states, network switching, manual refresh, and operator-unavailable presentation.

## Capabilities

### New Capabilities

- `prototype-faucet-availability`: Reliable, read-only faucet address/balance hydration and local API availability behavior for the development-only faucet.

### Modified Capabilities

- None. The existing `prototype-faucet` funding contract remains unchanged; this change hardens its read-only and local-runtime behavior.

## Impact

- Affects `BIS/packages/prototype-faucet/src/client`, `src/server`, `vite.config.mjs`, and related tests/documentation.
- Changes the balance API implementation so it reads wallet state without invoking onboarding or fee estimation.
- Adds no new public `@bis/integration` API and does not change the six-step standalone onboarding spike.
- Uses the existing Arkade SDK and local server-only environment configuration.
- Live fee-estimation availability remains operator-dependent; tests must distinguish successful read-only balance hydration from a failed onboarding submission.
