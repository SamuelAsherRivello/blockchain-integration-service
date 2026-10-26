import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {CSVMultisigTapscript,DefaultVtxo,MnemonicIdentity,SingleKey,Transaction} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {SIGNER_PROTOCOL,encodeSigningValue} from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {validateAssetAssignment,assertAssetAuthority,assertAssetPredecessor,assertAssetConnectionRequest,assertAssetConnectionResponse,assertAssetPreflight,assertAssetRequestEnvelope,assertAssetOperationBudget,checkBrowserAssetReceipt,assetScope,type AssetAssignment} from '../scripts/funded-workflow-assets.ts';
import {assetRequest,prepareAssetSdkPlan} from '../scripts/funded-workflow-asset-plan.ts';

const key=hex.encode(await SingleKey.fromHex('1'.padStart(64,'0')).compressedPublicKey());
const required=['funded-workflow-live.ts','protected-browser-journal.ts','tests/funded-workflow-preflight.ts','funded-workflow-assets.ts','funded-workflow-asset-plan.ts'];
const sourceHashes=Object.fromEntries(required.map(path=>['BIS/packages/bis-server/scripts/'+path,'a'.repeat(64)]));
const assetId='aa'.repeat(34);
function assignment(patch:Record<string,unknown>={}):AssetAssignment{
  return validateAssetAssignment({runId:'server-mint-0001',network:'mutinynet',pair:'test-pair',candidateId:'mutinynet:01',playerProfileId:'c'.repeat(64),
    gameProfileId:createHash('sha256').update(Buffer.from(key,'hex')).digest('hex'),serverPublicKey:key,endpoint:'https://reviewed-example.vercel.app/api/bis/',amountSats:1000,feeSats:0,
    sourceHashes,step:'mint',lineageId:'lineage-0001',authorizationMode:'owner',...patch});
}

test('asset assignments require reviewed sources, exact original lineage and explicit public/owner separation',()=>{
  const a=assignment();assert.equal(a.authorizationMode,'owner');
  assert.equal(assignment({authorizationMode:undefined}).authorizationMode,'owner');
  assert.equal(assignment({authorizationMode:'player-proof'}).authorizationMode,'player-proof');
  for(const patch of [{step:'unknown'},{lineageId:'x'},{assetId},{amountSats:999},{phrase:'untrusted'},{authorizationMode:'other'},
    {sourceHashes:{...sourceHashes,'BIS/packages/bis-server/scripts/funded-workflow-assets.ts':undefined}},
    {step:'burn',authorizationMode:'player-proof',assetId,predecessorRunId:'server-delivery-0001'}])assert.throws(()=>assignment(patch));
});

test('runtime, exact coordinator slot, owner credential and reviewed financial approval precede access',()=>{
  const a=assignment(),slot={BIS_SERVER_ACCEPTANCE_SLOT:a.runId,BIS_ACCEPTANCE_OWNER_TOKEN:'synthetic-owner-value'};
  assert.doesNotThrow(()=>assertAssetAuthority(a,'prepare',a.runId,slot,'24.21.0'));
  assert.throws(()=>assertAssetAuthority(a,'prepare',a.runId,slot,'26.0.0'));
  assert.throws(()=>assertAssetAuthority(a,'prepare','wrong-run',slot,'24.21.0'));
  assert.throws(()=>assertAssetAuthority(a,'prepare',a.runId,{BIS_SERVER_ACCEPTANCE_SLOT:a.runId},'24.21.0'));
  assert.throws(()=>assertAssetAuthority(a,'run',a.runId,slot,'24.21.0'));
  const approved=assignment({approvedOutpoints:[`${'dd'.repeat(32)}:0`],approvedFingerprint:'e'.repeat(64)});
  assert.doesNotThrow(()=>assertAssetAuthority(approved,'run',a.runId,{...slot,BIS_SERVER_FINANCIAL_SLOT:a.runId},'24.21.0'));
  const publicAssignment=assignment({authorizationMode:'player-proof'});
  assert.doesNotThrow(()=>assertAssetAuthority(publicAssignment,'prepare',a.runId,{BIS_SERVER_ACCEPTANCE_SLOT:a.runId},'24.21.0'));
  assert.throws(()=>assertAssetAuthority(publicAssignment,'prepare',a.runId,slot,'24.21.0'),/refuses an owner token/);
});

