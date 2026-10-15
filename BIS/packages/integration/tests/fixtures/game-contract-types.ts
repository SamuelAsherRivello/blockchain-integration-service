import type {
  IBis, IBisGame, BisEvent, BisSnapshot, BisContractRequest,
  BisGameConfirmedPlayerReward, BisGameEffectReceipt,
} from '../../src/index';
import { BisService } from '@bis/integration';
import '@bis/integration/style.css';

export async function mountBis(game: IBisGame, container: HTMLElement): Promise<IBis> {
  const bis: IBis = new BisService({ getBisGame: () => game });
  await bis.readyAsync();
  bis.mount(container);
  return bis;
}

export function facadeConforms(service: BisService): IBis {
  // @ts-expect-error JavaScript private fields cannot be public game members.
  service.context;
  // @ts-expect-error Controller factories are no longer promoted by the facade.
  service.createContinue();
  return service;
}

const receipt: BisGameEffectReceipt = { status: 'applied' };
export const game = {
  getActiveGameSession: () => ({ gameId: 'fixture-game', gameSessionId: 'run-1' }),
  captureContinuationTarget: () => ({ continuationTargetId: 'defeat-1' }),
  applyConfirmedContinuationAsync: async () => receipt,
  presentConfirmedPlayerRewardAsync: async (_reward: BisGameConfirmedPlayerReward) => receipt,
  onBisEvent: (_event: BisEvent) => {},
} satisfies IBisGame;

// @ts-expect-error The event method is mandatory, not an optional backdoor.
export const incompleteGame: IBisGame = {
  getActiveGameSession: game.getActiveGameSession,
  captureContinuationTarget: game.captureContinuationTarget,
  applyConfirmedContinuationAsync: game.applyConfirmedContinuationAsync,
  presentConfirmedPlayerRewardAsync: game.presentConfirmedPlayerRewardAsync,
};

export function consume(bis: IBis, mount: HTMLElement, request: BisContractRequest) {
  bis.mount(mount);
  void bis.readyAsync();
  bis.openAccountDialog();
  const snapshot: BisSnapshot = bis.getSnapshot();
  const continuation = bis.beginContinuation();
  void bis.payContinuationAsync(continuation.workflowId);
  void bis.checkContinuationAsync(continuation.workflowId);
  bis.endContinuation(continuation.workflowId);
  const reward = bis.beginReward({
    asset: { name: 'Fixture Trophy', ticker: 'FXT', amount: '1', decimals: 0 },
    successMessage: 'Collected',
  });
  void bis.refreshRewardAsync(reward.workflowId);
  void bis.collectRewardAsync(reward.workflowId);
  void bis.checkRewardAsync(reward.workflowId);
  void bis.acknowledgeRewardAsync(reward.workflowId);
  bis.endReward(reward.workflowId);
  void bis.refreshEquipmentAsync();
  void bis.selectEquipmentAsync('owned-asset');
  void bis.clearEquipmentAsync('Shoes');
  void bis.startContractAsync(request);
  void bis.queryContractsAsync();
  void bis.checkContractsAsync();
  void bis.claimContractAsync('offer');
  void bis.rejectContractAsync('offer');
  void bis.endContractSessionAsync(request.offerSessionId);
  void bis.resetForGameAsync().then(result => {
    if (result.status === 'failed') return result.error.code;
    return result.resetId;
  });
  // @ts-expect-error No context escape hatch.
  bis.context;
  // @ts-expect-error No wallet escape hatch.
  bis.gameWallet;
  // @ts-expect-error No LTO service escape hatch.
  bis.lto;
  // @ts-expect-error No UI object escape hatch.
  bis.ui;
  // @ts-expect-error No workflow controller factory.
  bis.createContinue();
  // @ts-expect-error Projection data cannot be changed by the host.
  snapshot.account.hasProfile = true;
  // @ts-expect-error Nested operation arrays are readonly.
  snapshot.continuations.push(continuation);
  bis.dispose({ preserveContracts: true });
  return snapshot;
}

export function displayReward(reward: BisGameConfirmedPlayerReward) {
  return reward.kind === 'asset' ? reward.asset.quantity : reward.amountSats;
}
