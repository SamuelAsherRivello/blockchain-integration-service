import {
  BisService,
  type BisEvent,
  type IBisGame,
  type BisGameSession,
  type BisGameConfirmedContinuation,
  type BisGameConfirmedPlayerReward,
} from '@bis/integration';
import { TREASURE_DEMO_GAME_ID } from './treasure-demo-runtime.ts';

/** Browser-owned BIS account service, kept out of the import-safe source module. */
export function createTreasureDemoService(onEvent: (event: BisEvent) => void, network: 'signet'|'mutinynet') {
  const host: IBisGame = {
    onBisEvent: onEvent,
    getActiveGameSession(): BisGameSession { return { gameId: TREASURE_DEMO_GAME_ID, gameSessionId: 'treasure-hunt-demo' }; },
    captureContinuationTarget: () => undefined,
    applyConfirmedContinuationAsync: async (_input: BisGameConfirmedContinuation) => ({ status: 'not-applicable' }),
    presentConfirmedPlayerRewardAsync: async (_input: BisGameConfirmedPlayerReward) => ({ status: 'not-applicable' }),
  };
  const service = new BisService({ getBisGame: () => host, manualGameWalletOnly: true, prototypeTreasureSameWallet: true, prototypeTreasureNetwork: network });
  return {
    service,
    async ready() { await service.readyAsync(); },
    mount(container: HTMLElement) { service.mount(container); },
    getSnapshot() { return service.getSnapshot(); },
    openAccountDialog() { service.openAccountDialog(); },
    dispose() { service.dispose({ preserveContracts: true }); },
  };
}
