import {renderStepCompletion,setupStepDisclosure} from './step-ui.js';
import { errorSummary, guarded } from './callback-errors.js';

import { layout } from './layout.js';

import { Wallet, RestArkProvider, InMemoryWalletRepository, InMemoryContractRepository, Ramps, CSVMultisigTapscript, hasBoardingTxExpired, sdkVersion } from '@arkade-os/sdk';

import { identity, read, write, recoveryDetails } from './storage.js';

import { half, canSubmit, verifiedReceipt, fundingEligible } from './model.js';

import { incomingTransactions } from './incoming.js';

import { incomingCard, transferBadge, statusBadge, settlementCard } from './transaction-card.js';

import { recordTiming, loadTimings } from './timing.js';

import { setupTimingViews, renderTimings } from './timing-view.js';

import './style.css';



const $=id=>document.getElementById(id);

document.querySelector('#app').innerHTML=layout;

setupStepDisclosure();
setupTimingViews();

$('status').insertAdjacentHTML('beforebegin','<div id="transfer-badge" class="transfer-badge" aria-live="polite"></div>');

document.querySelector('.refresh-bar').insertAdjacentHTML('afterend','<p class="muted" id="timing-storage">Step timings and averages are saved in local storage for this browser and address origin. In-progress durations are excluded. Time with the browser closed is included.</p>');

$('sdk').textContent=sdkVersion;
$('commitment').closest('dl').insertAdjacentHTML('afterend','<div id="settlement-transactions"></div>');

$('error').insertAdjacentHTML('afterend','<pre id="callback-errors" style="white-space:pre-wrap" aria-live="polite"></pre>');

const diagnosticKey='standalone-callback-errors-v1';

let errors=[];

try{errors=JSON.parse(localStorage.getItem(diagnosticKey)||'[]');}catch{}

function renderErrors(){ $('callback-errors').textContent=errors.map(e=>`${e.at} · ${e.context} · ${e.summary}`).join('\n'); }

function captureError(context,error){

 try{errors.push({at:new Date().toISOString(),context,summary:errorSummary(error)});errors=errors.slice(-30);renderErrors();try{localStorage.setItem(diagnosticKey,JSON.stringify(errors));}catch{}}catch{}

}

const guardCallback=(context,callback)=>guarded(callback,error=>captureError(context,error));

window.addEventListener('error',event=>captureError('window error',event.error));

window.addEventListener('unhandledrejection',event=>captureError('unhandled promise',event.reason));

renderErrors();



let recoveryTimer,recoveryGeneration=0;

function setRecoveryEye(visible){
 $('eye-slash').style.display=visible?'none':'';
 const label=visible?'Hide recovery details':'Show recovery details';
 $('reveal-recovery').setAttribute('aria-label',label);$('reveal-recovery').title=label;
 $('reveal-recovery').setAttribute('aria-pressed',String(visible));
}
function hideRecovery(){

 recoveryGeneration++;clearTimeout(recoveryTimer);$('recovery-value').value='';$('recovery-value').type='password';

 setRecoveryEye(false);$('recovery-feedback').textContent='';

}

$('reveal-recovery').onclick=async()=>{

 if($('recovery-value').type==='text'){hideRecovery();return;}

 const generation=++recoveryGeneration,requestedAccount=accountId;

 try{

  const details=await recoveryDetails(requestedAccount);

  if(generation!==recoveryGeneration||requestedAccount!==accountId||document.hidden)return;

  $('recovery-value').value=details.value;$('recovery-value').type='text';setRecoveryEye(true);

  recoveryTimer=setTimeout(hideRecovery,60000);

 }catch(error){captureError('application callback',error);$('recovery-feedback').textContent='Could not reveal recovery details. Reload to verify the saved account.';}

};

$('copy-recovery').onclick=async()=>{

 if(!accountId)return;

 try{const requested=accountId;const details=await recoveryDetails(requested);if(requested!==accountId)return;await navigator.clipboard.writeText(details.value);$('recovery-feedback').textContent='Copied.';}

 catch{$('recovery-feedback').textContent='Copy unavailable. Reveal and copy manually.';}

};

document.addEventListener('visibilitychange',()=>{if(document.hidden)hideRecovery();});

window.addEventListener('pagehide',hideRecovery);

window.addEventListener('storage',()=>{if($('recovery-value').type==='text')hideRecovery();});

