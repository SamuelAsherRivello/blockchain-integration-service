import test from 'node:test';
import assert from 'node:assert/strict';
import {bech32m} from '@scure/base';
import {ArkAddress,AssetManager,CSVMultisigTapscript,Extension,Intent,ReadonlyWallet,RestArkProvider,RestIndexerProvider,Transaction,Wallet,createAssetPacket,networks} from '@arkade-os/sdk';
import {createContext} from '../src/core/context.ts';
import {clearBrowserPreferences} from '../src/core/logout-cleanup.ts';
import {readBoardingRecord} from '../src/core/boarding-record.ts';
import {walletReservations,eligibleUnreservedCoins} from '../src/core/wallet-reservations.ts';
import {testLocks} from './locks-fixture.mjs';

// Stateful adapter regression, not a live Signet test. BIS payment, mint and
// transfer adapters are real. SDK issuance/output construction is real; signing,
// provider transport and the chain ledger are controlled at their boundaries.
const points=['79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'].map(h=>Uint8Array.from(Buffer.from(h,'hex')));
const own=new ArkAddress(points[0],points[0],'tark'),game=new ArkAddress(points[0],points[1],'tark');
const bitcoin=bech32m.encode('tb',[1,...bech32m.toWords(points[1])]);
const encoded=tx=>Buffer.from(tx.toPSBT()).toString('base64');
const anchor=Uint8Array.from([0x51,0x02,0x4e,0x73]);

