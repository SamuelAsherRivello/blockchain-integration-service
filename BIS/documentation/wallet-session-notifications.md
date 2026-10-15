# Wallet Session Notifications

[Repository README](../../README.md) · [Marketplace package](../packages/marketplace/marketplace-package-readme.md)

Use the public `@bis/integration` wallet-session bridge when a business application owns a Player Wallet or Game Wallet session while Marketplace is open in a trusted popup or embedded window relationship. This bridge reports only public lifecycle state; it never moves wallet authority between applications.

## Trusted peer setup

Marketplace must be opened by the business application and built with `VITE_BIS_WALLET_SESSION_ORIGIN` set to the business application's exact origin, for example `https://game.example`. Marketplace accepts notifications only when both the browser message origin and source window match that configured opener. Do not use `*`, a path, or a dynamically supplied origin.

The business application creates a peer using the Marketplace window and its exact origin, then binds its existing public Player and Game Wallet controllers:

```ts
import { publishWalletSessionLifecycle } from '@bis/integration';

const lifecycle = publishWalletSessionLifecycle(
  { origin: 'https://marketplace.example', window: marketplaceWindow },
  playerWalletController,
  gameWalletController,
);

// Before an intentional business-window close after local logout:
lifecycle.dispose({ publishInactive: true });
```

Each controller exposes `getState()` and `subscribe(listener)`. An active state supplies only `profileId`, network (`signet` or `mutinynet`), and its public address. A missing field publishes an inactive notification. Revisions advance independently per wallet role; Marketplace ignores duplicates and old revisions.

## Marketplace behavior

Marketplace chooses its own response. A valid activation can update a wallet label, but does not create a local signer or unlock Buy, Sell, listings, or checkout. A Player Wallet deactivation clears Player and dependent Game presentation, inventory, and checkout work. A Game Wallet deactivation retains eligible Player presentation while removing Game presentation and Game-required actions. Late results for superseded sessions are rejected.

Never place a recovery phrase, private key, signing object, balance, transaction payload, or other secret in a notification. A business application that has no configured Marketplace popup or embedding relationship must not attempt a wildcard or tab-discovery fallback; Marketplace remains locally authoritative in that case.
