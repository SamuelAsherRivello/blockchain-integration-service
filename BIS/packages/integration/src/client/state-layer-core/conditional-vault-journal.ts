import type {
  VaultPublicDescriptor,
  VaultOutpoint,
  VaultOperation,
} from "./conditional-vault.ts";
import type { TestNetwork } from "./test-network.ts";

/** Private adapter storage. Never export through a game-facing result or log. */
export type VaultJournalEntry = {
  operationId: string;
  operation: VaultOperation;
  scope: string;
  network: TestNetwork;
  createdAt: number;
  phase: "prepared" | "submitting" | "pending" | "verified" | "rejected";
  descriptor?: VaultPublicDescriptor;
  expectedInput?: VaultOutpoint;
  expectedScript?: string;
  transactionId?: string;
  recovery: Array<{
    target: "operator" | "finalize" | "emulator";
    request: string[] | [string, string[]];
  }>;
  draft?: Record<string, string | number>;
};
export interface VaultJournal {
  transaction<T>(
    use: (entries: VaultJournalEntry[]) => T | Promise<T>,
  ): Promise<T>;
}
type Envelope = {
  version: 1;
  revision: number;
  key: CryptoKey;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
};
export interface VaultJournalBackend {
  read(): Promise<Envelope | undefined>;
  write(value: Envelope, previousRevision: number): Promise<void>;
}

function browserBackend(network: TestNetwork): VaultJournalBackend {
  const database = `bis-conditional-vault-${network}-v1`;
  async function access<T>(
    mode: IDBTransactionMode,
    use: (
      store: IDBObjectStore,
      set: (value: T) => void,
      tx: IDBTransaction,
    ) => void,
  ): Promise<T> {
    if (!globalThis.indexedDB) throw Error("vault-private-storage-unavailable");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(Error("vault-private-storage-unavailable"));
    });
    return new Promise((resolve, reject) => {
      let value: T;
      const tx = db.transaction("recovery", mode);
      tx.oncomplete = () => {
        db.close();
        resolve(value);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(Error("vault-private-storage-unavailable"));
      };
      use(
        tx.objectStore("recovery"),
        (result) => {
          value = result;
        },
        tx,
      );
    });
  }
  return {
    read: () =>
      access("readonly", (store, set) => {
        const request = store.get("journal");
        request.onsuccess = () => set(request.result);
      }),
    write: (value, revision) =>
      access<void>("readwrite", (store, set, tx) => {
        const request = store.get("journal");
        request.onsuccess = () => {
          if ((request.result?.revision ?? 0) !== revision) {
            tx.abort();
            return;
          }
          store.put(value, "journal");
          set(undefined);
        };
      }),
  };
}

export function createVaultJournal(
  network: TestNetwork,
  backend: VaultJournalBackend = browserBackend(network),
  lock?: <T>(work: () => Promise<T>) => Promise<T>,
): VaultJournal {
  const aad = (revision: number) =>
    new TextEncoder().encode(`bis:conditional-vault:${network}:1:${revision}`);
  const exclusive =
    lock ??
    (async <T>(work: () => Promise<T>) => {
      if (!globalThis.navigator?.locks)
        throw Error("vault-cross-tab-lock-unavailable");
      return navigator.locks.request(`bis-vault-journal:${network}`, work);
    });
  return {
    transaction: <T>(use: (entries: VaultJournalEntry[]) => T | Promise<T>) =>
      exclusive(async () => {
        const old = await backend.read();
        let entries: VaultJournalEntry[] = [];
        if (old) {
          if (
            old.version !== 1 ||
            old.key.extractable ||
            !Number.isSafeInteger(old.revision)
          )
            throw Error("vault-private-storage-invalid");
          const plain = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: old.iv, additionalData: aad(old.revision) },
            old.key,
            old.ciphertext,
          );
          const text = new TextDecoder().decode(plain);
          if (text.length > 8_000_000)
            throw Error("vault-private-storage-limit");
          entries = JSON.parse(text);
          if (!Array.isArray(entries))
            throw Error("vault-private-storage-invalid");
        }
        const before = structuredClone(entries);
        const result = await use(entries);
        if (JSON.stringify(entries) === JSON.stringify(before)) return result;
        const ids = new Set<string>();
        for (const entry of entries) {
          if (
            entry.network !== network ||
            !/^[A-Za-z0-9:_-]{1,100}$/.test(entry.operationId) ||
            ids.has(entry.operationId) ||
            !Array.isArray(entry.recovery) ||
            !["create", "increment", "claim", "recover"].includes(
              entry.operation,
            ) ||
            ![
              "prepared",
              "submitting",
              "pending",
              "verified",
              "rejected",
            ].includes(entry.phase) ||
            !Number.isSafeInteger(entry.createdAt) ||
            entry.createdAt < 0 ||
            typeof entry.scope !== "string"
          )
            throw Error("vault-journal-invalid");
          ids.add(entry.operationId);
        }
        for (const prior of before) {
          const next = entries.find(
            (row) => row.operationId === prior.operationId,
          );
          if (
            !next ||
            next.scope !== prior.scope ||
            next.operation !== prior.operation ||
            next.createdAt !== prior.createdAt ||
            (prior.descriptor &&
              JSON.stringify(prior.descriptor) !==
                JSON.stringify(next.descriptor)) ||
            JSON.stringify(prior.expectedInput) !==
              JSON.stringify(next.expectedInput) ||
            prior.expectedScript !== next.expectedScript ||
            (prior.transactionId &&
              prior.transactionId !== next.transactionId) ||
            (prior.draft?.parameters &&
              prior.draft.parameters !== next.draft?.parameters) ||
            (prior.phase === "verified" && next.phase !== "verified") ||
            JSON.stringify(next.recovery.slice(0, prior.recovery.length)) !==
              JSON.stringify(prior.recovery)
          )
            throw Error("vault-journal-history-mismatch");
        }
        const revision = (old?.revision ?? 0) + 1,
          key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"],
          );
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const plaintext = new TextEncoder().encode(JSON.stringify(entries));
        if (plaintext.length > 8_000_000)
          throw Error("vault-private-storage-limit");
        const ciphertext = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv, additionalData: aad(revision) },
          key,
          plaintext,
        );
        await backend.write(
          { version: 1, revision, key, iv, ciphertext },
          old?.revision ?? 0,
        );
        return result;
      }),
  };
}