test('approving inputs preserves scope while changing endpoint, mode or lineage invalidates the original',()=>{
  const a=assignment();assert.equal(assetScope(a),assetScope(assignment({approvedFingerprint:'d'.repeat(64),approvedOutpoints:[`${'ee'.repeat(32)}:0`]})));
  for(const patch of [{endpoint:'https://replacement.vercel.app/api/bis/'},{authorizationMode:'player-proof'},{lineageId:'different-lineage'}])assert.notEqual(assetScope(a),assetScope(assignment(patch)));
});

test('zero-cost asset insertion still requires its captured approved wire and retains all historical costs',async()=>{
  const a=assignment(),operatorKey=await SingleKey.fromHex('3'.padStart(64,'0')).xOnlyPublicKey();
  const own=new DefaultVtxo.Script({pubKey:await SingleKey.fromHex('1'.padStart(64,'0')).xOnlyPublicKey(),serverPubKey:operatorKey,csvTimelock:{type:'seconds',value:1024n}});
  const player=new DefaultVtxo.Script({pubKey:await SingleKey.fromHex('2'.padStart(64,'0')).xOnlyPublicKey(),serverPubKey:operatorKey,csvTimelock:{type:'seconds',value:1024n}});
  const context={inputs:[{txid:'11'.repeat(32),vout:0,value:3000,tapTree:own.encode(),tapLeafScript:own.forfeit(),assets:[]}],changeScript:own.pkScript,recipientScript:player.pkScript,maximumExposureSats:1000,
    serverUnrollScript:CSVMultisigTapscript.encode({pubkeys:[operatorKey],timelock:{type:'seconds',value:86016n}})};
  const plan=await prepareAssetSdkPlan(context,{step:'mint',authorizationMode:'owner',operationId:a.runId+'-mint',carrierSats:330,gamePublicKey:a.serverPublicKey.slice(2)},operatorKey,330n);
  const approved=assignment({approvedFingerprint:plan.fingerprint,approvedOutpoints:plan.outpoints});
  const now=Date.now(),intent={id:a.runId+'-asset',network:a.network,profileId:a.gameProfileId,kind:'mint',amountSats:0,feeSats:0};
  const row={intent,createdAt:new Date(now).toISOString(),state:'prepared'},historical={intent:{id:'old-unresolved',network:a.network,amountSats:10000,feeSats:0},createdAt:row.createdAt,state:'unknown'};
  assert.doesNotThrow(()=>assertAssetOperationBudget([historical,row],intent,approved,plan,0,intent.id,now));
  assert.throws(()=>assertAssetOperationBudget([historical,row],intent,approved,plan,1,intent.id,now),/rolling/);
  assert.throws(()=>assertAssetOperationBudget([row],intent,approved,undefined,0,intent.id,now));
  assert.throws(()=>assertAssetOperationBudget([row],{...intent,amountSats:1000},approved,plan,0,intent.id,now));
  assert.throws(()=>assertAssetOperationBudget([row],{...intent,feeSats:undefined},approved,plan,0,intent.id,now));
  assert.throws(()=>assertAssetOperationBudget([row,row],intent,approved,plan,0,intent.id,now));
  assert.throws(()=>assertAssetOperationBudget([row],{...intent,profileId:a.playerProfileId},approved,plan,0,intent.id,now));
  const missingHistoricalFee={...historical,intent:{...historical.intent,amountSats:6000,feeSats:undefined}};
  assert.throws(()=>assertAssetOperationBudget([missingHistoricalFee,row],intent,approved,plan,0,intent.id,now),/rolling/);
});

