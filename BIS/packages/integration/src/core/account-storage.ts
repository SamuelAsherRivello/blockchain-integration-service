import type { AccountSecret } from '../arkade/account.ts';
import { assertNoPendingSend } from './sending.ts';
import {readAccountOnboarding} from './onboarding-record.ts';
import { assertNoPendingBoarding, BoardingBlockedError } from './boarding-record.ts';
import { readContractReservations } from './contract-reservations.ts';
import { browserMutationLock, clearBrowserPreferences, clearBrowserProfilePreferences, pendingLogoutOperations, withBrowserMutation, type LogoutOperations } from './logout-cleanup.ts';
export type LogoutReceipt = Readonly<{ id: string; profileId: string; generation: number }>;
export type StoredAccount = { generation: number; account: AccountSecret | null; logout?: LogoutReceipt };
export interface AccountStorage {
  load(): Promise<StoredAccount>;
  listProfiles(): Promise<Readonly<{profiles:readonly string[];activeProfileId?:string;generation:number}>>;
  selectProfile(profileId:string, expectedGeneration?:number, signal?:AbortSignal):Promise<void>;
  save(account: AccountSecret, generation: number, signal: AbortSignal): Promise<void>;
  reset(expectedGeneration?: number, options?: { purpose: 'logout'; profileId: string; operations: LogoutOperations }): Promise<void>;
  subscribe(listener: () => void): () => void;
}
const DB = 'bis-account-signet-v1';
const STORE = 'account';
type Envelope = { version: 1; network: 'signet'; key: CryptoKey; iv: Uint8Array<ArrayBuffer>; encrypted: ArrayBuffer };
const aad = new TextEncoder().encode('bis:signet:account:v1');
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB || !globalThis.crypto?.subtle) { reject(new Error('Private storage unavailable.')); return; }
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = () => {if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Private storage unavailable.'));
    request.onblocked = () => reject(new Error('Private storage blocked.'));
  });
}
async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, set: (value:T)=>void, tx: IDBTransaction)=>void): Promise<T> {
  const db = await open();
  return new Promise((resolve,reject) => {
    let result: T;
    const tx = db.transaction(STORE,mode);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('Private storage operation failed.')); };
    try { run(tx.objectStore(STORE), value => {result=value;},tx); } catch {tx.abort();}
  });
}
function generation(value: unknown) {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('Invalid account generation.');
  return value as number;
}
export function createAccountStorage(): AccountStorage {
  const listeners = new Set<() => void>();
  let revision = 0;
  let channel: BroadcastChannel | undefined;
  const notify = () => { for (const listener of listeners) listener(); };
  let pendingSessionLogout: LogoutReceipt | undefined;
  type RawCollection={generation:number;legacy?:Envelope;profiles:string[];activeProfileId?:string;envelope?:Envelope;logout?:LogoutReceipt};
  const readRaw=()=>transaction<RawCollection>('readonly',(store,set,tx)=>{
    const g=store.get('generation'),legacy=store.get('identity'),profiles=store.get('profiles'),logout=store.get('logout'),active=store.get('activeProfile');
    active.onsuccess=()=>{try{
      const list=profiles.result===undefined?[]:profiles.result;
      if(!Array.isArray(list)||list.some(id=>typeof id!=='string'||!id)||new Set(list).size!==list.length)throw Error();
      const activeProfileId=active.result;
      if(activeProfileId!==undefined&&(typeof activeProfileId!=='string'||!list.includes(activeProfileId)))throw Error();
      if(!activeProfileId){set({generation:generation(g.result),legacy:legacy.result,profiles:list,logout:logout.result});return;}
      const envelope=store.get(`profile:${activeProfileId}`);
      envelope.onsuccess=()=>set({generation:generation(g.result),legacy:legacy.result,profiles:list,activeProfileId,envelope:envelope.result,logout:logout.result});
    }catch{tx.abort();}};
  });
  const decrypt=async(e:Envelope):Promise<AccountSecret>=>{
      if(e.version!==1 || e.network!=='signet' || !(e.key instanceof CryptoKey) || e.key.extractable) throw new Error('Saved account cannot be read.');
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:e.iv,additionalData:aad},e.key,e.encrypted);
      const account=JSON.parse(new TextDecoder().decode(plain));
      if(typeof account.phrase!=='string'||typeof account.profileId!=='string') throw new Error('Invalid saved account.');
      return account;
  };
  const migrateLegacy=async(raw:RawCollection)=>{
    if(!raw.legacy)return raw;
    const account=await decrypt(raw.legacy);
    await transaction<void>('readwrite',(store,set,tx)=>{
      const legacy=store.get('identity'),profiles=store.get('profiles'),existing=store.get(`profile:${account.profileId}`);
      existing.onsuccess=()=>{try{
        if(!legacy.result) {set(undefined);return;}
        const list=profiles.result===undefined?[]:profiles.result;
        if(!Array.isArray(list)||list.some(id=>typeof id!=='string'||!id))throw Error();
        if(!existing.result)store.put(legacy.result,`profile:${account.profileId}`);
        if(!list.includes(account.profileId))store.put([...list,account.profileId],'profiles');
        store.put(account.profileId,'activeProfile');store.delete('identity');set(undefined);
      }catch{tx.abort();}};
    });
    return readRaw();
  };
  const collection=async()=>migrateLegacy(await readRaw());
  const read = async (): Promise<StoredAccount> => {
      const record=await collection();
      if (!record.activeProfileId) return {generation:record.generation,account:null,logout:record.logout};
      if(!record.envelope)throw Error('Saved account cannot be read.');
      const account=await decrypt(record.envelope);
      if(account.profileId!==record.activeProfileId)throw Error('Invalid saved account.');
      return {generation:record.generation,account,logout:record.logout};
  };
  return {
    async listProfiles(){const raw=await collection();return Object.freeze({profiles:Object.freeze([...raw.profiles]),...(raw.activeProfileId?{activeProfileId:raw.activeProfileId}:{}),generation:raw.generation});},
    async selectProfile(profileId,expectedGeneration,signal){
      if(!profileId)throw Error('Select a saved profile.');signal?.throwIfAborted();
      await withBrowserMutation(()=>transaction<void>('readwrite',(store,set,tx)=>{
        const g=store.get('generation'),profiles=store.get('profiles'),envelope=store.get(`profile:${profileId}`);
        envelope.onsuccess=()=>{try{
          const current=generation(g.result),list=profiles.result;
          if(signal?.aborted||(expectedGeneration!==undefined&&current!==expectedGeneration)||!Array.isArray(list)||!list.includes(profileId)||!envelope.result){tx.abort();return;}
          store.put(profileId,'activeProfile');store.put(current+1,'generation');store.delete('logout');set(undefined);
        }catch{tx.abort();}};
      }));revision++;channel?.postMessage('changed');notify();
    },
    async load() {
      if (!pendingSessionLogout) return read();
      if (!globalThis.navigator?.locks) throw Error('This browser cannot safely coordinate wallet operations.');
      // Reconciliation waits for the initiating logout lock to release.
      return navigator.locks.request(browserMutationLock, {mode:'exclusive'}, async () => {
        const receipt = pendingSessionLogout;
        const loaded = await read();
        if (receipt && !loaded.account && loaded.logout?.id === receipt.id && loaded.generation === receipt.generation) {
          // Verify this tab's cleanup before allowing its context to request restart.
          // The lock also prevents a replacement save between verification and cleanup.
          clearBrowserPreferences(globalThis.sessionStorage);
        }
        if (pendingSessionLogout === receipt) pendingSessionLogout = undefined;
        return loaded;
      });
    },
    async save(account, expected, signal) {
      const currentRevision = revision;
      signal.throwIfAborted();
      const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,new TextEncoder().encode(JSON.stringify(account)));
      signal.throwIfAborted();
      await withBrowserMutation(() => transaction<void>('readwrite',(store,set,tx)=> {
        const abort=()=> {try {tx.abort();}catch {}};
        signal.addEventListener('abort',abort,{once:true});
        tx.addEventListener('complete',()=>signal.removeEventListener('abort',abort));
        tx.addEventListener('abort',()=>signal.removeEventListener('abort',abort));
        const g=store.get('generation'); const profiles=store.get('profiles');const existing=store.get(`profile:${account.profileId}`);
        existing.onsuccess=()=> {
          try {
            const list=profiles.result===undefined?[]:profiles.result;
            if(signal.aborted || revision !== currentRevision || generation(g.result)!==expected || !Array.isArray(list)) {tx.abort();return;}
            store.delete('logout');
            if(!existing.result)store.put({version:1,network:'signet',key,iv,encrypted} satisfies Envelope,`profile:${account.profileId}`);
            if(!list.includes(account.profileId))store.put([...list,account.profileId],'profiles');
            store.put(account.profileId,'activeProfile');set(undefined);
          }catch {tx.abort();}
        };
      }));
      channel?.postMessage('changed');
    },
    async reset(expectedGeneration, options) {
      if (options?.purpose === 'logout') {
        await withBrowserMutation(async () => {
          const loaded = await this.load();
          if (loaded.account?.profileId !== options.profileId || (expectedGeneration !== undefined && loaded.generation !== expectedGeneration)) throw Error('The account changed.');
          const currentOperations = pendingLogoutOperations(globalThis.localStorage,options.profileId);
          if (currentOperations.count !== options.operations.count || currentOperations.fingerprint !== options.operations.fingerprint) throw new BoardingBlockedError('Pending operations changed. Confirm logout again.');
          if (currentOperations.count > 0) throw new BoardingBlockedError('Wallet operations are unresolved. Open Account and check recovery status before logging out.');
          // No SDK IndexedDB repositories are used by this app: all SDK wallets
          // explicitly use in-memory repositories. Never clear an unrelated SDK DB.
          clearBrowserProfilePreferences(options.profileId,globalThis.localStorage);
          clearBrowserProfilePreferences(options.profileId,globalThis.sessionStorage);
          const receipt: LogoutReceipt = {id:crypto.randomUUID(),profileId:options.profileId,generation:loaded.generation+1};
          await transaction<void>('readwrite', (store, set, tx) => {
            const request = store.get('generation');
            request.onsuccess = () => {
              if (generation(request.result) !== loaded.generation) { tx.abort(); return; }
              const profiles=store.get('profiles');
              profiles.onsuccess=()=>{
                const list=profiles.result;
                if(!Array.isArray(list)||!list.includes(options.profileId)){tx.abort();return;}
                store.delete(`profile:${options.profileId}`);store.put(list.filter(id=>id!==options.profileId),'profiles');store.delete('activeProfile');store.delete('identity');store.put(receipt.generation,'generation');store.put(receipt,'logout');set(undefined);
              };
            };
          });
          revision++;
          channel?.postMessage({type:'logout',...receipt}); notify();
        }, true);
        return;
      }
      const loaded = await this.load();
      const profileId = loaded.account?.profileId;
      // A game wallet can fund a player contract: serialize reset against all
      // wallets on this origin before checking either participant's recovery.
      await withBrowserMutation(async () => {
      if(readContractReservations().some(record=>record.pending&&(record.playerId===profileId||record.gameId===profileId)))
        throw new BoardingBlockedError('A contract is unresolved. Open Account → Contracts and check recovery before resetting this account.');
      assertNoPendingSend(profileId);
      // Administrative reset retains its existing unresolved-transfer guard.
      assertNoPendingBoarding(profileId);
      if(profileId&&readAccountOnboarding(profileId).some(r=>r.status==='pending'))throw new BoardingBlockedError('Onboarding is unresolved. Open Account → Balance → Onboarding before resetting this account.');
      await transaction<void>('readwrite',(store,set,tx)=> {
        const request=store.get('generation');
        const active=store.get('activeProfile');
        active.onsuccess=()=> {
          try {
            const current = generation(request.result);
            if (current !== loaded.generation || !!active.result !== !!loaded.account || (expectedGeneration !== undefined && expectedGeneration !== current)) { tx.abort(); return; }
            store.clear();store.put(current+1,'generation');set(undefined);
          }catch {tx.abort();}
        };
      });
      channel?.postMessage('changed'); notify();
      },true);
    },
    subscribe(listener) {
      listeners.add(listener);
      if(!channel && typeof BroadcastChannel!=='undefined') {channel=new BroadcastChannel(DB);channel.onmessage=event=>{
        revision++;
        if(event.data?.type==='logout') pendingSessionLogout=event.data as LogoutReceipt;
        notify();
      };}
      return ()=> {listeners.delete(listener);if(!listeners.size){channel?.close();channel=undefined;}};
    },
  };
}
