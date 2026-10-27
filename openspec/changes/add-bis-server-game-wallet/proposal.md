# Proposal

**Release proposal 1 of 2: Signet.** This change delivers the working BIS server and its Stealth & Steel consumer on Signet. The two-network qualification and hardening follow-up is [qualify-bis-server-two-network-readiness](../qualify-bis-server-two-network-readiness/proposal.md). Mutinynet is unavailable for hosted signing until that follow-up is complete.

## Why

Players currently configure a second browser wallet to exercise Game Wallet features. A server-held game signer removes that setup in local development and published demos while retaining the existing manual login whenever no running server can be found.

## What Changes

- Create `BIS/packages/bis-server`, package `@bis/bis-server`, to own only the Game Wallet signing identity. Keep Player Wallet signing and existing game workflows in the browser.
- Load the game mnemonic from server-only `.env.local` locally and private environment configuration on Vercel. Return public identity and signatures, never the mnemonic.
- Support the same signing handlers through the root Vite server for local testing/debugging and through Vercel for published clients. The adjacent game uses its Vite origin with a local proxy or middleware.
- Resolve the known local API during development and a configured Vercel API in Pages builds. Probe at initialization and player login/logout. If no server is running/findable after a bounded attempt, offer existing manual Game Wallet Login, including when the endpoint was configured.
- Display `Server` beside network and BIS version only while connected to a compatible server signer. Source changes affect new work only; existing server operations retain their original signer and recovery records.
- Include the minimal hosted authorization, signing-session state and wallet coordination required for Vercel correctness now. Keep transaction preparation, submission, operation journals and reconciliation in the browser. Configure and enable the hosted signer for Signet only; Mutinynet must report unavailable and retain explicit manual fallback.
- Release BIS Admin and Marketplace to Pages. Export the verified BIS package, import it into Stealth & Steel, configure its local/hosted backend selection, and publish a matching game version. Complete this proposal only after all three published consumers work with Signet Vercel signing and manual fallback is verified.

## Capabilities

### New Capabilities

- `bis-server-game-wallet`: Private local/hosted Signet Game Wallet signing, source resolution with explicit manual fallback, signing parity and source-bound recovery.

### Modified Capabilities

- `user-facing-game-wallet`: Source-aware Developer Settings, manual fallback and banner indicator.
- `admin-game-wallet`: Server-source exceptions to local identity import and lifecycle rules.
- `multi-package-development`: Same-Vite handlers, secret isolation, local/Pages backend selection and package documentation.
- `pages-demo-deployment`: Signet Vercel-backed Admin/Marketplace release and separately published matching game consumer.

## Impact

Targets integration Game Wallet composition, Arkade identity/session adapters, shared account shell, Admin/Marketplace consumers, root Vite tooling, bis-server package/deployment configuration, and the adjacent Stealth & Steel vendored BIS package, environment configuration and release metadata. The release enables hosted signing on Signet only; Mutinynet remains unavailable pending proposal 2. Game gameplay code changes only if integration requires them.

SDK 0.4.79 exposes public keys, transaction/message signing and stateful signer sessions. Remote compatibility and Vercel restart/concurrency behavior must be proven; this proposal does not claim they already work. The no-custom-server project constraint receives a scoped exception for the game signer. Existing fee payer, trophy eligibility and gameplay rules remain unchanged.

Implementation defaults are `/api/bis/`, a Signet test-wallet identity, and a serverless-compatible store for signing-session/coordination metadata. The existing multi-network implementation may remain, but this release configures and exposes only Signet signing. Mutinynet wallet selection, funding and signing acceptance belong to proposal 2. Provider/project URLs and private credentials are deployment inputs to obtain privately during apply. A reachable but incompatible/unauthorized server reports its error rather than masquerading as an absent server.

Complete proposal 1 before proposal 2. Deployment, commits/pushes and live Signet acceptance occur during apply/release; Mutinynet qualification and hardening are reserved for proposal 2. Full-operation server execution remains separately deferred to `host-bis-server-game-wallet`.
