import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { windowsProtector } from './protector.ts';
import { fail } from './errors.ts';

export const repositoryRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const ecosystemRoot = dirname(repositoryRoot);
export const inside = (parent, child) => {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
};
export function defaultVaultRoot() {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) fail('vault-protection-unavailable');
  const project = createHash('sha256').update(repositoryRoot.toLowerCase()).digest('hex').slice(0, 16);
  return resolve(process.env.LOCALAPPDATA, 'BIS', 'agent-test-wallets', project);
}
export async function validatePrivatePath(target) {
  if (!isAbsolute(target) || inside(ecosystemRoot, target)) fail('unsafe-private-path');
  // Reject junctions/symlinks in every existing ancestor, including the leaf.
  let current = resolve(target);
  while (true) {
    const info = await lstat(current).catch(error => { if (error.code === 'ENOENT') return; throw error; });
    if (info?.isSymbolicLink()) fail('unsafe-private-path');
    if (info && inside(ecosystemRoot, await realpath(current))) fail('unsafe-private-path');
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve(target);
}
export function publicManifest(state) {
  return {
    version: 1, revision: state.revision,
    accounts: state.accounts.map(({ label, profileId, generation, provenance, createdAt }) =>
      ({ label, profileId, generation, provenance, createdAt })),
    pairs: state.pairs,
    ...(state.applications === undefined ? {} : { applications: state.applications }),
  };
}

export class Vault {
  constructor({ root, protector = windowsProtector(), beforeCommit } = {}) {
    this.root = root ?? defaultVaultRoot();
    this.protector = protector;
    this.beforeCommit = beforeCommit;
  }
  async initialize() {
    await validatePrivatePath(this.root);
    const exists = await lstat(this.root).catch(error => { if (error.code === 'ENOENT') return; throw error; });
    if (!exists) {
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      await this.protector.secure(this.root);
    } else await this.protector.check(this.root); // Do not silently repair broad existing ACLs.
    return this.transaction(state => publicManifest(state), { initialize: true });
  }
  async transaction(use, { initialize = false } = {}) {
    await validatePrivatePath(this.root);
    await this.protector.check(this.root);
    const lockPath = join(this.root, 'vault.lock');
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') fail('vault-locked'); throw error; }
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      await lock.sync();
      const state = await this.read({ initialize });
      const before = JSON.stringify(state);
      const result = await use(state);
      if (before !== JSON.stringify(state) || state.revision === 0) {
        state.revision++;
        await this.write(state);
      }
      return result;
    } finally { await lock.close(); await unlink(lockPath); }
  }
  async read({ initialize }) {
    const path = join(this.root, 'vault.json');
    await validatePrivatePath(path);
    const exists = await lstat(path).catch(error => { if (error.code === 'ENOENT') return; throw error; });
    if (!exists) {
      if (!initialize) fail('vault-not-initialized');
      return { version: 1, revision: 0, accounts: [], pairs: [] };
    }
    if (!exists.isFile() || exists.size > 3 * 1024 * 1024) fail('vault-invalid');
    await this.protector.check(path);
    const envelope = JSON.parse(await readFile(path, 'utf8'));
    if (envelope.version !== 1 || typeof envelope.ciphertext !== 'string' ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.ciphertext)) fail('vault-invalid');
    const bytes = await this.protector.unprotect(Buffer.from(envelope.ciphertext, 'base64'));
    try {
      const state = JSON.parse(bytes.toString('utf8'));
      if (state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 1 ||
          !Array.isArray(state.accounts) || !Array.isArray(state.pairs)) fail('vault-invalid');
      if (JSON.stringify(publicManifest(state)) !== JSON.stringify(envelope.public)) fail('vault-manifest-mismatch');
      return state;
    } finally { bytes.fill(0); }
  }
  async write(state) {
    const bytes = Buffer.from(JSON.stringify(state));
    let ciphertext;
    try { ciphertext = await this.protector.protect(bytes); } finally { bytes.fill(0); }
    const path = join(this.root, 'vault.json');
    const temporary = join(this.root, `vault-${randomUUID()}.tmp`);
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify({ version: 1, public: publicManifest(state), ciphertext: ciphertext.toString('base64') }));
      await file.sync();
    } finally { await file.close(); ciphertext.fill(0); }
    try {
      await this.protector.check(temporary);
      await validatePrivatePath(path);
      await this.beforeCommit?.();
      await rename(temporary, path);
    } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
}

