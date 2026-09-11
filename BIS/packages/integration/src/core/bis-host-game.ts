/**
 * Protocol-neutral game-host boundary. BIS confirms wallet operations; the
 * host decides whether and how its current session can safely show an effect.
 */
export type BisHostGameSessionReference = Readonly<{
  gameId: string;
  gameSessionId: string;
}>;

export type BisHostGameContinuationTarget = Readonly<{
  continuationTargetId: string;
}>;

export type BisHostGameConfirmedContinuation = Readonly<{
  operationId: string;
  gameSessionReference: BisHostGameSessionReference;
  continuationTarget: BisHostGameContinuationTarget;
}>;

export type BisHostGameConfirmedPlayerReward = Readonly<{
  operationId: string;
  gameSessionReference: BisHostGameSessionReference;
  rewardId: string;
  rewardDisplayName: string;
}>;

export type BisHostGameEffectReceipt = Readonly<{
  status: 'applied' | 'already-applied' | 'not-applicable';
}>;

/** All game-owned callbacks are intentionally collected in this one contract. */
export interface BisHostGame {
  getActiveGameSessionReference(): BisHostGameSessionReference | undefined;
  captureContinuationTarget(input: Readonly<{
    gameSessionReference: BisHostGameSessionReference;
  }>): BisHostGameContinuationTarget | undefined;
  applyConfirmedContinuation(input: BisHostGameConfirmedContinuation): Promise<BisHostGameEffectReceipt>;
  presentConfirmedPlayerReward(input: BisHostGameConfirmedPlayerReward): Promise<BisHostGameEffectReceipt>;
}
