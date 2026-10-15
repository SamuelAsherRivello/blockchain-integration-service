# Tasks

## 1. Batch generation preparation

- [x] 1.1 Add provider-neutral generation selection and BIS-owned public supply preparation; test legacy v3, repeated preparation, pending/corrupt history, full burn, positive supply, failed supply and network isolation.
- [x] 1.2 Integrate preparation into C.G.2 with exact pending recovery and stale-scope checks; test mint, burn, remint, interrupted retry and historical-result diagnostics. Document generation behavior in Admin documentation.

## 2. Marketplace verification

- [x] 2.1 Select the eligible connected Game Wallet address for inventory without changing the published catalog or guest browsing; test address/network switching and inventory isolation.
- [x] 2.2 Run focused metadata/batch/inventory tests, typecheck and affected production builds; record exact outcomes.
- [x] 2.3 Use the coordinated registered owned test-wallet pair to mint nine items through Admin, verify exact assets and structured metadata, then restore the same pair in Marketplace and verify Game Wallet cards; retain sanitized public evidence under output/reports/marketplace-batch-remint/.

