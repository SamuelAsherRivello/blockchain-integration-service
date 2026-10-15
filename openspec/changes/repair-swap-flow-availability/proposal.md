# Proposal

## Why

The Swap view currently presents a total Bitcoin balance without the transfer-eligible amount, then allows Review Transfer to proceed even when the live eligibility check knows that no confirmed, unreserved inputs are available. The user reaches a predictable quote error instead of receiving an honest disabled action or a valid review, and Account Details cannot be used as a complete cached source for the per-balance availability information.

## What Changes

- Extend the provider-neutral balance projection to include validated available amounts for the Bitcoin and Arkade portions of the account, while retaining the existing total fields and account isolation rules.
- Load and cache the complete balance projection when Account Details prepares its balance dependency, including each side's available amount; do not persist wallet values or use stale values after failure.
- Show the per-side available values in Account Details and Swap balance affordances with clear unavailable/loading states.
- Gate Review Transfer using the selected direction's verified eligibility and available amount. A transfer with no eligible funds, or with prerequisites that cannot be verified, remains disabled and explains the blocking reason; a valid available transfer remains reviewable.
- Keep quote and confirmation live validation authoritative, so cached presentation data never authorizes a transfer.
- Add focused adapter, context/cache, and browser-facing regression coverage for complete per-side availability and the currently reproducible enabled-button/quote-failure sequence.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-balance`: Account Details balance reads include complete validated per-side availability values and present them without stale or partial fallback.
- `wallet-operation-availability`: Swap availability and action state distinguish total balance from confirmed eligible unreserved funds and do not enable an action that its current eligibility result cannot support.
- `background-caching`: The shared balance cache stores the complete provider-neutral balance projection required by Details and Swap, while mutation and confirmation retain fresh live checks.

## Impact

- Affected integration balance adapter and provider-neutral `BalanceAmounts` contract.
- Affected Account Details and Swap React components, including availability state and disabled-action messaging.
- Affected integration unit/browser fixtures and transfer regression tests.
- No new dependencies, persistence schema, network operation, settlement protocol, or recovery-record migration.
