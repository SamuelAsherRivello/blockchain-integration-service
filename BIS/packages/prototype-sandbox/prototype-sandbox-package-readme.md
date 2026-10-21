# Prototype Sandbox

[Back to the main README](../../../README.md)

`@spike/prototype-sandbox` contains executable Arkade examples with shared setup, source views, and output. Select Signet or MutinyNet in the title bar. Wallet creation runs locally; reads, payments, assets, boarding, and contracts use real SDK/provider operations. UI tests do not establish financial acceptance.

## Routes and setup

Run `npm run dev` from the repository root. The shared Vite launcher serves `/prototype-sandbox/`, alongside Admin, Marketplace, Onboarding, Faucet, and documentation. Twenty-one demo routes are declared in `src/client/navigation.ts`, grouped into Wallets, Payments, Assets, Events, Smart Contracts, and External Wallet. Direct links retain their trailing slash.

Setup separates network profiles. Wallet 1 supplies a public address; Wallet 2 supplies the signing mnemonic. Submit edits before running another demo. Actions read current values; SDK state stays separate per network, identity, and browser. Switching identities preserves earlier state. Confirm network changes. Use test wallets only. Never save mnemonics in source, output, screenshots, reports, or Git. Port changes do not migrate recovery data.

## Events

[Events](./demo-21/) opens a separate 500 by 400 pixel React window. A white card on black says `Wallet 1` and `I'm listening . . .` after connection preparation. Allow popups if launch is blocked. The window observes the captured public Arkade address and network without a mnemonic, independently of sidebar navigation or closing its opener.

Wait for listening, then run Send Payment for 100 sats from Wallet 2, or Mint Asset followed by Send Asset. Mint alone affects Wallet 2. External Wallet payments also target Wallet 1. Receive and history demos are read-only.

The monitor describes received, spent, and swept outputs, including asset quantities. Existing holdings and duplicates stay quiet. Notifications pulse three times over three seconds and display for five seconds. New events replace the message and restart timing. Status dots cycle each second. Click the rounded card to flip to a full-height, scrollable connection/event log; click again to return. Enter and Space also flip. Reduced motion omits spatial animation. History lasts until reload or closure. Setup changes require executing Events again.

## Conditional Vault

Create locks 1,000 sats in a contract-derived output. Each permissionless Increment consumes one state and creates the committed next state, preserving the amount. Three increments permit the creator-signed Claim, returning the principal. Check uses public network evidence and never signs, finalizes, or rebroadcasts a transaction.

The deadline is 120 seconds after preflight, enforced by the co-signer's clock before signing. Accepted transactions can finish later. Expiry exposes creator-authorized recovery; the separate CSV Bitcoin exit requires maturity, unroll, and fees.

Both local co-signers require their original protected keys and Docker. Use `node BIS/scripts/conditional-vault-service.ts start signet` or `mutinynet`. Ports are 7074 and 7075 respectively. Preserve services and encrypted recovery while contracts are funded. This preview does not establish public deployment.

Create shows Demo, Tapscript, and Compiled tabs with the selected contract's actual source and artifacts. Public descriptors are saved automatically. Keep the same browser and origin for all calls; an address alone cannot discover constructor parameters.

## Results and recovery

Output identifies results. Pending acknowledgement is not financial success. Events launch success means a window opened, not payment occurred. Contract retries reconcile original identifiers. Source buttons open readable local files in Vite and GitHub files on Pages.

## Verification and boundaries

Run `npm run typecheck`, `npm test`, and `npm run build --workspace @spike/prototype-sandbox` from the root. Root tests discover deterministic sandbox checks; browser and funded network runs remain separate. Build the pinned executable VM with `pwsh -NoProfile -File BIS/tools/conditional-vault-vm/build.ps1` before contract execution tests. The browser runner checks public descriptors without mnemonic access.

Run focused checks with `node --test BIS/packages/prototype-sandbox/tests/wallet-events.test.ts BIS/packages/prototype-sandbox/tests/events-presentation.test.ts`. Browser checks use `node --test BIS/packages/prototype-sandbox/tests/browser-events.test.ts` against the running shared server. Explicit funded acceptance uses `node BIS/scripts/prototype-events-live.ts signet` and `mutinynet`, approved protected test identities, and an isolated browser profile. Reports contain public evidence under `output/reports/prototype-wallet-events/`; missing funded evidence remains incomplete.

See the [observer notes](./src/client/wallet-events.md), [contract guide](../integration/src/client/wallet-layer-arkade/conditional-vault.md), and [acceptance report](../../documentation/conditional-vault-acceptance.md) for boundaries and verification. Teaching UI belongs here; contract execution and protected recovery belong to integration.
