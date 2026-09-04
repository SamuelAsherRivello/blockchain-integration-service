import type { AccountSecret } from '../arkade/account.ts';
import { assertNoPendingSend } from './sending.ts';
import { assertNoPendingBoarding, withWalletMutation } from './boarding-record.ts';
import { clearBrowserPreferences, pendingLogoutOperations, withBrowserMutation, type LogoutOperations } from './logout-cleanup.ts';
export type StoredAccount = { generation: number; account: AccountSecret | null };
export interface AccountStorage {
  load(): Promise<StoredAccount>;
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
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
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
  return {
    async load() {
      const record = await transaction<{generation:number; envelope?:Envelope}>('readonly',(store,set,tx) => {
        const g=store.get('generation'); const a=store.get('identity');
        a.onsuccess=()=> {try {set({generation:generation(g.result),envelope:a.result});} catch {tx.abort();}};
      });
      if (!record.envelope) return {generation:record.generation,account:null};
      const e=record.envelope;
      if(e.version!==1 || e.network!=='signet' || !(e.key instanceof CryptoKey) || e.key.extractable) throw new Error('Saved account cannot be read.');
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:e.iv,additionalData:aad},e.key,e.encrypted);
      const account=JSON.parse(new TextDecoder().decode(plain));
      if(typeof account.phrase!=='string'||typeof account.profileId!=='string') throw new Error('Invalid saved account.');
      return {generation:record.generation,account};
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
        const g=store.get('generation'); const existing=store.get('identity');
        existing.onsuccess=()=> {
          try {
            if(signal.aborted || revision !== currentRevision || generation(g.result)!==expected || existing.result) {tx.abort();return;}
            store.put({version:1,network:'signet',key,iv,encrypted} satisfies Envelope,'identity'); set(undefined);
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
          const operations = pendingLogoutOperations();
          if (operations.fingerprint !== options.operations.fingerprint || operations.count !== options.operations.count) throw Error('Pending operations changed. Review logout again.');
          // No SDK IndexedDB repositories are used by this app: all SDK wallets
          // explicitly use in-memory repositories. Never clear an unrelated SDK DB.
          clearBrowserPreferences(globalThis.localStorage);
          clearBrowserPreferences(globalThis.sessionStorage);
          await transaction<void>('readwrite', (store, set, tx) => {
            const request = store.get('generation');
            request.onsuccess = () => {
              if (generation(request.result) !== loaded.generation) { tx.abort(); return; }
              store.clear(); set(undefined);
            };
          });
          revision++;
          channel?.postMessage('logout'); notify();
          // Reset every mounted host and closure after successful destructive logout.
          // This also discards demo state and in-memory SDK repositories.
          if (typeof window !== 'undefined') window.location.reload();
        }, true);
        return;
      }
      const loaded = await this.load();
      const profileId = loaded.account?.profileId;
      await withWalletMutation(async () => {
      assertNoPendingSend(profileId);
      // Administrative reset retains its existing unresolved-transfer guard.
      assertNoPendingBoarding(profileId);
      await transaction<void>('readwrite',(store,set,tx)=> {
        const request=store.get('generation');
        const identity=store.get('identity');
        identity.onsuccess=()=> {
          try {
            const current = generation(request.result);
            if (current !== loaded.generation || !!identity.result !== !!loaded.account || (expectedGeneration !== undefined && expectedGeneration !== current)) { tx.abort(); return; }
            store.put(current+1,'generation'); store.delete('identity');set(undefined);
          }catch {tx.abort();}
        };
      });
      channel?.postMessage('changed'); notify();
      },profileId);
    },
    subscribe(listener) {
      listeners.add(listener);
      if(!channel && typeof BroadcastChannel!=='undefined') {channel=new BroadcastChannel(DB);channel.onmessage=event=>{
        revision++;
        if(event.data==='logout') {
          try {clearBrowserPreferences(globalThis.sessionStorage);}
          finally {
            notify();
            if (typeof window !== 'undefined') window.location.reload();
          }
        } else notify();
      };}
      return ()=> {listeners.delete(listener);if(!listeners.size){channel?.close();channel=undefined;}};
    },
  };
}
