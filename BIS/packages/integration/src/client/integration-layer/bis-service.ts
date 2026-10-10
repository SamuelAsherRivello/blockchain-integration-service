import { createBisAssetCollection } from '../state-layer-core/asset-collection';
import { getControls, invalidateContractPresentation } from '../state-layer-core/context';
import { createBisContext } from '../wallet-layer-arkade/context-composition';
import { createBisContinue } from '../state-layer-core/game-continue';
import { createBisGameWallet } from '../state-layer-core/game-wallet';
import { createBisLto, type BisContractFilter, type BisContractActionResult, type BisContractsResult } from '../state-layer-core/lto-service';
import { createBisEquipment } from '../state-layer-core/equipment-loadout';
import type { IBisGame, BisGameSession, BisGameEffectReceipt, BisGameConfirmedPlayerReward } from '../state-layer-core/bis-game';
import { createBisUi } from '../ui-layer-react/client';
import { assetMintingSupportAvailable, contractSupportAvailable, itemSupportAvailable,
  assetMintingSupportFeedback, contractSupportFeedback, itemSupportFeedback } from '../state-layer-core/capabilities.ts';
import { version } from '../../../package.json';
import type { IBis, BisOptions, BisDisposeOptions, BisSnapshot, BisEvent, BisResetResult,
  BisGameContinuationRequest, BisGameContinuationState, BisGameRewardRequest,
  BisGameRewardState, BisGameEquipmentFamily, BisGameOperationReference,
  BisContractRequest, BisContractQueryResult } from './bis';

/** Compatibility names for non-game consumers; games use BisOptions/BisResetResult. */
export type BisServiceOptions = BisOptions;
export type BisServiceResetResult = BisResetResult;
export type BisServiceResetErrorCode = 'disposed' | 'cleanup-failed';
export class BisServiceResetError extends Error {
  constructor(readonly code: BisServiceResetErrorCode, message: string) {
    super(message); this.name = 'BisServiceResetError';
  }
}
export type BisServiceContinueDeliveryOptions = Readonly<{ onEffectReceipt?(receipt: BisGameEffectReceipt): void }>;
type Origin = Readonly<{ host: IBisGame; session: BisGameSession; generation: number }>;
type Continuation = {
  controller: ReturnType<typeof createBisContinue>; unsubscribe: () => void; origin: Origin;
  operation?: BisGameOperationReference; receipt?: BisGameEffectReceipt;
};
type Reward = {
  controller: ReturnType<typeof createBisAssetCollection>; unsubscribe: () => void; origin?: Origin;
  operation?: BisGameOperationReference; receipt?: BisGameEffectReceipt;
  asset?: BisGameConfirmedPlayerReward & { kind: 'asset' };
};
function frozenCopy<T>(value: T): T {
  const copy = structuredClone(value);
  function freeze(item: unknown): void {
    if (!item || typeof item !== 'object' || Object.isFrozen(item)) return;
    for (const child of Object.values(item)) freeze(child);
    Object.freeze(item);
  }
  freeze(copy); return copy;
}
const sameSession = (a: BisGameSession | undefined, b: BisGameSession) => a?.gameId === b.gameId && a.gameSessionId === b.gameSessionId;

/** Lifecycle-owned game facade. Private resources cannot escape to a host. */
export class BisService implements IBis {
  #context: ReturnType<typeof createBisContext>;
  #gameWallet: ReturnType<typeof createBisGameWallet>;
  #lto: ReturnType<typeof createBisLto>;
  #ui: ReturnType<typeof createBisUi>;
  #equipment: ReturnType<typeof createBisEquipment>;
  #getBisGame: BisOptions['getBisGame'];
  #subscriptions: (() => void)[] = [];
  #continuations = new Map<string, Continuation>();
  #rewards = new Map<string, Reward>();
  #offerOrigins = new Map<string, Origin>();
  #endedOffers = new Set<string>();
  #deliveredContracts = new Set<string>();
  #contracts: BisContractQueryResult = { status: 'unavailable', contracts: [] };
  #contractsAccountKey: string | undefined;
  #disposed = false;
  #generation = 0;
  #revision = 0;
  #notifying = false;
  #queryRevision = 0;
  #resetPromise: Promise<BisResetResult> | undefined;