async function timing(step,action,at=Date.now(),run=accountId){

 const saved=await recordTiming(run,step,action,at);

 if(!saved)$('timing-storage').textContent='Could not save timing history in local storage. Wallet processing continues.';

 renderTimings(accountId);

}

async function observeDeposit(){

 await timing(3,'start');

 try{const firstSeen=loadTimings(localStorage).runs[accountId]?.[3]?.startedAt;if(firstSeen!==undefined)await timing(2,'finish',firstSeen);}catch(error){captureError('application callback',error);/* Timing is optional. */}

}

let incomingBusy=false,depositSeen=false;

async function refreshIncoming(){

 if(incomingBusy||!wallet)return;incomingBusy=true;

 const observedAccount=accountId;

 try{

  const [transactions,coins]=await Promise.all([wallet.onchainProvider.getTransactions(bitcoinAddress),wallet.onchainProvider.getCoins(bitcoinAddress)]);

  if(observedAccount!==accountId)return;

  const rows=incomingTransactions(transactions,bitcoinAddress,coins);
  depositSeen=rows.length>0;render();
  $('fund-status').textContent=rows.length?'Deposit detected · see confirmation status in Step 3.':'Waiting for faucet funding.';
  $('fund-output').textContent=rows.length?`${rows.length} incoming transaction${rows.length===1?'':'s'} detected. Details in Step 3.`:'No deposit observed yet.';

  if(coins.length&&['idle','waiting'].includes(state.phase))await observeDeposit();

  $('incoming-status').textContent=rows.length?`${rows.length} incoming transaction${rows.length===1?'':'s'} detected. ${rows.filter(r=>!r.confirmed).length} awaiting Bitcoin confirmation.`:'No incoming transaction detected for this address yet. A faucet request is not proof of a broadcast; check the faucet result for a transaction ID.';

  $('incoming-rows').replaceChildren();

  const count=document.createElement('h3');count.className='transaction-count';count.textContent=`${rows.length} incoming transaction${rows.length===1?'':'s'}`;$('incoming-rows').append(count);

  if(!rows.length)$('incoming-rows').append(statusBadge('No transaction detected','neutral'));

  for(const row of rows){

   $('incoming-rows').append(incomingCard(row,bitcoinAddress,row.txid===state.commitment));

  }

  $('incoming-checked').textContent=`Bitcoin transaction check: ${new Date().toLocaleTimeString()}. Received amounts are transaction history, not an available-balance total.`;

 }catch(error){captureError('application callback',error);

  $('incoming-status').textContent='Bitcoin transaction lookup unavailable. This does not mean no deposit exists. Retrying automatically.';

  $('incoming-rows').replaceChildren();

  $('incoming-rows').append(statusBadge('Status unavailable','unknown'));

  $('incoming-checked').textContent='Current transaction status could not be verified.';

 }finally{incomingBusy=false;}

}

let diagnosticReplay=false;
let wallet, bitcoinAddress='', state={phase:'idle'}, busy=false, signing=false, accountId, timer, confirmedFunding=false, accountBusy=false;

const refreshIntervalMs=5000;

let nextRefreshAt=Date.now()+refreshIntervalMs;

function renderRefresh(){

 renderTimings(accountId);

 $('refresh').disabled=busy||!wallet;

 $('refresh').textContent=busy?'Refreshing…':`Refresh status (${Math.max(0,Math.ceil((nextRefreshAt-Date.now())/1000))}s)`;

}

const messages={boarded:'Original Bitcoin funds boarded. Preparing the return of the Bitcoin half.',idle:'No Bitcoin → Arkade transfer submitted. Use Step 4 after Bitcoin funding is confirmed.',waiting:'No transfer submitted. Confirmed funding and a new Step 4 click are required.',submitting:'Submitting Bitcoin → Arkade…',registered:'Bitcoin → Arkade intent registered. Waiting for the settlement batch…',uncertain:'Bitcoin → Arkade outcome uncertain. Checking the existing transfer automatically; no new submission.',committed:'Commitment received. Verifying confirmed Bitcoin change and spendable Arkade receipt…',success:'Bitcoin → Arkade settlement verified.'};

