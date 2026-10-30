import test from 'node:test';
import {acceptanceRuntimeSignerModule} from '../scripts/funded-workflow-live.ts';
import assert from 'node:assert/strict';

test('controlled browser configures the exact runtime signer module after a Vite update',()=>{
 const path='/BIS/packages/integration/src/client/wallet-layer-arkade/server-wallet.ts';
 for(const suffix of ['', '?t=1793366132724'])assert.equal(acceptanceRuntimeSignerModule(`import {remoteSigningIdentity} from "${path+suffix}";`),path+suffix);
 for(const source of ['',`import {} from "https://other.test${path}";`,`import {} from "${path}?token=private";`,`import {} from "${path}?t=1&extra=1";`,`import {} from "${path}"; import {} from "${path}?t=1";`])assert.throws(()=>acceptanceRuntimeSignerModule(source));
});
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ArkAddress,SingleKey,Transaction} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {encodeSigningValue} from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {validatePaymentAssignment,assertExecutionAuthority,assertProtectedSessionSources,assignmentScope,assertAtomicPaymentBudget,inspectPaymentPlan,inspectOriginalSubmission,verifyPaymentReceipt,acceptanceBrowserEndpoint,acceptanceDocumentPolicy,acceptanceProxyHeaders,type PaymentAssignment} from '../scripts/funded-workflow-live.ts';
import {assertPublicEligibilityReference} from '../scripts/tests/funded-workflow-preflight.ts';

const sourceHash='a'.repeat(64),fingerprint='b'.repeat(64);
const paths=['BIS/packages/bis-server/scripts/funded-workflow-live.ts','BIS/packages/bis-server/scripts/protected-browser-journal.ts','BIS/packages/bis-server/scripts/tests/funded-workflow-preflight.ts'];

test('controlled Node transport preserves real signing authority without spoofing browser origin or cookies',()=>{
  assert.deepEqual(acceptanceProxyHeaders({origin:'http://127.0.0.1:5174',authorization:'Bearer fixture-token','x-bis-signing-grant':'fixture-grant',cookie:'unrelated-cookie'}),
    {'Content-Type':'application/json',Authorization:'Bearer fixture-token','X-BIS-Signing-Grant':'fixture-grant'});
});

test('operation-scoped protection requires every reviewed helper and permits only its exact PowerShell paths',async()=>{
 const a=await assignment(),required=['BIS/scripts/test-wallets/protector-session.ts','BIS/scripts/test-wallets/protector-worker.ps1','BIS/scripts/test-wallets/protector.ps1'];
 assert.throws(()=>assertProtectedSessionSources(a),/protector sources/);
 const sourceHashes={...a.sourceHashes,...Object.fromEntries(required.map(path=>[path,sourceHash]))};
 assert.doesNotThrow(()=>validatePaymentAssignment({...a,sourceHashes}));assert.doesNotThrow(()=>assertProtectedSessionSources({sourceHashes}));
 for(const path of required){const missing={...sourceHashes};delete missing[path];assert.throws(()=>assertProtectedSessionSources({sourceHashes:missing}));}
 assert.throws(()=>validatePaymentAssignment({...a,sourceHashes:{...sourceHashes,'BIS/scripts/test-wallets/unreviewed.ps1':sourceHash}}),/source path/);
});

