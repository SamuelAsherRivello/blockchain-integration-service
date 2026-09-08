import type { AccountSecret } from '../arkade/account.ts';

const database = 'bis-game-wallet-signet-v1';
const aad = new TextEncoder().encode(database);
type Envelope = { key: CryptoKey; iv: Uint8Array<ArrayBuffer>; encrypted: ArrayBuffer };
export interface GameWalletStorage {
  load(): Promise<AccountSecret | null>;
  select(account: AccountSecret): Promise<void>;
  logout(): Promise<void>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}
export function createGameWalletStorage(): GameWalletStorage {
  const listeners = new Set<() => void>();
  const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(database);
  channel?.addEventListener('message', () => listeners.forEach(listener => listener()));
  async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, set: (value: T) => void) => void): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('wallets');
      request.onsuccess = () => resolve(request.result);
      request.onerror = request.onblocked = () => reject(Error('Game wallet storage unavailable.'));
    });
    return new Promise((resolve, reject) => {
      let result: T;
      const tx = db.transaction('wallets', mode);
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(Error('Game wallet storage unavailable.')); };
      try { run(tx.objectStore('wallets'), value => { result = value; }); } catch { tx.abort(); }
    });
  }
  return {
    async load() {
      const saved = await transaction<{id: string; envelope: Envelope} | null>('readonly', (store, set) => {
        const selection = store.get('selected');
        selection.onsuccess = () => {
          if (!selection.result) { set(null); return; }
          const identity = store.get(`identity:${selection.result}`);
          identity.onsuccess = () => set({id: selection.result, envelope: identity.result});
        };
      });
      if (!saved) return null;
      const e = saved.envelope;
      if (!e || !(e.key instanceof CryptoKey) || e.key.extractable) throw Error('Game wallet storage unavailable.');
      const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:e.iv, additionalData:aad}, e.key, e.encrypted);
      const account = JSON.parse(new TextDecoder().decode(plain));
      if (account.profileId !== saved.id || typeof account.phrase !== 'string') throw Error('Game wallet storage unavailable.');
      return account as AccountSecret;
    },
    async select(account) {
      const key = await crypto.subtle.generateKey({name:'AES-GCM', length:256}, false, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:aad}, key, new TextEncoder().encode(JSON.stringify(account)));
      await transaction<void>('readwrite', (store, set) => {
        store.put({key, iv, encrypted} satisfies Envelope, `identity:${account.profileId}`);
        store.put(account.profileId, 'selected'); set(undefined);
      });
      channel?.postMessage('selected');
    },
    async logout() {
      await transaction<void>('readwrite', (store, set) => { store.put(null, 'selected'); set(undefined); });
      channel?.postMessage('selected');
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() { listeners.clear(); channel?.close(); },
  };
}

