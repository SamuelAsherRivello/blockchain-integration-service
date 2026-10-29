import test from 'node:test';
import assert from 'node:assert/strict';
import { Transaction } from '@arkade-os/sdk';
import { encodeSigningValue } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { finalizeSignetArkadeTransaction, submitSignetArkadeTransaction, validSignetArkadeFinalize, validSignetArkadeSubmit, verifySignetSubmissionAuthorizations } from '../src/server/arkade-write-proxy.ts';
import { signingDigest } from '../src/server/signing-authorization.ts';

const transaction=new Transaction();transaction.addInput({txid:'11'.repeat(32),index:0});transaction.addOutput({script:Uint8Array.of(0x51),amount:900n});
const tx=Buffer.from(transaction.toPSBT()).toString('base64');
const id=transaction.id;

test('Signet write validators require exact bounded Arkade submit and finalize schemas', () => {
  assert.equal(validSignetArkadeSubmit({ signedArkTx: tx, checkpointTxs: [tx] }), true);
  assert.equal(validSignetArkadeSubmit({ signedArkTx: tx, checkpointTxs: [], network: 'mutinynet' }), false);
  assert.equal(validSignetArkadeSubmit({ signedArkTx: 'not base64!', checkpointTxs: [] }), false);
  assert.equal(validSignetArkadeSubmit({ signedArkTx: tx, checkpointTxs: Array(33).fill(tx) }), false);
  assert.equal(validSignetArkadeFinalize({ arkTxid: id, finalCheckpointTxs: [tx] }), true);
  assert.equal(validSignetArkadeFinalize({ arkTxid: id, finalCheckpointTxs: [], retry: true }), false);
  assert.equal(validSignetArkadeFinalize({ arkTxid: 'not-a-txid', finalCheckpointTxs: [] }), false);
});

test('submit forwards one fixed Signet request and validates the bounded receipt', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const result = await submitSignetArkadeTransaction({ signedArkTx: tx, checkpointTxs: [tx] }, async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json({ arkTxid: id, finalArkTx: tx, signedCheckpointTxs: [tx] });
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://signet.arkade.sh/v1/tx/submit');
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(calls[0].init?.redirect, 'error');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { signedArkTx: tx, checkpointTxs: [tx] });
  assert.deepEqual(result, { arkTxid: id, finalArkTx: tx, signedCheckpointTxs: [tx] });
  await assert.rejects(() => submitSignetArkadeTransaction({ signedArkTx: tx, checkpointTxs: [] }, async () =>
    Response.json({ arkTxid: id, finalArkTx: 'corrupt', signedCheckpointTxs: [] })));
});

test('submit receipt cannot add or replace signature material while preserving the same txid',async()=>{
  const original=new Transaction({version:2});original.addInput({txid:'55'.repeat(32),index:0,witnessUtxo:{script:Uint8Array.of(0x51),amount:1200n}});original.addOutput({script:Uint8Array.of(0x51),amount:1000n});
  const signed=Transaction.fromPSBT(original.toPSBT());signed.updateInput(0,{tapKeySig:new Uint8Array(64).fill(0x51)});
  const upstream=Transaction.fromPSBT(signed.toPSBT());upstream.updateInput(0,{finalScriptWitness:[new Uint8Array(64).fill(0x52)]});
  const encoded=(value:Transaction)=>Buffer.from(value.toPSBT()).toString('base64');
  await assert.rejects(()=>submitSignetArkadeTransaction({signedArkTx:encoded(signed),checkpointTxs:[]},async()=>
    Response.json({arkTxid:original.id,finalArkTx:encoded(upstream),signedCheckpointTxs:[]})),/receipt does not match the authorized transactions/);
});

test('submit and finalize never retry, follow redirects, or substitute another host', async () => {
  let calls = 0;
  const lost = async () => { calls++; throw Error('synthetic timeout'); };
  await assert.rejects(() => submitSignetArkadeTransaction({ signedArkTx: tx, checkpointTxs: [] }, lost));
  assert.equal(calls, 1);
  await assert.rejects(() => finalizeSignetArkadeTransaction({ arkTxid: id, finalCheckpointTxs: [] }, async (input, init) => {
    calls++;
    assert.equal(String(input), 'https://signet.arkade.sh/v1/tx/finalize');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    return new Response(null, { status: 307, headers: { location: 'https://attacker.invalid/submit' } });
  }));
  assert.equal(calls, 2);
  await finalizeSignetArkadeTransaction({ arkTxid: id, finalCheckpointTxs: [] }, async input => {
    assert.equal(String(input), 'https://signet.arkade.sh/v1/tx/finalize');
    return new Response(null, { status: 204 });
  });
});

