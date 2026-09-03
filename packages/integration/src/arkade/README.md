# Arkade integration

SDK 0.4.67 creates a real Signet wallet with MnemonicIdentity (isMainnet:false) and explicit in-memory repositories. The operator is https://signet.arkade.sh; both preflight and SDK configuration reads enforce Signet. Creation validates an address and disposes the SDK wallet, with no funding or transaction operations. Identity reconstruction verifies the stored public-key-derived profile identifier offline. No recovery material is logged or exposed through package exports.

A3 restores a supplied, locally validated twelve-word English phrase through the same temporary-wallet path and derivation as creation. Connection must succeed before Core persists the account. A bounded lifecycle covers wallet acquisition and address loading and disposes on success, failure, timeout, or late acquisition. Restoration does not load balances or assets.

A4 `balance.ts` reads fresh Signet available/total sats using a bounded temporary wallet and in-memory repositories. It rejects degraded synchronization and latches indexer query failures, never returning cached values as success. Temporary SDK watchers are disposed; BIS does not retain a subscription or balance cache. No wallet mutation is performed.


A5 activity.ts uses ReadonlyWallet with transient repositories. getTransactionHistory() is the full history source; getBoardingUtxos() supplements status and unambiguous output indexes. notifyIncomingFunds() triggers reconciliation. A 15-second SDK read also catches missed notifications, pending-record removal, and provider failure. SDK Esplora polling is selected explicitly to avoid dangling WebSocket fallback timers. Indexer and onchain read errors are latched; unavailable state requires Retry with a fresh wallet. No direct explorer fetch, payment, or settlement is added. The wallet history API has no pagination parameter; this adapter includes everything it returns and promises no history beyond SDK coverage.
