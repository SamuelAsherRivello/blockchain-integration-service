# Prototype Faucet

[Back to the main README](../../../README.md)

`@spike/prototype-faucet` is an experimental development tool for funding Arkade test wallets on Signet and Mutinynet. It is deliberately separate from the BIS product packages: it is not part of `@bis/integration`, does not change the game-facing API, and should not be described as a production custody service.

## What it does

The browser page lets a developer select Signet or Mutinynet, paste an Arkade address, choose 50,000, 100,000, or 200,000 sats, and submit a bounded request. The server validates the address again against the selected Arkade operator before it sends. A `tark1…` prefix alone is not treated as proof of network compatibility. The page is Arkade-only in its first slice and does not send ordinary on-chain Bitcoin.

The page reports ready, pending, success, unavailable, rejected, and rate-limited states separately. A request acknowledgement is not presented as verified delivery. Public operation identifiers may be displayed, but recovery phrases, private keys, signed transaction material, raw provider errors, and faucet wallet balances never enter the browser response or committed configuration.

## Package boundary

The package contains a Vite browser entry under `src/client`, shared validation and policy under `src/shared`, and a Node HTTP server under `src/server`. The server is the only place that can load faucet wallet secrets. The browser has no signing identity and never receives faucet-wallet configuration. This is a prototype boundary, not a replacement for a production custody or abuse-prevention service.

## Run the page

From the repository root, start the shared development server:

```text
npm run dev
```

Open the printed `/prototype-faucet/` route. For an isolated browser check, run `npm run dev --workspace @spike/prototype-faucet`; its default port is 5188.

The browser calls `/api/faucet/request` on the same origin. Start the local API separately when testing the request path:

```text
npm run server --workspace @spike/prototype-faucet
```

Without faucet wallet configuration, the server remains safe but funding requests return unavailable. For a one-time local setup, copy `prototype-faucet-env.template` to `.env.local`, then replace the placeholders with `FAUCET_SIGNET_MNEMONIC` and/or `FAUCET_MUTINYNET_MNEMONIC`. The server and AI funding helper load that file automatically; it is ignored by Git. Optional `FAUCET_SIGNET_MAX_SATS`, `FAUCET_MUTINYNET_MAX_SATS`, and `FAUCET_PORT` configure non-secret limits and the API port. Never commit these values or place them in `VITE_` variables.

For an explicit, idempotent request from a terminal, use the funding helper. It automatically starts the local API when it is not already reachable, inheriting credentials from the current server environment. The address, network, and amount are all required; the amount accepts `50000` or `50k` notation and has no default:

```text
npm run fund --workspace @spike/prototype-faucet -- --address <tark1-address> --network signet --amount 50k
```

The helper accepts only 50,000, 100,000, or 200,000 sats, starts the local server when needed, sends the request, and prints the public operation result. A `pending` result means the request was accepted for processing; it is not proof that the destination has received the funds. If the faucet mnemonics are not available to the AI or server process, the helper reports an unavailable configuration without exposing or storing them.

## Verification

Run `npm run test --workspace @spike/prototype-faucet` for deterministic address, network, amount, idempotency, rate-limit, and service tests. Run `npm run build --workspace @spike/prototype-faucet` for the browser build and `npm run typecheck` for the repository type check. These checks use mock wallets and do not prove live funding. A live test must use a disposable development wallet, the exact selected network, and privacy-safe evidence under the repository `output/` directory.

Testnet and signet sats have no monetary value. Do not paste a recovery phrase or private key into this page, its issue tracker, logs, or chat.
