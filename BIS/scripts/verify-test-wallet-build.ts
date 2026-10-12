import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const buildDirectories = ['integration', 'integration-admin', 'marketplace', 'prototype-faucet', 'prototype-onboarding']
  .map(name => `BIS/packages/${name}/dist`);

// Inspect only built artifacts, never the populated environment or private
// vault. This structural exclusion check cannot certify absence of every secret.
export function artifactViolation(path, bytes) {
  const normalized = path.replaceAll('\\', '/');
  if (/(?:^|\/)(?:\.env(?:\..*)?|vault\.(?:json|lock)|Local State|Cookies|Login Data)$/i.test(normalized) ||
      /(?:^|\/)(?:test-wallets|agent-test-wallets|profiles)(?:\/|$)/i.test(normalized)) return 'private-or-runner-file';
  const source = bytes.toString('utf8');
  if (/BIS_TEST_ACCOUNT_[1-4]_MNEMONIC/.test(source)) return 'fixture-secret-slot';
  if (/BIS[\\/]scripts[\\/]test-wallets[\\/]|api[\\/]test-wallets(?:[\\/"'`?]|$)|vault-protection-unavailable/.test(source))
    return 'fixture-control-code';
}

export async function verifyBuilds(root, directories = buildDirectories) {
  let files = 0;
  const violations = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name), name = relative(root, path).replaceAll('\\', '/');
      if (entry.isSymbolicLink()) throw Error('build-symlink-unavailable');
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) {
        files++;
        const reason = artifactViolation(name, await readFile(path));
        if (reason) violations.push({ artifact: name, reason });
      }
    }
  }
  for (const directory of directories) {
    const path = resolve(root, directory);
    const rel = relative(resolve(root), path);
    if (rel.startsWith('..') || resolve(root) === path || !(await lstat(path)).isDirectory()) throw Error('build-directory-unavailable');
    await walk(path);
  }
  if (!files) throw Error('build-empty');
  return { ok: violations.length === 0, directories: directories.length, files, violations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyBuilds(resolve(fileURLToPath(new URL('../../', import.meta.url))));
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  } catch {
    console.log(JSON.stringify({ ok: false, reason: 'build-verification-unavailable' }));
    process.exitCode = 1;
  }
}
