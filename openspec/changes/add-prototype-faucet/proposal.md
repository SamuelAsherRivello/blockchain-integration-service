# Proposal

## Why

BIS development currently depends on separate third-party faucets when a test wallet needs Arkade sats. That interrupts local testing and makes it difficult to request a predictable amount on the correct Signet or Mutinynet operator. A clearly labeled `prototype-faucet` package can provide one development page for both networks without presenting the tool as part of the BIS product.

## What Changes

- Add a new `BIS/packages/prototype-faucet/` workspace package and browser page.
- Provide a network selector for Arkade Signet and Arkade Mutinynet.
- Accept a pasted Arkade destination and validate its syntax and selected-network compatibility before enabling funding.
- Offer configurable prototype funding amounts, initially targeting 50,000, 100,000, and 200,000 sats while respecting operator and faucet limits.
- Add a server-side funding boundary that keeps faucet-wallet signing material and liquidity-management configuration out of the browser bundle.
- Return truthful validation, pending, success, rejection, unavailable, and rate-limit states; never display an acknowledgement as confirmed receipt.
- Add local development and verification entry points for the prototype page without adding it to the reusable `@bis/integration` API.
- Keep ordinary on-chain Mutinynet and Signet BTC funding out of the first slice; reserve it for a later extension of the prototype.
- Document that the package is experimental, requires separately funded faucet wallets, and is not a BIS product or custody service.

## Capabilities

### New Capabilities

- `prototype-faucet`: A development-only Arkade faucet page and protected funding service for requesting bounded test sats on Signet and Mutinynet.

### Modified Capabilities

None. Existing BIS wallet and account capabilities remain unchanged; the prototype consumes Arkade network configuration and SDK behavior without changing the product contract.

## Impact

- Adds `BIS/packages/prototype-faucet/` to the npm workspace and shared Vite development routing.
- Adds a server runtime or deployable service boundary for funded Arkade wallet operations, plus environment-based configuration and rate limiting.
- Uses the existing `@arkade-os/sdk` dependency and configured Arkade operators for Signet and Mutinynet.
- Requires separately funded faucet liquidity and an explicitly chosen deployment model. The repository currently documents “no custom application server”; this proposal intentionally limits that exception to the development-only prototype and leaves deployment/authentication details unresolved until design review.
- Adds unit, API, and browser verification for address validation, amount limits, safe error mapping, and truthful operation states.
