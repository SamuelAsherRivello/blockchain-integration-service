import type { BisAsset } from './assets';
import type { BisEvent } from '../integration-layer/bis';

/**
 * Protocol-neutral game boundary. BIS confirms wallet operations; the game
 * decides whether and how its current session can safely show an effect.
 */
export type BisGameSession = Readonly<{
  gameId: string;
  gameSessionId: string;
}>;

export type BisGameContinuationTarget = Readonly<{
  continuationTargetId: string;
}>;

export type BisGameConfirmedContinuation = Readonly<{
  operationId: string;
  gameSession: BisGameSession;
  continuationTarget: BisGameContinuationTarget;
}>;

export type BisGameConfirmedPlayerReward = Readonly<{
  operationId: string;
  gameSession: BisGameSession;
  rewardId: string;
  rewardDisplayName: string;
}> & (
  | Readonly<{ kind: 'asset'; asset: BisAsset }>
  | Readonly<{ kind: 'sats'; amountSats: number }>
);

export type BisGameEffectReceipt = Readonly<{
  status: 'applied' | 'already-applied' | 'not-applicable';
}>;

/** All game-owned callbacks are intentionally collected in this one interface. */
export interface IBisGame {
  onBisEvent(event: BisEvent): void;
  getActiveGameSession(): BisGameSession | undefined;
  captureContinuationTarget(input: Readonly<{
    gameSession: BisGameSession;
  }>): BisGameContinuationTarget | undefined;
  applyConfirmedContinuationAsync(input: BisGameConfirmedContinuation): Promise<BisGameEffectReceipt>;
  presentConfirmedPlayerRewardAsync(input: BisGameConfirmedPlayerReward): Promise<BisGameEffectReceipt>;
}
