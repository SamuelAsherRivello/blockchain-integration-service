/** Private Sandbox recovery. No mnemonic, preimage or signed transaction is
 * written to localStorage, page output or a public descriptor. */
export interface TreasureStorage<T> {
  load(): Promise<{ revision: number; records: T[] }>;
  save(records: T[], expectedRevision: number): Promise<number>;
}
export type TreasureStorageEnvelope = { revision: number; key: CryptoKey; iv: Uint8Array<ArrayBuffer>; encrypted: ArrayBuffer };
export interface TreasureStorageBackend {
  read(): Promise<TreasureStorageEnvelope | undefined>;
  write(envelope: TreasureStorageEnvelope, expectedRevision: number): Promise<void>;
}

export function treasureSdkStorage<T>(scope: string, backend?: TreasureStorageBackend): TreasureStorage<T> {
  if (!/^[a-f0-9]{64}$/.test(scope)) throw Error('Treasure wallet scope is invalid.');
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('bis-sandbox-treasure-recovery-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('recovery');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('Treasure recovery storage is unavailable.'));
    request.onblocked = () => reject(Error('Close the other Treasure recovery connection.'));
  });
  const read = async () => {
    if (backend) return backend.read();
    const db = await open();
    try {
      return await new Promise<any>((resolve, reject) => {
        const tx = db.transaction('recovery', 'readonly');
        const request = tx.objectStore('recovery').get(scope);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(Error('Treasure recovery could not be read.'));
      });
    } finally { db.close(); }
  };
  return {
    async load() {
      try {
        const row = await read();
        if (row === undefined) return { revision: 0, records: [] };
        if (!Number.isSafeInteger(row.revision) || row.revision < 1 || !(row.key instanceof CryptoKey) || row.key.extractable) throw Error();
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: row.iv,
          additionalData: new TextEncoder().encode(`${scope}:${row.revision}`) }, row.key, row.encrypted);
        const records = JSON.parse(new TextDecoder().decode(plain));
        if (!Array.isArray(records) || records.length > 1000) throw Error();
        return { revision: row.revision, records };
      } catch { throw Error('Treasure recovery could not be verified. Existing operations remain reserved.'); }
    },
    async save(records, expectedRevision) {
      if (!Array.isArray(records) || records.length > 1000 || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw Error('Treasure recovery is invalid.');
      const revision = expectedRevision + 1;
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
        additionalData: new TextEncoder().encode(`${scope}:${revision}`) }, key, new TextEncoder().encode(JSON.stringify(records)));
      if (backend) { await backend.write({ revision, key, iv, encrypted }, expectedRevision); return revision; }
      const db = await open();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('recovery', 'readwrite'), store = tx.objectStore('recovery');
          const request = store.get(scope);
          request.onsuccess = () => {
            if ((request.result?.revision ?? 0) !== expectedRevision) { tx.abort(); return; }
            store.put({ revision, key, iv, encrypted }, scope);
          };
          tx.oncomplete = () => resolve();
          tx.onabort = tx.onerror = () => reject(Error('Treasure recovery changed. Check the original operation.'));
        });
        return revision;
      } finally { db.close(); }
    },
  };
}