test('account switch -> pay -> mint to player -> pay -> submit 1000-sat swap -> pay while swap is pending',async t=>{
 const memory=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return memory.size;},key:i=>[...memory.keys()][i]??null,getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}});
 Object.defineProperty(navigator,'locks',{configurable:true,value:testLocks()});
 t.mock.method(globalThis,'fetch',async()=>{throw Error('This regression must not access the network');});
 let account={profileId:'first-account',phrase:'legal winner thank year wave sausage worth useful legal winner thank yellow'},generation=0;
 const listeners=new Set();
 const storage={load:async()=>({account,generation}),subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);},reset:async()=>{account=null;generation++;clearBrowserPreferences(localStorage);}};
 let coins=[],payments=0,metadata,release,workerDone,transactions=[],consumed=[];
 const gate=new Promise(r=>release=r),finished=new Promise(r=>workerDone=r);
 const total=()=>coins.reduce((n,c)=>n+c.value,0);
 const info={network:'signet',fees:{txFeeRate:'0',intentFee:{}},sessionDuration:60n,utxoMinAmount:330n,utxoMaxAmount:0n,vtxoMinAmount:330n,vtxoMaxAmount:0n};
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>info);
 t.mock.method(RestArkProvider.prototype,'registerIntent',async()=> 'pending-sequence-swap');
 t.mock.method(RestArkProvider.prototype,'submitTx',async()=>({arkTxid:'c'.repeat(64),signedCheckpointTxs:[]}));
 t.mock.method(RestArkProvider.prototype,'finalizeTx',async()=>{});
 t.mock.method(RestIndexerProvider.prototype,'getVtxos',async()=>({vtxos:[...coins,...consumed]}));
 t.mock.method(RestIndexerProvider.prototype,'getAssetDetails',async assetId=>({assetId,metadata}));
 t.mock.method(CSVMultisigTapscript,'decode',()=>({params:{timelock:{type:'blocks',value:100n}}}));
 const base=()=>({dustAmount:330n,boardingTapscript:{exitScript:'00'},getAddress:async()=>own.encode(),getBoardingAddress:async()=>bitcoin,getBoardingUtxos:async()=>[],getSpendableVtxos:async()=>coins,getVtxos:async()=>coins,getBalance:async()=>({available:total(),total:total(),boarding:{total:0},assets:coins.flatMap(c=>c.assets??[])}),getProviderConnectionState:()=>({mode:'online',source:'live'}),onchainProvider:{getChainTip:async()=>({height:1}),getTransactions:async()=>transactions},dispose:async()=>{}});
 t.mock.method(ReadonlyWallet,'create',async options=>{const w={...base(),...options};w.assetManager=new AssetManager(w);return w;});
 t.mock.method(Wallet,'create',async options=>{
  let settling=false;
  const w={...base(),...options,dispose:async()=>{if(settling)workerDone();},
   send:async({selectedVtxos,recipients})=>{
    assert.equal(recipients[0].amount,1000);
    const sum=selectedVtxos.reduce((n,c)=>n+c.value,0),assets=selectedVtxos.flatMap(c=>c.assets??[]);
    const cps=selectedVtxos.map(c=>{const cp=new Transaction({version:3});cp.addInput({txid:c.txid,index:c.vout,witnessUtxo:{script:own.pkScript,amount:BigInt(c.value)}});cp.addOutput({script:own.pkScript,amount:BigInt(c.value)});cp.addOutput({script:anchor,amount:0n});return cp;});
    const tx=new Transaction({version:3});
    cps.forEach((cp,i)=>tx.addInput({txid:cp.id,index:0,witnessUtxo:{script:own.pkScript,amount:BigInt(selectedVtxos[i].value)}}));
    tx.addOutput({script:game.pkScript,amount:1000n});tx.addOutput({script:own.pkScript,amount:BigInt(sum-1000)});
    if(assets.length)tx.addOutput(Extension.create([createAssetPacket(new Map(selectedVtxos.flatMap((c,i)=>c.assets?.length?[[i,c.assets]]:[])),recipients,{address:own.encode(),amount:sum-1000,assets})]).txOut());
    tx.addOutput({script:anchor,amount:0n});
    await options.arkProvider.submitTx(encoded(tx),cps.map(encoded));
    const used=new Set(selectedVtxos.map(c=>`${c.txid}:${c.vout}`));
    coins=[...coins.filter(c=>!used.has(`${c.txid}:${c.vout}`)),{txid:tx.id,vout:1,value:sum-1000,assets}];payments++;return tx.id;
   },
   buildAndSubmitOffchainTx:async(inputs,outputs)=>{
    const packet=Extension.fromBytes(outputs.find(o=>Extension.isExtension(o.script)).script).getAssetPacket();
    const issuance=packet.groups.find(g=>g.isIssuance());
    assert.equal(issuance.outputs[0].amount,1n);
    const response=await options.arkProvider.submitTx('fixture-mint-transport',[]);
    await options.arkProvider.finalizeTx(response.arkTxid,[]);
    const used=new Set(inputs.map(c=>`${c.txid}:${c.vout}`));
    coins=[...coins.filter(c=>!used.has(`${c.txid}:${c.vout}`)),{txid:response.arkTxid,vout:0,value:Number(outputs[0].amount),assets:[{assetId:response.arkTxid+'0000',amount:1n}]}];return response;
   },
   settle:async params=>{
    settling=true;
    // Capture the installed SDK's real settlement output/asset assignment.
    const stop=new Error('capture signing boundary');let outputs;
    const facade={getAddress:async()=>own.encode(),logUngatedInputs:async()=>{},network:networks.signet,recipientAddressContext:()=>({hrp:'tark',signerSet:{active:Buffer.from(points[0]).toString('hex'),deprecated:[]}}),identity:{signerSession:()=>({getPublicKey:async()=>points[0]})},makeRegisterIntentSignature:async(_inputs,next)=>{outputs=next;throw stop;},makeDeleteIntentSignature:async()=>{}};
    await assert.rejects(Wallet.prototype._settleImpl.call(facade,params),e=>e===stop);
    const proof=Intent.create({type:'register',onchain_output_indexes:params.outputs.flatMap((o,i)=>o.address===bitcoin?[i]:[]),valid_at:0,expire_at:0,cosigners_public_keys:[]},params.inputs.map(c=>({txid:c.txid,index:c.vout,witnessUtxo:{script:own.pkScript,amount:BigInt(c.value)}})),outputs);
    await options.arkProvider.registerIntent({proof:encoded(proof)});
    await gate;throw Error('Controlled teardown of pending fixture settlement');
   }};
  w.assetManager=new AssetManager(w);
  const issue=w.assetManager.issue.bind(w.assetManager);w.assetManager.issue=async p=>{metadata=p.metadata;return issue(p);};return w;
 });
 const balance=async()=>({availableSats:total(),totalSats:total(),arkadeSats:total(),bitcoinSats:0});
 const context=createContext(storage,undefined,async()=>account.profileId,undefined,balance,undefined,undefined,async()=>{},undefined,undefined,undefined,undefined,undefined,{continueRecipient:game.encode()});
 const pay=operationId=>context.requestContinue({operationId,sats:1000,context:'sequence'});
 let started=false;
 try {
  await context.ready();assert.equal(context.getState().profileId,'first-account');
  context.openAccountDialog();context.openLogoutConfirmation();context.setLogoutBackupAcknowledged(true);await context.confirmLogout();
  assert.equal(context.getState().hasProfile,false);
  account={profileId:'funded-player',phrase:'abandon '.repeat(11)+'about'};generation++;
  coins=[{txid:'a'.repeat(64),vout:0,value:267715}];
  for(const listener of listeners)listener();await context.ready();assert.equal(context.getState().profileId,'funded-player');
  assert.equal((await pay('first-payment')).status,'succeeded');assert.equal(total(),266715);
  const minted=await context.mintAsset({operationId:'sequence-mint',name:'Sequence trophy',ticker:'SEQ',amount:'1',decimals:0});
  assert.equal(minted.status,'minted',JSON.stringify(minted));assert.equal(coins[0].assets[0].amount,1n);
  assert.equal((await pay('second-payment')).status,'succeeded');assert.equal(total(),265715);
  assert.equal(coins.length,1);assert.equal(coins[0].assets[0].assetId,minted.asset.assetId);
  const quote=await context.quoteAccountTransfer(1000,'to-bitcoin');
  await context.confirmAccountTransfer(quote);started=true;
  const record=readBoardingRecord(account.profileId);
  assert.equal(record.status,'pending');assert.equal(record.phase,'registered');
  assert.equal(record.quote.amountSats,1000);assert.equal(record.quote.inputSats,265715);
  assert.equal(record.assetChange.sats,264715);
  assert.equal(eligibleUnreservedCoins(coins,walletReservations(account.profileId)).length,0);
  const last=await pay('third-payment');
  t.diagnostic(JSON.stringify({firstTwoPayments:payments,swap:record.status,swapAmount:1000,reservedInputSats:record.quote.inputSats,expectedArkadeChangeSats:record.assetChange.sats,thirdPayment:last.status,message:last.message}));
  assert.equal(last.status,'failed');
  assert.match(last.message,/265,715 sats.*reserved.*pending transfer/i);
  assert.match(last.message,/Transactions/);
  assert.doesNotMatch(last.message,/Insufficient eligible spendable funds/);
  assert.equal(payments,2,'A pending sole input must not reach payment submission');
  assert.equal((await context.getContinueAvailability()).canPay,true,'B1 remains actionable');
  // Public ledger fixtures exercise real receipt reconciliation. This does not
  // claim the SDK batch handler or a live operator completed the withdrawal.
  release();await finished;
  const commitment='d'.repeat(64),input=coins[0];
  consumed=[{...input,isSpent:true,settledBy:commitment}];
  coins=[{txid:'e'.repeat(64),vout:0,value:264715,script:record.assetChange.script,assets:input.assets,commitmentTxIds:[commitment]}];
  transactions=[{txid:commitment,status:{confirmed:true},vout:[{scriptpubkey_address:bitcoin,value:1000}]}];
  const recovered=await pay('after-verified-withdrawal');
  assert.equal(recovered.status,'succeeded',recovered.message);
  assert.equal(readBoardingRecord(account.profileId).status,'succeeded');
  assert.equal(readBoardingRecord(account.profileId).id,record.id);
  assert.equal(readBoardingRecord(account.profileId).commitmentTxid,commitment);
  assert.equal(walletReservations(account.profileId).length,0);
  assert.equal(payments,3);assert.equal(total(),263715);
  assert.equal(coins[0].assets[0].assetId,minted.asset.assetId);
  assert.equal(coins[0].assets[0].amount,1n);
  assert.equal(context.getState().profileId,'funded-player');
 } finally {release();if(started)await finished;context.dispose();}
});
