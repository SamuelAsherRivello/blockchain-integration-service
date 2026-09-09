import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {openVault} from '../src/vault.mjs';

test('private vault restores wallets and journals, rejects a second writer, and never stores plaintext',()=>{
  const dir=resolve('output/tests/hosted-wallet',crypto.randomUUID());mkdirSync(dir,{recursive:true});
  const marker='synthetic-wallet-material-for-storage-test';
  const a=openVault(dir);
  a.set('wallet',{profileId:'fixture',phrase:marker});a.set('journal',{submission:'unknown',id:'original'});
  assert.throws(()=>openVault(dir));a.close();
  assert.equal(readFileSync(resolve(dir,'state.sqlite')).includes(Buffer.from(marker)),false);
  const b=openVault(dir);assert.equal(b.get('wallet').phrase,marker);assert.deepEqual(b.get('journal'),{submission:'unknown',id:'original'});b.close();
});
