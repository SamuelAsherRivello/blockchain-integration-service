# BIS server

[Back to the main README](../../../README.md)

`@bis/bis-server` keeps the BIS Game Wallet signer on the server. BIS owns provider reads, transaction preparation, submission, and journals; this package returns public identity and authorized signatures. Player Wallet signing stays in the browser. A signature does not prove settlement.

## Local development

Copy [.env.local.template](.env.local.template) to `.env.local` in this package directory and add disposable local test mnemonics privately. Process values take precedence, including blank overrides. Never put recovery phrases in `VITE_` variables, browser settings, chat, reports, or URLs.

Run `npm run dev` from the repository root. The shared Vite listener mounts `/api/bis/` beside Admin and Marketplace. `BIS_SERVER_ENABLED=false` exercises Signet Server unavailability. Mutinynet uses Local independently. This README renders at `/bis-server/`.

## Network workflows and identity selection

Signet and Mutinynet have independent wallet slots `01`, `02`, and `03`. New work checks candidates against fresh Arkade-spendable balance requirements; confirmed Bitcoin balance does not count. Identity-only discovery may select an unfunded identity. Pending work stays tied to its selected network and profile.

Mutinynet selects Local before any BIS probe or remembered-server read. Its Game Wallet stays in the browser. Signet selects Server and probes on account/network lifecycle changes and Retry. The header shows Local or Server before network/version, with connection health separate. An unavailable Signet signer stays Server; it does not offer Local create/restore/login. There is no mode toggle. Pending work retains its original network, profile, source and keys.

## Signing and policy

`POST /api/bis/connect` creates a scoped connection. `/api/bis/sign` supports transaction, message, and SDK signing sessions. Sessions are encrypted in Redis. Atomic claims prevent conflicting input signing, changed-request replay, and nonce reuse across instances; uncertain operations remain quarantined.

Public spending requires verified Player proof and a short-lived grant bound to the exact request, operation, network, identity, and connection. Exposure includes fees and cannot exceed 5,000 sats per operation or 10,000 sats per network/day. Configuration may lower these limits. Production public signing is allowlisted for Signet. Hosted Mutinynet remains deferred; its Local workflow does not depend on this service. Asset, contract, and settlement policies refuse arbitrary outputs and unowned assets. Privileged routes use `BIS_OWNER_ACCESS_TOKEN`, falling back to legacy access only when it is absent. Keep `BIS_OWNER_TOKEN` stable: it protects authorization and signing-session recovery. Operator Settings holds the access credential in tab memory only. Never embed it in a browser bundle.

## Debugging and verification

Use breakpoints in client `server-wallet.ts`, server `signer.ts` or `hosted.ts`, and the submission adapter. See [local compatibility evidence](../../documentation/bis-server-local-compatibility.md).

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

Before Preview validation, `npm run verify:deployment-preflight --workspace @bis/bis-server -- <sanitized-snapshot.json>` checks bundle identity, runtime, deployment protection, required variable names, distinct test identities, caps, and free-tier configuration. It accepts names and public profile IDs, rejects credentials, and writes sanitized reports beneath `output/reports/bis-server/milestone-1/`. Passing does not qualify funded signing.

## Hosted deployment boundary

Vercel Preview reads only isolated `BIS_PREVIEW_`-prefixed owner, cap, Redis, wallet-slot, and signing-network settings. Missing Preview values never fall back to Production; Production ignores Preview-prefixed values. Use separate, unfunded Preview test identities. Never copy Production or DPAPI-vault mnemonics to Preview.

The [Vercel deployment](https://bis-server-rho.vercel.app) serves the hosted API. Deployment Protection remains enabled; do not place a bypass secret in a browser bundle. Production is configured for Signet-only public payment signing, capped at 5,000 sats per operation and 10,000 sats per network per day. Confirm the deployed health and identity capabilities, then verify funded Signet acceptance separately. Mutinynet signing stays unavailable. See [deployment steps and remaining gates](../../documentation/bis-server-deployment.md).

Acceptance remains incomplete until required Local/Server workflows and matching Admin, Marketplace, and Stealth & Steel releases pass. Deterministic checks do not establish live contract support.
