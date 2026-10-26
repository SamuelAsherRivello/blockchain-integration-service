// C094 protected test recovery. Only resumes the exact original signed request.
import {Transaction,RestIndexerProvider,verifyTapscriptSignatures} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {Vault} from './test-wallets/vault.ts';
import {Operations} from './test-wallets/operations.ts';
import {verifiedInventory} from './test-wallets/inventory.ts';
import {inspectTreasureSpendPlan} from '../packages/integration/src/client/wallet-layer-arkade/treasure-spend-plan.ts';

for(const method of ['log','info','warn','error','debug','trace','dir'])console[method]=()=>{};
// Bound provider observations without converting a timeout into a failed spend.
const requestFetch=globalThis.fetch;
globalThis.fetch=(input,init={})=>requestFetch(input,{...init,signal:AbortSignal.any([
  ...(init.signal?[init.signal]:[]),AbortSignal.timeout(init.method==='POST'?30_000:10_000),
])});
const [mode,runId]=process.argv.slice(2);
const suffix=process.argv[4];
let stage='arguments';
let checks;
try{
  if(!['inspect','resume-original'].includes(mode)||!/^[a-z][a-z0-9-]{0,27}$/.test(runId??''))throw Error();
  if(process.argv.length>5||(suffix!==undefined&&!['early-refund','refund'].includes(suffix)))throw Error();
  stage='vault';const vault=new Vault();
  const run=await vault.transaction(async state=>{
    await verifiedInventory(state);
    const run=state.treasureProofRuns?.[runId];
    if(!run||run.network!=='mutinynet')throw Error();
    if(mode==='resume-original'){
      const game=state.accounts.find(a=>a.profileId===run.game);
      if(!game?.grant?.active||!game.grant.networks.includes(run.network)||game.reportedPending?.[run.network])throw Error();
    }
    return structuredClone(run);
  });
  const branch=run.scenario==='claim'?'claim':'refund';
  stage='original-request';const operation=runId+'-'+(suffix??branch);
  const request=run.recovery[operation]?.find(r=>r.kind==='emulator-submitTx')?.request;
  const fund=run.receipts.find(r=>r.kind==='fund');
  if(!request||!fund)throw Error();
  const original=Transaction.fromPSBT(base64.decode(request[0]));
  if(request[1].length!==1)throw Error();
  const checkpoint=Transaction.fromPSBT(base64.decode(request[1][0]));
  const parent=checkpoint.getInput(0),checkpointOutput=checkpoint.getOutput(0);
  const input=original.getInput(0),output=original.getOutput(0);
  stage='bound-transaction';
  checks={oneInput:original.inputsLength===1,threeOutputs:original.outputsLength===3,
    originalInput:hex.encode(parent.txid)===fund.txid,originalVout:parent.index===fund.vout,
    checkpointLink:hex.encode(input.txid)===checkpoint.id&&input.index===0,
    principal:input.witnessUtxo?.amount===1000n&&parent.witnessUtxo?.amount===1000n&&checkpointOutput.amount===1000n,
    inputScript:!!parent.witnessUtxo&&hex.encode(parent.witnessUtxo.script)===fund.script&&hex.encode(input.witnessUtxo.script)===hex.encode(checkpointOutput.script),
    reward:output.amount===1000n,gameDestination:hex.encode(output.script)==='5120'+run.params[branch==='claim'?'playerDestination':'gameDestination'],
    expired:run.deadlineSeconds*1000<=Date.now(),
    inputTxid:hex.encode(input.txid),fundingTxid:fund.txid,inputPkScript:hex.encode(input.witnessUtxo.script),fundingPkScript:fund.script};
  if(!checks.oneInput||!checks.threeOutputs||!checks.originalInput||!checks.originalVout||!checks.checkpointLink||
    !checks.principal||!checks.inputScript||!checks.reward||!checks.gameDestination||
    (branch==='refund'&&!checks.expired))throw Error();
  const signer=run.params[branch==='claim'?'player':'game'];
  inspectTreasureSpendPlan(request[0],request[1],{funding:fund,
    destinationScript:hex.encode(output.script),participantKeys:[signer]});
  stage='signatures';verifyTapscriptSignatures(original,0,[signer]);
  for(const cp of request[1])verifyTapscriptSignatures(Transaction.fromPSBT(base64.decode(cp)),0,[signer]);
  const indexer=new RestIndexerProvider('https://mutinynet.arkade.sh');
  async function receipt(){
    const wire=await indexer.getVirtualTxs([original.id]);
    if(!wire.txs.some(encoded=>(/^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):
      Transaction.fromPSBT(base64.decode(encoded))).id===original.id))return false;
    const {vtxos}=await indexer.getVtxos({outpoints:[{txid:original.id,vout:0}]});
    return vtxos.some(c=>c.txid===original.id&&c.vout===0&&c.value===1000&&
      c.script===hex.encode(output.script)&&!c.assets?.length);
  }
  stage='network-evidence';let confirmed=await receipt(),httpStatus,classification;
  if(!confirmed&&mode==='resume-original'){
    const {vtxos}=await indexer.getVtxos({outpoints:[fund]});
    if(!vtxos.some(c=>c.txid===fund.txid&&c.vout===fund.vout&&c.value===1000&&c.script===fund.script&&
      !c.isSpent&&!c.spentBy&&!c.isSwept&&!c.isUnrolled&&!c.assets?.length))throw Error();
    await vault.transaction(state=>{
      const current=state.treasureProofRuns[runId];
      if(current.originalRecoveryAttempt)throw Error();
      current.originalRecoveryAttempt={at:Date.now(),txid:original.id,endpoint:'https://emulator.mutinynet.arkade.sh'};
    });
    // Same PSBTs, outpoint, amount, script and txid. No new signing or funding.
    let response;
    try{
      response=await fetch('https://emulator.mutinynet.arkade.sh/v1/tx',{
        method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),
        body:JSON.stringify({arkTx:request[0],checkpointTxs:request[1]}),
      });
    }catch{
      await vault.transaction(state=>{state.treasureProofRuns[runId].originalRecoveryAttempt.observation='response-unavailable';});
      throw Error();
    }
    const body=await response.text();httpStatus=response.status;
    await vault.transaction(state=>{state.treasureProofRuns[runId].originalRecoveryAttempt.response={status:httpStatus,body};});
    classification=/CHECKTIME|checktime|time.*verify/i.test(body)?'time-validation':
      /signature|signatures/i.test(body)?'signature-validation':/opcode|script.*fail|execute.*script/i.test(body)?'script-validation':
      /pending|already|spent/i.test(body)?'original-operation-state':response.ok?'acknowledged':'provider-rejection';
    for(let attempt=0;attempt<10&&!confirmed;attempt++){
      confirmed=await receipt();if(!confirmed)await new Promise(resolve=>setTimeout(resolve,500));
    }
  }
  if(confirmed){
    await new Operations(vault).reconcile(operation,async record=>({id:record.intent.id,fingerprint:record.fingerprint,
      providerId:original.id,outcome:'settled',verified:true}));
    await vault.transaction(state=>{
      const current=state.treasureProofRuns[runId];
      if(!current.receipts.some(r=>r.txid===original.id))current.receipts.push({kind:'refund',txid:original.id,
        vout:0,value:1000,script:hex.encode(output.script)});
      current.completedAt=Date.now();
    });
  }
  const prior=run.originalRecoveryAttempt;
  const privateBody=prior?.response?.body??'';
  const responseChecks=Object.fromEntries(['CHECKTIME','signature','opcode','script','finaliz','pending','spent','not found','deadline','previous']
    .map(token=>[token,privateBody.toLowerCase().includes(token.toLowerCase())]));
  process.stdout.write(JSON.stringify({ok:true,runId,txid:original.id,confirmed,httpStatus,classification,
    originalRecoveryAttempt:prior?{recorded:true,httpStatus:prior.response?.status,hasResponse:!!prior.response,responseChecks}:undefined})+'\n');
}catch{
  process.stdout.write(JSON.stringify({ok:false,runId,stage,checks,reason:'original-recovery-unavailable-reservation-retained'})+'\n');
  process.exitCode=1;
}
