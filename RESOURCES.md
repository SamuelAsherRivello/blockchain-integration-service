# ArkadeOS Smart Contracts Resources

## Knowledge

- [Redis introduction](https://redis.io/docs/latest/get-started/)
  Primary overview of in-memory storage, data types and disk persistence. Use for backend responsibilities alongside the blockchain integration.
- [Redis cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/)
  Primary explanation of caching database reads, expiration and stale data. Use for distinguishing cached displays from authoritative checks.
- [Redis use cases](https://redis.io/docs/latest/develop/use-cases/)
  Official index covering sessions, rate limits, queues, messaging and leaderboards. Use to compare backend storage needs.
- [Redis session storage](https://redis.io/docs/latest/develop/use-cases/session-store/)
  Shared login state, automatic expiration and durability. Use when discussing multiple API instances.
- [Redis rate limiting](https://redis.io/docs/latest/develop/use-cases/rate-limiter/)
  Shared request quotas and atomic counters. Use when explaining why per-process counters differ from centralized limits.
- [ArkadeOS](https://arkadeos.com/)
  Primary product overview. Use for the current distinction between Arkade, Bitcoin, VTXOs, wallets, assets, contracts, and Intents.
- [Arkade documentation: VTXO Lifecycle & Liveness](https://docs.arkadeos.com/learn/pillars/batch-expiry)
  Primary explanation of expiry, renewal, unilateral exit, and operator liveness. Use when reasoning about game assets that may remain inactive.
- [Arkade TypeScript SDK API documentation](https://arkade-os.github.io/ts-sdk/)
  Current API reference for wallets, contract management, fee quoting, and contract-aware applications.
- [Arkade SDK demos](https://github.com/arkade-os/demos)
  Official runnable examples, including contract-manager and covenant examples. Use when moving from concepts to implementation.
- [Arkade TypeScript SDK](https://github.com/arkade-os/ts-sdk)
  Primary implementation source for the TypeScript wallet and contract-management model.
- [Arkade Functions](https://docs.arkadeos.com/experimental/arkade-functions)
  Experimental reference for Arkade Script built-ins such as signature checks, hashes, timelocks, witness-output constructors, and Taproot helpers. Use for language-level examples, not production assumptions.
- [Arkade wallets](https://docs.arkadeos.com/wallets)
  Official wallet concepts, payment flows, addresses, and VTXO lifecycle operations.
- [Arkade assets](https://docs.arkadeos.com/assets)
  Official asset model, issuance, metadata, reissuance, burning, and deposit detection.
- [Arkade intents](https://docs.arkadeos.com/intents)
  Official intent, quote, solver, route, and swap documentation.
- [Arkade oracles](https://docs.arkadeos.com/v0.5/oracles/overview)
  Official v0.5 oracle concepts for signed external data and contract spending conditions.
- [Arkade vaults](https://docs.arkadeos.com/v0.5/vaults/overview)
  Official v0.5 vault concepts for programmable BTC and asset custody, release rules, and exit paths.

## Wisdom (Communities)

- [ArkadeOS GitHub organization](https://github.com/arkade-os)
  The highest-signal place to inspect current implementation discussions, releases, and examples.

## Gaps

- A single public, stable fee schedule for contract creation and contract calls was not found. Current cost should be obtained from the connected operator/SDK quote and the prevailing Bitcoin fee market.
