import { invalidateContractPresentation, withContextForegroundWork, type BisContext } from './context.ts';
import { createNetworkScopedGameWalletStorage, gameWalletAccountStore, type createBisGameWallet } from './game-wallet.ts';
import type { GameWalletStorage } from './game-wallet-storage.ts';
import type { WalletAccount } from '../wallet-layer-arkade/wallet-identity.ts';
import { createAccountStorage } from './account-storage.ts';
import { createGameWalletStorage } from './game-wallet-storage.ts';
import { withWalletMutation } from './boarding-record.ts';
import { createContractStorage, createNetworkScopedContractStorage, type ContractDocument, type ContractRecovery } from './contract-storage.ts';
import { beginContractOperation, contractResolved, endContract, finishContractOperation, presentContract, startLto, type BisContract, type ContractRecord, type LtoRequest } from './contracts.ts';
import { publishContractReservations, reserveContract } from './contract-reservations.ts';
import { prepareLtoRecovery, reconcileLtoSpend, resumeLtoFinalization, submitLtoSpend } from '../wallet-layer-arkade/lto-contract.ts';
import { operatorFor } from '../wallet-layer-arkade/account.ts';
import { isTestNetwork, type TestNetwork } from './test-network.ts';
import { recordGamePlayerPayment } from './game-player-payment.ts';
import {contractValidationDescription,type ContractValidationPreference} from './contract-validation.ts';
import { appWalletOwner } from '../wallet-layer-arkade/app-wallet-composition.ts';
import {exportContractRecovery,decryptContractRecovery,mergeContractRecovery,type ContractRecoveryScope} from './contract-portable-recovery.ts';
import {inspectLtoRecoveryDescriptor} from '../wallet-layer-arkade/lto-recovery-descriptor.ts';
import {readonlyIdentity} from '../wallet-layer-arkade/wallet-identity.ts';
import {hex} from '@scure/base';
import {treasureServerRecoveryPending} from './treasure-server-recovery.ts';

export type BisContractFilter = Readonly<{ purpose?: string; sessionId?: string; exclusivityKey?: string; gameId?: string; hostReference?: string; includeResolved?: boolean; includeOtherNetworks?: boolean }>;
export type BisContractsResult = Readonly<{ status: 'ready' | 'unavailable'; contracts: readonly BisContract[] }>;
export type BisContractActionResult = Readonly<{ status: 'pending' | 'confirmed' | 'unavailable' | 'too-late' | 'not-submitted' | 'already-taken'; contract?: BisContract }>;
export type BisContractReconcileOptions = Readonly<{ contractId?: string; sessionId?: string; feedback?: 'silent' | 'explicit' | 'active' }>;
export type BisLtoRequest = Omit<LtoRequest,'id'|'operationId'|'scope'> & Readonly<{ exclusivityKey: string; approveUponCreation?: boolean;validationSolution?:ContractValidationPreference }>;
type Controller = { claim(id:string):Promise<BisContractActionResult>; approve(id:string):Promise<BisContractActionResult>; reject(id:string):Promise<BisContractActionResult>; refund(id:string):Promise<BisContractActionResult>;checkContractsAsync?(filter?:BisContractFilter):Promise<BisContractsResult>;reconcile?(options?:BisContractReconcileOptions):Promise<void>;
  exportRecovery?(password:string):Promise<string>;importRecovery?(file:string,password:string):Promise<void> };
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
    const document = await createNetworkScopedContractStorage(() => network).load();
    return inspectContractDocument(document,profileId,filter,network);
  } catch { return {status:'unavailable',contracts:[]}; }
}
/** Read-only projection used by both account inspection and the host controller. */
export function inspectContractDocument(document:ContractDocument,profileId:string,filter:BisContractFilter={},network:TestNetwork='signet'):BisContractsResult {
  const pending=(record:ContractRecord)=>treasureServerRecoveryPending(document.recovery[record.id]);
  const records=document.ledger.contracts.filter(record=>(filter.includeResolved||!contractResolved(record)||pending(record))&&(record.scope.playerId===profileId||record.scope.gameId===profileId)&&
    (filter.includeOtherNetworks ? isTestNetwork(record.scope.network)&&record.scope.operator===operatorFor(record.scope.network) : record.scope.network===network&&record.scope.operator===operatorFor(network))&&
    (filter.purpose===undefined||record.purpose===filter.purpose)&&(filter.sessionId===undefined||record.sessionId===filter.sessionId)&&
    (filter.hostReference===undefined||record.hostReference===filter.hostReference)&&(filter.exclusivityKey===undefined||record.scope.exclusivityKey===filter.exclusivityKey)&&(filter.gameId===undefined||record.scope.gameId===filter.gameId));
  return {status:'ready',contracts:records.map(record=>{
    const observed=ended(record),recovery=document.recovery[record.id],role=record.scope.playerId===profileId?'player':'game';
    // Keep the verified financial outcome visible while a private signing
    // acknowledgement remains unresolved. Only the existing safe recovery
    // flag is projected; tokens and signing journals never enter this DTO.
    const snapshot=presentContract(pending(record)?{...observed,recoveryRequired:true}:observed,Date.now());
    const validationMode=record.validationMode??'browser-policy-v1';
    return {...snapshot,validationMode,validationDescription:contractValidationDescription(validationMode),role,canClaim:role==='player'&&snapshot.canClaim,canReject:role==='player'&&snapshot.canReject,canRefund:role==='game'&&snapshot.canRefund,
      evidence:!record.recoveryRequired&&record.operation.submission==='confirmed'?'verified receipt':'local record',operationId:record.operation.id,operationKind:record.operation.kind,
      transactionId:recovery.spend?.transactionId,fundingTransactionId:recovery.fundingOutput?.txid};
  })};
}