function render(){
 renderStepCompletion({accountReady:!!wallet&&!!bitcoinAddress,depositSeen,fundingConfirmed:confirmedFunding,phase:state.phase,commitment:state.commitment});
 $('onboard-output').textContent=state.target?`${state.target.toLocaleString()} sats targeted for Arkade. Transfer details in Step 5.`:'No transfer authorized yet.';
 $('ready-status').textContent=state.phase==='success'?'Complete · usable funds verified.':state.commitment?'Underway · verifying spendable funds.':'Not started · waiting for settlement';
 if($('retry-existing')){$('retry-existing').disabled=!wallet||busy||signing||state.phase!=='uncertain'||!!state.intent||!!state.commitment;$('retry-existing').textContent=`Retry original ${(state.target??0).toLocaleString()}-sat onboarding`;} 
 if($('diagnostic-retry'))$('diagnostic-retry').disabled=!wallet||busy||signing||state.phase!=='uncertain';

 $('onboard').disabled=!wallet||!canSubmit(state,confirmedFunding)||busy||accountBusy;

 $('create').disabled=accountBusy||busy||signing||!['idle','waiting','success'].includes(state.phase);

 $('create').textContent=accountId?'Reset & Restart':'Create';

 $('faucet').disabled=!wallet||accountBusy;

 $('reveal-recovery').disabled=!accountId||accountBusy;$('copy-recovery').disabled=!accountId||accountBusy;

 $('eligibility').textContent=state.phase==='success'?'This onboarding is complete.':!['idle','waiting'].includes(state.phase)?'The authorized transfer is in progress.':confirmedFunding?'Incoming Bitcoin is confirmed. You can now onboard 50%.':'Locked — waiting for confirmed incoming Bitcoin in Step 3.';

 $('status').textContent=messages[state.phase]??'Checking existing operation…';

 $('transfer-badge').replaceChildren(transferBadge(state.phase));

 for(const key of ['target','fee','change'])$(key).textContent=Number.isSafeInteger(state[key])?`${state[key].toLocaleString()} sats`:'—';

 $('intent').textContent=state.intent??'—';$('commitment').textContent=state.commitment??state.boardingCommitment??'—';

 if(state.mode==='board-then-return')$('status').textContent+=` Phase ${state.leg==='return'?'2/2: return Bitcoin half':'1/2: board original inputs'}.`;
 if(state.stage)$('status').textContent+=` Last stage: ${state.stage}.`;

 $('usable').textContent=state.phase==='success'?`${state.target.toLocaleString()} sats verified as usable Arkade funds. Ready.`:'Not ready yet. CPU will verify spendable Arkade funds after the transfer settles.';

 $('ready-panel').classList.toggle('complete',state.phase==='success');

 renderTimings(accountId);

}

async function save(patch){

 if((await read('identity'))?.id!==accountId)throw Error('Account changed in another tab. Reload.');

 state={...state,...patch};await write('operation',state);

 const now=Date.now();

 if(patch.phase==='submitting')await timing(5,'start',now);

 if(patch.commitment){await timing(5,'finish',now);await timing(6,'start',now);}

 if(patch.phase==='success')await timing(6,'finish',now);

 render();

}

const serialize=fn=>navigator.locks.request('standalone-operation',fn);

function showFailure(message){$('error').textContent=message;}

