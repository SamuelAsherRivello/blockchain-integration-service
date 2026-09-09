import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SingleKey} from '@arkade-os/sdk';
import {newRecoveryPhrase,restoreIdentity} from '../src/identity-material.js';
test('new seed phrase restores exactly the same Signet identity',async()=>{
 const phrase=newRecoveryPhrase();
 assert.ok(phrase.split(' ').length===12,'Expected a 12-word phrase');
 const original=await restoreIdentity('mnemonic',phrase).compressedPublicKey();
 const restored=await restoreIdentity('mnemonic',phrase).compressedPublicKey();
 assert.ok(original.every((v,i)=>v===restored[i]),'Restored public identity must match');
});
test('legacy private-key accounts retain their original identity',async()=>{
 const original=SingleKey.fromRandomBytes();
 const before=await original.compressedPublicKey();
 const after=await restoreIdentity(undefined,original.toHex()).compressedPublicKey();
 assert.ok(before.every((v,i)=>v===after[i]),'Legacy public identity must remain unchanged');
 assert.throws(()=>restoreIdentity('unknown',''),/Unsupported saved account format/);
});
