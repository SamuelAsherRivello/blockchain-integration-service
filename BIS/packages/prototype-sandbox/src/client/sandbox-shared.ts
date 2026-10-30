/**
 * Supporting functionality for the executable sandbox demos.
 * The operation a page teaches lives in that page's source, not in this module.
 * Wallet creation and vault inspection are borrowed from their teaching pages.
 * Imports alone never read storage, open a wallet or submit an operation.
 */
export { demoGetInput, demoSetInput, walletPaymentUrl, walletConnectUrl, walletCallbackUrl } from './navigation.ts';
export { demoResult, demoDisposeWallet, demoErrorMessage, demoTransactionDetails, numberedPreviews, DemoMintAssetError } from './demo-runtime.ts';
export { demoExternalWalletPayment, externalWalletPaymentResult, externalWalletPaymentVerifiedTerminal, notifyExternalWalletOpener } from './external-wallet-payment-runtime.ts';
export { demoOnboardBitcoin } from './settlement-runtime.ts';
export { demoReadRecoveryRequest, demoWriteRecoveryRequest, demoClearRecoveryRequest, demoRecoveryStorage } from './demo-runtime.ts';
export type { DemoContext, DemoResult, DemoHistoryEntry } from './demo-runtime.ts';
export { demoCreateWallet, demoWithFreshWallet, demoGetMnemonic, demoRefreshWallet } from './demo-wallet.ts';
export { demoCreateWalletStorage } from './wallet-storage.ts';
export { installWalletMaintenance } from './wallet-maintenance.ts';
export { demoGetNetwork, demoGetVtxosUrl, demoEncodeHex } from './demo-utils.ts';
export { getMintedAssetId, demoMatchesAsset } from './demo-asset-selection.ts';
export { assetPaymentSats, demoValidateAssetTransferSats, assetSendIndexerError } from './asset-payment.ts';
export { LEVEL_ONE_ICON, LEVEL_ONE_TITLE, LEVEL_TWO_TITLE, LEVEL_TWO_ICON, LEVEL_THREE_ICON, readAssetUpgradeRecord, writeAssetUpgradeRecord, assertAssetUpgradeRequestMatches } from './asset-upgrade.ts';
export type { AssetUpgradeRequest, AssetUpgradeRecord, AssetUpgradeResult } from './asset-upgrade.ts';
export { demoVaultClient, demoVaultOperationId, demoForgetVaultOperationId, demoRememberVaultResult, demoRememberObservedOutput, demoObservedOutputHint, demoReadConditionalVaultDescriptor, demoCheckConditionalVault } from './conditional-vault.ts';
export { demoRequireVault, demoRecoverVault, demoVaultResult } from './vault-demo-runtime.ts';
export { demoOpenEventsMonitor } from './events-popup.ts';
export { validateArkadeAddress } from '../../../prototype-faucet/src/shared/faucet-core.ts';
export { networkDefinition } from '../../../prototype-faucet/src/shared/network-config.ts';
export { decodeListedMetadataValue } from '../../../integration/src/client/state-layer-core/assets.ts';
export { compileConditionalVault } from '../../../integration/src/client/wallet-layer-arkade/conditional-vault-program.ts';
export { compileVaultDescriptor, validateVaultDescriptor } from '../../../integration/src/client/wallet-layer-arkade/conditional-vault-descriptor.ts';
export { normalizeVaultOutputLayout } from '../../../integration/src/client/wallet-layer-arkade/conditional-vault-spend.ts';
export type { VaultDemoExecution } from '../../../integration/src/client/wallet-layer-arkade/conditional-vault-api.ts';
export type { VaultPublicDescriptor, VaultMutationResult, VaultInspection, VaultOutpoint, VaultEvidence } from '../../../integration/src/client/state-layer-core/conditional-vault.ts';
export type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
export { hex, base64 } from '@scure/base';
