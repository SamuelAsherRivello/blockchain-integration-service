import test from 'node:test';
import assert from 'node:assert/strict';
import {configureBisServer,probeGameSigner,remoteSigningIdentity,serverContractRequest,serverTreasureAuthority,
  createLeasedTreasureServerTransport,type ServerSigningOperation} from '../../src/client/wallet-layer-arkade/server-wallet.ts';
import {createTreasureServerJournal,prepareTreasureServerRequest} from '../../src/client/wallet-layer-arkade/treasure-server-journal.ts';
import {fundFixture,common,connection,token,wireArgs,player} from './fixtures/treasure-server-transport-fixture.ts';
import {hex} from '@scure/base';

test('V4 metadata stays public while the generic hosted signer refuses unjournaled V4 requests',async t=>{
  configureBisServer({});t.after(()=>configureBisServer({}));
  const f=fundFixture(),calls:string[]=[],contract={artifactVersion:4 as const,kind:'fund' as const,branch:'fund' as const,
    offerSessionId:common.terms.offerSessionId,hostReference:common.terms.hostReference,startedAtMs:common.terms.startedAtMs,
    playerPublicKey:'02'+common.terms.player,privateField:'must-not-leave'};
  assert.deepEqual(serverContractRequest(contract),{artifactVersion:4,kind:'fund',branch:'fund',offerSessionId:contract.offerSessionId,
    hostReference:contract.hostReference,startedAtMs:contract.startedAtMs});
  const fetcher:typeof fetch=async(url)=>{calls.push(String(url));return Response.json({protocol:1,network:'mutinynet',gameId:common.gameId,
    profileId:common.profileId,publicKey:common.publicKey,token:connection,runtime:'vercel',capabilities:['sign','signMessage','signerSession']});};
  const probe=await probeGameSigner('mutinynet',{endpoint:common.endpoint,fetcher});assert.equal(probe.status,'connected');if(probe.status!=='connected')throw Error();
  const selected:ServerSigningOperation={id:'ephemeral-sdk-lease',payment:{active:{outpoints:[],contract}}};
  await assert.rejects(remoteSigningIdentity(probe.account,()=>selected).sign(f.pair.arkTx,[0,1]),/saved private journal/);
  assert.equal(calls.length,1,'only the identity probe occurred');
});

test('private factory pins the Game lease and saved authority, never an owner credential from a new connection mode',async t=>{
  t.mock.method(Date,'now',()=>common.terms.startedAtMs+2000);
  configureBisServer({ownerToken:'runtime-only-new-owner'});t.after(()=>configureBisServer({}));
  const f=fundFixture('player-proof'),journal=prepareTreasureServerRequest(createTreasureServerJournal(f.binding),
    {purpose:'root',id:'root-request',argsJson:wireArgs(f.pair.arkTx)},common.terms.startedAtMs+1000);
  const calls:{path:string;authorization:string|null}[]=[];
  const fetcher:typeof fetch=async(url,init)=>{
    const path=new URL(String(url)).pathname.replace('/api/bis/','');calls.push({path,authorization:new Headers(init?.headers).get('Authorization')});
    if(path==='connect')return Response.json({protocol:1,network:'mutinynet',gameId:common.gameId,profileId:common.profileId,publicKey:common.publicKey,
      token:connection,runtime:'vercel',capabilities:['sign','signMessage','signerSession']});
    return Response.json({error:'fixture refuses any signing plan'},{status:503});
  };
  const probe=await probeGameSigner('mutinynet',{endpoint:common.endpoint,fetcher});assert.equal(probe.status,'connected');if(probe.status!=='connected')throw Error();
  assert.equal(serverTreasureAuthority(probe.account),'owner','fresh operations use current explicit authority');
  let selected:ServerSigningOperation|undefined={id:'new-lease-same-original-operation',playerProof:async()=>({token:token('fresh-player'),
    expires:Date.now()+1000,playerPublicKey:hex.encode(await player.compressedPublicKey())})};
  const persistence={read:async()=>journal,commit:async()=>{throw Error('no commit permitted');},isCurrent:()=>true};
  const transport=await createLeasedTreasureServerTransport(probe.account,()=>selected,persistence);
  await assert.rejects(transport.request('root-request'));
  assert.equal(calls.at(-1)!.path,'payment/plan','saved Player-proof mode remains pinned');
  assert.equal(calls.at(-1)!.authorization,`Bearer ${connection}`);
  const count=calls.length;selected=undefined;await assert.rejects(transport.recover('root-request'));assert.equal(calls.length,count);
  await assert.rejects(createLeasedTreasureServerTransport(probe.account,()=>selected,persistence));
});

test('an imported endpoint cannot obtain the verified original connection owner credential',async t=>{
  configureBisServer({ownerToken:'runtime-private-owner'});t.after(()=>configureBisServer({}));
  const f=fundFixture('owner'),journal=createTreasureServerJournal(f.binding),calls:string[]=[];
  const fetcher:typeof fetch=async(url)=>{calls.push(String(url));return Response.json({protocol:1,network:'mutinynet',gameId:common.gameId,
    profileId:common.profileId,publicKey:common.publicKey,token:connection,runtime:'vercel',capabilities:['sign','signMessage','signerSession']});};
  const probe=await probeGameSigner('mutinynet',{endpoint:common.endpoint,fetcher});assert.equal(probe.status,'connected');if(probe.status!=='connected')throw Error();
  const operation:ServerSigningOperation={id:'endpoint-lease'};
  const forged={...probe.account,server:{...probe.account.server,endpoint:'https://foreign.invalid/api/bis/'}};
  await assert.rejects(createLeasedTreasureServerTransport(forged,()=>operation,{read:async()=>journal,commit:async()=>{},isCurrent:()=>true}));
  assert.equal(calls.length,1);
});
