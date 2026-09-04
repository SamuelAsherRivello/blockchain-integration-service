## Why

D2a provides a usable Receive page without depending on live Lightning support. Address receiving and the unavailable invoice section already exist, but the story needs its own production demonstration, complete verification, and independently trackable delivery boundary.

## What Changes

- Adopt and verify existing Arkade/Bitcoin address receiving, copy feedback, Refresh, Back, and default unavailable invoice presentation rather than rebuilding them.
- Add a D2a receiving demonstration through the production public API, with ordinary account entry when logged out and no automatic account creation or funding.
- Complete keyboard, clipboard failure, address failure/retry, navigation, and 9:16 checks in the demo and an independent host.
- Synchronize D2a documentation and record its completion independently of D2b.
- Exclude live invoices, fee prompts, recovery processing, Lightning Activity, and invoice-specific account-clearing guards. D3 sending and D4 account transfer remain separate.

## Capabilities

### New Capabilities

- `account-address-receiving`: The address-based Receive journey with truthful unavailable Lightning presentation.

### Modified Capabilities

- `story-driven-demo`: A dedicated D2a production demonstration and evidence independent of blocked D2b.

## Impact

Relevant surfaces are integration Core public state, existing address/invoice UI and tests, and demo story selection/catalog/documentation. No new dependencies, provider integration, persistent operation storage, wallet transactions, or account-clearing changes are required.

This change owns D2a acceptance going forward and reuses work already recorded under add-lightning-invoice-receiving. That earlier change retains D2b live requirements and historical evidence; completing this change must not complete or archive the earlier combined change. Shared baseline requirements are preserved, not reimplemented. Before a later D2b spec sync, reconcile its overlapping presentation/demo deltas against the shipped D2a baseline. This proposal does not rewrite the earlier artifacts or claim their remaining tasks complete.