test('submission requires the connected Signet profile’s completed exact signer result and its signature in the submitted PSBT',async()=>{
  const original=new Transaction({version:2});original.addInput({txid:'11'.repeat(32),index:1,witnessUtxo:{script:Uint8Array.from([0x51,0x20,...new Uint8Array(32).fill(5)]),amount:1200n}});
  original.updateInput(0,{bip32Derivation:[[Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'),{fingerprint:1,path:[0]}]]});
  original.addOutput({script:Uint8Array.of(0x51),amount:1000n});
  const signed=Transaction.fromPSBT(original.toPSBT());signed.updateInput(0,{tapKeySig:new Uint8Array(64).fill(7)});
  const profileId='d'.repeat(64),connectionToken='test-connection-token-at-least-16',request={id:'sign-request-1',operationId:'sign-operation-1',method:'sign',network:'signet',profileId,args:encodeSigningValue([original,[0]])};
  const authorization={request,connectionToken},stored={status:'completed' as const,result:encodeSigningValue(signed)};
  const store={readCompleted:async(input:{scope:string;id:string;digest:string})=>input.scope===`stealth-and-steel:signet:${profileId}`&&input.id===request.id&&input.digest===signingDigest(request)?stored:{status:'missing' as const}};
  const accepted=await verifySignetSubmissionAuthorizations({gameId:'stealth-and-steel',operationId:request.operationId,authorizations:[authorization],signedArkTx:Buffer.from(signed.toPSBT()).toString('base64'),checkpointTxs:[],store,verifyConnection:(token,id)=>token===connectionToken&&id===profileId});
  assert.deepEqual(accepted,{profileId,transactionId:original.id});
  await assert.rejects(()=>verifySignetSubmissionAuthorizations({gameId:'stealth-and-steel',operationId:request.operationId,authorizations:[authorization],signedArkTx:Buffer.from(original.toPSBT()).toString('base64'),checkpointTxs:[],store,verifyConnection:()=>true}),/signature material differs from its completed signer receipts/);
  const unreceiptedPartial=Transaction.fromPSBT(signed.toPSBT());unreceiptedPartial.updateInput(0,{partialSig:[[Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'),new Uint8Array(64).fill(9)]]});
  const unreceiptedScript=Transaction.fromPSBT(signed.toPSBT());unreceiptedScript.updateInput(0,{tapScriptSig:[[{pubKey:new Uint8Array(32).fill(1),leafHash:new Uint8Array(32).fill(2)},new Uint8Array(64).fill(9)]]});
  const unreceiptedFinal=Transaction.fromPSBT(signed.toPSBT());unreceiptedFinal.updateInput(0,{finalScriptWitness:[new Uint8Array(64).fill(9)]});
  for(const extra of [unreceiptedPartial,unreceiptedScript,unreceiptedFinal])await assert.rejects(()=>verifySignetSubmissionAuthorizations({gameId:'stealth-and-steel',operationId:request.operationId,authorizations:[authorization],signedArkTx:Buffer.from(extra.toPSBT()).toString('base64'),checkpointTxs:[],store,verifyConnection:()=>true}),/signature material differs from its completed signer receipts/);
  const metadataTampered=new Transaction({version:2});metadataTampered.addInput({txid:'11'.repeat(32),index:1,witnessUtxo:{script:Uint8Array.from([0x51,0x20,...new Uint8Array(32).fill(5)]),amount:1200n},bip32Derivation:[[Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'),{fingerprint:1,path:[1]}]]});
  metadataTampered.addOutput({script:Uint8Array.of(0x51),amount:1000n});metadataTampered.updateInput(0,{tapKeySig:new Uint8Array(64).fill(7)});
  await assert.rejects(()=>verifySignetSubmissionAuthorizations({gameId:'stealth-and-steel',operationId:request.operationId,authorizations:[authorization],signedArkTx:Buffer.from(metadataTampered.toPSBT()).toString('base64'),checkpointTxs:[],store,verifyConnection:()=>true}),/differs from its approved signer result/);
  const changed=Transaction.fromPSBT(original.toPSBT());changed.addOutput({script:Uint8Array.of(0x51),amount:1n});
  await assert.rejects(()=>verifySignetSubmissionAuthorizations({gameId:'stealth-and-steel',operationId:request.operationId,authorizations:[authorization],signedArkTx:Buffer.from(changed.toPSBT()).toString('base64'),checkpointTxs:[],store,verifyConnection:()=>true}),/differs from its approved signer request/);
  await assert.rejects(()=>verifySignetSubmissionAuthorizations({gameId:'stealth-and-steel',operationId:request.operationId,authorizations:[authorization],signedArkTx:Buffer.from(signed.toPSBT()).toString('base64'),checkpointTxs:[],store,verifyConnection:()=>false}),/connection is invalid/);
  await assert.rejects(()=>verifySignetSubmissionAuthorizations({gameId:'stealth-and-steel',operationId:request.operationId,authorizations:[{...authorization,request:{...request,network:'mutinynet'}}],signedArkTx:Buffer.from(signed.toPSBT()).toString('base64'),checkpointTxs:[],store,verifyConnection:()=>true}),/authorization is invalid/);
});

test('submission accepts the exact union of completed multi-signer signature entries and no additional entries',async()=>{
  const original=new Transaction({version:2});original.addInput({txid:'33'.repeat(32),index:0,witnessUtxo:{script:Uint8Array.of(0x51),amount:1200n}});original.addOutput({script:Uint8Array.of(0x51),amount:1000n});
  const pubKey=Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex').subarray(1),leafHashA=new Uint8Array(32).fill(0xaa),leafHashB=new Uint8Array(32).fill(0xbb);
  const signerA=Transaction.fromPSBT(original.toPSBT());signerA.updateInput(0,{tapScriptSig:[[{pubKey,leafHash:leafHashA},new Uint8Array(64).fill(0x41)]]});
  const signerB=Transaction.fromPSBT(original.toPSBT());signerB.updateInput(0,{tapScriptSig:[[{pubKey,leafHash:leafHashB},new Uint8Array(64).fill(0x42)]]});
  const merged=Transaction.fromPSBT(original.toPSBT());merged.updateInput(0,{tapScriptSig:[...signerA.getInput(0).tapScriptSig!,...signerB.getInput(0).tapScriptSig!]});
  const profileId='f'.repeat(64),connectionToken='test-connection-token-at-least-16',operationId='multi-sign-operation',requests=[
    {id:'multi-sign-a',operationId,method:'sign',network:'signet',profileId,args:encodeSigningValue([original,[0]])},
    {id:'multi-sign-b',operationId,method:'sign',network:'signet',profileId,args:encodeSigningValue([original,[0]])},
  ],results=[signerA,signerB],authorizations=requests.map(request=>({request,connectionToken}));
  const store={readCompleted:async(input:{scope:string;id:string;digest:string})=>{const index=requests.findIndex(request=>request.id===input.id&&signingDigest(request)===input.digest);return input.scope===`stealth-and-steel:signet:${profileId}`&&index>=0?{status:'completed' as const,result:encodeSigningValue(results[index])}:{status:'missing' as const};}};
  const accepted=await verifySignetSubmissionAuthorizations({gameId:'stealth-and-steel',operationId,authorizations,signedArkTx:Buffer.from(merged.toPSBT()).toString('base64'),checkpointTxs:[],store,verifyConnection:()=>true});
  assert.deepEqual(accepted,{profileId,transactionId:original.id});
  const extra=Transaction.fromPSBT(merged.toPSBT());extra.updateInput(0,{partialSig:[[Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'),new Uint8Array(64).fill(0x55)]]});
  await assert.rejects(()=>verifySignetSubmissionAuthorizations({gameId:'stealth-and-steel',operationId,authorizations,signedArkTx:Buffer.from(extra.toPSBT()).toString('base64'),checkpointTxs:[],store,verifyConnection:()=>true}),/signature material differs from its completed signer receipts/);
});

test('submission rejects a completed signer result whose sighash metadata differs from the request',async()=>{
  const original=new Transaction({version:2});original.addInput({txid:'22'.repeat(32),index:1,witnessUtxo:{script:Uint8Array.from([0x51,0x20,...new Uint8Array(32).fill(6)]),amount:1200n},sighashType:1});
  original.addOutput({script:Uint8Array.of(0x51),amount:1000n});
  const mismatched=Transaction.fromPSBT(original.toPSBT());mismatched.updateInput(0,{sighashType:3,tapKeySig:new Uint8Array(64).fill(8)});
  const submitted=Transaction.fromPSBT(original.toPSBT());submitted.updateInput(0,{tapKeySig:new Uint8Array(64).fill(8)});
  const profileId='e'.repeat(64),connectionToken='test-connection-token-at-least-16',request={id:'sign-request-sighash',operationId:'sign-operation-sighash',method:'sign',network:'signet',profileId,args:encodeSigningValue([original,[0]])};
  const authorization={request,connectionToken},store={readCompleted:async(input:{scope:string;id:string;digest:string})=>input.scope===`stealth-and-steel:signet:${profileId}`&&input.id===request.id&&input.digest===signingDigest(request)?{status:'completed' as const,result:encodeSigningValue(mismatched)}:{status:'missing' as const}};
  await assert.rejects(()=>verifySignetSubmissionAuthorizations({gameId:'stealth-and-steel',operationId:request.operationId,authorizations:[authorization],signedArkTx:Buffer.from(submitted.toPSBT()).toString('base64'),checkpointTxs:[],store,verifyConnection:()=>true}),/differs from its approved signer result/);
});
