// Explicit sandbox acceptance. No game import and no boarding submission.
// Signed requests and original hold history stay in the protected test vault.
import { Wallet, MnemonicIdentity, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository, Intent, ArkAddress, Transaction } from '@arkade-os/sdk';
import { base64, hex } from '@scure/base';
import { Vault } from './test-wallets/vault.ts';
import { Operations } from './test-wallets/operations.ts';
import { verifiedInventory } from './test-wallets/inventory.ts';
const [runId]=process.argv.slice(2);
for(const method of ['log','warn','info','error','debug','trace','dir'])console[method]=()=>{};
const emit=value=>process.stdout.write(JSON.stringify({runId,stage,...value})+'\n');
const vault=new Vault(),ledger=new Operations(vault);
const operator='https://signet.arkade.sh',network='signet',amount=5000;
let wallet,stage='arguments';
try {
  if(process.argv.length!==3||!/^[a-z][a-z0-9-]{0,35}$/.test(runId??''))throw Error('invalid-arguments');
  const account=await vault.transaction(async state=>{
    await verifiedInventory(state);
    const a=state.accounts.find(a=>a.label==='test-account-1');
    if(!a?.grant?.active||!a.grant.networks.includes(network)||!a.reportedPending?.signet)throw Error('original-hold-required');
    if(state.signetFundingBypass?.[runId]||(state.operations??[]).some(o=>o.intent.network===network&&[o.intent.profileId,o.intent.target?.profileId].includes(a.profileId)&&!['settled','failed','cancelled'].includes(o.state)))throw Error('original-operation-requires-reconciliation');
    return {...a};
  });
  const identity=MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false});
  const ark=new RestArkProvider(operator),indexer=new RestIndexerProvider(operator);
  const info=await ark.getInfo();
  if(info.network!==network||Number(info.fees.txFeeRate)!==0)throw Error('unsupported-network-or-fee');
  wallet=await Wallet.create({identity,arkProvider:ark,indexerProvider:indexer,settlementConfig:false,walletMode:'static',storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}});
  const boarding=await wallet.getBoardingUtxos();
  const available=await wallet.getSpendableVtxos({withRecoverable:false,withUnrolled:false,genericallySpendableOnly:true});
  const selected=available.filter(c=>c.value===1000&&!c.assets?.length).slice(0,5);
  if(selected.length!==5)throw Error('independent-inputs-unavailable');
  const scope=coins=>coins.map(({txid,vout,value})=>({txid,vout,value}));
  const queries=[];
  stage='reconcile-current-inputs';
  for(const [category,coins] of [['boarding',boarding],['offchain',available]]){
    if(!coins.length)continue;
    const pendingProof=await wallet.makeGetPendingTxIntentSignature(coins);
    const pending=await ark.getPendingTxs(pendingProof);
    const message=JSON.stringify({type:'get-intent',expire_at:Math.floor(Date.now()/1000)+120});
    const proof=Intent.create(message,coins,[]);
    const signed=await identity.sign(proof,Array.from({length:coins.length+1},(_,i)=>i));
    const intentProof={proof:base64.encode(signed.toPSBT()),message};
    const response=await fetch(operator+'/v1/intent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({intent:intentProof}),signal:AbortSignal.timeout(15000)});
    const answer=await response.json();
    if(!response.ok||!Array.isArray(answer.intents)||answer.intents.length||answer.intent||pending.length)throw Error('current-inputs-still-reserved');
    queries.push({category,inputs:scope(coins),pendingProof,intentProof,pending,intents:answer.intents,observedAt:Date.now()});
  }
  const addressResponse=await fetch('http://127.0.0.1:5190/api/faucet/addresses?network=signet');
  const destination=await addressResponse.json();
  if(!addressResponse.ok||destination.network!==network||ArkAddress.decode(destination.arkadeAddress).serverPubKey.length!==32)throw Error('faucet-identity-unavailable');
  const script=hex.encode(ArkAddress.decode(destination.arkadeAddress).pkScript);
  const before=await(await fetch('http://127.0.0.1:5190/api/faucet/balance?network=signet')).json();
  if(before.network!==network||before.available!==0||before.onboarding?.status==='pending')throw Error('faucet-needs-reconciliation');
  await vault.transaction(state=>{
    const a=state.accounts.find(a=>a.profileId===account.profileId);
    if(JSON.stringify(a?.reportedPending?.signet)!==JSON.stringify(account.reportedPending.signet))throw Error('hold-changed');
    state.signetFundingBypass??={};
    if(state.signetFundingBypass[runId])throw Error('original-run-already-exists');
    state.signetFundingBypass[runId]={network,account:account.profileId,originalHold:account.reportedPending.signet,
      reconciliation:{status:'no-active-reservations-on-current-inputs',historicalOutcome:'unknown',queries},
      destination:destination.arkadeAddress,amount,before,selected:scope(selected),requests:[],createdAt:Date.now(),status:'prepared'};
    a.onboardingReconciliations??=[];
    a.onboardingReconciliations.push({network,runId,originalHold:account.reportedPending.signet,observedAt:Date.now(),result:'no-active-reservations-on-current-inputs',historicalOutcome:'unknown'});
    delete a.reportedPending.signet;
  });
  emit({holdReconciled:true,historicalOutcome:'unknown',boardingInputs:boarding.length,offchainInputs:available.length,amountSats:amount});
  const requestId=runId+'-seed';
  await ledger.prepare({id:requestId,account:account.label,profileId:account.profileId,generation:account.generation,network,kind:'arkade-send',recipient:destination.arkadeAddress,amountSats:amount,feeSats:0,sourceOrigin:'http://127.0.0.1:5190'});
  async function save(kind,args){await vault.transaction(state=>{state.signetFundingBypass[runId].requests.push({kind,args});state.signetFundingBypass[runId].status='pending';});}
  for(const method of ['registerIntent','submitIntent','deleteIntent'])if(typeof ark[method]==='function')ark[method]=async()=>{throw Error('boarding-not-authorized-by-this-run');};
  const submit=ark.submitTx.bind(ark);
  ark.submitTx=async(signedArk,checkpoints)=>{
    const tx=Transaction.fromPSBT(base64.decode(signedArk));
    if(tx.getOutput(0).amount!==BigInt(amount)||hex.encode(tx.getOutput(0).script)!==script)throw Error('seed-output-mismatch');
    const actual=checkpoints.map(encoded=>{const c=Transaction.fromPSBT(base64.decode(encoded)),i=c.getInput(0);return hex.encode(i.txid)+':'+i.index;}).sort();
    if(JSON.stringify(actual)!==JSON.stringify(selected.map(c=>c.txid+':'+c.vout).sort()))throw Error('seed-input-mismatch');
    await save('submitTx',[signedArk,checkpoints]);
    const answer=await submit(signedArk,checkpoints);await save('submitTx-response',answer);return answer;
  };
  const finalize=ark.finalizeTx.bind(ark);
  ark.finalizeTx=async(...args)=>{await save('finalizeTx',args);const response=await finalize(...args);await save('finalizeTx-response',response);return response;};
  stage='seed-faucet';
  const sent=await ledger.submit(requestId,async()=>({providerId:await wallet.send({address:destination.arkadeAddress,amount,selectedVtxos:selected})}));
  if(!sent.providerId)throw Error('seed-outcome-unknown');
  stage='verify-seed';
  const wire=await indexer.getVirtualTxs([sent.providerId]);
  const tx=wire.txs.map(encoded=>/^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded))).find(tx=>tx.id===sent.providerId);
  const {vtxos}=await indexer.getVtxos({outpoints:[{txid:sent.providerId,vout:0}]});
  if(!tx||tx.getOutput(0).amount!==BigInt(amount)||hex.encode(tx.getOutput(0).script)!==script||!vtxos.some(c=>c.txid===sent.providerId&&c.vout===0&&c.value===amount&&c.script===script&&!c.assets?.length))throw Error('seed-receipt-unverified');
  await ledger.reconcile(requestId,async op=>({id:requestId,fingerprint:op.fingerprint,providerId:sent.providerId,outcome:'settled',verified:true}));
  const after=await(await fetch('http://127.0.0.1:5190/api/faucet/balance?network=signet')).json();
  if(after.available!==amount||after.boarding!==before.boarding||after.onboarding?.updatedAt!==before.onboarding?.updatedAt)throw Error('faucet-bypass-state-unverified');
  const receipt={txid:sent.providerId,vout:0,value:amount,script};
  await vault.transaction(state=>Object.assign(state.signetFundingBypass[runId],{status:'verified',receipt,completedAt:Date.now()}));
  emit({verified:true,receipt,faucetAvailable:after.available,boardingUnchanged:true});
}catch(error){
  const known=['invalid-arguments','original-hold-required','original-operation-requires-reconciliation','unsupported-network-or-fee','independent-inputs-unavailable','current-inputs-still-reserved','faucet-identity-unavailable','faucet-needs-reconciliation','seed-outcome-unknown','seed-receipt-unverified','faucet-bypass-state-unverified'];
  emit({verified:false,reason:known.includes(error?.message)?error.message:'original-operation-needs-inspection'});process.exitCode=1;
}finally{await wallet?.dispose?.().catch(()=>{});}
