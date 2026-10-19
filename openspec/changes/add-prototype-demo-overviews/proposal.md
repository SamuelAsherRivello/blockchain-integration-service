# Proposal

## Why

The prototype sandbox currently presents the Create Wallet demo with an Overview section, while the other demos expose their documentation separately. This makes the demos inconsistent and leaves users without a concise explanation or operation-specific architecture view before they run an example.

## What Changes

- Add the same `Overview` section structure to all 19 prototype sandbox demos.
- Give every Overview three tabs: `Intro`, `Diagram`, and `Docs`.
- Add a short, audience-friendly, demo-specific Intro sentence beginning with “Demonstrates”.
- Move each demo’s existing Docs body into its Overview Docs tab without changing its destination or meaning.
- Add a reusable Mermaid sequence-diagram model with these standard columns:
  - Bitcoin `(On-Chain L1)`
  - Arkade Operator `(Off-Chain L2)`
  - Arkade Wallet `(SDK L3)`
  - Client `(L3)`
- Keep all four standard columns visible for every demo, leaving unused columns unconnected when a flow does not use them.
- Add a fifth rightmost `External Wallet (L3)` column to the two External Wallet demos.
- Define action-specific connection lines for onboarding, offboarding, payments, balances, assets, history, and each Conditional Vault action without inventing network behavior.
- Preserve the current 400px diagram canvas, responsive tab sizing, and existing demo inputs, source code, execution, loading, and output behavior.
- Update prototype tests and labels to cover the Overview structure across all demo routes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `story-driven-demo`: Every implemented prototype sandbox demonstration gains a consistent Overview presentation containing an audience-facing introduction, an accurate operation diagram, and the existing documentation body.

## Impact

- Affects `BIS/packages/prototype-sandbox/src/client/App.tsx`, navigation labels, prototype styling, Mermaid diagram definitions, and prototype sandbox tests.
- No Arkade SDK, wallet, provider, contract, or transaction behavior changes.
- No new runtime dependency is required beyond the existing Mermaid integration.
- The change is presentation-only and must preserve truthful boundaries: diagrams may omit unused layers, and they must not imply that a read or external-wallet handoff uses an SDK path that the implementation does not use.
