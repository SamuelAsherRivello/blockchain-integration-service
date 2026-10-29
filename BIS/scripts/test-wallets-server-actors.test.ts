import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SingleKey} from '@arkade-os/sdk';
import {register,verifiedInventory} from './test-wallets/inventory.ts';
import {publicManifest} from './test-wallets/vault.ts';
import {Operations} from './test-wallets/operations.ts';
import {validateServerActor,findTestActor,actorSource,assertAssignedServerActor} from './test-wallets/server-actors.ts';
import {readonlyIdentity} from '../packages/integration/src/client/wallet-layer-arkade/wallet-identity.ts';

const phrase='abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
async function fixture(){
  const state={version:1,revision:1,accounts:[],pairs:[]},vault={transaction:async use=>use(state)};
  await register(vault,[{label:'player',phrase}],'supplied');
  const publicKey=Buffer.from(await SingleKey.fromHex('1'.padStart(64,'0')).compressedPublicKey()).toString('hex');
  const actor={endpoint:'https://reviewed-example.vercel.app/api/bis/',network:'signet',publicKey,
    profileId:createHash('sha256').update(Buffer.from(publicKey,'hex')).digest('hex'),
    grant:{active:true,networks:['signet'],source:'user-approved-hosted-test-actor'}};
  state.serverActors={'remote-game':actor};state.pairs.push({label:'server-pair',network:'signet',player:'player',game:'remote-game'});
  const game=findTestActor(state,'remote-game'),player=state.accounts[0];
  const intent={id:'remote-original',account:game.label,profileId:game.profileId,generation:1,network:'signet',kind:'arkade-send',recipient:'fixture-destination',amountSats:1000,feeSats:0,sourceOrigin:'http://127.0.0.1:5174',serverSource:actorSource(game)};
  return {state,vault,actor,game,player,intent,ledger:new Operations(vault)};
}

test('public server actor keeps local mnemonic validation and Player ownership intact',async()=>{
  const f=await fixture();await verifiedInventory(f.state);
  assert.equal(f.game.phrase,undefined);assert.equal('phrase' in f.game,false);
  assert.equal(Buffer.from(await(await readonlyIdentity(f.game)).compressedPublicKey()).toString('hex'),f.actor.publicKey);
  assert.equal(JSON.stringify(publicManifest(f.state)).includes(phrase),false);
  assert.deepEqual(publicManifest(f.state).serverActors,f.state.serverActors);
  f.state.accounts[0].phrase='not a recovery phrase';await assert.rejects(verifiedInventory(f.state),/identity-mismatch/);
});

test('public actor rejects private fields, changed key/profile, network and noncanonical endpoint',async()=>{
  const {actor}=await fixture();
  for(const patch of [{phrase},{mnemonic:phrase},{privateKey:'1'.repeat(64)},{profileId:'a'.repeat(64)},
    {publicKey:'04'+'1'.repeat(64)},{network:'mainnet'},{endpoint:'http://reviewed-example.vercel.app/api/bis/'},
    {endpoint:'https://example.org/api/bis/'},{endpoint:actor.endpoint+'?token=fixture'},
    {grant:{...actor.grant,networks:['signet','mutinynet']}}])assert.throws(()=>validateServerActor({...actor,...patch}));
});

test('remote source cannot occupy the Player role or collide with a local identity',async()=>{
  const f=await fixture();f.state.pairs[0].player='remote-game';f.state.pairs[0].game='player';
  await assert.rejects(verifiedInventory(f.state),/role-assignment/);
  f.state.pairs=[];f.state.serverActors.player=f.actor;await assert.rejects(verifiedInventory(f.state),/duplicate-identity/);
});

test('original remote operation requires exact source and preserves pending conflicts',async()=>{
  const f=await fixture();const prepared=await f.ledger.prepare(f.intent);
  assert.deepEqual(prepared.intent.serverSource,actorSource(f.game));
  const missing={...f.intent,id:'missing-source'};delete missing.serverSource;
  await assert.rejects(f.ledger.prepare(missing),/source-changed/);
  await assert.rejects(f.ledger.prepare({...f.intent,id:'competing-source'}),/scope-pending/);
  const target={account:f.game.label,profileId:f.game.profileId,generation:1,serverSource:actorSource(f.game)};
  await assert.rejects(f.ledger.prepare({...f.intent,id:'competing-recipient',account:f.player.label,profileId:f.player.profileId,serverSource:undefined,target}),/scope-pending/);
  f.state.serverActors['remote-game'].endpoint='https://changed-example.vercel.app/api/bis/';
  await assert.rejects(f.ledger.submit(f.intent.id,()=>assert.fail('changed source must not submit')),/source-changed/);
  assert.equal(f.state.operations[0].state,'prepared');
});

test('revoked remote grant and cross-network assignment fail before signing',async()=>{
  const f=await fixture();await f.ledger.prepare(f.intent);f.actor.grant.active=false;
  await assert.rejects(f.ledger.submit(f.intent.id,()=>assert.fail('revoked grant must not submit')),/grant-unavailable/);
  const assignment={gameProfileId:f.game.profileId,network:'signet',endpoint:f.actor.endpoint,serverPublicKey:f.actor.publicKey};
  assert.doesNotThrow(()=>assertAssignedServerActor(f.game,assignment));
  for(const patch of [{network:'mutinynet'},{endpoint:'https://changed-example.vercel.app/api/bis/'},{serverPublicKey:'03'+'1'.repeat(64)},{gameProfileId:'a'.repeat(64)}])
    assert.throws(()=>assertAssignedServerActor(f.game,{...assignment,...patch}),/assignment-mismatch/);
});

test('one public-source operation retains its receipt and never submits again',async()=>{
  const f=await fixture();await f.ledger.prepare(f.intent);let submissions=0;
  const send=async record=>{
    submissions++;assert.deepEqual(record.intent.serverSource,actorSource(f.game));
    assert.equal('phrase' in findTestActor(f.state,record.intent.account),false);
    return {providerId:'a'.repeat(64)};
  };
  const pending=await f.ledger.submit(f.intent.id,send);
  assert.equal(pending.state,'pending');await f.ledger.submit(f.intent.id,send);assert.equal(submissions,1);
  const settled=await f.ledger.reconcile(f.intent.id,async row=>({id:row.intent.id,fingerprint:row.fingerprint,providerId:'a'.repeat(64),outcome:'settled',verified:true,feeSats:0}));
  assert.equal(settled.state,'settled');assert.deepEqual(settled.intent.serverSource,actorSource(f.game));
  assert.equal(settled.providerId,'a'.repeat(64));
});
