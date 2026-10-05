import { createBisAssetCollection, type BisAssetCollectionOptions } from '../state-layer-core/asset-collection';
import { getControls, type BisContext } from '../state-layer-core/context';
import { createBisContext } from '../wallet-layer-arkade/context-composition';
import { createBisContinue, type BisGameContinueOptions as BisGameContinueControllerOptions } from '../state-layer-core/game-continue';
import { createBisGameWallet } from '../state-layer-core/game-wallet';
import { createBisLto } from '../state-layer-core/lto-service';
import { createBisEquipment } from '../state-layer-core/equipment-loadout';
import type { IBisGame, BisGameEffectReceipt } from '../state-layer-core/bis-game';
import { createBisUi } from '../ui-layer-react/client';
import { assetMintingSupportAvailable, contractSupportAvailable, itemSupportAvailable } from '../state-layer-core/capabilities.ts';

export type BisServiceResetResult = Readonly<{ status: 'completed'; resetId: string }>;
export type BisServiceResetErrorCode = 'disposed' | 'cleanup-failed';
export class BisServiceResetError extends Error {
  readonly code: BisServiceResetErrorCode;
  constructor(code: BisServiceResetErrorCode, message: string) { super(message); this.name = 'BisServiceResetError'; this.code = code; }
}

export type BisServiceOptions = Readonly<{
  getBisGame(): IBisGame | undefined;
}>;

export type BisServiceContinueDeliveryOptions = Readonly<{
  onEffectReceipt?(receipt: BisGameEffectReceipt): void;
}>;

/** Public lifecycle facade for a game embedding BIS. */
export class BisService {
  /** 1. The game sees only the protocol-neutral IBisGame interface, never Arkade. */
  readonly context: BisContext;
  readonly gameWallet;
  readonly lto;
  readonly ui;
  #disposed = false;
  #getBisGame: BisServiceOptions['getBisGame'];
  #resetPromise: Promise<BisServiceResetResult> | undefined;

  constructor(options: BisServiceOptions) {
    this.#getBisGame = options.getBisGame;
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

  /** 3. Hydrate account state before IBisGame asks BIS to start an operation. */
  ready() { return this.context.ready(); }
  mount(container: HTMLElement) { this.ui.mount(container); }
  openAccountDialog() { this.context.openAccountDialog(); }
  isBisVisible() { return this.ui.isBisVisible(); }
  showLoading() { this.ui.showLoading(); }
  hideLoading() { this.ui.hideLoading(); }

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
  resetForGame(): Promise<BisServiceResetResult> {
    if (this.#disposed) return Promise.reject(new BisServiceResetError('disposed', 'BIS service is disposed.'));
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
        if (error instanceof BisServiceResetError) throw error;
        throw new BisServiceResetError('cleanup-failed', error instanceof Error ? error.message : 'BIS reset did not finish.');
      } finally {
        this.#resetPromise = undefined;
      }
    })();
    return this.#resetPromise;
  }

  createEquipment() {
    if (this.#disposed) throw Error('BIS service is disposed.');
    return createBisEquipment(this.context);
  }

  createAssetCollection(options: BisAssetCollectionOptions) {
    if (this.#disposed) throw Error('BIS service is disposed.');
    const original = options.onCollected;
    return createBisAssetCollection(this.context, {
      ...options,
      onCollected: result => {
        original?.(result);
        const bisGame = this.#getBisGame();
        const gameSession = bisGame?.getActiveGameSession();
        if (!bisGame || !gameSession) return;
        /** 4. Deliver confirmed outcomes to IBisGame without altering financial truth. */
        void bisGame.presentConfirmedPlayerReward({
          operationId: result.operationId,
          gameSession,
          rewardId: result.asset.ticker ?? result.asset.assetId,
          rewardDisplayName: result.asset.name ?? result.asset.ticker ?? result.asset.assetId,
        }).catch(() => {});
      },
    });
  }

  createContinue(options: BisServiceContinueDeliveryOptions = {}) {
    if (this.#disposed) throw Error('BIS service is disposed.');
    const bisGame = this.#getBisGame();
    const gameSession = bisGame?.getActiveGameSession();
    const continuationTarget = bisGame && gameSession
      ? bisGame.captureContinuationTarget({ gameSession })
      : undefined;
    if (!bisGame || !gameSession || !continuationTarget) {
      throw Error('A current game continuation target is required.');
    }
    const context = `${gameSession.gameId}/${gameSession.gameSessionId}/${continuationTarget.continuationTargetId}`;
    const controllerOptions: BisGameContinueControllerOptions = {
      context,
      onSuccess: result => {
        void bisGame.applyConfirmedContinuation({ operationId: result.operationId, gameSession, continuationTarget })
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
