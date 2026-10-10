import test from 'node:test';import assert from 'node:assert/strict';
import {createContextWithDependencies,createBisAdminContext} from '../../src/client/state-layer-core/context.ts';
import {createArkadeContextDependencies} from '../../src/client/wallet-layer-arkade/context-dependencies.ts';
import {writeOnboardingRecord} from '../../src/client/state-layer-core/onboarding-record.ts';
import {scope,facts,draft,storage as browserStorage,flush} from './onboarding-fixture.mjs';
test('activation starts onboarding without navigation; page changes preserve the worker; disposal aborts it',async()=>{
 browserStorage();const account={phrase:'unused-placeholder',profileId:scope.profileId};let starts=0,reads=0,signal;
 const f=facts();f.snapshot.boarding=[];
 const args=Array(17).fill(undefined);args[0]={load:async()=>({account,generation:0}),subscribe:()=>()=>{}};args[2]=async()=>account.profileId;args[4]=async()=>({availableSats:0,totalSats:0,bitcoinSats:0,arkadeSats:0});args[6]=async()=>({bitcoinAddress:'tb1-test',arkadeAddress:'tark-test'});args[7]=async()=>{};args[9]={list:async()=>({status:'ready',assets:[]})};args[16]=()=>{starts++;return {inspect:async(_,s)=>{signal=s;reads++;return f;},submit:async()=>assert.fail('no funding')};};
 const context=createContextWithDependencies(args[0],createArkadeContextDependencies({identifyAccount:args[2],readBalance:args[4],readAddresses:args[6],observeActivity:args[7],assets:args[9],onboardingFactory:args[16]}));await context.readyAsync();await flush();assert.equal(context.getState().view,'empty');assert.equal(context.getState().onboarding.status,'start');assert.equal(reads,1);
 context.openAccountDialog();context.openAccountDetails();context.openAccountOnboarding();await flush();assert.equal(context.getState().accountOnboarding,true);context.closeAccount();assert.equal(context.getState().accountDetails,true);assert.equal(context.getState().accountOnboarding,false);assert.equal(starts,1);context.dispose();assert.ok(signal.aborted);
});
test('a legacy Mutinynet account passes its selected network to onboarding',async()=>{
 browserStorage();const account={phrase:'unused-placeholder',profileId:scope.profileId};let adapterAccount;
 const f=facts();f.snapshot.boarding=[];
 const args=Array(17).fill(undefined);args[0]={load:async()=>({account,generation:0}),subscribe:()=>()=>{}};args[2]=async()=>account.profileId;args[4]=async()=>({availableSats:0,totalSats:0,bitcoinSats:0,arkadeSats:0});args[6]=async()=>({bitcoinAddress:'tb1-test',arkadeAddress:'tark-test'});args[9]={list:async()=>({status:'ready',assets:[]})};args[13]={getNetwork:()=> 'mutinynet'};args[16]=saved=>{adapterAccount=saved;return {inspect:async()=>f,submit:async()=>assert.fail('no funding')};};
 const context=createContextWithDependencies(args[0],createArkadeContextDependencies({identifyAccount:args[2],readBalance:args[4],readAddresses:args[6],assets:args[9],onboardingFactory:args[16]}),args[13]);await context.readyAsync();await flush();assert.equal(adapterAccount.network,'mutinynet');context.dispose();
});
test('Onboarding reads the active Arkade balance as well as the boarding address',async()=>{
 browserStorage();const account={phrase:'unused-placeholder',profileId:scope.profileId};let balanceReads=0;
 const f=facts();f.snapshot.boarding=[];
 const args=Array(17).fill(undefined);args[0]={load:async()=>({account,generation:0}),subscribe:()=>()=>{}};args[2]=async()=>account.profileId;args[4]=async()=>{balanceReads++;return {availableSats:100000,totalSats:100000,bitcoinSats:0,arkadeSats:100000};};args[6]=async()=>({bitcoinAddress:'tb1-test',arkadeAddress:'tark-test'});args[9]={list:async()=>({status:'ready',assets:[]})};args[16]=()=>({inspect:async()=>f,submit:async()=>assert.fail('no funding')});
 const context=createContextWithDependencies(args[0],createArkadeContextDependencies({identifyAccount:args[2],readBalance:args[4],readAddresses:args[6],assets:args[9],onboardingFactory:args[16]}));await context.readyAsync();await flush();context.openAccountDialog();context.openAccountOnboarding();await flush();
 assert.equal(balanceReads,1);assert.deepEqual(context.getState().balance,{status:'ready',availableSats:100000,totalSats:100000,bitcoinSats:0,arkadeSats:100000});assert.equal(context.getState().addresses.status,'ready');context.dispose();
});
test('Admin Reset cannot clear a pending onboarding parent',async()=>{
 browserStorage();writeOnboardingRecord(scope,draft(),0);let resets=0;const account={phrase:'unused-placeholder',profileId:scope.profileId};
 const context=createContextWithDependencies({load:async()=>({account,generation:0}),subscribe:()=>()=>{},reset:async()=>{resets++;}},createArkadeContextDependencies({identifyAccount:async()=>account.profileId}));
 await context.readyAsync();await assert.rejects(createBisAdminContext(context).resetClient(),/Onboarding is unresolved/);assert.equal(resets,0);assert.ok(context.getState().hasProfile);context.dispose();
});
