import type { BisContext } from './context.ts';
import { createNetworkScopedGameWalletStorage, type createBisGameWallet } from './game-wallet.ts';
import { createAccountStorage } from './account-storage.ts';
import { createGameWalletStorage } from './game-wallet-storage.ts';
import { withWalletMutation } from './boarding-record.ts';
import { createContractStorage, type ContractDocument, type ContractRecovery } from './contract-storage.ts';
import { beginContractOperation, contractResolved, endContract, finishContractOperation, presentContract, startLto, contractFailureMessages, type BisContract, type ContractRecord, type LtoRequest } from './contracts.ts';
import { publishContractReservations, reserveContract } from './contract-reservations.ts';
import { prepareLtoRecovery, reconcileLtoSpend, resumeLtoFinalization, submitLtoSpend } from '../arkade/lto-contract.ts';
import { operatorFor } from '../arkade/account.ts';
import { isTestNetwork, type TestNetwork } from './test-network.ts';

export type BisContractFilter = Readonly<{ purpose?: string; sessionId?: string; exclusivityKey?: string; gameId?: string; hostReference?: string; includeResolved?: boolean; includeOtherNetworks?: boolean }>;
export type BisContractsResult = Readonly<{ status: 'ready' | 'unavailable'; contracts: readonly BisContract[] }>;
export type BisContractActionResult = Readonly<{ status: 'pending' | 'confirmed' | 'unavailable' | 'too-late' | 'not-submitted'; contract?: BisContract }>;
export type BisLtoRequest = Omit<LtoRequest,'id'|'operationId'|'scope'> & Readonly<{ exclusivityKey: string }>;
type Controller = { claim(id:string):Promise<BisContractActionResult>; reject(id:string):Promise<BisContractActionResult>; refund(id:string):Promise<BisContractActionResult>;checkContracts?(filter?:BisContractFilter):Promise<BisContractsResult> };
const controllers = new WeakMap<BisContext,Controller>();
export const contractController = (context: BisContext) => controllers.get(context);
function createNetworkScopedPlayerStorage(selectedNetwork: () => TestNetwork | undefined): Pick<ReturnType<typeof createAccountStorage>, 'load'> {
  const stores = new Map<TestNetwork, ReturnType<typeof createAccountStorage>>();
  const current = () => {
    const network = selectedNetwork() ?? 'signet';
    let store = stores.get(network);
    if (!store) { store = createAccountStorage(network); stores.set(network, store); }
    return store;
  };
  return {load: () => current().load()};
}
const endKey = (record: Pick<ContractRecord,'scope'|'sessionId'>) => `bis-lto-ended-v1:${encodeURIComponent(JSON.stringify([record.scope.gameId,record.scope.playerId,record.scope.exclusivityKey,record.sessionId]))}`;
function ended(record: ContractRecord): ContractRecord {
  const reason = localStorage.getItem(endKey(record));
  if (reason === null) return record;
  if (reason !== 'rejected' && reason !== 'session-ended') throw Error('Contract end request is unavailable.');
  return endContract(record,reason);
}
function persistEnd(record: Pick<ContractRecord,'scope'|'sessionId'>, reason: 'rejected'|'session-ended') {
  const key = endKey(record);
  localStorage.setItem(key,reason);
  if (localStorage.getItem(key) !== reason) throw Error('Contract end request could not be saved.');
}
export async function queryAccountContracts(profileId: string | undefined, filter: BisContractFilter = {}, network: TestNetwork = 'signet'): Promise<BisContractsResult> {
  if (!profileId) return {status:'ready',contracts:[]};
  try {
    const document = await createContractStorage().load();
    return inspectContractDocument(document,profileId,filter,network);
  } catch { return {status:'unavailable',contracts:[]}; }
}
/** Read-only projection used by both account inspection and the host controller. */
export function inspectContractDocument(document:ContractDocument,profileId:string,filter:BisContractFilter={},network:TestNetwork='signet'):BisContractsResult {
  const records=document.ledger.contracts.filter(record=>(filter.includeResolved||!contractResolved(record))&&(record.scope.playerId===profileId||record.scope.gameId===profileId)&&
    (filter.includeOtherNetworks ? isTestNetwork(record.scope.network)&&record.scope.operator===operatorFor(record.scope.network) : record.scope.network===network&&record.scope.operator===operatorFor(network))&&
    (filter.purpose===undefined||record.purpose===filter.purpose)&&(filter.sessionId===undefined||record.sessionId===filter.sessionId)&&
    (filter.hostReference===undefined||record.hostReference===filter.hostReference)&&(filter.exclusivityKey===undefined||record.scope.exclusivityKey===filter.exclusivityKey)&&(filter.gameId===undefined||record.scope.gameId===filter.gameId));
  return {status:'ready',contracts:records.map(record=>{
    const snapshot=presentContract(ended(record),Date.now()),recovery=document.recovery[record.id],role=record.scope.playerId===profileId?'player':'game';
    return {...snapshot,role,canClaim:role==='player'&&snapshot.canClaim,canReject:role==='player'&&snapshot.canReject,canRefund:role==='game'&&snapshot.canRefund,
      evidence:record.operation.submission==='confirmed'?'verified receipt':'local record',operationId:record.operation.id,operationKind:record.operation.kind,
      transactionId:recovery.spend?.transactionId,fundingTransactionId:recovery.fundingOutput?.txid};
  })};
}