test('real protected operation state reserves a zero-cost original and never resubmits an unknown attempt',async()=>{
  // Runtime-test the existing untyped tooling through the same narrow bridge
  // as the executable, without claiming its full legacy tree is typechecked.
  const legacy=(path:string)=>import(new URL(path,import.meta.url).href),{Operations}=await legacy('../../../scripts/test-wallets/operations.ts');
  const phrase='abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const publicKey=await MnemonicIdentity.fromMnemonic(phrase,{isMainnet:false}).compressedPublicKey(),profileId=createHash('sha256').update(publicKey).digest('hex');
  const state:any={accounts:[{label:'synthetic-game',phrase,profileId,generation:1,provenance:'agent-created',grant:{active:true,networks:['mutinynet']}}],pairs:[],operations:[]};
  const ledger=new Operations({transaction:async(use:any)=>use(state)}),intent={id:'synthetic-zero-mint',account:'synthetic-game',profileId,generation:1,network:'mutinynet',kind:'mint',recipient:`asset:${assetId}`,amountSats:0,feeSats:0,sourceOrigin:'http://127.0.0.1:5174'};
  await ledger.prepare(intent);assert.equal(state.operations[0].state,'prepared');assert.equal(state.operations[0].intent.amountSats,0);
  let submissions=0;await ledger.submit(intent.id,async()=>{submissions++;assert.equal(state.operations[0].state,'submitting');throw Error('Synthetic lost acknowledgement; no provider exists.');});
  assert.equal(state.operations[0].state,'unknown');
  await ledger.submit(intent.id,async()=>{submissions++;return {providerId:'must-not-run'};});assert.equal(submissions,1);
  await assert.rejects(ledger.prepare({...intent,id:'competing-zero-mint'}),/operation-scope-pending/);
  assert.equal(state.operations.length,1);assert.equal(state.operations[0].intent.amountSats,0);
});

test('delivery and burn require the exact settled predecessor, receipt, authorization and identities',()=>{
  const a=assignment(),delivery=assignment({runId:'server-delivery-0001',step:'delivery',assetId,predecessorRunId:a.runId});
  const prior={phase:'settled',assignment:a,receipt:{verified:true,authorizationMode:'owner',assetId}};
  assert.doesNotThrow(()=>assertAssetPredecessor(delivery,{[a.runId]:prior}));
  for(const changed of [{...prior,phase:'unresolved'},{...prior,receipt:{...prior.receipt,verified:false}},
    {...prior,receipt:{...prior.receipt,authorizationMode:'player-proof'}},{...prior,assignment:{...a,network:'signet'}},
    {...prior,receipt:{...prior.receipt,assetId:'ff'.repeat(34)}}])assert.throws(()=>assertAssetPredecessor(delivery,{[a.runId]:changed}));
  assert.throws(()=>assertAssetPredecessor(a,{'some-other-run':{assignment:{lineageId:a.lineageId}}}));
  const burn=assignment({runId:'server-burn-0001',step:'burn',assetId,predecessorRunId:delivery.runId});
  assert.doesNotThrow(()=>assertAssetPredecessor(burn,{[delivery.runId]:{...prior,assignment:delivery}}));
});

test('controller reconnects accept only the original identity or the exact step requirement',()=>{
  const a=assignment(),base={network:a.network,gameId:'stealth-and-steel'};
  for(const body of [{...base,profileId:a.gameProfileId},{...base,requirement:{purpose:'mint'}},{...base,requirement:{arkadeSats:1000}},base])assert.doesNotThrow(()=>assertAssetConnectionRequest(body,a));
  for(const body of [{...base,profileId:'d'.repeat(64)},{...base,profileId:a.gameProfileId,requirement:{purpose:'mint'}},
    {...base,requirement:{purpose:'boarding'}},{...base,network:'signet'},{...base,unknown:'value'},{...base,requirement:{purpose:'mint',excludedProfiles:[a.gameProfileId]}}])assert.throws(()=>assertAssetConnectionRequest(body,a));
  const delivery=assignment({step:'delivery',assetId,predecessorRunId:'previous-mint-0001'});
  assert.doesNotThrow(()=>assertAssetConnectionRequest({...base,requirement:{purpose:'asset',asset:{assetId,quantity:'1'}}},delivery));
  assert.throws(()=>assertAssetConnectionRequest({...base,requirement:{purpose:'asset',asset:{assetId,quantity:'2'}}},delivery));
});

