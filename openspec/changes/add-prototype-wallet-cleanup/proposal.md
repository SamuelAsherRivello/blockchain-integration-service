# Proposal

## Why

The sandbox's happy-path demos can encounter interrupted sends and recoverable outputs, while Setup has no maintenance action. A manual action should finish supported pending work and recover eligible funds without resetting the wallet or hiding uncertain outcomes.

## What Changes

- Add `Clean Wallet 2` to both Setup network profiles, using the submitted mnemonic and concise progress/success/error feedback.
- Refresh address discovery, finish existing pending sends through the installed SDK, reconcile tracked settlements, and recover eligible owned outputs only when no unresolved operation conflicts.
- Retain public operation evidence across reloads and prevent overlapping cleanup and demo mutations for the same wallet/network.
- Preserve credentials, assets, history, contract records and unresolved operations; do not create replacement payments or reset databases.
- Change Send Asset choices to 330 and 1000 sats, default to 330, and migrate saved 0/1/100 selections to 330.

## Capabilities

### New Capabilities

- `prototype-wallet-maintenance`: Explicit wallet cleanup, pending reconciliation, recovery and minimal Setup feedback.
- `prototype-asset-transfers`: Exact asset carrier selections with a practical 330-sat minimum.

### Modified Capabilities

None. Existing Setup identity isolation and public Wallet 1 observation contracts remain in force.

## Impact

Confined to `BIS/packages/prototype-sandbox`, focused tests, package documentation and this change's artifacts. Uses SDK 0.4.79 without a new server. The SDK's already-installed Bitcoin serializer is declared directly at its existing pinned version. Wallet 1 remains address-only.

The user clarified that cleanup is manually runnable at any time and primarily concerns pending transactions. Read-only reconciliation does not need a fee policy. SDK same-wallet recovery may deduct its freshly calculated operator fee; no arbitrary zero-fee or 100-sat availability gate is introduced. The action must verify exact retained value and all asset quantities, and fail safely if it cannot verify the recovery terms. No background maintenance or new transfers to other wallets are authorized by cleanup.
