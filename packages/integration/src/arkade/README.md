# Arkade integration

SDK 0.4.67 creates a real Signet wallet with MnemonicIdentity (isMainnet:false) and explicit in-memory repositories. The operator is https://signet.arkade.sh; both preflight and SDK configuration reads enforce Signet. Creation validates an address and disposes the SDK wallet, with no funding or transaction operations. Identity reconstruction verifies the stored public-key-derived profile identifier offline. No recovery material is logged or exposed through package exports.