/** The host receives no identities or scripts. Signers are loaded privately from this origin. */
export function createBisLto(options: { context: BisContext; gameWallet: ReturnType<typeof createBisGameWallet>; creationEnabled?: boolean }):ReturnType<typeof createLtoService> {
  // Runtime readiness and provider validation govern each attempt. Hosts may
  // explicitly disable new offers while keeping existing-contract recovery.
  return createLtoService(options,{storage:createContractStorage(),playerStorage:createNetworkScopedPlayerStorage(() => options.context.getState().network),gameStorage:createNetworkScopedGameWalletStorage(() => options.gameWallet.getState().network ?? options.context.getState().network),prepare:prepareLtoRecovery,submit:submitLtoSpend,reconcile:reconcileLtoSpend,resume:resumeLtoFinalization,poll:true});
}
/** Internal adapter seam for offline lifecycle tests; not exported by the package. */
export function createLtoService(options: {context:BisContext;gameWallet:ReturnType<typeof createBisGameWallet>;creationEnabled?:boolean}, dependencies: {
  storage:ReturnType<typeof createContractStorage>;playerStorage:Pick<ReturnType<typeof createAccountStorage>,'load'>;gameStorage:Pick<ReturnType<typeof createGameWalletStorage>,'load'|'dispose'>;
  prepare:typeof prepareLtoRecovery;submit:typeof submitLtoSpend;reconcile:typeof reconcileLtoSpend;resume:typeof resumeLtoFinalization;poll:boolean;
}) {
  const { context, gameWallet } = options;
  const {storage,playerStorage,gameStorage}=dependencies;
  const attempts = new Map<string,Promise<BisContractActionResult>>();
  const started = new Map<string,Pick<ContractRecord,'scope'|'sessionId'>>();
  const notifications = new Set<string>();
  let detached = false, reconciling: Promise<void>|undefined, reconcileQueued = false, detachedGameId:string|undefined;
  async function wallets() {
    const [player,game] = await Promise.all([playerStorage.load(),gameStorage.load()]);
    return {player:player.account,game};
  }
  const current = (playerId:string, gameId:string) => context.getState().profileId === playerId && gameWallet.getState().profileId === gameId;
  async function locked<T>(profileId: string, work: () => Promise<T>, network:TestNetwork='signet'): Promise<T> {
    return withWalletMutation(()=>navigator.locks.request(`bis-${network}-contracts-v1`,{ifAvailable:true},lock=>{
      if (!lock) throw Error('Another contract operation is in progress.');
      return work();
    }),profileId);
  }
  async function save(document: ContractDocument, record: ContractRecord, recovery: ContractRecovery) {
    reserveContract(record,recovery);
    const next = await storage.save({...document,ledger:{...document.ledger,contracts:document.ledger.contracts.map(old=>old.id===record.id?record:old)},recovery:{...document.recovery,[record.id]:recovery}});
    publishContractReservations(next); return next;
  }
  function notify(record: ContractRecord) {
    if (detached || ![record.scope.playerId,record.scope.gameId].includes(context.getState().profileId ?? '')) return;
    const phase = record.operation.submission, key = `${record.operation.id}:${phase === 'confirmed' || phase === 'not-submitted' ? phase : 'pending'}`;
    if (notifications.has(key)) return;
    notifications.add(key);
    const label = record.operation.kind === 'fund' ? 'Offer funding' : record.operation.kind === 'claim' ? 'Contract claim' : 'Contract refund';
    const message = phase === 'confirmed' ? record.operation.kind === 'fund' && (record.ended || Date.now() >= record.expiresAt) ? 'Offer funded; return pending' : `${label} confirmed: ${record.amountSats.toLocaleString('en-US')} sats`
      : phase === 'not-submitted' ? `${label} was not submitted${record.operation.failure?`: ${contractFailureMessages[record.operation.failure]}`:''}` : `${label} pending`;
    context.showToast(message,{messageType:phase==='confirmed'?'success':phase==='not-submitted'?'warning':'info',icon:'lightning'});
  }
  async function execute(document: ContractDocument, record: ContractRecord, recovery: ContractRecovery, account: NonNullable<Awaited<ReturnType<typeof wallets>>['game']>) {
    let latest = document;
    const result = await dependencies.submit(record,recovery,account,async(next,material)=>{
      latest = await save(latest,ended(next),material); notify(ended(next));
    },()=>record.operation.kind==='refund' ? gameWallet.getState().profileId===record.scope.gameId
      : current(record.scope.playerId,record.scope.gameId) && !ended(record).ended && Date.now()<record.expiresAt);
    if(!detached)void context.refreshBalance().catch(()=>{});
    void gameWallet.refresh().catch(()=>{});
    return {document:latest,...result};
  }
  function action(id: string, kind: 'claim'|'refund', reject = false): Promise<BisContractActionResult> {
    if(detached)return Promise.resolve({status:'unavailable'});
    return new Promise(resolve=>{
      let accepted = false;
      void (async()=>{
        const {player,game} = await wallets();
        const signer = kind === 'claim' ? player : game;
        if (!signer || !game || (kind==='claim'&&!player)) throw Error();
        await locked(signer.profileId,async()=>{
          let document = await storage.load();
          let record = document.ledger.contracts.find(record=>record.id===id);
          if (!record || record.scope.gameId!==game.profileId || gameWallet.getState().profileId!==record.scope.gameId) throw Error();
          const viewer=context.getState().profileId;
          if(kind==='claim'||reject) {if(viewer!==record.scope.playerId||!player||player.profileId!==record.scope.playerId)throw Error();}
          else if(viewer!==record.scope.gameId)throw Error();
          record = ended(record);
          if (kind==='claim'&&!presentContract(record,Date.now()).canClaim) { resolve({status:Date.now()>=record.expiresAt?'too-late':'unavailable'}); return; }
          if (reject) { persistEnd(record,'rejected'); record=endContract(record,'rejected'); }
          record=beginContractOperation(record,kind,crypto.randomUUID(),Date.now());
          const recovery={...document.recovery[id],spend:undefined,finalization:undefined};
          document=await save(document,record,recovery);
          notify(record); accepted=true; resolve({status:'pending',contract:presentContract(record,Date.now())});
          await execute(document,record,recovery,{...signer,network:record.scope.network});
        },signer.network ?? context.getState().network ?? game.network ?? 'signet');
      })().catch(()=>{ if(!accepted)resolve({status:'unavailable'}); });
    });
  }
  async function reconcile() {
    if (reconciling) { reconcileQueued=true; return reconciling; }
    reconciling = (async()=>{
      do {
        reconcileQueued=false;
        try {
          const {game} = await wallets(); if(!game || (detached && game.profileId!==detachedGameId))return;
          await locked(game.profileId,async()=>{
            let document=await storage.load();
            publishContractReservations(document);
            const network=game.network ?? 'signet';
            for (const original of document.ledger.contracts) {
              if (original.scope.gameId!==game.profileId || original.scope.network!==network || original.scope.operator!==operatorFor(network) || contractResolved(original)) continue;
              let record=ended(original), recovery=document.recovery[record.id];
              // Holding both mutation locks proves no writer can still submit a prepared operation.
              // Every provider call first durably transitions to submitted, so prepared is safe to abandon.
              if(record.operation.submission==='prepared'&&!recovery.spend) {
                record=finishContractOperation(record,{operationId:record.operation.id,kind:record.operation.kind,outcome:'not-submitted'});
              }
              let result=await dependencies.reconcile(record,recovery);
              if(['submitted','unknown'].includes(result.record.operation.submission)&&result.recovery.finalization)result=await dependencies.resume(result.record,result.recovery);
              record=ended(result.record); recovery=result.recovery;
              document=await save(document,record,recovery); notify(record);
              if (record.financial==='funded'&&(record.ended||Date.now()>=record.expiresAt)) {
                record=beginContractOperation(record,'refund',crypto.randomUUID(),Date.now()); recovery={...recovery,spend:undefined,finalization:undefined};
                document=await save(document,record,recovery); notify(record);
                const returned=await execute(document,record,recovery,game); document=returned.document;
              }
            }
          },game.network ?? 'signet');
        } catch { /* Uncertainty retains both the slot and its reservation. The Contracts query stays available. */ }
      } while (reconcileQueued);
    })().finally(()=>{ reconciling=undefined; });
    return reconciling;
  }
  async function prepareExclusiveReplacement(playerId:string, gameId:string, exclusivityKey:string, currentKey:string):Promise<boolean> {
    const document=await storage.load();
    const prior=document.ledger.contracts.filter(record=>!contractResolved(record)&&record.scope.playerId===playerId&&record.scope.gameId===gameId&&record.scope.exclusivityKey===exclusivityKey);
    if(!prior.length)return true;
    for(const record of prior)persistEnd(record,'session-ended');
    await Promise.all([...attempts.entries()].filter(([key])=>key!==currentKey).map(([,attempt])=>attempt.catch(()=>undefined)));
    await Promise.resolve();
    await reconcile();
    const after=await storage.load();
    return !after.ledger.contracts.some(record=>!contractResolved(record)&&record.scope.playerId===playerId&&record.scope.gameId===gameId&&record.scope.exclusivityKey===exclusivityKey);
  }
  async function durableStartResult(sessionId:string, network:TestNetwork, playerId:string, gameId:string, exclusivityKey:string):Promise<BisContractActionResult | undefined> {
    const document=await storage.load();
    const record=document.ledger.contracts.find(record=>record.sessionId===sessionId&&record.scope.network===network&&record.scope.operator===operatorFor(network)&&record.scope.playerId===playerId&&record.scope.gameId===gameId&&record.scope.exclusivityKey===exclusivityKey);
    if(!record)return undefined;
    return {status:record.operation.submission==='confirmed'?'confirmed':record.operation.submission==='not-submitted'?'not-submitted':'pending',contract:presentContract(ended(record),Date.now())};
  }
  const controller = {
    checkContracts: async(filter: BisContractFilter = {}):Promise<BisContractsResult> => {
      const profileId=context.getState().profileId;if(!profileId)return {status:'ready',contracts:[]};
      try {const result=inspectContractDocument(await storage.load(),profileId,filter,context.getState().network??'signet');return context.getState().profileId===profileId?result:{status:'unavailable',contracts:[]};}
      catch{return {status:'unavailable',contracts:[]};}
    },
    start(request: BisLtoRequest): Promise<BisContractActionResult> {
      const playerId=context.getState().profileId, gameId=gameWallet.getState().profileId;
      const key=JSON.stringify([gameId,playerId,request.exclusivityKey,request.sessionId]);
      if(attempts.has(key))return attempts.get(key)!;
      let needsReconcile=false;
      const attempt=(async():Promise<BisContractActionResult>=>{
        if(detached||options.creationEnabled===false||!playerId||!gameId||playerId===gameId)return {status:'unavailable'};
        const marker=`bis-lto-attempt-v1:${encodeURIComponent(key)}`;
        const network=context.getState().network ?? 'signet';
        if(localStorage.getItem(marker)!==null)return await durableStartResult(request.sessionId,network,playerId,gameId,request.exclusivityKey) ?? {status:'unavailable'};
        if(context.getState().phase!=='active'||gameWallet.getState().status!=='ready') {
          // Persist readiness skips so this session cannot late-start if the
          // same session's wallets become ready later.
          localStorage.setItem(marker,'attempted');if(localStorage.getItem(marker)!=='attempted')return {status:'unavailable'};
          return {status:'unavailable'};
        }
        const scope={network,operator:operatorFor(network),playerId,gameId,exclusivityKey:request.exclusivityKey};
        started.set(request.sessionId,{scope,sessionId:request.sessionId});
        needsReconcile=true;
        if(!await prepareExclusiveReplacement(playerId,gameId,request.exclusivityKey,key))return {status:'unavailable'};
        localStorage.setItem(marker,'attempted');if(localStorage.getItem(marker)!=='attempted')return {status:'unavailable'};
        return locked(gameId,async()=>{
          const {player,game}=await wallets();
          const playerNetwork=player?.network ?? network, gameNetwork=game?.network ?? network;
          if(!player||!game||player.profileId!==playerId||game.profileId!==gameId||playerNetwork!==gameNetwork||playerNetwork!==network||!current(playerId,gameId))return {status:'unavailable'};
          const activePlayer={...player,network},activeGame={...game,network};
          let document=await storage.load();
          const allocated=startLto(document.ledger,{...request,scope,id:crypto.randomUUID(),operationId:crypto.randomUUID()},Date.now());
          if(!allocated.contract) { await storage.save({...document,ledger:allocated.ledger}); return {status:'unavailable'}; }
          const recovery=await dependencies.prepare(activeGame,activePlayer);
          let record=ended(allocated.contract);
          reserveContract(record,recovery);
          document=await storage.save({...document,ledger:{...allocated.ledger,contracts:allocated.ledger.contracts.map(old=>old.id===record.id?record:old)},recovery:{...document.recovery,[record.id]:recovery}});
          publishContractReservations(document);notify(record);
          const result=await execute(document,record,recovery,activeGame);
          return {status:result.record.operation.submission==='confirmed'?'confirmed':result.record.operation.submission==='not-submitted'?'not-submitted':'pending',contract:presentContract(ended(result.record),Date.now())};
        },network);
      })().catch(()=>({status:'unavailable' as const}));
      attempts.set(key,attempt);void attempt.finally(()=>{attempts.delete(key);if(needsReconcile)void reconcile();});return attempt;
    },
    claim: (id:string) => action(id,'claim'),
    reject: (id:string) => action(id,'refund',true),
    refund: (id:string) => action(id,'refund'),
    async endSession(sessionId:string) {
      const record=started.get(sessionId);
      if(record)persistEnd(record,'session-ended');
      else {
        const gameId=(await gameStorage.load())?.profileId;
        for(const existing of (await storage.load()).ledger.contracts)if(existing.sessionId===sessionId&&existing.scope.gameId===gameId&&existing.scope.playerId===context.getState().profileId&&!contractResolved(existing))persistEnd(existing,'session-ended');
      }
      await reconcile();
    },
    reconcile,
    async reset() {
      attempts.clear();
      started.clear();
      notifications.clear();
      await storage.reset();
    },
    dispose({endSessions=true}={}) { if(detached)return;detachedGameId=gameWallet.getState().profileId;detached=true;if(endSessions)for(const record of started.values())persistEnd(record,'session-ended');if(controllers.get(context)===controller)controllers.delete(context);void reconcile(); },
  };
  controllers.set(context,controller);
  if(!dependencies.poll)return controller;
  const interval=setInterval(()=>{void reconcile();},5000);
  const visible=()=>{if(document.visibilityState==='visible')void reconcile();};
  document.addEventListener('visibilitychange',visible);
  // The recovery worker outlives host UI disposal while unresolved offers remain.
  const cleanup=setInterval(()=>{
    if(!detached)return;
    void Promise.all([storage.load(),gameStorage.load()]).then(([document,game])=>{
      const outstanding=document.ledger.contracts.some(record=>record.scope.gameId===detachedGameId&&record.scope.network===((game?.network)??'signet')&&record.scope.operator===operatorFor((game?.network)??'signet')&&!contractResolved(record));
      // A replacement signer cannot resolve this worker's contracts. Keep their
      // durable records for a future service using the original game identity.
      if(!outstanding||game?.profileId!==detachedGameId){clearInterval(interval);clearInterval(cleanup);globalThis.document.removeEventListener('visibilitychange',visible);gameStorage.dispose();}
    }).catch(()=>{});
  },5000);
  void reconcile();
  return controller;
}
