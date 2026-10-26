import test from 'node:test';
import assert from 'node:assert/strict';
import {parseV4QualificationOptions,assertV4QualificationLease,assertB2Admission,assertB2CheckpointTiming,
  classifyV4DeadlineResponse,qualificationEligibility,runV4Qualification,assertV4QualificationFundingCoin,v4QualificationSourceValue} from './treasure-v4-qualification.ts';

// Pure safeguard tests. No protected Vault, actual wallet, provider or financial
// outcome is used. Timeline/control fixtures are explicit offline data.
const options=parseV4QualificationOptions(['b2','v4-case-a','registered-pair']);
function state(){return {accounts:[{label:'game',profileId:'a'.repeat(64),generation:1,phrase:'offline placeholder',grant:{active:true,networks:['mutinynet']}},
  {label:'player',profileId:'b'.repeat(64),generation:1,phrase:'offline placeholder',grant:{active:true,networks:['mutinynet']}}],
  pairs:[{label:'registered-pair',network:'mutinynet',player:'player',game:'game'}],operations:[] as {intent:{id:string;network:string;profileId:string;amountSats:number;feeSats:number|null;generation:number};state:string;createdAt:string;fingerprint:string}[]};}
test('the live runner refuses missing financial/execution/source leases before Vault initialization or network',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('Network is forbidden in offline safeguards');});
  await assert.rejects(runV4Qualification(options,{}));assert.equal(calls,0);
  assert.throws(()=>assertV4QualificationLease(options,{BIS_TREASURE_V4_FINANCIAL_SLOT:options.runId},'a'.repeat(64)));
  assert.throws(()=>assertV4QualificationLease(options,{BIS_TREASURE_V4_FINANCIAL_SLOT:options.runId,BIS_TREASURE_V4_EXECUTION_SLOT:options.runId,
    BIS_TREASURE_V4_APPROVED_SOURCE:'b'.repeat(64)},'a'.repeat(64)));
});
test('only named b1/b2 cases and exact original reconciliation are accepted; B1 requires a preceding positive control',()=>{
  for(const args of [['signet','id','pair'],['b2','../escape','pair'],['b2','case','pair','--retry'],['b1','case','pair']])assert.throws(()=>parseV4QualificationOptions(args));
  assert.equal(parseV4QualificationOptions(['b1','case','pair','--reconcile']).reconcile,true);
  assert.equal(parseV4QualificationOptions(['b1','case','pair','--control','prior-b2']).controlRun,'prior-b2');
});
test('B1 refuses before funding or credential access while the supported endpoint redacts all VM failures',async t=>{
  let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;throw Error('No provider calls allowed');});
  const result=await runV4Qualification(parseV4QualificationOptions(['b1','blocked-b1','registered-pair','--control','prior-b2']),{});
  assert.equal(result.outcome,'blocked-before-funding');assert.equal('reason' in result?result.reason:undefined,'upstream-v0.0.9-redacts-vm-rejection');
  assert.equal('financialActions' in result?result.financialActions:undefined,0);assert.equal('credentialReads' in result?result.credentialReads:undefined,0);assert.equal(requests,0);
});
test('emulator-only approval and an operator response at/after expiry cannot qualify B2 admission',()=>{
  assertB2Admission(90000,10000,89999);
  for(const admitted of [90000,90001,NaN,undefined])assert.throws(()=>assertB2Admission(90000,10000,admitted as number));
  assert.throws(()=>assertB2Admission(90000,20000,10000));
});
test('Player checkpoint signing must start after expiry, not merely finish after it',()=>{
  assertB2CheckpointTiming(90000,89999,90001,90002);
  for(const requested of [89999,90000,NaN])assert.throws(()=>assertB2CheckpointTiming(90000,89000,requested,90002));
  assert.throws(()=>assertB2CheckpointTiming(90000,90000,90001,90002));
  assert.throws(()=>assertB2CheckpointTiming(90000,89000,90002,90001));
});
test('generic grpc13, bad proofs, malformed responses and availability errors are never timing-rule proof',()=>{
  for(const [status,body] of [[500,'{"code":13,"message":"internal error"}'],[400,'{"message":"invalid actor signature"}'],
    [429,'{"code":"CLAIM_EXPIRED"}'],[200,'{"code":"CLAIM_EXPIRED"}'],[500,'CHECKTIMEVERIFY failed'],[500,'{"request":"CHECKTIMEVERIFY failed"}']] as const)
    assert.equal(classifyV4DeadlineResponse(status,body),status===500&&body==='{"code":13,"message":"internal error"}'?'upstream-redacted-rejection':'unattributed-response');
  assert.equal(classifyV4DeadlineResponse(422,'{"code":"TREASURE_CLAIM_EXPIRED"}'),'unattributed-response');
  assert.equal(classifyV4DeadlineResponse(500,'{"code":13,"message":"CHECKTIMEVERIFY failed"}'),'unattributed-response');
  assert.equal(classifyV4DeadlineResponse(400,'{"code":3,"message":"invalid checkpoint tx"}'),'parser-rejection');
});
test('funded V4 input must be explicitly unspent, settled and timestamp-expiring beyond the offer deadline',()=>{
  const point={txid:'a'.repeat(64),vout:0},coin={...point,value:1000,script:'5120'+'b'.repeat(64),isSpent:false,isSwept:false,isUnrolled:false,isPreconfirmed:false,
    spentBy:'',expiresAt:new Date(100001),assets:[]};
  assertV4QualificationFundingCoin(coin,point,coin.script,90000,80000);
  for(const change of [{isSpent:true},{isSpent:undefined},{isSwept:true},{isUnrolled:true},{isPreconfirmed:true},{spentBy:'c'.repeat(64)},
    {expiresAt:new Date(90000)},{expiresAt:undefined},{expiresAtHeight:1000},{assets:[{assetId:'x',amount:1}]},{value:999}])
    assert.throws(()=>assertV4QualificationFundingCoin({...coin,...change},point,coin.script,90000,80000));
});
test('existing exact-principal funding is eligible while dust change and excessive inputs are refused',()=>{
  for(const value of [1000,1330,5000])assert.equal(v4QualificationSourceValue(value),true);
  for(const value of [999,1001,1329,5001,1000.1,NaN])assert.equal(v4QualificationSourceValue(value),false);
});
test('registered grant and unrelated pending-account checks precede new qualification allocation',()=>{
  const now=Date.now(),snapshot=state();assert.equal(qualificationEligibility(snapshot,options,now).game.label,'game');
  snapshot.accounts[0].grant.active=false;assert.throws(()=>qualificationEligibility(snapshot,options,now));snapshot.accounts[0].grant.active=true;
  snapshot.operations.push({intent:{id:'old-original',network:'mutinynet',profileId:snapshot.accounts[0].profileId,generation:1,amountSats:1000,feeSats:0},
    state:'unknown',createdAt:new Date(now).toISOString(),fingerprint:'offline'});
  assert.throws(()=>qualificationEligibility(snapshot,options,now));
});
test('rolling network budget counts completed, unknown and reserved exposure including fees',()=>{
  const now=Date.now(),snapshot=state();snapshot.operations.push({intent:{id:'unrelated-cost',network:'mutinynet',profileId:'c'.repeat(64),generation:1,amountSats:8000,feeSats:1},
    state:'settled',createdAt:new Date(now).toISOString(),fingerprint:'offline'});
  assert.throws(()=>qualificationEligibility(snapshot,options,now));
  snapshot.operations[0].intent.feeSats=null;assert.throws(()=>qualificationEligibility(snapshot,options,now));
});
