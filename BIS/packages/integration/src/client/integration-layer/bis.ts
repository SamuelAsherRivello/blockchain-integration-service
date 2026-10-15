import type { BisAsset, BisMintAssetRequest } from '../state-layer-core/assets';
import type { BisAssetCollectionState } from '../state-layer-core/asset-collection';
import type { BisContext, BisEvent as BisContextEvent } from '../state-layer-core/context';
import type { BisContract } from '../state-layer-core/contracts';
import type { BisContractFilter, BisContractActionResult } from '../state-layer-core/lto-service';
import type { BisEquipmentDefinition, BisEquipmentFamily, BisEquipmentTier, BisEquipmentItem } from '../state-layer-core/equipment';
import type { BisEquipmentSlots, BisEquipmentState } from '../state-layer-core/equipment-loadout';
import type { BisGameContinueState } from '../state-layer-core/game-continue';
import type { IBisGame, BisGameSession, BisGameEffectReceipt } from '../state-layer-core/bis-game';
import type { TestNetwork } from '../state-layer-core/test-network';

/** Main game-facing vocabulary. Lower-level APIs remain available to non-game consumers. */
export type BisNetwork = TestNetwork;
export type BisOptions = Readonly<{ getBisGame(): IBisGame | undefined }>;
export type BisDisposeOptions = Readonly<{ preserveContracts?: boolean }>;
export type BisWalletReference = Readonly<{ profileId: string; network?: BisNetwork }>;
export type BisError = Readonly<{
  code: 'disposed' | 'cleanup-failed' | 'unavailable' | 'invalid-workflow' | 'invalid-request';
  message: string;
}>;
export type BisOperationResult<T = undefined> =
  | Readonly<{ status: 'completed'; value: T }>
  | Readonly<{ status: 'failed'; error: BisError }>;
export type BisResetResult =
  | Readonly<{ status: 'completed'; resetId: string }>
  | Readonly<{ status: 'failed'; resetId: string; error: BisError }>;
export type BisCapabilities = Readonly<{
  items: Readonly<{ available: boolean; reason: string }>;
  assetMinting: Readonly<{ available: boolean; reason: string }>;
  contracts: Readonly<{ available: boolean; reason: string }>;
  payments: Readonly<{ available: boolean; reason: string }>;
}>;

export type BisGameOperationReference = Readonly<{
  operationId: string;
  gameSession: BisGameSession;
  workflowId?: string;
  contractId?: string;
}>;
export type BisGameContinuationRequest = Readonly<{ gameSession?: BisGameSession }>;
export type BisGameContinuationState = BisGameContinueState & Readonly<{
  workflowId: string;
  gameSession?: BisGameSession;
  operation?: BisGameOperationReference;
  effectReceipt?: BisGameEffectReceipt;
}>;
export type BisGameRewardRequest = Readonly<{
  asset: Omit<BisMintAssetRequest, 'operationId'>;
  successMessage: string;
  timeoutMs?: number;
}>;
export type BisGameRewardState = BisAssetCollectionState & Readonly<{
  workflowId: string;
  gameSession?: BisGameSession;
  operation?: BisGameOperationReference;
  effectReceipt?: BisGameEffectReceipt;
  asset?: BisAsset;
}>;
export type BisGameEquipmentDefinition = BisEquipmentDefinition;
export type BisGameEquipmentFamily = BisEquipmentFamily;
export type BisGameEquipmentTier = BisEquipmentTier;
export type BisGameEquipmentItem = BisEquipmentItem;
export type BisGameEquipmentSlots = BisEquipmentSlots;
export type BisGameEquipmentState = BisEquipmentState;

export type BisContractRequest = Readonly<{
  offerSessionId: string;
  purpose: string;
  hostReference: string;
  amountSats: number;
  startedAt: number;
  expiresAt: number;
  exclusivityKey: string;
}>;
/** Legacy sessionId remains financial storage identity; offerSessionId names it explicitly. */
export type BisContractState = BisContract & Readonly<{ offerSessionId: string }>;
export type BisContractQueryResult = Readonly<{
  status: 'ready' | 'unavailable';
  contracts: readonly BisContractState[];
}>;

export type BisSnapshot = Readonly<{
  revision: number;
  version: string;
  disposed: boolean;
  account: Readonly<{
    visible: boolean;
    hasProfile: boolean;
    phase: ReturnType<BisContext['getState']>['phase'];
    playerWallet?: BisWalletReference;
    gameWallet?: BisWalletReference;
  }>;
  capabilities: BisCapabilities;
  equipment: BisGameEquipmentState;
  continuations: readonly BisGameContinuationState[];
  rewards: readonly BisGameRewardState[];
  contracts: BisContractQueryResult;
}>;

export type BisEvent = BisContextEvent
  | Readonly<{ type: 'stateChanged'; snapshot: BisSnapshot }>
  | Readonly<{ type: 'accountClosed' }>
  | Readonly<{ type: 'operationChanged'; operation: BisGameOperationReference; effectReceipt?: BisGameEffectReceipt }>;

/** The complete game-to-BIS runtime contract: no mutable services or controllers. */
export interface IBis {
  readyAsync(): Promise<void>;
  mount(container: HTMLElement): void;
  openAccountDialog(): void;
  isLoadingUIVisible(): boolean;
  showLoadingUI(): void;
  hideLoadingUI(): void;
  getSnapshot(): BisSnapshot;
  hasItemSupport(): boolean;
  hasAssetMintingSupport(): boolean;
  hasContractSupport(): boolean;
  hasPaymentSupport(): boolean;
  beginContinuation(request?: BisGameContinuationRequest): BisGameContinuationState;
  payContinuationAsync(workflowId: string): Promise<BisGameContinuationState>;
  checkContinuationAsync(workflowId: string): Promise<BisGameContinuationState>;
  endContinuation(workflowId: string): void;
  beginReward(request: BisGameRewardRequest): BisGameRewardState;
  refreshRewardAsync(workflowId: string): Promise<BisGameRewardState>;
  collectRewardAsync(workflowId: string): Promise<BisGameRewardState>;
  checkRewardAsync(workflowId: string): Promise<BisGameRewardState>;
  acknowledgeRewardAsync(workflowId: string): Promise<BisGameRewardState>;
  endReward(workflowId: string): void;
  refreshEquipmentAsync(): Promise<BisGameEquipmentState>;
  selectEquipmentAsync(assetId: string): Promise<BisGameEquipmentState>;
  clearEquipmentAsync(family: BisGameEquipmentFamily): Promise<BisGameEquipmentState>;
  startContractAsync(request: BisContractRequest): Promise<BisContractActionResult>;
  queryContractsAsync(filter?: BisContractFilter): Promise<BisContractQueryResult>;
  checkContractsAsync(filter?: BisContractFilter): Promise<BisContractQueryResult>;
  claimContractAsync(contractId: string): Promise<BisContractActionResult>;
  rejectContractAsync(contractId: string): Promise<BisContractActionResult>;
  endContractSessionAsync(offerSessionId: string): Promise<void>;
  resetForGameAsync(): Promise<BisResetResult>;
  dispose(options?: BisDisposeOptions): void;
}
