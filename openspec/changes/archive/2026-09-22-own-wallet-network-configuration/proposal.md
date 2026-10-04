# Proposal

## Why

Wallet operations currently interpret live operator/network terms in several adapters, which lets small representation changes such as a zero fee reported as `0.0` become user-facing failures. BIS should own a shared wallet-network configuration and capability layer so supported networks, operators, fee policies, and operation availability are normalized once and consumed consistently by sends, transfers, onboarding, contracts, assets, and game-wallet payments.

## What Changes

- Add a shared wallet network configuration capability that owns supported network definitions, operator endpoints, reported-network verification, fee schedule normalization, freshness, and operation capability checks.
- Replace scattered fee and network checks with a single normalized policy result that distinguishes supported zero-equivalent terms from truly unsupported/nonzero or unverifiable terms.
- Make every wallet operation consume the shared policy before quote, review, or submission, and require final revalidation at submission boundaries.
- Surface actionable availability reasons before the user reaches blocked review/confirmation flows whenever the operation cannot run on the active network/operator.
- Preserve the existing no-custom-server constraint: all checks remain client-side reads of configured network/operator metadata and fresh SDK/provider evidence.
- Do not authorize speculative support for nonzero transfer/contract/onboarding fees; unsupported terms remain blocked, but zero-equivalent formatting differences do not.

## Capabilities

### New Capabilities

- `wallet-network-configuration`: Defines BIS-owned network/operator metadata, normalized operator policy, freshness requirements, capability gating, and safe availability/error behavior for wallet operations.

### Modified Capabilities

- `account-boarding-settlement`: Transfer quote/review/confirmation must consume normalized wallet-network policy instead of adapter-local string checks.
- `account-automatic-onboarding`: Automatic onboarding must consume the shared policy for both legs before submission and during revalidation.
- `wallet-operation-availability`: Operation availability must report shared network/operator capability reasons consistently across wallet mutation paths.
- `account-address-sending`: Direct send must continue to bind full fee policy into quotes while obtaining it from the shared configuration layer.

## Impact

- Affected code: `BIS/packages/integration/src/core/test-network.ts`, `BIS/packages/integration/src/arkade/account.ts`, `arkade/boarding.ts`, `arkade/sending.ts`, `arkade/onboarding.ts`, `arkade/lto-contract.ts`, `core/context.ts`, wallet availability/recovery helpers, and UI surfaces that show blocked-operation reasons.
- Affected APIs: No breaking public API is planned. Existing operations keep their current entry points but receive more consistent availability and error behavior.
- Affected tests: Add policy-unit tests for fee normalization and network mismatch; update transfer, send, onboarding, contract, and wallet-operation availability tests to consume shared fixtures; add a regression for Mutinynet zero-equivalent fees such as `0.0`.
- Dependencies: No new external dependency is expected.
