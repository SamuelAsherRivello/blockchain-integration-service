export { createBisAdminContext } from './client/state-layer-core/context';
export type { ConditionalVaultApi, VaultCreateRequest, VaultMutationRequest, VaultMutationResult, VaultPublicDescriptor, VaultInspection, VaultEvidence, VaultLifecycle, VaultOutpoint, VaultOperation } from './client/state-layer-core/conditional-vault';
export { WALLET_SESSION_NOTIFICATION_VERSION, createWalletSessionPublisher, listenForWalletSessionNotifications, publishWalletSessionLifecycle, isWalletSessionNotification } from './client/integration-layer/wallet-session-notifications';
export type { WalletSessionNotification, WalletSessionPeer, WalletSessionRole, WalletSessionSource, WalletSessionSourceState } from './client/integration-layer/wallet-session-notifications';
export { createBisContext } from './client/wallet-layer-arkade/context-composition';
export { BisService } from './client/integration-layer/bis-service';
// Read-only production recovery classification for consumers; never clears or
// returns journals, signing material, or browser account storage.
export { pendingLogoutOperations } from './client/state-layer-core/logout-cleanup';
export type { LogoutOperations } from './client/state-layer-core/logout-cleanup';
export type {
  IBis, BisOptions, BisDisposeOptions, BisNetwork, BisWalletReference,
  BisError, BisOperationResult, BisResetResult, BisCapabilities, BisSnapshot, BisEvent,
  BisGameOperationReference, BisGameContinuationRequest, BisGameContinuationState,
  BisGameRewardRequest, BisGameRewardState, BisGameEquipmentDefinition,
  BisGameEquipmentFamily, BisGameEquipmentTier, BisGameEquipmentItem,
  BisGameEquipmentSlots, BisGameEquipmentState, BisContractRequest,
  BisContractState, BisContractQueryResult, BisGameWalletRestoreResult,
} from './client/integration-layer/bis';
export type { BisServiceOptions, BisServiceContinueDeliveryOptions, BisServiceResetResult, BisServiceResetErrorCode } from './client/integration-layer/bis-service';
export { BisServiceResetError } from './client/integration-layer/bis-service';
export type { IBisGame, BisGameSession, BisGameContinuationTarget, BisGameConfirmedContinuation, BisGameConfirmedPlayerReward, BisGameEffectReceipt, BisGameLogoutAuthorizationRequest, BisGameLogoutAuthorization, BisGameLogoutRecheck } from './client/state-layer-core/bis-game';
export { createBisGameWallet } from './client/state-layer-core/game-wallet';
export { configureBisServer } from './client/wallet-layer-arkade/server-wallet';
export { arkExplorerAssetUrl, arkExplorerTransactionUrl, testNetwork } from './client/state-layer-core/test-network';
export type { TestNetwork } from './client/state-layer-core/test-network';
export { createBisLto } from './client/state-layer-core/lto-service';
export type { BisLtoRequest, BisContractFilter, BisContractsResult, BisContractActionResult, BisContractReconcileOptions } from './client/state-layer-core/lto-service';
export type { BisContract } from './client/state-layer-core/contracts';
export type { BisGameWalletState } from './client/state-layer-core/game-wallet';
export { validateMint, normalizeAssetMetadata } from './client/state-layer-core/assets';
export { BIS_LATEST_ASSET_FORMAT_VERSION, bisAssetFormats, createBisAssetFormatRegistry, assetFormatDefinition, assetFormatMigrator, formatAssetMetadata, resolveBisAssetFormat, isLatestBisAssetFormat } from './client/state-layer-core/asset-format';
export type { BisAssetFormatResolution, BisAssetFormatDefinition, BisAssetFormatRegistration, BisAssetFormatMigrationPlan, BisAssetFormatMigrator } from './client/state-layer-core/asset-format';
export { migrateAssets, reconcileAssetMigration } from './client/state-layer-core/asset-migration';
export type { BisAssetMigrationDependencies, BisAssetMigrationResult, BisRecordedAssetMigrationDependencies } from './client/state-layer-core/asset-migration';
export { migrationRecordId, readAssetMigrationRecord, readAssetMigrationRecords, writeAssetMigrationRecord } from './client/state-layer-core/asset-migration-record';
export type { BisAssetMigrationRecord } from './client/state-layer-core/asset-migration-record';
export { prepareAssetMintBatch } from './client/wallet-layer-arkade/asset-mint-batch';
export { createBisAssetCollection } from './client/state-layer-core/asset-collection';
export type { BisAssetCollectionOptions, BisAssetCollectionState } from './client/state-layer-core/asset-collection';
export type { BisAsset, BisAssetMetadata, BisAssetMetadataValue, BisMintAssetRequest, BisMintAssetResult, BisListAssetsResult, BisAssetError, BisPendingMintResult } from './client/state-layer-core/assets';
export { assetDiagnostic, assetDiagnosticCode, diagnoseAssetFailure } from './client/state-layer-core/asset-operation-diagnostics';
export type { BisAssetDiagnostic, BisAssetDiagnosticCode, BisAssetDiagnosticPhase } from './client/state-layer-core/asset-operation-diagnostics';
export type { BisAssets } from './client/state-layer-core/asset-presentation';
export type { BisBurnAssetRequest, BisBurnAssetResult } from './client/state-layer-core/burning';
export type { BisContext, BisState, BisEvent as BisContextEvent, BisBalance } from './client/state-layer-core/context';
export type { BisToastOptions } from './client/state-layer-core/toasts';
export type { BisActivity, BisTransaction } from './client/state-layer-core/activity';
export type { BisInvoiceReceiving } from './client/state-layer-core/invoice-receiving';
export type { BisSendQuote, BisSendStatus } from './client/state-layer-core/sending';
export type { BisAssetDeliveryRequest, BisAssetDeliveryResult, BisPendingAssetDeliveryResult } from './client/state-layer-core/asset-delivery';
export { advanceLocalMarketplaceCheckout, beginLocalMarketplaceCheckout, confirmLocalMarketplaceCheckoutLeg, readLocalMarketplaceCheckout, readLocalMarketplaceCheckouts } from './client/state-layer-core/marketplace-checkout';
export type { BisMarketplaceCheckoutRecord, BisMarketplaceCheckoutRequest } from './client/state-layer-core/marketplace-checkout';
export { createBisUi, GameOverlay } from './client/ui-layer-react/client';
export { PendingOperations, usePendingNotice } from './client/ui-layer-react/PendingOperationDialog';
export type { BisPendingDiagnostic } from './client/ui-layer-react/PendingOperationDialog';
export { FormValue } from './client/ui-layer-react/FormValue';
export { FormTooltip, formatBalanceSats } from './client/ui-layer-react/FormTooltip';

