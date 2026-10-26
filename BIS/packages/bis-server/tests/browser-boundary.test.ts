import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

test('browser build excludes server configuration and private signer code', { timeout: 60000 }, async () => {
  const keys = ['BIS_GAME_WALLET_MNEMONIC', 'BIS_OWNER_TOKEN', ...['SIGNET', 'MUTINYNET'].flatMap(network => ['01', '02', '03'].map(slot => `BIS_GAME_WALLET_${network}_${slot}_MNEMONIC`))];
  const prior = new Map(keys.map(key => [key, process.env[key]]));
  const sentinel = 'bis-server-private-boundary-sentinel-7f5ec';
  for (const key of keys) process.env[key] = sentinel;
  const outDir = resolve(repositoryRoot, 'output/reports/bis-server/browser-boundary');
  try {
    await build({ root: resolve(repositoryRoot, 'BIS/packages/integration'), configFile: resolve(repositoryRoot, 'BIS/packages/integration/vite.config.ts'), build: { outDir, emptyOutDir: true }, logLevel: 'silent' });
    async function inspect(directory: string) {
      for (const file of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, file.name);
        if (file.isDirectory()) { await inspect(path); continue; }
        if (!/\.(?:js|json|html|map)$/.test(file.name)) continue;
        const source = await readFile(path, 'utf8');
        assert.equal(source.includes(sentinel), false, file.name);
        for (const key of keys) assert.equal(source.includes(key), false, file.name);
        assert.equal(source.includes('Game signer request capacity reached'), false, file.name);
      }
    }
    await inspect(outDir);
  } finally {
    for (const [key, value] of prior) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