test('public eligibility binds the real readonly key without accepting a mnemonic or replacement source',async()=>{
  const a=await assignment(),reference={profileId:a.gameProfileId,network:a.network,server:{endpoint:a.endpoint,publicKey:a.serverPublicKey,gameId:'stealth-and-steel'}};
  assert.doesNotThrow(()=>assertPublicEligibilityReference(reference,a.candidateId,a.gameProfileId));
  for(const patch of [{phrase:'must not be loaded'},{network:'mutinynet'},{profileId:'d'.repeat(64)},
    {server:{...reference.server,gameId:'other'}},{server:{...reference.server,endpoint:a.endpoint+'?private=forbidden'}},
    {server:{...reference.server,publicKey:'03'+'1'.repeat(64)}}])
    assert.throws(()=>assertPublicEligibilityReference({...reference,...patch} as any,a.candidateId,a.gameProfileId));
});
test('public browser endpoint is exactly reviewed HTTPS and its CSP change is confined to that origin',()=>{
  const endpoint='https://reviewed-example.vercel.app/api/bis/',binding={endpoint};
  assert.equal(acceptanceBrowserEndpoint(binding),'/api/bis/');
  assert.equal(acceptanceBrowserEndpoint(binding,endpoint),endpoint);
  assert.throws(()=>acceptanceBrowserEndpoint(binding,'https://different.vercel.app/api/bis/'));
  assert.throws(()=>acceptanceBrowserEndpoint({endpoint:'http://127.0.0.1:5174/api/bis/'},'http://127.0.0.1:5174/api/bis/'));
  const policy="default-src 'none'; script-src 'self'; connect-src 'self' https://mutinynet.arkade.sh; object-src 'none'; frame-ancestors 'self'";
  const changed=acceptanceDocumentPolicy(policy,endpoint);
  assert.equal(changed,policy.replace("connect-src 'self' https://mutinynet.arkade.sh","connect-src 'self' https://mutinynet.arkade.sh https://reviewed-example.vercel.app"));
  assert.equal(acceptanceDocumentPolicy(changed,endpoint),changed);
  assert.equal(acceptanceDocumentPolicy(policy),policy);
  assert.throws(()=>acceptanceDocumentPolicy("default-src 'none'",endpoint));
  assert.throws(()=>acceptanceDocumentPolicy(policy+'; connect-src *',endpoint));
});
test('proved zero asset exposure needs an explicit opt-in and retains every historical budget charge',()=>{
  const now=Date.now(),intent={id:'zero-asset-step',network:'mutinynet',amountSats:0,feeSats:0};
  assert.throws(()=>assertAtomicPaymentBudget([],intent,0,now));
  assert.doesNotThrow(()=>assertAtomicPaymentBudget([],intent,0,now,{allowZeroExposure:true}));
  const prior={intent:{id:'prior-real-step',network:'mutinynet',amountSats:9999,feeSats:0},createdAt:new Date(now).toISOString()};
  assert.doesNotThrow(()=>assertAtomicPaymentBudget([prior],intent,1,now,{allowZeroExposure:true}));
  assert.throws(()=>assertAtomicPaymentBudget([prior],intent,2,now,{allowZeroExposure:true}));
  assert.throws(()=>assertAtomicPaymentBudget([],{...intent,feeSats:NaN},0,now,{allowZeroExposure:true}));
  assert.throws(()=>assertAtomicPaymentBudget([],{...intent,amountSats:-1},0,now,{allowZeroExposure:true}));
});
async function assignment():Promise<PaymentAssignment>{
  const key=hex.encode(await SingleKey.fromHex('1'.padStart(64,'0')).compressedPublicKey());
  return {runId:'server-pay-0001',network:'signet',pair:'test-pair',candidateId:'signet:01',playerProfileId:'c'.repeat(64),gameProfileId:createHash('sha256').update(Buffer.from(key,'hex')).digest('hex'),
    serverPublicKey:key,endpoint:'https://reviewed-example.vercel.app/api/bis/',amountSats:1000,feeSats:0,sourceHashes:Object.fromEntries(paths.map(path=>[path,sourceHash]))};
}

test('assignment refuses unknown secrets, arbitrary destinations and unreviewed executable sources',async()=>{
  const valid=await assignment();assert.doesNotThrow(()=>validatePaymentAssignment(valid));
  for(const patch of [{phrase:'must-not-be-accepted'},{endpoint:'http://localhost:5174/api/bis/'},{endpoint:'https://attacker.example/api/bis/'},
    {endpoint:'https://reviewed-example.vercel.app/api/bis/?secret=value'},{feeSats:1},{amountSats:5001},{sourceHashes:{[paths[0]]:sourceHash}}])
    assert.throws(()=>validatePaymentAssignment({...valid,...patch}));
});

