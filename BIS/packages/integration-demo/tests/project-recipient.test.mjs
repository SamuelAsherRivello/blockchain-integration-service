import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ArkAddress} from '@arkade-os/sdk';
import {saveProjectRecipient, projectRecipientPlugin} from '../project-recipient.mjs';

test('import saves only the public recipient into both project configurations', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bis-recipient-'));
  const paths = [join(dir,'admin.json'), join(dir,'game.json')];
  const address = new ArkAddress(new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), 'tark').encode();
  await saveProjectRecipient({address}, paths);
  for (const path of paths) assert.deepEqual(JSON.parse(await readFile(path,'utf8')), {continueRecipient:address});
  await assert.rejects(saveProjectRecipient({address, phrase:'must-not-be-saved'}, paths));
  await assert.rejects(saveProjectRecipient({address:'invalid'}, paths));
  for (const path of paths) assert.deepEqual(JSON.parse(await readFile(path,'utf8')), {continueRecipient:address});
});
test('project writes reject cross-origin and non-POST requests', async () => {
  let handler;
  projectRecipientPlugin().configureServer({middlewares:{use(value){handler=value;}}});
  for (const [method, origin] of [['GET','http://localhost:5174'],['POST','https://example.com'],['POST',undefined]]) {
    let status;
    await handler({url:'/__bis/game-wallet-recipient',method,headers:{host:'localhost:5174',origin,'content-type':'application/json'}},
      {setHeader(){},writeHead(value){status=value;},end(){}},()=>assert.fail('must handle request'));
    assert.equal(status,403);
  }
});
