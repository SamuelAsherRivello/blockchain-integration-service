# BIS 0.0.4 local package release

This release adds two read-only game capability checks to `BisGameServices`:

- `hasAssetMintingSupport()` requires an active Player Wallet, a distinct ready Game Wallet on the same selected network, supported item coordination, and at least 1,000 available Game Wallet sats.
- `hasContractSupport()` requires both distinct ready wallets on the same selected network. Individual contract operations remain responsible for exact funding and authorization checks.

Neither method opens UI, mutates wallet state, or changes existing minting, contract, LTO, payment, ownership, or recovery semantics.

The Developer page also presents Asset Minting, Contracts, and Items as read-only support rows with disabled checkboxes and copyable status values.
