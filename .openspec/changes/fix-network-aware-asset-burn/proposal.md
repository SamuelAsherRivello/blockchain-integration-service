# Proposal

## Why

On the supplied Mutinynet Asset Detail screen, an owned asset can be listed successfully but Burn returns the generic unavailable error. The burn path currently creates its Arkade providers with the Signet default instead of the active account network, so a valid Mutinynet holding is verified against the wrong operator and cannot be burned.

## What Changes

- Make the active Player Account's verified `TestNetwork` the source of truth for every Player Wallet read and transaction, including balances, addresses, funding, sends, transfers, contracts, assets, and recovery/reconciliation.
- Require an existing Game Wallet to use the same network as the active Player Account; reject or isolate mismatched game-wallet state before reads or submissions and never mix wallet accounts across networks.
- Pass the active account's verified network through the burn provider, wallet, fresh holding, input-selection, and submission path.
- Make burn operation records, mutation coordination, logout cleanup, and reservations network-scoped without losing safe recognition of existing Signet records.
- Preserve exact quantity and holding revalidation, durable pre-submit intent, reserved-input protection, and no-resubmit handling for unknown outcomes.
- Return a specific safe network/provider failure instead of collapsing a cross-network failure into the generic Burn unavailable message.
- Add deterministic Signet and Mutinynet regression tests for every affected transaction family, browser-flow coverage, typecheck, build, and OpenSpec validation. Live burning remains conditional on an explicitly supplied disposable test asset; the supplied address is not used as a credential or test secret.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `asset-burning`: require Burn to use the active account network consistently from fresh ownership verification through SDK submission while retaining exact-operation safety.
- `wallet-operation-availability`: require all wallet-operation reservations, mutation coordination, and transaction adapters to be scoped to the active account/network/operator and prevent cross-network input reuse.

## Impact

- `BIS/packages/integration/src/arkade/` transaction adapters and `BIS/packages/integration/src/core/` operation/game-wallet coordination.
- `BIS/packages/integration/src/core/burning.ts`, wallet reservation/operation cleanup, and context error mapping.
- Integration and demo tests covering network routing/mismatch rejection, durable journals, Account Assets UI, Game Wallet matching, and Admin H2 behavior.
- No new game-facing Arkade types, no server, no secret logging, and no changes to the separate Stealth & Steel repository.