export type {BisContinueRequest,BisContinueResult} from './client/state-layer-core/continuation';
export {createBisContinue,getContinuePriceSats,networkLabel} from './client/state-layer-core/game-continue';
export type {BisGameContinueState,BisGameContinueOptions} from './client/state-layer-core/game-continue';

export type { BisPlayerRecipient } from './client/state-layer-core/game-player-payment';

export { MessageType } from './client/state-layer-core/toasts';

export { getBisMarketplaceTradingAvailability } from './client/state-layer-core/marketplace-trading';
export type { BisMarketplaceTradingAvailability } from './client/state-layer-core/marketplace-trading';
export { paymentSupportAvailable } from './client/state-layer-core/capabilities';

export { createSharedArkadeWalletService, normalizeSharedWalletFailure } from './client/wallet-layer-arkade/shared-wallet-service';
export type { SharedWalletBalance, SharedWalletFailureCode, SharedWalletOperation, SharedWalletScope, SharedWalletState, SharedWalletStore, SharedWalletLock } from './client/wallet-layer-arkade/shared-wallet-service';

export { BIS_STEALTH_AND_STEEL_GAME_ID, bisMarketplaceItems, classifyBisEquipmentAsset, inspectBisEquipmentAsset, marketplaceItemMetadata } from './client/state-layer-core/equipment';
export type { BisEquipmentClassificationStatus, BisEquipmentDefinition, BisEquipmentFamily, BisEquipmentItem, BisEquipmentTier } from './client/state-layer-core/equipment';
export { createBisEquipment } from './client/state-layer-core/equipment-loadout';
export type { BisEquipmentSlots, BisEquipmentState } from './client/state-layer-core/equipment-loadout';
export { preparePublicAssetInventory, getPublicAssetInventory, invalidatePublicAssetInventory } from './client/state-layer-core/public-asset-inventory';
export type { BisPublicAssetInventoryRequest } from './client/state-layer-core/public-asset-inventory';
export type { BoardingQuote, BitcoinFundingDestination } from './client/state-layer-core/boarding-quote';
export {contractValidationOptions,contractValidationDescription} from './client/state-layer-core/contract-validation.ts';
export type {ContractValidationMode,ContractValidationPreference} from './client/state-layer-core/contract-validation.ts';
