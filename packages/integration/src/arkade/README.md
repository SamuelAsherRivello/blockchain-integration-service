# Arkade integration

SDK 0.4.67 creates a real Signet wallet with MnemonicIdentity (isMainnet:false) and explicit in-memory repositories. The operator is https://signet.arkade.sh; both preflight and SDK configuration reads enforce Signet. Creation validates an address and disposes the SDK wallet, with no funding or transaction operations. Identity reconstruction verifies the stored public-key-derived profile identifier offline. No recovery material is logged or exposed through package exports.

A3 restores a supplied, locally validated twelve-word English phrase through the same temporary-wallet path and derivation as creation. Connection must succeed before Core persists the account. A bounded lifecycle covers wallet acquisition and address loading and disposes on success, failure, timeout, or late acquisition. Restoration does not load balances or assets.
