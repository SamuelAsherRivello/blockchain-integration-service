import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SingleKey} from '@arkade-os/sdk';
import {newRecoveryPhrase,normalizeRecoveryPhrase,restoreIdentity} from '../src/identity-material.js';
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
test('manual phrases normalize whitespace and case while retaining the exact identity',async()=>{
 const phrase=newRecoveryPhrase();
 const normalized=normalizeRecoveryPhrase('  '+phrase.toUpperCase().split(' ').join(' \n ')+'  ');
 assert.ok(normalized===phrase,'Normalized test phrase must match without printing it');
 const a=await restoreIdentity('mnemonic',phrase).compressedPublicKey();
 const b=await restoreIdentity('mnemonic',normalized).compressedPublicKey();
 assert.ok(a.every((value,index)=>value===b[index]));
});
test('invalid and empty phrases return a generic validation error',()=>{
 for(const phrase of ['',null,'invalid phrase'])assert.throws(()=>normalizeRecoveryPhrase(phrase),/^Error: Enter a valid English BIP39 seed phrase/);
});