async function prepare(coins,info,diagnostic=false){

 // Fail closed for fee schedules whose exact net/change treatment is not yet verified.

 if(info.fees.txFeeRate!=='0'||Object.values(info.fees.intentFee).some(v=>v!==''&&v!=='0'))throw Error('The operator has nonzero fees. Exact-half fee support needs verification; nothing submitted.');

 let params;

 const facade={getAddress:()=>wallet.getAddress(),getBoardingAddress:()=>wallet.getBoardingAddress(),settle:async p=>{params=p;return 'quote-only';}};

 await new Ramps(facade).onboard(info.fees,coins,BigInt(state.total));

 const own=await wallet.getAddress(), change=state.total-state.target;

 if(!params||params.outputs.length!==1||params.outputs[0].address!==own||params.outputs[0].amount!==BigInt(state.total))throw Error('SDK outputs do not match the exact half transfer. Nothing submitted.');

 if(state.target<Number(info.vtxoMinAmount)||change<Math.max(Number(info.utxoMinAmount),Number(wallet.dustAmount))|| (info.vtxoMaxAmount>0n&&BigInt(state.target)>info.vtxoMaxAmount)||(info.utxoMaxAmount>0n&&BigInt(change)>info.utxoMaxAmount))throw Error('The funded half or Bitcoin change is outside operator limits. Nothing submitted.');

 if(diagnostic){await wallet.settle(params,guardCallback('diagnostic settlement event',()=>{}));return;}
 await save({change,fee:0,phase:'submitting',mode:'board-then-return',leg:'board',attemptKey:crypto.randomUUID(),intent:undefined,stage:'Board all original inputs, then return the Bitcoin half'});
 launchSettlement(params);
}
function launchSettlement(params){

 signing=true;

 // Keep the actual SDK signer alive while independent status checks continue.

 void wallet.settle(params,guardCallback('settlement event',async event=>{

   const stages={batch_started:'batch started',tree_signing_started:'tree signing',batch_finalization:'batch finalization',batch_finalized:'batch finalized',batch_failed:'batch failed'};

   if(stages[event.type])await serialize(async()=>{state=await read('operation');if(state.phase!=='success')await save({stage:stages[event.type]});});

 })).then(commitment=>serialize(async()=>{state=await read('operation');if(state.phase!=='success')await save(state.leg==='board'?{phase:'boarded',boardingCommitment:commitment,boardingIntent:state.intent,intent:undefined,stage:'Boarding complete; preparing Bitcoin return'}:{phase:'committed',commitment});}))

 .catch(error=>{captureError('settlement',error);return serialize(async()=>{state=await read('operation');if(state.phase!=='success')await save({phase:'uncertain'});});})

 .finally(()=>{signing=false;void tick();}).catch(error=>captureError('settlement persistence',error));

}

async function tick(){

 if(!wallet||busy)return;busy=true;renderRefresh();

 void refreshIncoming();

 try{await serialize(async()=>{

   state=await read('operation')??{phase:'idle'};render();

   if((await read('identity'))?.id!==accountId){confirmedFunding=false;clearInterval(timer);throw Error('Account changed in another tab. Reload.');}

   if(state.phase==='waiting')await save({phase:'idle'});

   const [coins,balance,tip,info]=await Promise.all([wallet.getBoardingUtxos(),wallet.getBalance(),wallet.onchainProvider.getChainTip(),wallet.arkProvider.getInfo()]);

   if(info.network!=='signet')throw Error('Network mismatch; Signet required.');

   const connection=wallet.getProviderConnectionState();

   if(connection.mode!=='online'||connection.source!=='live')throw Error('Fresh network data unavailable.');

   $('bitcoin').textContent=balance.boarding.total.toLocaleString();$('arkade').textContent=(balance.total-balance.boarding.total).toLocaleString();$('available').textContent=`Spendable sats: ${balance.available.toLocaleString()}`;

   $('checked').textContent=new Date().toLocaleTimeString();showFailure('');

   const exit=CSVMultisigTapscript.decode(Uint8Array.from(wallet.boardingTapscript.exitScript.match(/.{2}/g),v=>parseInt(v,16)));

   confirmedFunding=fundingEligible(coins,c=>hasBoardingTxExpired(c,exit.params.timelock,tip.height));

   if(coins.length&&['idle','waiting'].includes(state.phase)){

    await observeDeposit();

   }

   if(confirmedFunding&&state.phase==='idle'){const now=Date.now();await timing(3,'finish',now);await timing(4,'start',now);}

   if(state.inputs&&!['idle','waiting'].includes(state.phase)){

     const [transactions,receipts]=await Promise.all([wallet.onchainProvider.getTransactions(bitcoinAddress),wallet.getSpendableVtxos({withRecoverable:false,withUnrolled:false})]);

     if(state.mode==='board-then-return'&&state.phase==='boarded'&&!signing){
       const selected=receipts.filter(v=>v.commitmentTxIds?.includes(state.boardingCommitment));
       if(selected.reduce((sum,v)=>sum+v.value,0)===state.total){
        if(info.fees.txFeeRate!=='0'||Object.values(info.fees.intentFee).some(v=>v!==''&&v!=='0'))throw Error('The operator fee schedule changed.');
        const own=await wallet.getAddress();
        await save({phase:'submitting',leg:'return',intent:undefined,attemptKey:crypto.randomUUID(),stage:'Returning the Bitcoin half'});
        launchSettlement({inputs:selected,outputs:[{address:bitcoinAddress,amount:BigInt(state.change)},{address:own,amount:BigInt(state.target)}]});
       }
     }
     $('settlement-transactions').replaceChildren();
     for(const [id,label] of [[state.boardingCommitment,'1 · Bitcoin to Arkade'],[state.commitment,'2 · Bitcoin half returned']]){
      if(id)$('settlement-transactions').append(settlementCard(id,label,transactions.find(tx=>tx.txid===id)?.status.confirmed));
     }
     const commitment=verifiedReceipt(state,transactions,receipts,bitcoinAddress);

     if(commitment&&state.phase!=='success')await save({phase:'success',commitment});

   }

 });}catch(error){captureError('status refresh',error);confirmedFunding=false;$('bitcoin').textContent='—';$('arkade').textContent='—';$('available').textContent='Spendable sats: —';showFailure(error instanceof Error&&/^(Account changed|The operator|SDK outputs|The funded|Captured|Network mismatch|Fresh network)/.test(error.message)?error.message:'Network check unavailable. Retrying automatically; the saved operation is preserved.');}

 finally{busy=false;nextRefreshAt=Date.now()+refreshIntervalMs;renderRefresh();render();}

}

