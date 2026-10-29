# BIS server

[Back to the main README](../../../README.md)

`@bis/bis-server` keeps the BIS Game Wallet signer on the server. BIS owns provider reads, transaction preparation, submission, and journals; this package returns public identity and authorized signatures. Player Wallet signing stays in the browser. A signature does not prove settlement.

## Local development

Copy [.env.local.template](.env.local.template) to `.env.local` in this package directory and add disposable local test mnemonics privately. Process values take precedence, including blank overrides. Never put recovery phrases in `VITE_` variables, browser settings, chat, reports, or URLs.

Run `npm run dev` from the repository root. The shared Vite listener mounts `/api/bis/` beside Admin and Marketplace. Set `BIS_SERVER_ENABLED=false` to exercise manual mode. This README renders at `/bis-server/`.

## Identity selection and fallback

Signet and Mutinynet have independent wallet slots `01`, `02`, and `03`. New work checks candidates against fresh Arkade-spendable balance requirements; confirmed Bitcoin balance does not count. Identity-only discovery may select an unfunded identity. Pending work stays tied to its selected network and profile.

BIS probes on startup, Player login/logout, network changes, and Retry. A compatible server provides public identity data and shows `Server` beside the network/version banner. An absent or unreachable server offers manual create/restore/login, even when a hosted endpoint is configured. A reachable but incompatible server reports its error. Saved local identities are not silently activated, and unresolved server work is never replayed through a manual wallet.

## Signing and policy

`POST /api/bis/connect` creates a scoped connection. `/api/bis/sign` supports transaction, message, and SDK signing sessions. Sessions are encrypted in Redis. Atomic claims prevent conflicting input signing, changed-request replay, and nonce reuse across instances; uncertain operations remain quarantined.

Public spending requires a verified Player proof and a short-lived grant bound to the exact request, operation, network, identity, and connection. Payment exposure includes fees and cannot exceed 5,000 sats per operation or 10,000 sats per network per day. Configuration may set lower limits. Public payment signing also requires an explicit network allowlist: proposal 1 is Signet-only, and Mutinynet remains unavailable until proposal 2. Asset, contract, and settlement operations have separate policy checks; arbitrary outputs and unowned assets are refused. Privileged routes use `BIS_OWNER_ACCESS_TOKEN` when configured, with legacy `BIS_OWNER_TOKEN` access retained only when the separate credential is absent. Keep `BIS_OWNER_TOKEN` stable because it protects authorization and signing-session recovery. Developer Settings retains the access credential in memory only; it is never sent to Pages or browser bundles.

## Debugging and verification

Use breakpoints in client `server-wallet.ts`, server `signer.ts` or `hosted.ts`, and the submission adapter. See [local compatibility and policy evidence](../../documentation/bis-server-local-compatibility.md).

```text
npm run test --workspace @bis/bis-server
npm run test:milestone-1 --workspace @bis/bis-server
npm run test:milestone-1:browser --workspace @bis/bis-server
npm run test:native-redis --workspace @bis/bis-server
npx tsc --project BIS/packages/bis-server/tsconfig.json
npm run typecheck
npm run build:deployment --workspace @bis/bis-server
```

The optional native Redis check uses pinned miniredis and requires Go 1.22+. Deterministic tests are not proof of funded network behavior; keep live Signet acceptance separate from UI evidence.

Before Preview validation, `npm run verify:deployment-preflight --workspace @bis/bis-server -- <sanitized-snapshot.json>` checks the exact built bundle, project/runtime settings, deployment protection, required variable names, distinct test identities, approved caps, and free-tier configuration. The checker accepts names and public profile IDs only, rejects credentials, and writes sanitized reports beneath `output/reports/bis-server/milestone-1/`. It is a read-only configuration gate, not deployment or signing acceptance.

## Hosted deployment boundary

Vercel Preview reads only isolated `BIS_PREVIEW_`-prefixed owner, cap, Redis, wallet-slot, and signing-network settings. Missing Preview values never fall back to Production; Production ignores Preview-prefixed values. Use separate, unfunded Preview test identities. Never copy Production or DPAPI-vault mnemonics to Preview.

The [Vercel deployment](https://bis-server-rho.vercel.app) serves the hosted API. Deployment Protection remains enabled; do not place a bypass secret in a browser bundle. Production is configured for Signet-only public payment signing, capped at 5,000 sats per operation and 10,000 sats per network per day. Confirm the deployed health and identity capabilities, then verify funded Signet acceptance separately. Mutinynet signing stays unavailable. See [deployment steps and remaining gates](../../documentation/bis-server-deployment.md).

Milestone 1 is incomplete until live Signet acceptance and matching Admin, Marketplace, and Stealth & Steel releases pass. `host-bis-server-game-wallet` is a separate milestone and is not part of this package change.