  constructor(options: BisOptions) {
    this.#getBisGame = options.getBisGame;
    let wallet: ReturnType<typeof createBisGameWallet> | undefined;
    this.#context = createBisContext({
      get continueRecipient() { return wallet?.getState().addresses?.arkadeAddress; },
      gameWalletProfileId: () => wallet?.getState().profileId,
      hasGameWallet: () => !!wallet?.getState().profileId,
      resetGameWallet: async () => wallet ? wallet.reset() : true,
    });
    wallet = createBisGameWallet({ playerProfileId: () => this.#context.getState().profileId, playerNetwork: () => this.#context.getState().network });
    this.#gameWallet = wallet;
    this.#lto = createBisLto({ context: this.#context, gameWallet: wallet });
    this.#equipment = createBisEquipment(this.#context);
    this.#ui = createBisUi(this.#context, {
      gameWallet: wallet, hasItemSupport: () => this.hasItemSupport(),
      hasAssetMintingSupport: () => this.hasAssetMintingSupport(), hasContractSupport: () => this.hasContractSupport(),
    });
    let accountVisible = this.#context.getState().view === 'account';
    let accountKey = this.#accountKey();
    const refreshAccountProjection = () => {
      const next = this.#accountKey();
      if (next !== accountKey) { accountKey = next; void this.#readContracts(); }
    };
    this.#subscriptions.push(
      this.#context.subscribe(() => {
        const visible = this.#context.getState().view === 'account', closed = accountVisible && !visible;
        accountVisible = visible; this.#publish();
        refreshAccountProjection();
        if (closed) this.#emit({ type: 'accountClosed' });
        if (!this.#resetPromise) void wallet?.refresh().catch(() => {});
      }),
      this.#context.onEvent(event => {
        this.#emit(event);
        if (event.type === 'accountDisconnected') void wallet?.logout().catch(() => {});
      }),
      this.#gameWallet.subscribe(() => { this.#publish(); refreshAccountProjection(); }),
      this.#equipment.subscribe(() => this.#publish()),
      this.#lto.subscribe(() => { invalidateContractPresentation(this.#context); void this.#readContracts(); }),
    );
  }
  #assertAlive() {
    if (this.#disposed || this.#resetPromise) throw Error('BIS is unavailable during reset or after disposal.');
  }
  #host(): IBisGame | undefined { try { return this.#getBisGame(); } catch { return undefined; } }
  #accountKey(): string {
    const player = this.#context.getState(), game = this.#gameWallet.getState();
    return JSON.stringify([player.profileId, player.network, game.profileId, game.network]);
  }
  #capture(): Origin | undefined {
    const host = this.#host();
    try {
      const session = host?.getActiveGameSession();
      return host && session ? { host, session: frozenCopy(session), generation: this.#generation } : undefined;
    } catch { return undefined; }
  }
  #current(origin: Origin): boolean {
    if (this.#disposed || this.#resetPromise || origin.generation !== this.#generation || this.#host() !== origin.host) return false;
    try { return sameSession(origin.host.getActiveGameSession(), origin.session); } catch { return false; }
  }
  #emit(event: BisEvent) {
    if (this.#disposed || this.#resetPromise || this.#notifying) return;
    this.#notifying = true;
    try { this.#host()?.onBisEvent(frozenCopy(event)); } catch { /* A host failure is not a financial result. */ }
    finally { this.#notifying = false; }
  }
  #publish() {
    if (this.#disposed || this.#resetPromise) return;
    this.#revision++; this.#emit({ type: 'stateChanged', snapshot: this.getSnapshot() });
  }
  #workflowChanged(id: string, workflow: Continuation | Reward | undefined) {
    if (!workflow) return;
    const operationId = workflow.controller.getState().operationId;
    if (operationId && workflow.origin && operationId !== workflow.operation?.operationId) {
      workflow.operation = frozenCopy({ operationId, gameSession: workflow.origin.session, workflowId: id });
      workflow.receipt = undefined;
    }
    this.#publish();
    if ((this.#continuations.get(id) ?? this.#rewards.get(id)) === workflow && workflow.operation) {
      this.#emit({ type: 'operationChanged', operation: workflow.operation });
    }
  }
  #continuationState(id: string, workflow = this.#continuations.get(id)): BisGameContinuationState {
    if (!workflow) throw Error('Unknown or ended BIS continuation.');
    const state = workflow.controller.getState();
    const operation = workflow.operation ?? (state.operationId ? { operationId: state.operationId, gameSession: workflow.origin.session, workflowId: id } : undefined);
    return frozenCopy({ ...state, workflowId: id, gameSession: workflow.origin.session,
      ...(operation ? { operation } : {}), ...(workflow.receipt ? { effectReceipt: workflow.receipt } : {}) });
  }
  #rewardState(id: string, workflow = this.#rewards.get(id)): BisGameRewardState {
    if (!workflow) throw Error('Unknown or ended BIS reward.');
    const state = workflow.controller.getState();
    const operation = workflow.operation ?? (state.operationId && workflow.origin ? { operationId: state.operationId, gameSession: workflow.origin.session, workflowId: id } : undefined);
    return frozenCopy({ ...state, workflowId: id,
      ...(workflow.origin ? { gameSession: workflow.origin.session } : {}),
      ...(operation ? { operation } : {}), ...(workflow.receipt ? { effectReceipt: workflow.receipt } : {}),
      ...(workflow.asset ? { asset: workflow.asset.asset } : {}) });
  }
  async #deliver(origin: Origin | undefined, operation: BisGameOperationReference | undefined,
    effect: () => Promise<BisGameEffectReceipt>): Promise<BisGameEffectReceipt> {
    let receipt: BisGameEffectReceipt = { status: 'not-applicable' };
    if (origin && this.#current(origin)) {
      try {
        const result = await effect();
        // The host guards its commit; a run ending after that commit must not rewrite its receipt.
        if (['applied', 'already-applied', 'not-applicable'].includes(result?.status)) receipt = { status: result.status };
      } catch { /* A rejected effect never retries a financial operation. */ }
    }
    if (origin && operation && !this.#disposed && origin.generation === this.#generation) this.#emit({ type: 'operationChanged', operation, effectReceipt: receipt });
    return frozenCopy(receipt);
  }
  async readyAsync() {
    this.#assertAlive(); await this.#context.readyAsync();
    if (!this.#disposed && !this.#resetPromise) { await this.#readContracts(); this.#publish(); }
  }
  mount(container: HTMLElement) { this.#assertAlive(); this.#ui.mount(container); }
  openAccountDialog() { this.#assertAlive(); this.#context.openAccountDialog(); }
  isLoadingUIVisible() { return !this.#disposed && this.#ui.isLoadingUIVisible(); }
  showLoadingUI() { this.#assertAlive(); if (!this.isLoadingUIVisible()) this.#ui.showLoadingUI(); }
  hideLoadingUI() { if (!this.#disposed && this.isLoadingUIVisible()) this.#ui.hideLoadingUI(); }
  hasItemSupport() { return !this.#disposed && !this.#resetPromise && itemSupportAvailable(this.#context.getState()); }
  hasAssetMintingSupport() { return !this.#disposed && !this.#resetPromise && assetMintingSupportAvailable(this.#context.getState(), this.#gameWallet.getState()); }
  hasContractSupport() { return !this.#disposed && !this.#resetPromise && contractSupportAvailable(this.#context.getState(), this.#gameWallet.getState()); }
  getSnapshot(): BisSnapshot {
    const player = this.#context.getState(), game = this.#gameWallet.getState();
    return frozenCopy({ revision: this.#revision, version, disposed: this.#disposed,
      account: { visible: !this.#disposed && player.view === 'account', hasProfile: !this.#disposed && player.hasProfile, phase: player.phase,
        ...(player.profileId ? { playerWallet: { profileId: player.profileId, network: player.network } } : {}),
        ...(game.profileId ? { gameWallet: { profileId: game.profileId, network: game.network } } : {}) },
      capabilities: {
        items: { available: this.hasItemSupport(), reason: itemSupportFeedback(player) },
        assetMinting: { available: this.hasAssetMintingSupport(), reason: assetMintingSupportFeedback(player, game) },
        contracts: { available: this.hasContractSupport(), reason: contractSupportFeedback(player, game) } },
      equipment: this.#equipment.getState(),
      continuations: [...this.#continuations].map(([id, workflow]) => this.#continuationState(id, workflow)),
      rewards: [...this.#rewards].map(([id, workflow]) => this.#rewardState(id, workflow)),
      contracts: this.#contractsAccountKey === this.#accountKey() ? this.#contracts : { status: 'unavailable', contracts: [] } });
  }
  beginContinuation(request: BisGameContinuationRequest = {}): BisGameContinuationState {
    this.#assertAlive(); const origin = this.#capture();
    if (!origin || (request.gameSession && !sameSession(request.gameSession, origin.session))) throw Error('A current game continuation session is required.');
    const target = origin.host.captureContinuationTarget({ gameSession: origin.session });
    if (!target) throw Error('A current game continuation target is required.');
    const continuationTarget = frozenCopy(target), id = crypto.randomUUID();
    const controller = createBisContinue(this.#context, {
      context: `${origin.session.gameId}/${origin.session.gameSessionId}/${target.continuationTargetId}`,
      onSuccess: result => {
        const workflow = this.#continuations.get(id); if (!workflow) return;
        workflow.operation = frozenCopy({ operationId: result.operationId, gameSession: origin.session, workflowId: id });
        void this.#deliver(origin, workflow.operation, () => origin.host.applyConfirmedContinuationAsync({ operationId: result.operationId, gameSession: origin.session, continuationTarget }))
          .then(receipt => { if (this.#continuations.get(id) === workflow && origin.generation === this.#generation) { workflow.receipt = receipt; this.#publish(); } });
      },
    });
    this.#continuations.set(id, { controller, origin, unsubscribe: controller.subscribe(() => this.#workflowChanged(id, this.#continuations.get(id))) });
    this.#publish(); return this.#continuationState(id);
  }
  async payContinuationAsync(id: string) {
    this.#assertAlive(); const workflow = this.#continuations.get(id);
    if (!workflow) throw Error('Unknown or ended BIS continuation.');
    if (!this.#current(workflow.origin)) throw Error('The continuation session has ended.');
    await workflow.controller.pay(); return this.#continuationState(id);
  }
  async checkContinuationAsync(id: string) {
    this.#assertAlive(); const workflow = this.#continuations.get(id);
    if (!workflow) throw Error('Unknown or ended BIS continuation.');
    await workflow.controller.check(); return this.#continuationState(id);
  }
  endContinuation(id: string) {
    const workflow = this.#continuations.get(id); if (!workflow) return;
    this.#continuations.delete(id); workflow.unsubscribe(); workflow.controller.dispose(); this.#publish();
  }
  beginReward(request: BisGameRewardRequest): BisGameRewardState {
    this.#assertAlive(); const origin = this.#capture(), id = crypto.randomUUID();
    const controller = createBisAssetCollection(this.#context, { ...frozenCopy(request), onCollected: result => {
      const workflow = this.#rewards.get(id); if (!workflow || !origin) return;
      workflow.operation = frozenCopy({ operationId: result.operationId, gameSession: origin.session, workflowId: id });
      const reward: BisGameConfirmedPlayerReward & { kind: 'asset' } = frozenCopy({ kind: 'asset', asset: result.asset,
        operationId: result.operationId, gameSession: origin.session, rewardId: result.asset.ticker ?? result.asset.assetId,
        rewardDisplayName: result.asset.name ?? result.asset.ticker ?? result.asset.assetId });
      workflow.asset = reward;
      void this.#deliver(origin, workflow.operation, () => origin.host.presentConfirmedPlayerRewardAsync(reward))
        .then(receipt => { if (this.#rewards.get(id) === workflow && origin.generation === this.#generation) { workflow.receipt = receipt; this.#publish(); } });
    } });
    this.#rewards.set(id, { controller, origin, unsubscribe: controller.subscribe(() => this.#workflowChanged(id, this.#rewards.get(id))) });
    this.#publish(); return this.#rewardState(id);
  }
  async #rewardAction(id: string, action: 'refresh' | 'collect' | 'check' | 'acknowledge') {
    this.#assertAlive(); const workflow = this.#rewards.get(id);
    if (!workflow) throw Error('Unknown or ended BIS reward.');
    if (action === 'collect' && (!workflow.origin || !this.#current(workflow.origin))) throw Error('The reward session has ended.');
    await workflow.controller[action](); return this.#rewardState(id);
  }
  refreshRewardAsync(id: string) { return this.#rewardAction(id, 'refresh'); }
  collectRewardAsync(id: string) { return this.#rewardAction(id, 'collect'); }
  checkRewardAsync(id: string) { return this.#rewardAction(id, 'check'); }
  acknowledgeRewardAsync(id: string) { return this.#rewardAction(id, 'acknowledge'); }
  endReward(id: string) {
    const workflow = this.#rewards.get(id); if (!workflow) return;
    this.#rewards.delete(id); workflow.unsubscribe(); workflow.controller.dispose(); this.#publish();
  }
  async refreshEquipmentAsync() { this.#assertAlive(); return frozenCopy(await this.#equipment.refresh()); }
  async selectEquipmentAsync(assetId: string) { this.#assertAlive(); return frozenCopy(await this.#equipment.select(assetId)); }
  async clearEquipmentAsync(family: BisGameEquipmentFamily) { this.#assertAlive(); return frozenCopy(await this.#equipment.clear(family)); }
  async #readContracts(filter: BisContractFilter = {}): Promise<BisContractQueryResult> {
    if (this.#disposed || this.#resetPromise) return frozenCopy({ status: 'unavailable', contracts: [] });
    const unfiltered = Object.keys(filter).length === 0;
    const generation = this.#generation, revision = unfiltered ? ++this.#queryRevision : this.#queryRevision, accountKey = this.#accountKey();
    let result: BisContractsResult;
    try { result = await (this.#context.checkContractsAsync?.(filter) ?? this.#lto.checkContractsAsync(filter)); }
    catch { result = { status: 'unavailable', contracts: [] }; }
    if (this.#disposed || this.#resetPromise || generation !== this.#generation || accountKey !== this.#accountKey()) return frozenCopy({ status: 'unavailable', contracts: [] });
    const projected: BisContractQueryResult = frozenCopy({ status: result.status, contracts: result.contracts.map(contract => ({ ...contract, offerSessionId: contract.sessionId })) });
    if (unfiltered && revision === this.#queryRevision) { this.#contracts = projected; this.#contractsAccountKey = accountKey; this.#publish(); }
    for (const contract of projected.contracts) {
      if (contract.financial !== 'claimed' || !contract.operationId) continue;
      const origin = this.#offerOrigins.get(contract.offerSessionId), key = `${contract.id}/${contract.operationId}`;
      if (!origin || this.#deliveredContracts.has(key)) continue;
      this.#deliveredContracts.add(key);
      const operation = { operationId: contract.operationId, gameSession: origin.session, contractId: contract.id };
      void this.#deliver(origin, operation, () => origin.host.presentConfirmedPlayerRewardAsync({ kind: 'sats', amountSats: contract.amountSats,
        operationId: contract.operationId!, gameSession: origin.session, rewardId: contract.id, rewardDisplayName: contract.purpose }));
    }
    return projected;
  }
  async startContractAsync(request: BisContractRequest): Promise<BisContractActionResult> {
    this.#assertAlive(); const existing = this.#offerOrigins.get(request.offerSessionId);
    if (this.#endedOffers.has(request.offerSessionId) || (existing && !this.#current(existing))) return { status: 'unavailable' };
    const origin = existing ?? this.#capture(); if (!origin) return { status: 'unavailable' };
    if (!this.#offerOrigins.has(request.offerSessionId)) this.#offerOrigins.set(request.offerSessionId, origin);
    const { offerSessionId, ...rest } = frozenCopy(request);
    const result = await this.#lto.start({ ...rest, sessionId: offerSessionId });
    await this.#readContracts(); return frozenCopy(result);
  }
  queryContractsAsync(filter: BisContractFilter = {}) { return this.#readContracts(filter); }
  async checkContractsAsync(filter: BisContractFilter = {}) {
    this.#assertAlive();
    await this.#lto.reconcile(filter.sessionId ? {sessionId:filter.sessionId,feedback:'silent'} : {feedback:'silent'});
    return this.#readContracts(filter);
  }
  async claimContractAsync(id: string) { this.#assertAlive(); const result = await this.#lto.claim(id); await this.#readContracts(); return frozenCopy(result); }
  async rejectContractAsync(id: string) { this.#assertAlive(); const result = await this.#lto.reject(id); await this.#readContracts(); return frozenCopy(result); }
  async endContractSessionAsync(id: string) { this.#assertAlive(); this.#endedOffers.add(id); this.#offerOrigins.delete(id); await this.#lto.endSession(id); await this.#readContracts(); }
  #endWorkflows() {
    for (const id of this.#continuations.keys()) this.endContinuation(id);
    for (const id of this.#rewards.keys()) this.endReward(id);
    this.#offerOrigins.clear(); this.#endedOffers.clear(); this.#deliveredContracts.clear();
  }
  resetForGameAsync(): Promise<BisResetResult> {
    if (this.#resetPromise) return this.#resetPromise;
    const resetId = crypto.randomUUID();
    if (this.#disposed) return Promise.resolve({ status: 'failed', resetId, error: { code: 'disposed', message: 'BIS is disposed.' } });
    this.#generation++; this.#queryRevision++;
    this.#resetPromise = Promise.resolve().then(async (): Promise<BisResetResult> => {
      try {
        if (!await this.#gameWallet.reset()) throw Error();
        await this.#lto.reset(); await getControls(this.#context).forceReset(resetId);
        if (this.#disposed) return { status: 'failed', resetId, error: { code: 'disposed', message: 'BIS was disposed during reset.' } };
        this.#contracts = { status: 'ready', contracts: [] }; this.#contractsAccountKey = this.#accountKey(); await this.#equipment.refresh();
        return frozenCopy({ status: 'completed', resetId });
      } catch { return frozenCopy({ status: 'failed', resetId, error: { code: 'cleanup-failed', message: 'BIS local cleanup did not finish. Retry Clear All Settings.' } }); }
      finally { this.#resetPromise = undefined; this.#publish(); }
    });
    this.#endWorkflows();
    return this.#resetPromise;
  }
  dispose(options: BisDisposeOptions = {}) {
    if (this.#disposed) return;
    this.#disposed = true; this.#generation++; this.#queryRevision++; this.#endWorkflows();
    for (const unsubscribe of this.#subscriptions.splice(0)) unsubscribe();
    this.#equipment.dispose(); this.#lto.dispose({ endSessions: !options.preserveContracts });
    this.#gameWallet.dispose(); this.#ui.unmount(); this.#context.dispose();
  }
}