$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(bitcoinAddress);$('copied').textContent=' Address copied.';}catch(error){captureError('application callback',error);$('address').select();$('copied').textContent=' Select and copy the address manually.';}};

$('onboard').onclick=async()=>{

 if(busy||!canSubmit(state,confirmedFunding))return;

 const clickedAt=Date.now();

 busy=true;render();renderRefresh();

 try{await serialize(async()=>{

  if((await read('identity'))?.id!==accountId)throw Error('Account changed. Reload.');

  state=await read('operation')??{phase:'idle'};if(state.phase!=='idle')return;

  const [coins,tip,info]=await Promise.all([wallet.getBoardingUtxos(),wallet.onchainProvider.getChainTip(),wallet.arkProvider.getInfo()]);

  const exit=CSVMultisigTapscript.decode(Uint8Array.from(wallet.boardingTapscript.exitScript.match(/.{2}/g),v=>parseInt(v,16)));

  if(!fundingEligible(coins,c=>hasBoardingTxExpired(c,exit.params.timelock,tip.height)))throw Error('Confirmed incoming funds are not available.');

  await timing(4,'finish',clickedAt);

  await save({...half(coins),inputs:coins.map(({txid,vout,value})=>({txid,vout,value}))});

  await prepare(coins,info);

 });}catch(error){captureError('onboard preparation',error);showFailure(error instanceof Error&&/^(The operator|The funded|SDK outputs|Confirmed|Account changed)/.test(error.message)?error.message:'Could not prepare onboarding. Check the saved transfer status before continuing.');}

 finally{busy=false;render();renderRefresh();}

};

$('faucet').onclick=()=>{if(wallet){window.open('https://www.google.com/search?q=signet+bitcoin+faucet','_blank','noopener,noreferrer');void timing(2,'start');}};

$('create').onclick=async()=>{

 if(accountBusy||busy||signing)return;accountBusy=true;render();clearInterval(timer);

 hideRecovery();

 const createdAt=Date.now();

 try{

  let signer;

  await serialize(async()=>{const current=await read('operation');if(current&&!['idle','waiting','success'].includes(current.phase))throw Error('Unresolved transfer.');signer=await identity(true,!!(await read('identity')));});

  localStorage.clear();errors=[];renderErrors();
  for(const panel of document.querySelectorAll('.step-ui'))panel.open=true;
  await timing(1,'start',createdAt,(await read('identity')).id);

  accountId=undefined;confirmedFunding=false;depositSeen=false;await wallet?.dispose();wallet=undefined;bitcoinAddress='';$('address').value='Creating account…';$('incoming-rows').replaceChildren();

  await start(signer);

 }catch(error){captureError('application callback',error);$('account-status').textContent='Account change failed or an unresolved transfer prevents recreation. Saved account data is retained.';}

 finally{accountBusy=false;render();}

};

$('refresh').onclick=()=>void tick();

window.addEventListener('beforeunload',event=>{if(signing){event.preventDefault();event.returnValue='';}});

