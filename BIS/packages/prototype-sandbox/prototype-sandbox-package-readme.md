# Prototype Sandbox

[Back to the main README](../../../README.md)

`@spike/prototype-sandbox` contains small, executable Arkade examples with shared setup, navigation, source views, and output. The examples use the title-bar Signet or MutinyNet selection. Wallet creation and address derivation run locally; network reads, payments, assets, boarding, and contract transactions use their actual SDK or provider paths. A successful UI test does not establish financial acceptance.

## Routes and setup

Run `npm run dev` from the repository root. The shared Vite launcher serves this package at `/prototype-sandbox/`, alongside Admin, Marketplace, Onboarding, Faucet, and package documentation. Nineteen demo routes are declared in `src/client/navigation.ts`. Direct links retain their trailing slash and load the shared React application; navigation groups them into Wallets, Payments, Assets, Smart Contracts, and External Wallet.

Setup keeps independent profiles for both networks. Wallet 1 supplies a public Arkade address; Wallet 2 supplies the signing mnemonic. Treat those as test identities only. Switching networks asks for confirmation and selects that network's separate values. Do not paste mnemonics into source code, public descriptors, console output, screenshots, reports, or Git. Changing the server port creates another browser origin and does not migrate wallet recovery data.

## Conditional Vault

The four calls are Create, Increment, Check, and Claim. Create locks exactly 1,000 sats in a contract-derived output. Each permissionless Increment consumes one state and creates the committed next state, preserving the amount. Three increments permit the creator-signed Claim, which returns the principal to the creator. Check uses public network evidence and never signs, finalizes, or rebroadcasts a transaction.

The immutable deadline is 120 seconds after creation preflight. The co-signer checks its UTC clock before signing; this is not an upper-bound Bitcoin settlement deadline. An already accepted transaction can finish later. After expiry, the details expose creator-authorized recovery from any progress state. The separate CSV Bitcoin exit has maturity, unroll, and fee requirements. It is not a free cooperative Claim.

Both local co-signers must run with their original protected keys. Use `node BIS/scripts/conditional-vault-service.ts start signet` and the corresponding `mutinynet` command from the repository root. Docker access is required. Signet binds loopback port 7074; MutinyNet binds 7075. The adapter independently pins their signer identities. Preserve these services and the encrypted recovery store while funded contracts exist. Public deployment and HTTPS operation are not claimed by this local preview.

Create shows Demo, Smart Contract (Tapscript), and Smart Contract (Compiled) tabs. The Tapscript tab shows the TypeScript source that constructs the contract scripts. The compiled tab contains the selected contract's actual compiled scripts and tree, not an example substituted for execution. Other calls show their integration source. The demo stores and validates public descriptors automatically without an export/import form. Use the same browser and origin for the four-call flow. A short dropdown ID or public address alone cannot discover arbitrary constructor parameters.

## Results and recovery

Output starts with the demo name, includes network, status, amount and receipt references, then ends with a success boolean. Pending acknowledgement is not success. Repeated operations reconcile their original outpoint and operation ID. Duplicate Create reports the selected VaultID. Local public metadata helps find a descriptor but never authorizes funds or establishes progress. Older records remain intact and explicitly unsupported rather than becoming new contracts.

## Verification and boundaries

Run `npm run typecheck`, `npm test`, and `npm run build --workspace @spike/prototype-sandbox` from the root. Root tests discover deterministic sandbox checks; browser and funded network runs remain separate. Build the pinned executable VM with `pwsh -NoProfile -File BIS/tools/conditional-vault-vm/build.ps1` before contract execution tests. The browser runner checks public descriptors without mnemonic access.

The integration package owns compilation, submission, protected recovery, and receipt verification. This package owns teaching UI and presentation. See the [contract guide](../integration/src/client/wallet-layer-arkade/conditional-vault.md), [documentation review](../../documentation/conditional-vault-contract-review.md), [acceptance report](../../documentation/conditional-vault-acceptance.md), and [execution evidence](../../documentation/conditional-vault-feasibility.md) for trust assumptions, commands, current gates, and historical failures. Keep future demos equally small and real; unavailable behavior must never become a simulated successful transaction.
