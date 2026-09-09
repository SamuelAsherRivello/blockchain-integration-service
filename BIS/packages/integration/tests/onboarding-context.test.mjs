import test from 'node:test';import assert from 'node:assert/strict';
import {createContext,createBisAdminContext} from '../src/core/context.ts';
import {writeOnboardingRecord} from '../src/core/onboarding-record.ts';
import {scope,facts,draft,storage as browserStorage,flush} from './onboarding-fixture.mjs';
test('activation starts onboarding without navigation; page changes preserve the worker; disposal aborts it',async()=>{
 browserStorage();const account={phrase:'unused-placeholder',profileId:scope.profileId};let starts=0,reads=0,signal;
 const f=facts();f.snapshot.boarding=[];
 const args=Array(17).fill(undefined);args[0]={load:async()=>({account,generation:0}),subscribe:()=>()=>{}};args[2]=async()=>account.profileId;args[4]=async()=>({availableSats:0,totalSats:0,bitcoinSats:0,arkadeSats:0});args[6]=async()=>({bitcoinAddress:'tb1-test',arkadeAddress:'tark-test'});args[7]=async()=>{};args[9]={list:async()=>({status:'ready',assets:[]})};args[16]=()=>{starts++;return {inspect:async(_,s)=>{signal=s;reads++;return f;},submit:async()=>assert.fail('no funding')};};
 const context=createContext(...args);await context.ready();await flush();assert.equal(context.getState().view,'empty');assert.equal(context.getState().onboarding.status,'start');assert.equal(reads,1);
 context.openAccountDialog();context.openAccountDetails();context.openAccountOnboarding();await flush();assert.equal(context.getState().accountOnboarding,true);context.closeAccount();assert.equal(context.getState().accountDetails,true);assert.equal(context.getState().accountOnboarding,false);assert.equal(starts,1);context.dispose();assert.ok(signal.aborted);
});
test('Admin Reset cannot clear a pending onboarding parent',async()=>{
 browserStorage();writeOnboardingRecord(scope,draft(),0);let resets=0;const account={phrase:'unused-placeholder',profileId:scope.profileId};
 const context=createContext({load:async()=>({account,generation:0}),subscribe:()=>()=>{},reset:async()=>{resets++;}},undefined,async()=>account.profileId);
 await context.ready();await assert.rejects(createBisAdminContext(context).resetClient(),/Onboarding is unresolved/);assert.equal(resets,0);assert.ok(context.getState().hasProfile);context.dispose();
});
