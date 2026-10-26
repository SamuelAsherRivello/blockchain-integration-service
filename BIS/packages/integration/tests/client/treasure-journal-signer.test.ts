import test from 'node:test';
import assert from 'node:assert/strict';
import {base64,hex} from '@scure/base';
import {Transaction,verifyTapscriptSignatures} from '@arkade-os/sdk';
import {Transaction as BitcoinTransaction} from '@scure/btc-signer';
import {createTreasureJournalSigner} from '../../src/client/wallet-layer-arkade/treasure-journal-signer.ts';
import {decodeSigningValue} from '../../src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {fixture} from './fixtures/treasure-transport-harness.ts';
import {fundFixture,operator} from './fixtures/treasure-server-transport-fixture.ts';
const encode=(value:Transaction)=>base64.encode(value.toPSBT());
function signer(f:Awaited<ReturnType<typeof fixture>>){return createTreasureJournalSigner({read:f.options.read,commit:f.options.commit,
  isCurrent:f.options.isCurrent,now:f.options.now,transport:f.transport()});}

test('typed Game bridge saves original requests and serializes both SDK checkpoint callbacks under one ROOT',async()=>{
  const f=await fixture(),j=signer(f),pair=(f.f as ReturnType<typeof fundFixture>).pair;
  const root=await j.root(encode(pair.arkTx)).catch(error=>{throw new Error(`Bridge stopped at ${f.read().requests.map(r=>r.phase).join(',')} after ${f.calls.map(c=>c.path).join(',')}`,{cause:error});});
  verifyTapscriptSignatures(Transaction.fromPSBT(base64.decode(root)),0,[f.read().binding.terms.game]);
  const cps=await Promise.all(pair.checkpoints.map(cp=>operator.sign(cp,[0])));
  const signed=await Promise.all(cps.map((cp,index)=>j.checkpoint(encode(cp),index)));
  for(const cp of signed)verifyTapscriptSignatures(Transaction.fromPSBT(base64.decode(cp)),0,[f.read().binding.terms.operator,f.read().binding.terms.game]);
  assert.deepEqual(f.read().requests.map(value=>[value.purpose,value.phase]),[['root','completed'],['checkpoint','completed'],['checkpoint','completed']]);
  assert.equal(new Set(f.read().requests.map(value=>value.id)).size,3);
  assert.deepEqual(f.writes,['prepared','planned','sign-pending','completed','prepared','planned','sign-pending','completed','prepared','planned','sign-pending','completed']);
  const calls=f.calls.length;assert.equal(await j.completed('root'),root);await j.root(encode(pair.arkTx));assert.equal(f.calls.length,calls);
});

test('a lost original Game result blocks another checkpoint and recovery reads only its saved original',async()=>{
  const f=await fixture(),j=signer(f),pair=(f.f as ReturnType<typeof fundFixture>).pair;f.drop();
  await assert.rejects(j.root(encode(pair.arkTx)));assert.equal(await j.state('root'),'sign-unknown');
  const before=f.calls.length,cp=await operator.sign(pair.checkpoints[0],[0]);
  await assert.rejects(j.checkpoint(encode(cp),0));assert.equal(f.calls.length,before);
  assert.equal(await j.recoverOutstanding(),true);assert.deepEqual(f.calls.slice(before).map(value=>value.path),['treasure/recover']);
  assert.equal(await j.state('root'),'completed');assert.ok(await j.completed('root'));
  assert.equal(f.read().requests.length,1,'unknown recovery never manufactures another signing request');
});

test('a fresh bridge recovers SDK-decoded original and completed ROOT/checkpoint transactions without signing again',async()=>{
  // Closed HTTP fixture and public test scalars only. This proves recovery
  // serialization, not a wallet operation, hosted signing or network acceptance.
  for(const purpose of ['root','checkpoint'] as const){
    const f=await fixture(),j=signer(f),pair=(f.f as ReturnType<typeof fundFixture>).pair;
    if(purpose==='checkpoint')await j.root(encode(pair.arkTx));
    const index=purpose==='checkpoint'?0:undefined;
    const original=encode(purpose==='root'?pair.arkTx:await operator.sign(pair.checkpoints[0],[0]));
    f.drop();
    await assert.rejects(purpose==='root'?j.root(original):j.checkpoint(original,0));
    const saved=f.read().requests.find(record=>record.purpose===purpose)!;
    assert.equal(saved.phase,'sign-unknown');
    const decoded=decodeSigningValue(JSON.parse(saved.argsJson))[0];
    assert.equal(decoded instanceof Transaction,false,'SDK static parsing returns the base transaction class');
    assert.ok(decoded instanceof BitcoinTransaction);
    assert.equal(encode(decoded),original);

    const resumed=signer(f),before=f.calls.length,requestCount=f.read().requests.length;
    assert.equal(await resumed.original(purpose,index),original);
    assert.equal(await resumed.completed(purpose,index),undefined);
    assert.equal(f.calls.length,before);
    assert.equal(await resumed.recoverOutstanding(),true);
    assert.deepEqual(f.calls.slice(before).map(call=>call.path),['treasure/recover']);
    const completed=f.read().requests.find(record=>record.id===saved.id)!;
    assert.equal(completed.phase,'completed');
    const recovered=decodeSigningValue(JSON.parse(completed.responseJson!).result);
    assert.equal(recovered instanceof Transaction,false);
    assert.ok(recovered instanceof BitcoinTransaction);
    const encoded=await resumed.completed(purpose,index);
    assert.equal(encoded,encode(recovered));
    assert.equal(encode(Transaction.fromPSBT(base64.decode(encoded!))),encoded);
    verifyTapscriptSignatures(recovered,0,purpose==='root'?[f.read().binding.terms.game]:
      [f.read().binding.terms.operator,f.read().binding.terms.game]);
    assert.equal(await resumed.original(purpose,index),original);
    assert.equal(f.read().requests.length,requestCount);
    assert.equal(f.calls.length,before+1,'completed/original reads must not send a new signing request');
  }
});

test('typed actor proof is derived from the saved template and arbitrary ROOT or unpersisted responses are refused',async()=>{
  const actor=await fixture('player-proof',true),j=signer(actor),proof=await j.actorProof();assert.match(proof,/^[a-f0-9]{128}$/);
  assert.equal(await j.completed('actor-proof'),proof);assert.equal(actor.calls.filter(value=>value.path==='sign').length,1);
  const f=await fixture(),pair=(f.f as ReturnType<typeof fundFixture>).pair,changed=Transaction.fromPSBT(pair.arkTx.toPSBT());
  changed.updateOutput(0,{script:hex.decode('5120'+f.read().binding.terms.gameDestination)});
  await assert.rejects(signer(f).root(encode(changed)));assert.equal(f.calls.length,0);
  const fake=createTreasureJournalSigner({read:f.options.read,commit:f.options.commit,isCurrent:()=>true,now:f.options.now,
    transport:{request:async()=>pair.arkTx,recover:async()=>pair.arkTx}});
  await assert.rejects(fake.root(encode(pair.arkTx)),'an RPC return without a persisted completed journal cannot advance the stage');
  assert.equal(f.read().requests[0].phase,'prepared');
});