/** The host receives no identities or scripts. Signers are loaded privately from this origin. */
export function createBisLto(options: { context: BisContext; gameWallet: ReturnType<typeof createBisGameWallet>; creationEnabled?: boolean }):ReturnType<typeof createLtoService> {
  // Runtime readiness and provider validation govern each attempt. Hosts may
  // explicitly disable new offers while keeping existing-contract recovery.
  const selected = gameWalletAccountStore(options.gameWallet);
  const gameStorage = selected ? {load:()=>selected.load(),dispose:()=>{}} : createNetworkScopedGameWalletStorage(() => options.gameWallet.getState().network ?? options.context.getState().network);
  const owner = appWalletOwner(options.context.subscribe);
  const submit: typeof submitLtoSpend = async (record, recovery, account, commit, isCurrent) => {
    if (!('server' in account) || !owner || recovery.treasure || record.operation.kind === 'claim') return submitLtoSpend(record, recovery, account, commit, isCurrent);
    const controller = new AbortController();
    const check = () => { if (!isCurrent()) controller.abort(new Error('Contract signing account changed.')); };
    const unsubscribe = options.context.subscribe(check);
    try {
      check();
      return await owner.signContract(account, controller.signal, (identity, prepare) => submitLtoSpend(record, recovery, account, commit, isCurrent, identity, prepare));
    } finally { unsubscribe(); }
  };
  const recoverSigning:NonNullable<Parameters<typeof createLtoService>[1]['recoverSigning']>=async(record,recovery,commit)=>{
    if(!owner||!treasureServerRecoveryPending(recovery))return;
    const game=await gameStorage.load();
    if(!game||!('server' in game)||game.profileId!==record.scope.gameId||game.network!==record.scope.network)return;
    const current=()=>options.gameWallet.getState().profileId===record.scope.gameId&&
      options.gameWallet.getState().network===record.scope.network&&options.context.getState().network===record.scope.network;
    const controller=new AbortController(),check=()=>{if(!current())controller.abort(new Error('Original contract recovery scope changed.'));};
    const unsubscribe=options.context.subscribe(check);
    try{
      check();
      await owner.signContract(game,controller.signal,async(_identity,_prepare,treasure)=>{
        if(!treasure)throw Error('Original hosted Treasure recovery is unavailable.');
        const {recoverOriginalTreasureSigning}=await import('../wallet-layer-arkade/treasure-server-result-recovery.ts');
        await recoverOriginalTreasureSigning(record,recovery,treasure.transport,commit,current);
      });
    }finally{unsubscribe();}
  };
  return createLtoService(options,{storage:createNetworkScopedContractStorage(() => options.context.getState().network),playerStorage:createNetworkScopedPlayerStorage(() => options.context.getState().network),gameStorage,prepare:prepareLtoRecovery,submit,reconcile:reconcileLtoSpend,resume:resumeLtoFinalization,recoverSigning,poll:true});
}
/** Internal adapter seam for offline lifecycle tests; not exported by the package. */
export function createLtoService(options: {context:BisContext;gameWallet:ReturnType<typeof createBisGameWallet>;creationEnabled?:boolean}, dependencies: {
  storage:ReturnType<typeof createContractStorage>;playerStorage:Pick<ReturnType<typeof createAccountStorage>,'load'>;gameStorage:Pick<GameWalletStorage<WalletAccount>,'load'|'dispose'>;
  prepare:typeof prepareLtoRecovery;submit:typeof submitLtoSpend;reconcile:typeof reconcileLtoSpend;resume:typeof resumeLtoFinalization;poll:boolean;
  /** Original completed-result lookup only. No planning, authorization, signing,
   * submission or finalization. Financial history stays with the same operation. */
  recoverSigning?:(record:ContractRecord,recovery:ContractRecovery,commit:(recovery:ContractRecovery)=>Promise<void>)=>Promise<void>;
}) {
  const { context, gameWallet } = options;
  const {storage,playerStorage,gameStorage}=dependencies;
  const attempts = new Map<string,Promise<BisContractActionResult>>();
  const started = new Map<string,Pick<ContractRecord,'scope'|'sessionId'>>();
  const notifications = new Set<string>();
  let generation = 0;
  const writes = new Set<Promise<ContractDocument>>();
  const assertGeneration = (expected: number) => {
    if (generation !== expected) throw Error('Contract work was invalidated by local reset.');
  };
  function write(document: ContractDocument, expected: number) {
    assertGeneration(expected);
    const pending = storage.save(document);
    writes.add(pending);
    void pending.then(() => writes.delete(pending), () => writes.delete(pending));
    return pending;
  }
  const listeners = new Set<() => void>();
  const publish = () => {
    for (const listener of listeners) {
      try { listener(); } catch { /* Observers cannot change financial execution. */ }
    }
  };
  let detached = false, reconciling: Promise<void>|undefined, reconcileQueued = false, detachedGameId:string|undefined, detachedPlayerId:string|undefined;
  let monitorTimer:ReturnType<typeof setInterval>|undefined, monitorActive=false;
  async function wallets() {
    const [player,game] = await Promise.all([playerStorage.load(),gameStorage.load()]);
    return {player:player.account,game};
  }
  const current = (playerId:string, gameId:string) => context.getState().profileId === playerId && gameWallet.getState().profileId === gameId;
  const privatePending = (document:ContractDocument,record:ContractRecord) => treasureServerRecoveryPending(document.recovery[record.id]);
  const recoveryBlocked = (record:ContractRecord,recovery:ContractRecovery) => !!record.recoveryRequired || treasureServerRecoveryPending(recovery);
  const snapshot = (record:ContractRecord,recovery:ContractRecovery) => presentContract(treasureServerRecoveryPending(recovery)?{...ended(record),recoveryRequired:true}:ended(record),Date.now());
  async function locked<T>(profileId: string, work: () => Promise<T>, network:TestNetwork='signet'): Promise<T> {
    return withWalletMutation(()=>navigator.locks.request(`bis-${network}-contracts-v1`,{ifAvailable:true},lock=>{
      if (!lock) throw Error('Another contract operation is in progress.');
      return work();
    }),profileId);
  }
  async function save(document: ContractDocument, record: ContractRecord, recovery: ContractRecovery, expected: number) {
    assertGeneration(expected);
    reserveContract(record,recovery);
    const next = await write({...document,ledger:{...document.ledger,contracts:document.ledger.contracts.map(old=>old.id===record.id?record:old)},recovery:{...document.recovery,[record.id]:recovery}}, expected);
    assertGeneration(expected);
    publishContractReservations(next); return next;
  }
  function notify(record: ContractRecord, feedback: BisContractReconcileOptions['feedback'] = 'silent',recovery?:ContractRecovery) {
    invalidateContractPresentation(context);
    publish();
    if(record.recoveryRequired||recovery&&treasureServerRecoveryPending(recovery))return;
    if (feedback === 'silent' || detached || ![record.scope.playerId,record.scope.gameId].includes(context.getState().profileId ?? '')) return;
    const phase = record.operation.submission, key = `${record.operation.id}:${phase === 'confirmed' || phase === 'not-submitted' ? phase : 'pending'}`;
    if (notifications.has(key)) return;
    notifications.add(key);
    const offerName = record.purpose === 'treasureLTO' ? 'Treasure' : 'Offer';
    const completed = record.operation.kind === 'fund'
      ? `The limited-time offer ${offerName} funding was submitted.`
      : record.operation.kind === 'claim'
        ? `You claimed limited-time offer ${offerName}.`
        : `Game Wallet refunded limited-time offer ${offerName}.`;
    const unavailable = record.operation.kind === 'fund'
      ? `The limited-time offer ${offerName} could not be created.`
      : record.operation.kind === 'claim'
        ? `You could not claim limited-time offer ${offerName}.`
        : `Game Wallet could not refund limited-time offer ${offerName}.`;
    if (feedback === 'active' && !['confirmed','not-submitted'].includes(phase) && record.operation.kind === 'fund') return;
    const message = phase === 'not-submitted' ? unavailable
      : record.operation.kind === 'fund' && (record.ended || Date.now() >= record.expiresAt) ? `Game Wallet refunded limited-time offer ${offerName}. (${phase === 'confirmed' ? 'Pending' : 'Confirmed'})`
      : `${completed} (${phase === 'confirmed' ? 'Confirmed' : 'Pending'})`;
    context.showToast(message,{messageType:phase==='confirmed'?'success':phase==='not-submitted'?'warning':'info',icon:'lightning'});
  }
  async function execute(document: ContractDocument, record: ContractRecord, recovery: ContractRecovery, account: NonNullable<Awaited<ReturnType<typeof wallets>>['game']>, expected: number, feedback: BisContractReconcileOptions['feedback'] = 'silent') {
    assertGeneration(expected);
    let latest = document;
    const result = await dependencies.submit(record,recovery,account,async(next,material)=>{
      latest = await save(latest,ended(next),material,expected); notify(ended(next),feedback,material);
    },()=>generation===expected && (record.operation.kind==='refund' ? gameWallet.getState().profileId===record.scope.gameId
      : current(record.scope.playerId,record.scope.gameId) && !ended(record).ended && Date.now()<record.expiresAt));
    assertGeneration(expected);
    if (record.operation.kind === 'claim' && result.recovery.spend) {
      try { recordGamePlayerPayment(result.recovery.spend.transactionId, record.scope.gameId, record.scope.playerId, record.amountSats); } catch { /* A missing label never alters an already-submitted claim. */ }
    }
    if(!detached)void context.refreshBalance().catch(()=>{});
    void gameWallet.refresh().catch(()=>{});
    return {document:latest,...result};
  }
  function action(id: string, kind: 'claim'|'refund', reject = false): Promise<BisContractActionResult> {
    const expected = generation;
    if(detached)return Promise.resolve({status:'unavailable'});
    return new Promise(resolve=>{
      let accepted = false;
      void (async()=>{
        const {player,game} = await wallets();
        const signer = kind === 'claim' ? player : game;
        if (!signer || !game || (kind==='claim'&&!player)) throw Error();
        await locked(signer.profileId,async()=>{
          let document = await storage.load();
          assertGeneration(expected);
          let record = document.ledger.contracts.find(record=>record.id===id);
          if (!record || record.scope.gameId!==game.profileId || gameWallet.getState().profileId!==record.scope.gameId) throw Error();
          const viewer=context.getState().profileId;
          if(kind==='claim'||reject) {if(viewer!==record.scope.playerId||!player||player.profileId!==record.scope.playerId)throw Error();}
          else if(viewer!==record.scope.gameId)throw Error();
          if(treasureServerRecoveryPending(document.recovery[id])){resolve({status:'unavailable',contract:snapshot(record,document.recovery[id])});return;}
          record = ended(record);
          if(record.recoveryRequired)throw Error('Imported recovery needs network verification.');
          if (contractResolved(record)) {
            resolve({status:'confirmed',contract:presentContract(record,Date.now())}); return;
          }
          if (kind==='claim'&&!presentContract(record,Date.now()).canClaim) { resolve({status:Date.now()>=record.expiresAt?'too-late':'unavailable'}); return; }
          if (reject) { persistEnd(record,'rejected'); record=endContract(record,'rejected'); }
          record=beginContractOperation(record,kind,crypto.randomUUID(),Date.now());
          const recovery={...document.recovery[id],spend:undefined,finalization:undefined,emulatorSubmission:undefined,submission:undefined};
          document=await save(document,record,recovery,expected);
          notify(record,'explicit',recovery); startMonitor(); accepted=true; resolve({status:'pending',contract:presentContract(record,Date.now())});
          await execute(document,record,recovery,{...signer,network:record.scope.network as TestNetwork},expected,'explicit');
        },signer.network ?? context.getState().network ?? game.network ?? 'signet');
      })().catch(()=>{ if(!accepted)resolve({status:'unavailable'}); });
    });
  }
  async function reconcile(options: BisContractReconcileOptions = {}) {
    if (reconciling) { reconcileQueued=true; return reconciling; }
    const expected = generation;
    reconciling = (async()=>{
      do {
        reconcileQueued=false;
        try {
          const {game} = await wallets(); if(!game || (detached && game.profileId!==detachedGameId))return;
          await locked(game.profileId,async()=>{
            let document=await storage.load();
            assertGeneration(expected);
            publishContractReservations(document);
            const network=game.network ?? 'signet';
            for (const original of document.ledger.contracts) {
              if (options.contractId && original.id !== options.contractId) continue;
              if (options.sessionId && original.sessionId !== options.sessionId) continue;
              if (original.scope.gameId!==game.profileId || original.scope.network!==network || original.scope.operator!==operatorFor(network) || contractResolved(original)&&!privatePending(document,original)) continue;
              if(privatePending(document,original)){
                // Financial completion cannot resolve a lost signing response.
                // Keep terminal records reachable without starting another branch.
                let material=document.recovery[original.id];
                if(dependencies.recoverSigning)await dependencies.recoverSigning(original,material,async next=>{
                  document=await save(document,original,next,expected);material=next;
                });
                assertGeneration(expected);
                const observed=await dependencies.reconcile(original,material);
                if(observed.record.operation.id!==original.operation.id||observed.record.operation.kind!==original.operation.kind)throw Error('Original signing operation changed.');
                document=await save(document,observed.record,observed.recovery,expected);
                notify(observed.record,options.feedback,observed.recovery);
                // Even a successful lookup never authorizes an automatic new
                // operation or legacy finalizer in this reconciliation pass.
                continue;
              }
              let record=ended(original), recovery=document.recovery[record.id];
              // Private signing uncertainty was handled above. With both locks
              // held, a financial prepared operation with no spend is safe to abandon.
              if(!record.recoveryRequired&&record.operation.submission==='prepared'&&!recovery.spend) {
                record=finishContractOperation(record,{operationId:record.operation.id,kind:record.operation.kind,outcome:'not-submitted'});
              }
              let result=await dependencies.reconcile(record,recovery);
              if(!treasureServerRecoveryPending(result.recovery)&&['submitted','unknown'].includes(result.record.operation.submission)&&(result.recovery.finalization||result.recovery.emulatorSubmission))result=await dependencies.resume(result.record,result.recovery);
              record=ended(result.record); recovery=result.recovery;
              document=await save(document,record,recovery,expected); notify(record,options.feedback,recovery);
              if (!recoveryBlocked(record,recovery)&&record.financial==='funded'&&(record.ended||Date.now()>=record.expiresAt)) {
                record=beginContractOperation(record,'refund',crypto.randomUUID(),Date.now()); recovery={...recovery,spend:undefined,finalization:undefined,emulatorSubmission:undefined,submission:undefined};
                document=await save(document,record,recovery,expected); notify(record,options.feedback,recovery);
                const returned=await execute(document,record,recovery,game,expected,options.feedback); document=returned.document;
              }
            }
          },game.network ?? 'signet');
        } catch { /* Uncertainty retains both the slot and its reservation. The Contracts query stays available. */ }
      } while (reconcileQueued && generation===expected);
    })().finally(()=>{ reconciling=undefined; void stopMonitorIfIdle(); });
    return reconciling;
  }
  async function stopMonitorIfIdle() {
    if (!monitorActive || !started.size) return;
    try {
      const document=await storage.load();
      const unresolved=document.ledger.contracts.some(record=>(!contractResolved(record)||privatePending(document,record))&&[...started.values()].some(startedRecord=>startedRecord.sessionId===record.sessionId&&startedRecord.scope.gameId===record.scope.gameId));
      if (!unresolved) stopMonitor();
    } catch { /* Keep monitoring when durable state cannot be inspected. */ }
  }
  function stopMonitor() {
    if (!monitorActive) return;
    monitorActive=false;
    if (monitorTimer !== undefined) { clearInterval(monitorTimer); monitorTimer=undefined; }
    globalThis.document?.removeEventListener('visibilitychange', onVisibilityChange);
  }
  function onVisibilityChange() {
    if (globalThis.document?.visibilityState === 'visible') void reconcile({feedback:'active'});
  }
  function startMonitor() {
    if (!dependencies.poll || monitorActive || detached) return;
    monitorActive=true;
    monitorTimer=setInterval(()=>{void reconcile({feedback:'active'});},5000);
    globalThis.document?.addEventListener('visibilitychange',onVisibilityChange);
  }
  async function prepareExclusiveReplacement(playerId:string, gameId:string, exclusivityKey:string, currentKey:string, expected:number):Promise<boolean> {
    const document=await storage.load();
    assertGeneration(expected);
    const prior=document.ledger.contracts.filter(record=>(!contractResolved(record)||privatePending(document,record))&&record.scope.playerId===playerId&&record.scope.gameId===gameId&&record.scope.exclusivityKey===exclusivityKey);
    if(!prior.length)return true;
    if(prior.some(record=>privatePending(document,record)))return false;
    for(const record of prior)persistEnd(record,'session-ended');
    await Promise.all([...attempts.entries()].filter(([key])=>key!==currentKey).map(([,attempt])=>attempt.catch(()=>undefined)));
    await Promise.resolve();
    assertGeneration(expected);
    await reconcile();
    const after=await storage.load();
    return !after.ledger.contracts.some(record=>(!contractResolved(record)||privatePending(after,record))&&record.scope.playerId===playerId&&record.scope.gameId===gameId&&record.scope.exclusivityKey===exclusivityKey);
  }
  async function durableStartResult(sessionId:string, network:TestNetwork, playerId:string, gameId:string, exclusivityKey:string):Promise<BisContractActionResult | undefined> {
    const document=await storage.load();
    const record=document.ledger.contracts.find(record=>record.sessionId===sessionId&&record.scope.network===network&&record.scope.operator===operatorFor(network)&&record.scope.playerId===playerId&&record.scope.gameId===gameId&&record.scope.exclusivityKey===exclusivityKey);
    if(!record)return undefined;
    return {status:recoveryBlocked(record,document.recovery[record.id])?'pending':record.operation.submission==='confirmed'?'confirmed':record.operation.submission==='not-submitted'?'not-submitted':'pending',contract:snapshot(record,document.recovery[record.id])};
  }
  const controller = {
    async exportRecovery(password:string):Promise<string> {
      const expected=generation;
      const {player,game}=await wallets();
      if(detached||!player||!game||'server' in player||'server' in game||!current(player.profileId,game.profileId))throw Error('Select the original local Player and Game Wallets.');
      const network=context.getState().network??'signet';
      const scope:ContractRecoveryScope={network,playerId:player.profileId,gameId:game.profileId};
      const snapshot=await storage.load();assertGeneration(expected);
      const file=await exportContractRecovery({...snapshot,ledger:{...snapshot.ledger,contracts:snapshot.ledger.contracts.map(ended)}},scope,password);assertGeneration(expected);
      if(!current(player.profileId,game.profileId)||context.getState().network!==network)throw Error('Wallet selection changed. Recovery was not exported.');
      return file;
    },
    async importRecovery(file:string,password:string):Promise<void> {
      const expected=generation,{player,game}=await wallets();
      if(detached||!player||!game||'server' in player||'server' in game||!current(player.profileId,game.profileId))throw Error('Select the original local Player and Game Wallets.');
      const network=context.getState().network??'signet';
      const scope:ContractRecoveryScope={network,playerId:player.profileId,gameId:game.profileId};
      const imported=await decryptContractRecovery(file,scope,password);
      const [playerKey,gameKey]=await Promise.all([player,game].map(async account=>hex.encode(await (await readonlyIdentity(account)).xOnlyPublicKey())));
      for(const record of imported.ledger.contracts){
        const r=imported.recovery[record.id];
        if(r.playerKey!==playerKey||r.gameKey!==gameKey)throw Error('Recovery does not match the selected wallet keys.');
        await inspectLtoRecoveryDescriptor(record,r);
      }
      await locked(game.profileId,async()=>{
        assertGeneration(expected);
        if(!current(player.profileId,game.profileId)||context.getState().network!==network)throw Error('Wallet selection changed. Recovery was not imported.');
        const next=mergeContractRecovery(await storage.load(),imported,scope);
        for(const record of next.ledger.contracts)if(record.recoveryRequired)reserveContract(record,next.recovery[record.id]);
        const saved=await write(next,expected);publishContractReservations(saved);invalidateContractPresentation(context);publish();
      },network);
      // No signing, finalization, monitor start or automatic network reconciliation.
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    checkContractsAsync: async(filter: BisContractFilter = {}):Promise<BisContractsResult> => {
      const profileId=context.getState().profileId;if(!profileId)return {status:'ready',contracts:[]};
      try {const result=inspectContractDocument(await storage.load(),profileId,filter,context.getState().network??'signet');return context.getState().profileId===profileId?result:{status:'unavailable',contracts:[]};}
      catch{return {status:'unavailable',contracts:[]};}
    },
    start(request: BisLtoRequest): Promise<BisContractActionResult> {
      const expected = generation;
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
        // A caller-supplied escrow ID is a durable namespace, not an
        // idempotency key. Once it exists, a later create must fail even if
        // the browser still has the prior attempt marker.
        const existingDocument=await storage.load();
        if(existingDocument.ledger.contracts.some(contract=>contract.id===request.sessionId))return {status:'already-taken'};
        const scope={network,operator:operatorFor(network),playerId,gameId,exclusivityKey:request.exclusivityKey};
        if(existingDocument.ledger.contracts.some(record=>record.scope.network===network&&record.scope.operator===scope.operator&&record.scope.playerId===playerId&&record.scope.gameId===gameId&&record.scope.exclusivityKey===request.exclusivityKey&&privatePending(existingDocument,record)))return {status:'unavailable'};
        started.set(request.sessionId,{scope,sessionId:request.sessionId});
        needsReconcile=true;
        if(!await prepareExclusiveReplacement(playerId,gameId,request.exclusivityKey,key,expected))return {status:'unavailable'};
        assertGeneration(expected);
        localStorage.setItem(marker,'attempted');if(localStorage.getItem(marker)!=='attempted')return {status:'unavailable'};
        return locked(gameId,async()=>{
          const {player,game}=await wallets();
          assertGeneration(expected);
          const playerNetwork=player?.network ?? network, gameNetwork=game?.network ?? network;
          if(!player||!game||player.profileId!==playerId||game.profileId!==gameId||playerNetwork!==gameNetwork||playerNetwork!==network||!current(playerId,gameId))return {status:'unavailable'};
          const activePlayer={...player,network},activeGame={...game,network};
          let document=await storage.load();
          assertGeneration(expected);
          if (document.ledger.contracts.some(contract => contract.id === request.sessionId)) return {status:'already-taken'};
          if(document.ledger.contracts.some(record=>record.scope.network===network&&record.scope.operator===scope.operator&&record.scope.playerId===playerId&&record.scope.gameId===gameId&&record.scope.exclusivityKey===request.exclusivityKey&&privatePending(document,record)))return {status:'unavailable'};
          const allocated=startLto(document.ledger,{...request,...(request.purpose==='treasureLTO'?{expiresAt:(Math.floor(request.startedAt/1000)+90)*1000}:{}),scope,id:request.sessionId,operationId:crypto.randomUUID(),approved:request.approveUponCreation ?? true},Date.now());
          if(!allocated.contract) { await write({...document,ledger:allocated.ledger},expected); return {status:'unavailable'}; }
          const recovery=await dependencies.prepare(activeGame,activePlayer,undefined,{record:allocated.contract,preference:request.validationSolution});
          assertGeneration(expected);
          let record=ended({...allocated.contract,validationMode:recovery.treasure?'arkade-covenant-v2':'browser-policy-v1'});
          reserveContract(record,recovery);
          document=await write({...document,ledger:{...allocated.ledger,contracts:allocated.ledger.contracts.map(old=>old.id===record.id?record:old)},recovery:{...document.recovery,[record.id]:recovery}},expected);
          assertGeneration(expected);
          publishContractReservations(document);notify(record,'active',recovery);
          startMonitor();
          const result=await execute(document,record,recovery,activeGame,expected,'active');
          return {status:recoveryBlocked(result.record,result.recovery)?'pending':result.record.operation.submission==='confirmed'?'confirmed':result.record.operation.submission==='not-submitted'?'not-submitted':'pending',contract:snapshot(result.record,result.recovery)};
        },network);
      })().catch(()=>({status:'unavailable' as const}));
      attempts.set(key,attempt);void attempt.finally(()=>{if(attempts.get(key)===attempt)attempts.delete(key);if(needsReconcile&&generation===expected)void reconcile({feedback:'silent',sessionId:request.sessionId});});return attempt;
    },
    claim: (id:string) => action(id,'claim'),
    async approve(id:string): Promise<BisContractActionResult> {
      const expected=generation;
      if(detached)return {status:'unavailable'};
      try {
        const {game}=await wallets();
        if(!game)return {status:'unavailable'};
        return await locked(game.profileId,async()=>{
          let document=await storage.load(); assertGeneration(expected);
          let record=document.ledger.contracts.find(candidate=>candidate.id===id);
          if(!record || record.recoveryRequired || record.scope.gameId!==game.profileId)return {status:'unavailable'};
          if(privatePending(document,record))return {status:'unavailable',contract:snapshot(record,document.recovery[id])};
          record=ended(record);
          if(contractResolved(record))return {status:'confirmed',contract:presentContract(record,Date.now())};
          const current=presentContract(record,Date.now());
          if(current.eligibility==='expired')return {status:'too-late',contract:current};
          if(record.approved)return {status:'confirmed',contract:current};
          const next={...record,approved:true};
          document=await save(document,next,document.recovery[id],expected);
          notify(next,'explicit',document.recovery[id]);
          return {status:'confirmed',contract:presentContract(next,Date.now())};
        },game.network ?? context.getState().network ?? 'signet');
      } catch { return {status:'unavailable'}; }
    },
    reject: (id:string) => action(id,'refund',true),
    refund: (id:string) => action(id,'refund'),
    async endSession(sessionId:string) {
      const expected = generation;
      const record=started.get(sessionId);
      if(record)persistEnd(record,'session-ended');
      else {
        const gameId=(await gameStorage.load())?.profileId;
        const document=await storage.load();assertGeneration(expected);
        for(const existing of document.ledger.contracts)if(existing.sessionId===sessionId&&existing.scope.gameId===gameId&&existing.scope.playerId===context.getState().profileId&&!contractResolved(existing))persistEnd(existing,'session-ended');
      }
      assertGeneration(expected);
      await reconcile();
    },
    reconcile(options?:BisContractReconcileOptions) { return reconcile(options); },
    async reset() {
      generation++;
      reconcileQueued=false;
      attempts.clear();
      started.clear();
      notifications.clear();
      // Finish already-started local writes before clearing. Remote submissions
      // are not cancelled; their late callbacks cannot recreate this generation.
      await Promise.allSettled([...writes]);
      await storage.reset();
      publish();
    },
    dispose({endSessions=true}={}) {
      if(detached)return;
      detachedGameId=gameWallet.getState().profileId;detachedPlayerId=context.getState().profileId;detached=true;
      stopMonitor();
      listeners.clear();
      if(endSessions)for(const record of started.values())persistEnd(record,'session-ended');
      if(controllers.get(context)===controller)controllers.delete(context);
    },
  };
  // Passive query is intentionally excluded. Explicit provider operations from
  // Admin or BisService have the same foreground priority as Account actions.
  for(const kind of ['start','claim','approve','reject','refund','reconcile'] as const) {
    const original=controller[kind];
    Object.defineProperty(controller,kind,{value:(...args:unknown[])=>withContextForegroundWork(context,()=>Reflect.apply(original,controller,args),kind!=='reconcile')});
  }
  controllers.set(context,controller);
  return controller;
}
