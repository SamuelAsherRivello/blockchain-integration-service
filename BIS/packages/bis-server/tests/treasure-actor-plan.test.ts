import test from 'node:test';
import assert from 'node:assert/strict';
import {createTreasureActorPlanAuthorization,type TreasureActorBinding} from '../src/server/treasure-actor-plan.ts';
import type {DerivedTreasureGameActorAuthorization} from '../src/server/treasure-actor-authorization.ts';

const binding:TreasureActorBinding={audience:'https://bis.example',gameId:'stealth-and-steel',network:'mutinynet',profileId:'a'.repeat(64),
  operationId:'treasure-operation',connectionId:'123e4567-e89b-12d3-a456-426614174000',playerPublicKey:`03${'c'.repeat(64)}`,authority:'public'};
const derived=(branch:'reject'|'cancel'|'refund',observedAtMs:number,deadlineMs=200_000):DerivedTreasureGameActorAuthorization=>({
  artifactVersion:4,branch,operationId:binding.operationId,gamePublicKey:`02${'b'.repeat(64)}`,funding:{txid:'c'.repeat(64),vout:0},
  checkpointId:'d'.repeat(64),templateRootId:'e'.repeat(64),message:new Uint8Array(32).fill(9),observedAtMs,deadlineMs,
});
const digest='f'.repeat(64),secret='treasure-actor-plan-test-secret-'.repeat(2);

test('HMAC actor plan and grant bind authority, signer, operation, message, request and connection',()=>{
  const authorization=createTreasureActorPlanAuthorization(secret,()=>100_000),candidate=derived('reject',99_000);
  const plan=authorization.plan(binding,digest,candidate),grant=authorization.authorize(plan,binding,digest,candidate);
  assert.equal(authorization.verify(plan,grant,binding,digest,candidate).message,Buffer.from(candidate.message).toString('hex'));
  assert.throws(()=>authorization.verify(plan,grant,{...binding,authority:'owner'},digest,candidate));
  assert.throws(()=>authorization.verify(plan,grant,{...binding,connectionId:'123e4567-e89b-12d3-a456-426614174001'},digest,candidate));
  assert.throws(()=>authorization.verify(plan,grant,binding,'0'.repeat(64),candidate));
  assert.throws(()=>authorization.verify(plan,grant,binding,digest,{...candidate,gamePublicKey:`03${'c'.repeat(64)}`}));
  const owner=createTreasureActorPlanAuthorization(secret,()=>100_000);
  assert.throws(()=>owner.authorize(plan,{...binding,authority:'owner'},digest,candidate));
});

test('short actor plans enforce deadline policy without inventing Player proof for Refund',()=>{
  const now=200_000,authorization=createTreasureActorPlanAuthorization(secret,()=>now);
  assert.throws(()=>authorization.plan(binding,digest,derived('reject',199_999,now)));
  assert.throws(()=>authorization.plan(binding,digest,derived('cancel',now)));
  const refund=derived('refund',now,190_000),plan=authorization.plan(binding,digest,refund);
  assert.equal(typeof plan,'string');
  assert.throws(()=>authorization.plan({...binding,audience:'http://bis.example'},digest,derived('reject',99_000)));
});

test('expired plan and grant cannot authorize new actor signing',()=>{
  let now=100_000;const authorization=createTreasureActorPlanAuthorization(secret,()=>now),candidate=derived('reject',99_000);
  const plan=authorization.plan(binding,digest,candidate),grant=authorization.authorize(plan,binding,digest,candidate);
  now+=60_001;
  assert.throws(()=>authorization.verify(plan,grant,binding,digest,candidate));
});
