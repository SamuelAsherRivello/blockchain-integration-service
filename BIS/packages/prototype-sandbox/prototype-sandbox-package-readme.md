# Prototype Sandbox

[Back to the main README](../../../README.md)

`@spike/prototype-sandbox` contains executable Arkade examples. Select Signet or MutinyNet in the title bar. Wallet creation runs locally; reads, payments, assets, boarding, and contracts use real SDK/provider operations. UI tests do not establish financial acceptance.

## Routes and setup

Run `npm run dev` from the root. Shared Vite serves `/prototype-sandbox/` alongside the other packages. `src/client/navigation.ts` declares twenty-five demo routes in Wallets, Payments, Assets, Events, Smart Contracts, and External Wallet.

Setup separates network profiles. Wallet 1 supplies an address; Wallet 2 supplies the signing mnemonic. Submit edits before running demos. SDK state stays separate per network, identity, and browser. Confirm network changes. Use test wallets only. Keep mnemonics out of source and Git.

## Events

[Events](./demo-21/) opens a React window that observes Wallet 1's public Arkade address and network without a mnemonic. Allow popups if launch is blocked.

After it connects, run Send Payment for 100 sats from Wallet 2, or Mint Asset followed by Send Asset. External Wallet payments target Wallet 1; Receive and history demos are read-only.

The monitor describes received, spent, and swept outputs with asset quantities. Click, Enter, or Space opens its event log; setup changes require executing Events again.

## Conditional Vault

Create locks 1,000 sats in a contract-derived output. Permissionless Increment advances committed state while preserving principal. After three increments, the creator-signed Claim returns it. Check reads public network evidence without signing, finalization, or rebroadcast.

The co-signer enforces a 120-second deadline after preflight. Expiry exposes creator-authorized recovery; the separate CSV Bitcoin exit requires maturity, unroll, and fees.

Both local co-signers require their original protected keys and Docker. Start one with `node BIS/scripts/conditional-vault-service.ts start signet` or `mutinynet` (ports 7074 and 7075). Preserve services and encrypted recovery while contracts are funded; this preview does not establish public deployment.

Create shows Demo, Tapscript, and Compiled tabs with the contract source and artifacts. Keep the same browser and origin; an address alone cannot discover constructor parameters.

## Treasure Hunt

[Treasure Hunt](./demo-22/) groups Create, Check, Claim, and Reject under Smart Contracts. Setup Wallet 2 funds a real 1,000-sat contract through the standard SDK helper. Claim and Reject return funds to that wallet through different contract leaves. The shared canonical compiler also builds the BIS Browser validation contract. This standalone demo needs no BIS Account or server. Live network acceptance is pending.

All four pages retain Execute with the selected network below it. Actions check current operator evidence and the original wallet-bound contract. The 90-second deadline is browser-enforced and can be bypassed by a modified client. Encrypted recovery retains the preimage and signed requests across reload. Check never resubmits; an explicit repeated action can resume its original signed finalization once. Unknown outcomes block competing wallet operations. Asset change and exact receipts are verified. Offline SDK and UI tests are not live acceptance.

## Results and recovery

Each file in `src/client/demos/` supplies Execute, the code panel, and Open source. Treasure Hunt uses the Arkade SDK directly and checks the operator's evidence at execution time. Viewing source never executes it; pending is not success.

Setup's **Clean Wallet 2** uses the submitted mnemonic to reconcile supported pending sends and recover eligible outputs to the same wallet. Assets, history, and credentials remain; recovery can deduct verified fees. Unknown outcomes stay recorded. Send Asset offers 330 or 1,000 sats.

## Verification and boundaries

Run `npm run typecheck`, `npm test`, and `npm run build --workspace @spike/prototype-sandbox` from the root. Browser and funded checks remain separate. Build the pinned VM before contract tests with `pwsh -NoProfile -File BIS/tools/conditional-vault-vm/build.ps1`. Descriptor checks never read mnemonics.

Focused and browser event checks are in `BIS/packages/prototype-sandbox/tests/`; funded acceptance uses `node BIS/scripts/prototype-events-live.ts signet` or `mutinynet`.

See the [observer notes](./src/client/wallet-events.md), [contract guide](../integration/src/client/wallet-layer-arkade/conditional-vault.md), and [acceptance report](../../documentation/conditional-vault-acceptance.md). Teaching UI belongs here; contract execution and protected recovery belong to integration.
