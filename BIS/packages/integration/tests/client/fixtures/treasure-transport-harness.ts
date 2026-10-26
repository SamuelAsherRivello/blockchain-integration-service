
import assert from 'node:assert/strict';
import {hex} from '@scure/base';
import {decodeSigningValue,encodeSigningValue} from '../../../src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {createTreasureServerTransport} from '../../../src/client/wallet-layer-arkade/treasure-server-transport.ts';
import {createTreasureServerJournal,prepareTreasureServerRequest,advanceTreasureServerJournal,
  type TreasureServerJournal} from '../../../src/client/wallet-layer-arkade/treasure-server-journal.ts';
import {fundFixture,spendFixture,game,operator,player,common,clock,connection,plan,receipt,token,wireArgs} from './treasure-server-transport-fixture.ts';

// HTTP is a closed deterministic fixture. Plans below are format placeholders;
// result signatures are real SDK signatures from public test scalars. These
// tests prove client persistence/transport, not hosted or network acceptance.
async function fixture(authority:'owner'|'player-proof'='player-proof',spend=false){
  const f=spend?await spendFixture():fundFixture(authority);
  let journal=createTreasureServerJournal({...f.binding,authority}),time=spend?clock:common.terms.startedAtMs+1000,current=true,owner='private-runtime-fixture-owner';
  let failCommit=false,drop=false,corrupt=false;
  const calls:{path:string;body:any;authorization:string|null}[]=[],writes:string[]=[],stored=new Map<string,unknown>();
  const account={profileId:common.profileId,network:'mutinynet' as const,server:{endpoint:common.endpoint,gameId:common.gameId,publicKey:common.publicKey}};
  const fetcher:typeof fetch=async(input,init)=>{
    const path=new URL(String(input)).pathname.replace('/api/bis/',''),body=JSON.parse(String(init?.body));
    calls.push({path,body,authorization:new Headers(init?.headers).get('authorization')});
    if(path.endsWith('/plan'))return Response.json(path.includes('/actor/')?{treasureActorPlan:token('actor-plan')}:
      authority==='owner'?{ownerPlan:plan}:{paymentPlan:plan});
    if(path.endsWith('/authorize'))return Response.json({grant:token('grant')});
    if(path==='treasure/recover'){
      assert.equal(body.requestJson,journal.requests.find(r=>r.id===body.requestId)!.bodyJson);
      assert.equal(body.connectionToken,connection);
      const value=stored.get(body.requestId);return value?Response.json(value):Response.json({error:'unavailable'},{status:409});
    }
    const checkpoint=path==='treasure/checkpoint/complete'||path==='owner/treasure/checkpoint/complete';
    if(checkpoint){
      assert.equal(body.connectionToken,connection);
      assert.equal(body.version,1);
      assert.equal(new Headers(init?.headers).has('X-BIS-Signing-Grant'),false);
      assert.equal(body.playerToken!==undefined,authority==='player-proof');
    }else assert.equal(path,'sign');
    const signingBody=checkpoint?JSON.parse(body.requestJson):body;
    const saved=journal.requests.find(r=>r.id===signingBody.id)!;
    assert.equal(saved.phase,'sign-pending','persist original body before the signing HTTP call');
    assert.equal(saved.bodyJson,JSON.stringify(signingBody));
    if(checkpoint)assert.equal(body.requestDigest,saved.bodyDigest);
    const args=decodeSigningValue(signingBody.args);
    const result=signingBody.method==='signMessage'?await game.signMessage(args[0],args[1]):corrupt?args[0]:await game.sign(args[0],args[1]);
    const value={result:encodeSigningValue(result),...(saved.purpose==='root'?{treasureRootReceipt:receipt}:{})};
    stored.set(signingBody.id,value);if(drop){drop=false;throw Error('Lost original signing response');}return Response.json(value);
  };
  const options={account,authority,connectionToken:connection,ownerToken:()=>owner,signal:new AbortController().signal,
    isCurrent:()=>current,now:()=>++time,fetcher,read:async()=>structuredClone(journal),
    commit:async(before:TreasureServerJournal,after:TreasureServerJournal)=>{
      if(failCommit)throw Error('Encrypted CAS unavailable');
      assert.deepEqual(before,journal);advanceTreasureServerJournal(before,after);journal=structuredClone(after);
      writes.push(after.requests.at(-1)!.phase);
    },playerProof:async()=>({token:token('player-proof'),expires:time+600_000,
      playerPublicKey:hex.encode(await player.compressedPublicKey()),assertCurrent:()=>assert.equal(current,true)})};
  function prepare(id='root-request',purpose:'root'|'checkpoint'|'actor-proof'='root',argsJson?:string,index?:number){
    journal=prepareTreasureServerRequest(journal,{purpose,id,argsJson:argsJson??wireArgs((f as ReturnType<typeof fundFixture>).pair.arkTx),
      ...(index===undefined?{}:{checkpointIndex:index})},++time);
  }
  return {f,options,calls,writes,stored,prepare,read:()=>structuredClone(journal),transport:()=>createTreasureServerTransport(options),
    elapse:(ms:number)=>{time+=ms;},drop:()=>{drop=true;},corrupt:()=>{corrupt=true;},failCommit:()=>{failCommit=true;},retire:()=>{current=false;},forget:()=>{owner='';}};
}


export {fixture};