test('runtime, exact command, private slot and financial approval fail before execution',async()=>{
  const a=await assignment(),slot={BIS_SERVER_ACCEPTANCE_SLOT:a.runId};
  assert.doesNotThrow(()=>assertExecutionAuthority(a,'prepare',a.runId,slot,'24.21.0'));
  assert.throws(()=>assertExecutionAuthority(a,'prepare',a.runId,slot,'26.0.0'),/Node 24/);
  assert.throws(()=>assertExecutionAuthority(a,'prepare','another-run',slot,'24.21.0'),/command/);
  assert.throws(()=>assertExecutionAuthority(a,'run',a.runId,slot,'24.21.0'),/financial slot/);
  const approved={...a,approvedOutpoints:[`${'d'.repeat(64)}:0`],approvedFingerprint:fingerprint};
  assert.doesNotThrow(()=>assertExecutionAuthority(approved,'run',a.runId,{...slot,BIS_SERVER_FINANCIAL_SLOT:a.runId},'24.21.0'));
  assert.throws(()=>assertExecutionAuthority(approved,'run',a.runId,{...slot,BIS_SERVER_FINANCIAL_SLOT:'wrong'},'24.21.0'),/financial slot/);
});

test('approval updates retain the original source while endpoint or identity changes do not',async()=>{
  const a=await assignment();
  assert.equal(assignmentScope(a),assignmentScope({...a,approvedOutpoints:[`${'d'.repeat(64)}:0`],approvedFingerprint:fingerprint}));
  assert.notEqual(assignmentScope(a),assignmentScope({...a,endpoint:'https://replacement.vercel.app/api/bis/'}));
  assert.notEqual(assignmentScope(a),assignmentScope({...a,playerProfileId:'d'.repeat(64)}));
});

test('atomic insertion guard includes current Vault and unmatched browser exposure without truncating large history',()=>{
  const now=100000000,intent={id:'new-pay',network:'signet',amountSats:3000,feeSats:0};
  const records=[{intent:{id:'old',network:'signet',amountSats:6000,feeSats:0},createdAt:new Date(now-1000).toISOString(),state:'unknown'}];
  assert.doesNotThrow(()=>assertAtomicPaymentBudget(records,intent,1000,now));
  assert.throws(()=>assertAtomicPaymentBudget(records,{...intent,amountSats:4000},1000,now),/rolling/);
  assert.doesNotThrow(()=>assertAtomicPaymentBudget([{...records[0],intent:{...records[0].intent,network:'mutinynet'}}],intent,0,now));
  assert.throws(()=>assertAtomicPaymentBudget([],{...intent,amountSats:5001},0,now),/operation/);
  assert.throws(()=>assertAtomicPaymentBudget([],{...intent,amountSats:-1,feeSats:2},0,now),/operation/);
  assert.throws(()=>assertAtomicPaymentBudget([{...records[0],intent:{...records[0].intent,amountSats:500,feeSats:null}}],{...intent,amountSats:5000},0,now),/rolling/);
});

async function wireFixture(change=1000){
  // Unfunded deterministic wire objects, not signed transactions or live proof.
  const keys=await Promise.all([1,2,3].map(async n=>await SingleKey.fromHex(String(n).padStart(64,'0')).xOnlyPublicKey()));
  const recipient=new ArkAddress(keys[0],keys[1],'tark').encode(),gameAddress=new ArkAddress(keys[0],keys[2],'tark').encode();
  const source={txid:'44'.repeat(32),vout:2},checkpoint=new Transaction();
  checkpoint.addInput({txid:source.txid,index:source.vout});checkpoint.addOutput({script:ArkAddress.decode(gameAddress).pkScript,amount:2000n});
  const payment=new Transaction();payment.addInput({txid:checkpoint.id,index:0});
  payment.addOutput({script:ArkAddress.decode(recipient).pkScript,amount:1000n});payment.addOutput({script:ArkAddress.decode(gameAddress).pkScript,amount:BigInt(change)});
  const assetId='11'.repeat(34),vtxos:any[]=[
    {...source,value:2000,isSpent:true,spentBy:checkpoint.id,script:hex.encode(ArkAddress.decode(gameAddress).pkScript),assets:[{assetId,amount:2n}]},
    {txid:payment.id,vout:0,value:1000,script:hex.encode(ArkAddress.decode(recipient).pkScript),assets:[]},
    {txid:payment.id,vout:1,value:change,script:hex.encode(ArkAddress.decode(gameAddress).pkScript),assets:[{assetId,amount:2n}]},
  ];
  const indexer={getVtxos:async()=>({vtxos}),getVirtualTxs:async()=>({txs:[payment,checkpoint].map(tx=>base64.encode(tx.toPSBT()))})};
  return {source,checkpoint,payment,recipient,gameAddress,vtxos,indexer,assetId,
    input:{transactionId:payment.id,outpoints:[`${source.txid}:${source.vout}`],recipient,gameAddress,amountSats:1000}};
}

