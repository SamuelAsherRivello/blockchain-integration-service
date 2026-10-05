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
}>;

export type BisGameEffectReceipt = Readonly<{
  status: 'applied' | 'already-applied' | 'not-applicable';
}>;

/** All game-owned callbacks are intentionally collected in this one interface. */
export interface IBisGame {
  getActiveGameSession(): BisGameSession | undefined;
  captureContinuationTarget(input: Readonly<{
    gameSession: BisGameSession;
  }>): BisGameContinuationTarget | undefined;
  applyConfirmedContinuation(input: BisGameConfirmedContinuation): Promise<BisGameEffectReceipt>;
  presentConfirmedPlayerReward(input: BisGameConfirmedPlayerReward): Promise<BisGameEffectReceipt>;
}
