import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyTapscriptSignatures} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {configureBisServer,probeGameSigner,remoteSigningIdentity,serverContractRequest,type ServerContractIntent,type ServerSigningOperation} from '../../src/client/wallet-layer-arkade/server-wallet.ts';
import {encodeSigningValue,decodeSigningValue} from '../../src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {stagedFixture,decode} from './treasure-staged-fixture.ts';

test('contract transport retains the legacy hash envelope and strips private/nonprotocol fields from v3 metadata',()=>{
  assert.deepEqual(serverContractRequest({kind:'refund',secretHash:'11'.repeat(32),playerPublicKey:'02'+'22'.repeat(32)}),{kind:'refund',secretHash:'11'.repeat(32)});
  const intent={artifactVersion:3 as const,kind:'refund' as const,branch:'reject' as const,offerSessionId:'offer',hostReference:'run',startedAtMs:1_800_000_000_123,playerPublicKey:'02'+'22'.repeat(32),phrase:'excluded',secretHex:'excluded'};
  assert.deepEqual(serverContractRequest(intent),{artifactVersion:3,kind:'refund',branch:'reject',offerSessionId:'offer',hostReference:'run',startedAtMs:intent.startedAtMs});
});

for(const owner of [false,true])test(`v3 ${owner?'owner':'Player-proof'} transport keeps the root receipt private and forwards it only to exact checkpoint authorization`,async t=>{
  const f=await stagedFixture('refund'),game=f.identities[1],publicKey=hex.encode(await game.compressedPublicKey());
  const profileId=hex.encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(hex.decode(publicKey)))));
  const root=decode(f.binding.original.arkTx),cp=decode(f.binding.original.checkpoints[0]),requests:{path:string;body:any;authorization:string|undefined}[]=[];
  let rootReceipt='synthetic-bound-root-receipt',unexpectedCheckpointReceipt=false;
  const contract:ServerContractIntent={artifactVersion:3,kind:'refund',branch:'refund',offerSessionId:f.binding.terms.offerSessionId,
    hostReference:f.binding.terms.hostReference,startedAtMs:f.binding.terms.startedAtMs,playerPublicKey:'02'+f.binding.terms.player};
  const payment:NonNullable<ServerSigningOperation['payment']>={active:{outpoints:[f.binding.funding],contract}};
  const operation:ServerSigningOperation={id:'synthetic-treasure-'+owner,payment,playerProof:async()=>({token:'synthetic-player-proof',expires:Date.now()+10000,playerPublicKey:contract.playerPublicKey})};
  configureBisServer({ownerToken:owner?'synthetic-owner-token':undefined});t.after(()=>configureBisServer({}));
  const fetcher:typeof fetch=async(url,init)=>{
    const path=new URL(String(url)).pathname.split('/api/bis/')[1],body=JSON.parse(String(init?.body));
    requests.push({path,body,authorization:(init?.headers as Record<string,string>)?.Authorization});
    if(path==='connect')return Response.json({protocol:1,network:'mutinynet',gameId:'stealth-and-steel',profileId,publicKey,token:'synthetic-connection',runtime:'vercel',capabilities:['sign','signMessage','signerSession']});
    if(path.endsWith('/plan'))return Response.json(owner?{ownerPlan:'synthetic-plan'}:{paymentPlan:'synthetic-plan'});
    if(path.endsWith('/authorize'))return Response.json({grant:'synthetic-grant'});
    assert.equal(path,'sign');const [tx,indexes]=decodeSigningValue(body.args) as [typeof root,number[]];
    return Response.json({result:encodeSigningValue(await game.sign(tx,indexes)),...(tx.id===root.id?{treasureRootReceipt:rootReceipt}:unexpectedCheckpointReceipt?{treasureRootReceipt:'unexpected-checkpoint-receipt'}:{})});
  };
  const probe=await probeGameSigner('mutinynet',{endpoint:`https://synthetic-${owner}.vercel.app/api/bis/`,fetcher});
  assert.equal(probe.status,'connected');if(probe.status!=='connected')throw Error('Synthetic probe failed');
  const identity=remoteSigningIdentity(probe.account,()=>operation),signedRoot=await identity.sign(root,[0]);
  verifyTapscriptSignatures(signedRoot,0,[f.binding.terms.game]);
  assert.equal(payment.active!.treasureRootId,root.id);assert.equal(payment.active!.treasureRootReceipt,'synthetic-bound-root-receipt');
  const signedCheckpoint=await identity.sign(cp,[0]);verifyTapscriptSignatures(signedCheckpoint,0,[f.binding.terms.game]);
  const plan=requests.find(row=>row.path.endsWith('/plan'))!;
  assert.deepEqual(plan.body.contract,serverContractRequest(contract));
  assert.equal(plan.body.contractPlayerPublicKey,owner?contract.playerPublicKey:undefined);
  const signs=requests.filter(row=>row.path==='sign');assert.equal(signs.length,2);
  assert.equal(signs[0].body.treasureRootReceipt,undefined);assert.equal(signs[1].body.treasureRootReceipt,'synthetic-bound-root-receipt');
  const auth=requests.filter(row=>row.path.endsWith('/authorize'));
  assert.equal(auth[0].body.request.treasureRootReceipt,undefined);assert.equal(auth[1].body.request.treasureRootReceipt,'synthetic-bound-root-receipt');
  assert.equal(signs[0].body.id,plan.body.request.id);assert.equal(signs[0].body.operationId,signs[1].body.operationId);
  assert.equal(signs[0].authorization,owner?'Bearer synthetic-owner-token':'Bearer synthetic-connection');
  assert.equal(JSON.stringify(probe.account).includes('treasureRootReceipt'),false);
  rootReceipt='substituted-receipt';await assert.rejects(identity.sign(root,[0]),/receipt changed/);
  unexpectedCheckpointReceipt=true;await assert.rejects(identity.sign(cp,[0]),/receipt changed/);
  assert.equal(payment.active!.treasureRootReceipt,'synthetic-bound-root-receipt');
});
