import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEMO_FILES } from '../src/client/demo-files.ts';
import { DEMOS } from '../src/client/navigation.ts';
import { demoSourceFile, demoSourceUrl } from '../src/client/source-links.ts';

test('all 21 routes map to distinct executable files and mode-specific source URLs', async () => {
  assert.deepEqual(DEMO_FILES.map(demo => demo.number).sort((a,b) => a-b), DEMOS.map(demo => demo.number).sort((a,b) => a-b));
  assert.equal(new Set(DEMO_FILES.map(demo => demo.file)).size, 21);
  for (const demo of DEMO_FILES) {
    const path = demoSourceFile(demo.id);
    assert.equal(path, `BIS/packages/prototype-sandbox/src/client/demos/${demo.file}`);
    const source = await readFile(new URL(`../src/client/demos/${demo.file}`, import.meta.url), 'utf8');
    assert.match(source, /export async function runDemo\(/);
    const local = new URL(demoSourceUrl(demo.id, true), 'http://127.0.0.1:5174');
    assert.equal(local.pathname, '/prototype-sandbox/source-view/');
    assert.equal(local.searchParams.get('file'), path);
    assert.equal(demoSourceUrl(demo.id, false), `https://github.com/SamuelAsherRivello/blockchain-integration-service/blob/main/${path}`);
  }
});

test('unknown source IDs fail explicitly', () => {
  for (const id of ['unknown', 'app', '__proto__', 'constructor']) {
    assert.throws(() => demoSourceFile(id), /Unknown demo source/);
  }
});
