import test from 'node:test';
import assert from 'node:assert/strict';
import {MnemonicIdentity,Transaction} from '@arkade-os/sdk';
import {generateMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english.js';
import {makeProof,requestDigest} from '../../integration/src/core/hosted-protocol.ts';
import {verifyProof,mergeClaimSignature} from '../src/protocol.mjs';

test('player authentication binds the exact method, path and body, and rejects replay',async()=>{
 const identity=MnemonicIdentity.fromMnemonic(generateMnemonic(wordlist),{isMainnet:false});
 const proof=await makeProof(identity,'POST','/v1/start','{"amountSats":1000}');const seen=new Map();
 const player=verifyProof(proof,'POST','/v1/start','{"amountSats":1000}',seen);
 assert.equal(player.publicKey.length,66);assert.equal(player.profileId.length,64);
 assert.throws(()=>verifyProof(proof,'POST','/v1/start','{"amountSats":1000}',seen));
 assert.throws(()=>verifyProof(proof,'POST','/v1/start','{"amountSats":2000}',new Map()));
 assert.throws(()=>verifyProof(proof,'POST','/v1/end','{"amountSats":1000}',new Map()));
 assert.equal((await requestDigest('POST','/v1/start',1,'nonce','body')).length,32);
});
test('claim signing exchange rejects substituted outputs',()=>{
 const original=new Transaction({allowUnknownInputs:true,allowUnknownOutputs:true});original.addInput({txid:'11'.repeat(32),index:0,witnessUtxo:{amount:1000n,script:new Uint8Array([0x51])}});original.addOutput({amount:1000n,script:new Uint8Array([0x51])});
 const replacement=original.clone();replacement.updateOutput(0,{amount:999n});
 assert.throws(()=>mergeClaimSignature(original,Buffer.from(replacement.toPSBT()).toString('base64')));
});
