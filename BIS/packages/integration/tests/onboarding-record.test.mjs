import test from 'node:test';
import assert from 'node:assert/strict';
import {onboardingKey, readOnboardingRecord, writeOnboardingRecord} from '../src/core/onboarding-record.ts';

const scope={profileId:'player:one',network:'signet',operator:'https://signet.arkade.sh'};
const coin={txid:'a'.repeat(64),vout:0,value:12001};
const script='5120'+'b'.repeat(64);
function record(){return {version:1,id:'parent-1',...scope,revision:1,createdAt:100,status:'pending',allocationPercent:50,
  plan:{inputs:[coin],totalSats:12001,targetSats:6000,returnSats:6001,bitcoinScript:script,arkadeScript:script},
  boarding:{phase:'prepared',attemptId:'board-1',inputs:[coin],outputs:[{script,value:12001,network:'arkade'}]},
  returning:{phase:'unprepared',inputs:[],outputs:[{script,value:6001,network:'bitcoin'},{script,value:6000,network:'arkade'}]}};}
function storage(){const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};}

test('onboarding journal roundtrips exact odd-sat plan without touching manual records',()=>{
  const db=storage();db.setItem('bis-signet-boarding-operation-v1:player','manual');
  const r=record();writeOnboardingRecord(scope,r,0,db);
  assert.deepEqual(readOnboardingRecord(scope,db),r);
  assert.equal(db.getItem('bis-signet-boarding-operation-v1:player'),'manual');
  assert.equal(r.plan.targetSats+r.plan.returnSats,r.plan.totalSats);
});
test('journal key and contents are scoped to account network and operator',()=>{
  const db=storage();writeOnboardingRecord(scope,record(),0,db);
  for(const changed of [{...scope,profileId:'player:two'},{...scope,operator:'https://another.example'}]){
    assert.notEqual(onboardingKey(scope),onboardingKey(changed));
    assert.equal(readOnboardingRecord(changed,db),undefined);
    db.setItem(onboardingKey(changed),JSON.stringify(record()));
    assert.throws(()=>readOnboardingRecord(changed,db),/recovery/);
  }
  assert.throws(()=>onboardingKey({...scope,network:'bitcoin'}),/scope/);
});
test('corrupt journals cannot appear as missing or release their funds',()=>{
  const db=storage();
  for(const value of ['{','null',JSON.stringify({...record(),version:2}),JSON.stringify({...record(),plan:{...record().plan,targetSats:6001}})]){
    db.setItem(onboardingKey(scope),value);
    assert.throws(()=>readOnboardingRecord(scope,db),/recovery/);
    assert.equal(db.getItem(onboardingKey(scope)),value);
  }
});
test('unknown fields and invalid public values cannot enter the journal',()=>{
  const db=storage();
  const invalid=[{...record(),phrase:'PRIVATE_SENTINEL'},
    {...record(),plan:{...record().plan,inputs:[coin,coin]}},
    {...record(),boarding:{...record().boarding,phase:'registered'}},
    {...record(),boarding:{...record().boarding,inputs:[{...coin,value:1}]}},
    {...record(),boarding:{...record().boarding,outputs:[{script,value:1,network:'arkade'}]}}];
  for(const r of invalid)assert.throws(()=>writeOnboardingRecord(scope,r,0,db),/recovery/);
  assert.equal(db.values.size,0);
});
test('revision conflicts and failed persistence cannot publish a new checkpoint',()=>{
  const db=storage();const r=record();writeOnboardingRecord(scope,r,0,db);
  assert.throws(()=>writeOnboardingRecord(scope,{...r,revision:2},0,db),/changed/);
  assert.throws(()=>writeOnboardingRecord(scope,{...r,revision:3},1,db),/revision/);
  assert.throws(()=>writeOnboardingRecord(scope,{...r,revision:2},1,{getItem:db.getItem,setItem:()=>{}}),/saved/);
  assert.equal(readOnboardingRecord(scope,db).revision,1);
});
test('completed parent needs verified final leg and exact owned target outputs',()=>{
  const db=storage();const r=record();
  assert.throws(()=>writeOnboardingRecord(scope,{...r,status:'complete',completedAt:200},0,db),/recovery/);
  const receipt={txid:'c'.repeat(64),vout:0,value:12001};
  const complete={...r,status:'complete',completedAt:200,
    boarding:{...r.boarding,phase:'receipt-verified',commitmentTxid:'d'.repeat(64),receipts:[receipt]},
    returning:{...r.returning,phase:'receipt-verified',attemptId:'return-1',inputs:[receipt],commitmentTxid:'e'.repeat(64),receipts:[{txid:'f'.repeat(64),vout:0,value:6000}]}};
  writeOnboardingRecord(scope,complete,0,db);
  assert.deepEqual(readOnboardingRecord(scope,db),complete);
});