test('returned selector metadata cannot switch pool slot, profile, network, protocol, key or runtime',()=>{
  const a=assignment(),body={protocol:SIGNER_PROTOCOL,gameId:'stealth-and-steel',runtime:'vercel',profileId:a.gameProfileId,publicKey:a.serverPublicKey,network:a.network,slot:'01',capabilities:['sign'],token:'synthetic-connect-token'};
  assert.doesNotThrow(()=>assertAssetConnectionResponse({status:200,text:JSON.stringify(body)},a));
  for(const patch of [{protocol:'other'},{runtime:'local'},{slot:'02'},{profileId:'f'.repeat(64)},{network:'signet'},{publicKey:'02'+'d'.repeat(64)},{capabilities:[]},{gameId:'other'},{token:''}])
    assert.throws(()=>assertAssetConnectionResponse({status:200,text:JSON.stringify({...body,...patch})},a));
});

test('controlled proxy CORS preflight is limited to the owned origin, POST and the mode-specific routes',()=>{
  const a=assignment({authorizationMode:'player-proof'}),headers={origin:'http://127.0.0.1:5174','access-control-request-method':'POST','access-control-request-headers':'authorization, content-type, x-bis-signing-grant'};
  assert.doesNotThrow(()=>assertAssetPreflight(headers,'payment/plan',a));
  for(const path of ['owner/plan','unreviewed','../connect'])assert.throws(()=>assertAssetPreflight(headers,path,a));
  assert.throws(()=>assertAssetPreflight({...headers,origin:'https://other.example'},'connect',a));
  assert.throws(()=>assertAssetPreflight({...headers,'access-control-request-method':'DELETE'},'connect',a));
  assert.throws(()=>assertAssetPreflight({...headers,'access-control-request-headers':'x-unreviewed'},'connect',a));
});

test('only the actual SDK transaction and the assigned signing scope enter authorization',()=>{
  const a=assignment(),tx=new Transaction();tx.addInput({txid:'11'.repeat(32),index:0});tx.addOutput({script:new Uint8Array([0x51]),amount:1000n});
  const raw={id:'request-1',operationId:'operation-1',network:a.network,profileId:a.gameProfileId,method:'sign',args:encodeSigningValue([tx,[0]])};
  assert.equal(assertAssetRequestEnvelope({request:raw},a).tx.id,tx.id);
  for(const patch of [{method:'signMessage'},{operationId:''},{profileId:a.playerProfileId},{network:'signet'},{args:encodeSigningValue(['not-a-transaction'])}])
    assert.throws(()=>assertAssetRequestEnvelope({request:{...raw,...patch}},a));
});

test('CLI without its exact private slot returns a sanitized refusal before reading an assignment file',()=>{
  const env={...process.env};delete env.BIS_SERVER_ACCEPTANCE_SLOT;delete env.BIS_SERVER_FINANCIAL_SLOT;delete env.BIS_ACCEPTANCE_OWNER_TOKEN;
  const result=spawnSync(process.execPath,['BIS/packages/bis-server/scripts/funded-workflow-assets.ts','run','missing-assignment.json','server-mint-0001'],{env,encoding:'utf8',timeout:20000,windowsHide:true});
  assert.equal(result.status,1);const lines=result.stdout.trim().split(/\r?\n/);assert.equal(lines.length,1);
  assert.equal(JSON.parse(lines[0]).reason,'guarded-asset-acceptance-incomplete');assert.equal(result.stderr,'');
});

