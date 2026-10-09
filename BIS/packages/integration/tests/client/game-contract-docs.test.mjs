import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../../../../',import.meta.url));
const documents=[
  'BIS/documentation/deep-dive.md','BIS/documentation/BGS_PROJECT_BRIEF.md',
  'BIS/documentation/design-discussion.md','BIS/documentation/SMOKE_TEST_BIS_TO_GAME.md',
  'BIS/packages/integration/integration-package-readme.md',
  'BIS/packages/integration-admin/integration-admin-package-readme.md',
  'BIS/packages/marketplace/marketplace-package-readme.md','docs/readme/package-boundaries-readme.md',
  ...['bridge-layer','state-layer-core','ui-layer-react','operation-layer','wallet-layer-game'].map(layer=>`BIS/packages/integration/src/client/${layer}/README.md`),
];

test('canonical deep-dive example matches the compiled public package fixture',async()=>{
  const docs=await readFile(resolve(root,documents[0]),'utf8');
  const fixture=await readFile(resolve(root,'BIS/packages/integration/tests/fixtures/game-contract-types.ts'),'utf8');
  const example=docs.match(/export async function mountBis[\s\S]*?\n}/)?.[0];
  assert.ok(example);assert.ok(fixture.includes(example));
  assert.ok(fixture.includes("from '@bis/integration'"));
  assert.ok(fixture.includes("import '@bis/integration/style.css'"));
});

test('current game-contract documentation has resolvable local references',async()=>{
  for(const path of documents){
    const source=await readFile(resolve(root,path),'utf8');
    for(const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
      const target=match[1];if(/^(?:https?:|#)/.test(target))continue;
      const local=decodeURIComponent(target.split('#')[0]);
      await assert.doesNotReject(access(resolve(dirname(resolve(root,path)),local)),`${path}: ${target}`);
    }
  }
});
