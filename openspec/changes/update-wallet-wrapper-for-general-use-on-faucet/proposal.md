# Proposal

## Why

The BIS player and game wallets already centralize Arkade account lifecycle, balance reads, onboarding settlement, operation ownership, and reconciliation, but the prototype faucet constructs and mutates an SDK wallet independently. This duplication causes the faucet to use a different onboarding path and prevents it from receiving the same durable status, recovery, and transaction-history guarantees as BIS.

The change is timely because the faucet currently reports `fee-estimation-unavailable` during onboarding, while the shared BIS path already provides the right boundary for exact settlement and observable recovery. Generalizing that boundary will make the failure consistent and diagnosable across BIS, Marketplace, and Faucet, while leaving the external Signet operator prerequisite explicit.

## What Changes

- Extract a framework-neutral Arkade wallet service from the existing BIS wallet/onboarding implementation.
- Reuse the service for player wallets, game wallets, and the prototype faucet.
- Provide shared operations for public wallet reads, balance reads, onboarding preparation, exact settlement submission, transaction history, and reconciliation.
- Keep browser-specific concerns such as `localStorage`, `navigator.locks`, React state, and UI presentation in adapters rather than the shared service.
- Give the faucet server-side persistence and exclusive-operation dependencies suitable for its mnemonic-backed wallet.
- Make onboarding states and failures consistent across consumers, including operator-policy and `fee-estimation-unavailable` classification.
- Preserve wallet/network/operator scoping and prevent duplicate or ambiguous settlement submissions.
- Add integration and Playwright acceptance coverage proving the faucet can expose spendable Arkade funds when the configured operator is healthy.
- Do not treat a successful quote, intent registration, or returned promise as proof that funds are spendable; completion requires verified Arkade balance and transaction evidence.
- Do not claim the faucet is fixed while the Signet operator cannot create the required commitment transaction.

## Capabilities

### New Capabilities

- `shared-arkade-wallet-service`: A consumer-neutral Arkade wallet and onboarding service with scoped reads, exact settlement, durable operation status, and reconciliation hooks.

### Modified Capabilities

None. The existing onboarding and settlement requirements remain authoritative; the new capability defines the shared consumer boundary and faucet integration without changing those contracts.

## Impact

- Affected packages: `BIS/packages/integration`, `BIS/packages/prototype-faucet`, and their tests; Marketplace consumers should use the shared public integration boundary rather than duplicate Arkade setup.
- Affected APIs: the internal wallet/onboarding adapter surface and the faucet server wallet service; public game-facing APIs should remain free of Arkade SDK types.
- Affected persistence: browser wallet records remain browser-scoped; faucet operation records require a server-safe durable store and must never contain recovery phrases.
- Affected verification: unit/integration tests must cover shared service behavior, and Playwright must verify the real faucet flow through balance refresh, onboarding, transaction evidence, and spendable Arkade balance.
- External dependency: the configured Arkade operator must provide working fee estimation and commitment construction. This proposal does not simulate or bypass that requirement.
