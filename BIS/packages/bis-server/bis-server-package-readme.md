# BIS server

[Back to the main README](../../../README.md)

`@bis/bis-server` holds the BIS Game Wallet signing identity. In milestone 1, BIS remains responsible for provider reads, transaction preparation, submission, journals, and reconciliation; the server returns public identity data and authorized signatures. Player Wallet signing stays in the browser. A signature does not prove that an operation settled.

## Local development

Copy [.env.local.template](.env.local.template) to `.env.local` in this package directory and add disposable local test mnemonics privately. Process values take precedence, including blank overrides. Never use `VITE_` secrets or place recovery phrases in chat, reports, URLs, or browser settings.

Run `npm run dev` from the repository root. The shared Vite listener serves `/api/bis/` beside Admin and Marketplace; a second daemon is not required. The package documentation is at `/bis-server/`. The local adapter is loopback-only and rejects cross-site requests. Set `BIS_SERVER_ENABLED=false` to exercise manual mode while keeping the apps running.

## Identity selection and fallback

Signet and Mutinynet each have independent mnemonic slots `01`, `02`, and `03`. New selection checks them in order against fresh, operation-specific Arkade-spendable balance requirements; Bitcoin balance is not Arkade spendable balance. An identity-only probe may select an unfunded wallet. Once selected, pending work stays bound to its original network and profile, even if balance or priority changes.

BIS probes on initialization, Player login/logout, network changes, and Retry. A compatible server provides public keys without importing a mnemonic and adds `Server` beside the network/version banner. An absent route, stopped server, connection refusal, or bounded timeout offers the existing manual create/restore/login flow, even when the hosted URL is configured. A reachable but incompatible server shows its specific error. Saved local identities remain inactive unless explicitly selected; server work is never replayed with a manual wallet.

## Signing and authorization

`POST /api/bis/connect` issues a scoped connection; `/api/bis/sign` supports transaction, message, and SDK session signatures. Hosted sessions are encrypted in Redis. Atomic claims prevent conflicting inputs, changed-request replay, and nonce reuse; uncertain work remains quarantined after crashes.

Public spending requires a verified Player proof and a short-lived grant bound to the exact request, operation, network, profile, and connection. Offchain payment exposure includes fees and is limited to 5,000 sats per operation and 10,000 sats per network/day; configuration may lower but never raise the approved ceilings. Asset policy permits one non-reissuable BIS unit, a one-unit delivery for the verified Player or a verified Marketplace receipt, and a burn only for an asset previously issued to that same Player. Burns preserve every other asset at the Game address. Arbitrary outputs and unowned assets are refused. Public settlement signing has a separate opt-in flag and policy.

Privileged signing uses separate `/api/bis/owner/` plans and requires `BIS_OWNER_TOKEN`. Developer Settings keeps the credential in memory only; it is not included in Pages settings or browser bundles. Public signing remains disabled in production until deployment and funded acceptance are complete.

## Debugging and verification

Set breakpoints in client `server-wallet.ts`, server `signer.ts` or `hosted.ts`, and the existing submission adapter. Inspect sanitized method names and statuses only. See [local compatibility and policy evidence](../../documentation/bis-server-local-compatibility.md).

```text
npm run test --workspace @bis/bis-server
npm run test:milestone-1 --workspace @bis/bis-server
npm run test:milestone-1:browser --workspace @bis/bis-server
npm run test:native-redis --workspace @bis/bis-server
npx tsc --project BIS/packages/bis-server/tsconfig.json
npm run typecheck
npm run build:deployment --workspace @bis/bis-server
```

Run the full server suite with `npm test --workspace @bis/bis-server`; its runner executes from the repository root so root-relative build tests work from a workspace command. The focused signer/controller suite runs sequentially. The browser runner isolates each UI case in its own process to prevent Vite optimizer state from leaking between temporary servers. Both runners set the repository's ignored `output/tool-cache/playwright` browser cache. Before a protected Preview check, `npm run verify:deployment-preflight --workspace @bis/bis-server -- <sanitized-snapshot.json>` validates the linked project, exact built bundle hash, Node 24 Preview state/protection, required environment-variable names, distinct public test identities, approved caps, and current Vercel/Redis free-tier quotas and upgrade settings. Preview secrets use `BIS_PREVIEW_`-prefixed names and never fall back to Production values. Include environment-variable names, not values; identity fields use public profile IDs. Never include credentials, mnemonics, or private key material. The checker rejects credential-bearing field names and records only a sanitized, uniquely named report under `output/reports/bis-server/milestone-1/`. It is a read-only gate, not a deployment or signing acceptance.

The package tests use public BIP39 vectors and cryptography; passing them is not funded-network proof. The optional native Redis acceptance test executes the production checkpoint Lua against pinned miniredis and requires Go 1.22 or newer. It is kept outside the default suite so CI and local checks without Go do not acquire an undeclared runtime requirement. Use `BIS_GO_BINARY` to select a Go executable; generated module/build caches stay under the ignored repository `output/` directory.

## Hosted deployment boundary

Vercel Preview requires isolated `BIS_PREVIEW_`-prefixed owner, cap, Redis, and wallet-slot variables. The server maps these names only when `VERCEL_ENV=preview`; missing Preview values never fall back to Production. Production ignores all Preview-prefixed values. Use distinct, unfunded test identities for Preview. Never copy Production or DPAPI vault wallet phrases into a Preview deployment.

The [Vercel deployment](https://bis-server-rho.vercel.app) validates private configuration, Redis, and cryptographic proofs. Deployment Protection remains enabled; public Pages access requires the stable production domain to be reachable through the free Standard Protection scope. Never place a Vercel bypass secret in browser code. Production signing flags and its earlier 1,000-sat configuration are unchanged; the local policies are not deployed. See [deployment steps and remaining gates](../../documentation/bis-server-deployment.md).

Milestone 1 remains incomplete until funded acceptance, BIS Admin/Marketplace Pages releases, and the matching Stealth & Steel integration/release all pass. The separate milestone 2 change, `host-bis-server-game-wallet`, remains untouched.
