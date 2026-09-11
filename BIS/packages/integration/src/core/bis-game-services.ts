import { createBisAssetCollection, type BisAssetCollectionOptions } from './asset-collection';
import { createBisContext, type BisContext } from './context';
import { createBisContinue, type BisGameContinueOptions as BisGameContinueControllerOptions } from './game-continue';
import { createBisGameWallet } from './game-wallet';
import { createBisLto } from './lto-service';
import { createBisEquipment } from './equipment-loadout';
import type { BisHostGame, BisHostGameEffectReceipt } from './bis-host-game';
import { createBisUi } from '../ui/client';

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

  constructor(options: BisGameServicesOptions) {
    this.#getGameHost = options.getGameHost;
    let wallet: ReturnType<typeof createBisGameWallet> | undefined;
    /** 2. Compose BIS internals at one boundary and retain their ownership here. */
    this.context = createBisContext({ get continueRecipient() { return wallet?.getState().addresses?.arkadeAddress; } });
    wallet = createBisGameWallet({ playerProfileId: () => this.context.getState().profileId });
    this.gameWallet = wallet;
    this.lto = createBisLto({ context: this.context, gameWallet: wallet });
    this.ui = createBisUi(this.context, { gameWallet: wallet });
  }

  /** 3. Hydrate account state before a host asks BIS to start an operation. */
  ready() { return this.context.ready(); }
  mount(container: HTMLElement) { this.ui.mount(container); }
  openAccountDialog() { this.context.openAccountDialog(); }

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
