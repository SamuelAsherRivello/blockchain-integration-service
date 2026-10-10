import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const secretKeys = new Set(['mnemonic', 'phrase', 'seed', 'recoveryPhrase', 'recovery']);

function sanitize(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !secretKeys.has(key)).map(([key, item]) => [key, sanitize(item)]));
}

export function createFaucetOperationStore(path) {
  let cached;
  let loaded = false;
  async function load() {
    if (loaded) return cached;
    loaded = true;
    try { cached = JSON.parse(await readFile(path, 'utf8')); } catch { cached = undefined; }
    return cached;
  }
  return Object.freeze({
    async read() { return load(); },
    async write(operation) {
      cached = sanitize(operation);
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify(cached, null, 2)}\n`, 'utf8');
      await rename(temporary, path);
    },
  });
}

export function createProcessWalletLock() {
  let tail = Promise.resolve();
  return async function withLock(_key, work) {
    const previous = tail;
    let release;
    tail = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await work(); } finally { release(); }
  };
}
