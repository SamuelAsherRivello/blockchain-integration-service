# Design

## Context

See [proposal.md](proposal.md) for motivation and scope. The repository is a React/TypeScript npm workspace with a shared Vite development server, the Arkade SDK already installed, and configured Signet and Mutinynet operator definitions. Existing BIS product boundaries explicitly avoid a custom application server and keep secrets private; this prototype is an intentional, isolated exception.

The Arkade SDK provides `ArkAddress.decode`, `isValidArkAddress`, `RestArkProvider.getInfo`, and wallet `send` operations. A prefix check such as `tark1` is insufficient to prove that an address belongs to the selected operator, so validation must compare the decoded address's operator identity with verified network information.

Reference implementations include the repository's existing faucet notes, the Mutinynet Arkade faucet, ArkFaucet's server-backed Signet design, and the Arkade `arkd` service. These are implementation references, not dependencies or product integrations.

## Goals / Non-Goals

**Goals:**

- Add one visibly experimental `BIS/packages/prototype-faucet/` workspace package.
- Support Arkade-only funding on Signet and Mutinynet.
- Keep faucet signing keys and liquidity server-side.
- Revalidate the network, destination, amount, and configured limits at the server boundary.
- Make pending and success evidence honest and safe for local development.
- Make the local workflow testable with deterministic mocks before any live-funding check.

**Non-Goals:**

- Adding faucet behavior to `@bis/integration`, Admin, Marketplace, or the game-facing API.
- Creating a general-purpose production custody service.
- Supporting ordinary on-chain BTC, Lightning, assets, user accounts, or recovery-phrase entry in the first slice.
- Guaranteeing public internet deployment, anonymous abuse resistance, or unlimited liquidity.

## Decisions

### 1. One package owns the prototype page and API adapter

`prototype-faucet` will contain the browser page, a small server-facing API client, network policy, and server entry point. The shared Vite route will serve the page during local development; the server entry point will be separately runnable and will not be imported into the browser bundle.

Keeping the prototype self-contained makes its experimental status obvious and avoids adding faucet types or APIs to `@bis/integration`. Alternative: add a button to Admin. Rejected because it would make a product demo surface appear to own faucet custody and would not provide the requested standalone page.

### 2. Server-side wallet per network

The server will configure one faucet wallet/operator context for each supported network through environment-based configuration. Secrets are read only by the server process. The page receives network labels, limits, sanitized errors, and public operation identifiers, never wallet material.

Alternative: call third-party faucet endpoints directly from the browser. Rejected because it does not provide an owned faucet, gives inconsistent limits and semantics, and cannot safely hold BIS-controlled liquidity.

### 3. Two-stage validation

The page may provide immediate syntax feedback, but the server is authoritative. Server validation will decode the Arkade address, verify the selected operator/network, enforce the allowlisted amount set and current configured ceiling, then submit through the network wallet. A request ID and idempotency key prevent repeated clicks from creating duplicate sends.

Alternative: trust the browser's validation result. Rejected because browser validation is mutable and cannot protect the funded wallet.

### 4. Bounded prototype limits and rate limiting

The initial allowlist is 50,000, 100,000, and 200,000 sats. The effective limit is the minimum of the selected amount, prototype configuration, and operator-reported capability. The server will apply a development-appropriate per-destination and per-client rate limit, returning a typed safe error rather than leaking provider payloads.

Alternative: expose an arbitrary numeric amount immediately. Rejected because it broadens abuse and acceptance scope before liquidity and operator constraints are understood.

### 5. Verification is separate from submission acknowledgement

Submission returns a pending operation when the provider accepts or ambiguously completes a send. A bounded status read will verify the public Arkade transaction and destination amount before success. If verification is unavailable, the UI remains pending or unavailable; it never upgrades an acknowledgement to success.

Alternative: treat a successful HTTP response as delivery. Rejected because faucet APIs may acknowledge a request before the Arkade output is observable.

### 6. Local-first deployment boundary

The first implementation will support local development with explicit environment variables and a documented command for starting the API/server. Hosting, authentication, TLS, persistent abuse controls, and production operations remain outside this proposal unless a later decision changes the prototype's status.

This keeps the package useful immediately without silently converting the repository's development-only tool into a public custody service.

## Risks / Trade-offs

- [Faucet liquidity can be exhausted] -> Expose health/availability without balances or secrets, enforce ceilings, and document that funding wallets must be replenished separately.
- [An attacker can replay or automate requests] -> Use server-side idempotency, per-destination and per-client limits, bounded amounts, and no public secret-bearing endpoint.
- [Arkade operator semantics or SDK APIs change] -> Pin the existing SDK version, isolate adapter code, and verify live behavior separately from unit tests.
- [Address network identity cannot be inferred from HRP alone] -> Decode the address and compare its embedded operator identity with fresh verified operator info.
- [Server error payloads may contain sensitive data] -> Map provider failures to an allowlisted error vocabulary and keep raw details server logs out of the page and committed artifacts.
- [The repository's no-server product rule may be misunderstood] -> Name the package `prototype-faucet`, keep it out of product exports, and state the exception in its README and deployment instructions.

## Migration Plan

1. Add the package and route without changing existing product packages.
2. Implement mocked validation, limit, rate-limit, submission, and verification flows.
3. Configure local server environment variables without committing secrets.
4. Run a controlled live test only after a faucet wallet is funded on the intended network, recording privacy-safe evidence under `output/`.
5. Roll back by removing the prototype route/package and its workspace entry; no BIS account or wallet storage migration is required.

## Open Questions

- Which local or hosted runtime should eventually run the server, if the prototype is later shared beyond the developer machine?
- What exact per-destination and per-client quotas are appropriate after observing live faucet liquidity and operator limits?
