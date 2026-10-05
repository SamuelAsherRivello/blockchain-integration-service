# Prototype Scope and Security

## Status

Blockchain Integration Service (BIS) is a proof of concept for exploring
Bitcoin-related game experiences. It is intended for development, demos, and
evaluation only; it is not production-ready.

## Security model

BIS is client-authoritative and insecure by design. Its browser-side state,
UI, and flows must not be treated as trusted controls or as guarantees of
ownership, balances, transactions, or asset availability. Do not rely on BIS
to protect real funds, valuable assets, credentials, or production player
data.

## Supported networks

BIS supports the Bitcoin **Signet** and **Mutinynet** test networks only. Do
not use it with Bitcoin mainnet, real funds, or production wallets.

## Use expectations

- Treat all interactions as experimental.
- Use only testnet funds and disposable test accounts.
- Independently verify any transaction or asset behavior before relying on it.
- Games integrating BIS remain responsible for their own security, server-side
  authority, and production readiness.

Return to the [BIS README](../../README.md).
