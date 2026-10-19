# ArkadeOS Smart Contracts Resources

## Knowledge

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

## Wisdom (Communities)

- [ArkadeOS GitHub organization](https://github.com/arkade-os)
  The highest-signal place to inspect current implementation discussions, releases, and examples.

## Gaps

- A single public, stable fee schedule for contract creation and contract calls was not found. Current cost should be obtained from the connected operator/SDK quote and the prevailing Bitcoin fee market.