test('real browser journal getters retain unresolved burn and require exact original delivery status',async()=>{
  const modules=['assets','burning','asset-delivery'];
  const bundled=await build({stdin:{contents:modules.map(name=>`export * from './BIS/packages/integration/src/client/state-layer-core/${name}.ts';`).join('\n'),resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm'});
  const server=createServer((request,response)=>{
    if(request.url==='/admin/'){response.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><html><head></head><body>Unfunded asset journal fixture</body></html>');return;}
    response.writeHead(200,{'Content-Type':'application/javascript'}).end(request.url==='/asset-journal.js'?bundled.outputFiles[0].text:"export * from '/asset-journal.js';");
  });
  let browser;
  try{
    await new Promise<void>(ready=>server.listen(0,'127.0.0.1',ready));browser=await chromium.launch({headless:true});const page=await browser.newPage();
    page.setDefaultTimeout(7000);const address=server.address();if(!address||typeof address==='string')throw Error('Isolated browser listener unavailable.');
    let remoteCalls=0;await page.route('https://**',route=>{remoteCalls++;return route.abort('blockedbyclient');});
    await page.goto(`http://127.0.0.1:${address.port}/admin/`,{waitUntil:'domcontentloaded'});
    const a=assignment(),deliveryOperation='fixture-delivery-0001',burnOperation='fixture-burn-0001',txid='33'.repeat(32);
    const recipient='tark1'+'q'.repeat(80),delivery=assetRequest('delivery',deliveryOperation,assetId,recipient),burn=assetRequest('burn',burnOperation,assetId);
    await page.evaluate(async input=>{
      const load=(path:string)=>import(/* @vite-ignore */path),module=await load('/asset-journal.js');
      module.writeAssetDeliveryRecord({version:1,id:input.delivery.operationId,profileId:input.profileId,network:'mutinynet',request:input.delivery,status:'pending',
        inputs:[{txid:'11'.repeat(32),vout:0}],inputAssets:[{assetId:input.assetId,quantity:'2'}],senderScript:'5120'+'aa'.repeat(32),recipientScript:'5120'+'bb'.repeat(32),sourceQuantity:'2',transactionId:input.txid});
      module.writeBurnRecord({version:1,id:input.burn.operationId,profileId:input.profileId,network:'mutinynet',request:input.burn,status:'pending',inputs:[{txid:'22'.repeat(32),vout:0}],transactionId:input.txid});
      // Controlled public-method seam tests dispatch and real journal updates.
      // It supplies no provider/signing capability or live confirmation claim.
      (globalThis as any).__serverAcceptance={game:{checkAssetDelivery:async(operationId:string)=>module.completeAssetDelivery(input.profileId,operationId,input.txid,'mutinynet')}};
    },{profileId:a.gameProfileId,assetId,delivery,burn,txid});
    const binding={assetId,transactionId:txid,profileId:a.gameProfileId,network:a.network};
    assert.equal((await checkBrowserAssetReceipt(page,{...binding,step:'delivery',operationId:deliveryOperation,expectedRequest:delivery})).status,'succeeded');
    await assert.rejects(checkBrowserAssetReceipt(page,{...binding,step:'delivery',operationId:deliveryOperation,transactionId:'44'.repeat(32),expectedRequest:delivery}),/unresolved/);
    await assert.rejects(checkBrowserAssetReceipt(page,{...binding,step:'burn',operationId:burnOperation,expectedRequest:burn}),/unresolved/);
    assert.equal(await page.evaluate(async profileId=>{const load=(path:string)=>import(/* @vite-ignore */path);return (await load('/asset-journal.js')).readBurnRecords(profileId,'mutinynet')[0].status;},a.gameProfileId),'pending');
    assert.equal(remoteCalls,0);
  }finally{await browser?.close();await new Promise<void>(ready=>server.close(()=>ready()));}
});
