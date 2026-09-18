import { createBisAssetCollection, type BisAssetCollectionOptions } from './asset-collection';
import { createBisContext, type BisContext } from './context';
import { createBisContinue, type BisGameContinueOptions as BisGameContinueControllerOptions } from './game-continue';
import { createBisGameWallet } from './game-wallet';
import { createBisLto } from './lto-service';
import { createBisEquipment } from './equipment-loadout';
import type { BisHostGame, BisHostGameEffectReceipt } from './bis-host-game';
import { createBisUi } from '../ui/client';
import { getControls } from './context';
import { assetMintingSupportAvailable, contractSupportAvailable, itemSupportAvailable } from './capabilities.ts';

export type BisGameResetResult = Readonly<{ status: 'completed'; resetId: string }>;
export type BisGameResetErrorCode = 'disposed' | 'cleanup-failed';
export class BisGameResetError extends Error {
  readonly code: BisGameResetErrorCode;
  constructor(code: BisGameResetErrorCode, message: string) { super(message); this.name = 'BisGameResetError'; this.code = code; }
}

export type BisGameServicesOptions = Readonly<{
  getGameHost(): BisHostGame | undefined;
}>;

export type BisGameContinueDeliveryOptions = Readonly<{
  onEffectReceipt?(receipt: BisHostGameEffectReceipt): void;
}>;

/** Public lifecycle facade for a game embedding BIS. */
export class BisGameServices {
  /** 1. The game sees only a protocol-neutral host contract, never Arkade. */
  readonly context: BisContext;
  readonly gameWallet;
  readonly lto;
  readonly ui;
  #disposed = false;
  #getGameHost: BisGameServicesOptions['getGameHost'];
  #resetPromise: Promise<BisGameResetResult> | undefined;

  constructor(options: BisGameServicesOptions) {
    this.#getGameHost = options.getGameHost;
    let wallet: ReturnType<typeof createBisGameWallet> | undefined;
    /** 2. Compose BIS internals at one boundary and retain their ownership here. */
    this.context = createBisContext({
      get continueRecipient() { return wallet?.getState().addresses?.arkadeAddress; },
      gameWalletProfileId: () => wallet?.getState().profileId,
      hasGameWallet: () => !!wallet?.getState().profileId,
      resetGameWallet: async () => wallet ? wallet.reset() : true,
    });
    wallet = createBisGameWallet({ playerProfileId: () => this.context.getState().profileId, playerNetwork: () => this.context.getState().network });
    this.context.subscribe(() => { void wallet?.refresh(); });
    this.gameWallet = wallet;
    this.lto = createBisLto({ context: this.context, gameWallet: wallet });
    this.ui = createBisUi(this.context, {
      gameWallet: wallet,
      hasItemSupport: () => this.hasItemSupport(),
      hasAssetMintingSupport: () => this.hasAssetMintingSupport(),
      hasContractSupport: () => this.hasContractSupport(),
    });
  }

  /** 3. Hydrate account state before a host asks BIS to start an operation. */
  ready() { return this.context.ready(); }
  mount(container: HTMLElement) { this.ui.mount(container); }
  openAccountDialog() { this.context.openAccountDialog(); }

  /** Item support is Player Wallet-only; admin-minted items do not require a Game Wallet. */
  hasItemSupport(): boolean {
    return !this.#disposed && itemSupportAvailable(this.context.getState());
  }

  /** Asset minting also requires a distinct, funded Game Wallet. */
  hasAssetMintingSupport(): boolean {
    return !this.#disposed && assetMintingSupportAvailable(this.context.getState(), this.gameWallet.getState());
  }

  /** Contract support requires distinct ready wallets; contract calls still verify their exact funding needs. */
  hasContractSupport(): boolean {
    return !this.#disposed && contractSupportAvailable(this.context.getState(), this.gameWallet.getState());
  }


  /** Force-clears BIS-owned local game state without changing remote funds. */
  resetForGame(): Promise<BisGameResetResult> {
    if (this.#disposed) return Promise.reject(new BisGameResetError('disposed', 'BIS game services are disposed.'));
    if (this.#resetPromise) return this.#resetPromise;
    const resetId = crypto.randomUUID();
    this.#resetPromise = (async () => {
      try {
        const gameWalletReset = await this.gameWallet.reset();
        if (!gameWalletReset) throw new Error('Game Wallet reset could not be confirmed.');
        await this.lto.reset();
        await getControls(this.context).forceReset(resetId);
        return Object.freeze({status: 'completed' as const, resetId});
      } catch (error) {
        if (error instanceof BisGameResetError) throw error;
        throw new BisGameResetError('cleanup-failed', error instanceof Error ? error.message : 'BIS reset did not finish.');
      } finally {
        this.#resetPromise = undefined;
      }
    })();
    return this.#resetPromise;
  }

  createEquipment() {
    if (this.#disposed) throw Error('BIS game services are disposed.');
    return createBisEquipment(this.context);
  }

  createAssetCollection(options: BisAssetCollectionOptions) {
    if (this.#disposed) throw Error('BIS game services are disposed.');
    const original = options.onCollected;
    return createBisAssetCollection(this.context, {
      ...options,
      onCollected: result => {
        original?.(result);
        const host = this.#getGameHost();
        const gameSessionReference = host?.getActiveGameSessionReference();
        if (!host || !gameSessionReference) return;
        /** 4. Deliver confirmed outcomes to the game without altering financial truth. */
        void host.presentConfirmedPlayerReward({
          operationId: result.operationId,
          gameSessionReference,
          rewardId: result.asset.ticker ?? result.asset.assetId,
          rewardDisplayName: result.asset.name ?? result.asset.ticker ?? result.asset.assetId,
        }).catch(() => {});
      },
    });
  }

  createContinue(options: BisGameContinueDeliveryOptions = {}) {
    if (this.#disposed) throw Error('BIS game services are disposed.');
    const host = this.#getGameHost();
    const gameSessionReference = host?.getActiveGameSessionReference();
    const continuationTarget = host && gameSessionReference
      ? host.captureContinuationTarget({ gameSessionReference })
      : undefined;
    if (!host || !gameSessionReference || !continuationTarget) {
      throw Error('A current game continuation target is required.');
    }
    const context = `${gameSessionReference.gameId}/${gameSessionReference.gameSessionId}/${continuationTarget.continuationTargetId}`;
    const controllerOptions: BisGameContinueControllerOptions = {
      context,
      onSuccess: result => {
        void host.applyConfirmedContinuation({ operationId: result.operationId, gameSessionReference, continuationTarget })
          .then(receipt => options.onEffectReceipt?.(receipt))
          .catch(() => options.onEffectReceipt?.({ status: 'not-applicable' }));
      },
    };
    return createBisContinue(this.context, controllerOptions);
  }

  /** 5. Dispose in reverse ownership order; pending payments remain recoverable. */
  dispose(options: { preserveContracts?: boolean } = {}) {
    if (this.#disposed) return;
    this.#disposed = true;
    this.lto.dispose({ endSessions: !options.preserveContracts });
    this.gameWallet.dispose();
    this.ui.unmount();
    this.context.dispose();
  }
}