test('remote authorization binds original VTXOs, recipient, amount and actual PSBT',async()=>{
  const f=await wireFixture(),a=await assignment();
  const payload={request:{network:a.network,profileId:a.gameProfileId,method:'sign',args:encodeSigningValue([f.payment,[0]])},outpoints:[f.source]};
  const quote={outpoints:f.input.outpoints};
  assert.equal(inspectPaymentPlan(payload,a,quote,f.recipient),f.payment.id);
  assert.throws(()=>inspectPaymentPlan({...payload,outpoints:[{...f.source,vout:3}]},a,quote,f.recipient),/plan changed/);
  assert.throws(()=>inspectPaymentPlan(payload,{...a,amountSats:2000},quote,f.recipient),/destination/);
  assert.throws(()=>inspectPaymentPlan(payload,a,quote,f.gameAddress),/destination/);
});

test('original submission checks checkpoint ancestry instead of trusting a claimed transaction id',async()=>{
  const f=await wireFixture(),a={...await assignment(),approvedOutpoints:f.input.outpoints};
  const body={signedArkTx:base64.encode(f.payment.toPSBT()),checkpointTxs:[base64.encode(f.checkpoint.toPSBT())]};
  assert.deepEqual(inspectOriginalSubmission(body,a,f.payment.id).checkpointIds,[f.checkpoint.id]);
  assert.throws(()=>inspectOriginalSubmission(body,{...a,approvedOutpoints:[`${'ff'.repeat(32)}:2`]},f.payment.id),/inputs changed/);
  assert.throws(()=>inspectOriginalSubmission(body,a,'f'.repeat(64)),/transaction changed/);
});

test('receipt needs fresh indexed inputs, wire ancestry, exact payout and conserved asset change',async()=>{
  const f=await wireFixture(),receipt=await verifyPaymentReceipt(f.indexer,f.input);
  assert.equal(receipt.amountSats,1000);assert.equal(receipt.feeSats,0);assert.equal(receipt.assetsPreserved,true);
  f.vtxos[2].assets=[{assetId:f.assetId,amount:1n}];
  await assert.rejects(verifyPaymentReceipt(f.indexer,f.input),/change or assets/);
});

test('same-value balance or index entries cannot replace original wire and zero-fee evidence',async()=>{
  const f=await wireFixture();
  await assert.rejects(verifyPaymentReceipt({...f.indexer,getVirtualTxs:async()=>({txs:[]})},f.input),/wire/);
  const fee=await wireFixture(900);await assert.rejects(verifyPaymentReceipt(fee.indexer,fee.input),/fee or amount/);
  f.vtxos[0].spentBy='1'.repeat(64);await assert.rejects(verifyPaymentReceipt(f.indexer,f.input),/ancestry/);
});

test('CLI without its exact private slot emits one sanitized refusal without reading the supplied file',()=>{
  const result=spawnSync(process.execPath,['BIS/packages/bis-server/scripts/funded-workflow-live.ts','run','does-not-exist-private-file.json','server-pay-0001'],
    {encoding:'utf8',timeout:20000,env:{...process.env,BIS_SERVER_ACCEPTANCE_SLOT:'',BIS_SERVER_FINANCIAL_SLOT:''}});
  assert.equal(result.status,1);assert.equal(result.error,undefined);
  const rows=result.stdout.trim().split(/\r?\n/).map(line=>JSON.parse(line));assert.equal(rows.length,1);
  assert.equal(rows[0].reason,'guarded-payment-acceptance-incomplete');
  assert.ok(!result.stdout.includes('does-not-exist-private-file'));
});