async function start(providedSigner){

 try{

  const signer=providedSigner??await identity();

  if(!signer){$('account-status').textContent='Click Create. CPU will generate and save a new Signet account.';render();return;}

  const savedIdentity=await read('identity');accountId=savedIdentity.id;$('account-status').textContent='Connecting the saved account…';

  $('recovery-label').textContent=savedIdentity.kind==='mnemonic'?'Seed phrase':'Private key';


  const provider=new RestArkProvider('https://signet.arkade.sh');

  const getInfo=provider.getInfo.bind(provider);provider.getInfo=async()=>{const info=await getInfo();if(info.network!=='signet')throw Error('Signet required.');return info;};

  await provider.getInfo();

  const register=provider.registerIntent.bind(provider);let registered;

  provider.registerIntent=async intent=>{

   if(diagnosticReplay)throw Error('Diagnostic stopped before registration');
   const attempt=(await read('operation'))?.attemptKey;
   if(registered===attempt&&registered!==undefined)throw Error('Repeat registration blocked.');registered=attempt;

   const saved=await read('operation');if(saved?.phase!=='submitting'||saved.intent)throw Error('Registration is not authorized.');

   let id;try{id=await register(intent);}catch(error){captureError('intent registration',error);throw error;}

   await serialize(async()=>{state=await read('operation');await save({phase:'registered',intent:id});});return id;

  };

  provider.deleteIntent=async()=>{throw Error('Automatic cancellation and replay disabled.');};

  wallet=await Wallet.create({identity:signer,arkProvider:provider,settlementConfig:false,storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}});

  bitcoinAddress=await wallet.getBoardingAddress();

  if(!bitcoinAddress.startsWith('tb1'))throw Error('Unexpected address network.');

  $('address').value=bitcoinAddress;$('copy').disabled=false;

  $('account-status').textContent='Account saved in this browser. Refresh will keep this boarding address.';

  await timing(1,'finish');

  $('address-explorer').href=`https://mempool.signet.arkade.sh/address/${bitcoinAddress}`;

  state=await read('operation')??{phase:'idle'};render();await tick();

  clearInterval(timer);timer=setInterval(guardCallback('refresh timer',()=>{renderRefresh();if(!busy&&Date.now()>=nextRefreshAt)return tick();}),200);

 }catch(error){captureError('application callback',error);$('account-status').textContent='Signet connection could not be established. Reload to retry with the same saved account.';render();}

}


$('onboard').insertAdjacentHTML('afterend','<button id="diagnostic-retry" disabled>Retry preparation · no new transfer</button>');
$('diagnostic-retry').insertAdjacentHTML('afterend','<button id="retry-existing" disabled>Retry original 6,000-sat onboarding</button>');
$('retry-existing').onclick=guardCallback('live retry',async()=>{
 if(busy||signing||state.phase!=='uncertain'||state.intent||state.commitment)return;
 busy=true;render();
 try{await serialize(async()=>{
  state=await read('operation');
  if(state.phase!=='uncertain'||state.intent||state.commitment)return;
  const [coins,info]=await Promise.all([wallet.getBoardingUtxos(),wallet.arkProvider.getInfo()]);
  const captured=state.inputs??[];
  if(!captured.length||captured.some(i=>!coins.some(c=>c.txid===i.txid&&c.vout===i.vout&&c.value===i.value&&c.status.confirmed)))throw Error('Captured inputs unavailable');
  await write(`operation-attempt:${Date.now()}`,state);
  await prepare(coins.filter(c=>captured.some(i=>i.txid===c.txid&&i.vout===c.vout)),info);
 });}catch(error){captureError('live retry',error);}finally{busy=false;render();}
});
$('diagnostic-retry').onclick=guardCallback('diagnostic replay',async()=>{
 if(busy||signing||diagnosticReplay||state.phase!=='uncertain')return;
 busy=true;diagnosticReplay=true;render();
 try{
  const [coins,info]=await Promise.all([wallet.getBoardingUtxos(),wallet.arkProvider.getInfo()]);
  const captured=state.inputs??[];
  if(!captured.length||captured.some(input=>!coins.some(c=>c.txid===input.txid&&c.vout===input.vout&&c.value===input.value)))throw Error('Captured inputs no longer available');
  await prepare(coins.filter(c=>captured.some(i=>i.txid===c.txid&&i.vout===c.vout)),info,true);
 }catch(error){captureError('diagnostic replay',error);}
 finally{diagnosticReplay=false;busy=false;render();}
});
for(const element of document.querySelectorAll('button')){if(element.onclick)element.onclick=guardCallback(`button ${element.id}`,element.onclick);}

void start().catch(error=>captureError('startup',error));





