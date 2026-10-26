// Explicit funded compatibility runner. Never imported by the game or default tests.
// Each original signed request stays in the existing protected test vault.
import {arkade,Wallet,MnemonicIdentity,RestArkProvider,RestIndexerProvider,RestEmulatorProvider,
  InMemoryWalletRepository,InMemoryContractRepository,ArkAddress,Transaction,
  signAndSubmitOffchainTx,getNetwork} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import {buildTreasureScript as compileTreasureProof} from '../packages/integration/src/client/wallet-layer-arkade/treasure-script.ts';
import {inspectTreasureSpendPlan} from '../packages/integration/src/client/wallet-layer-arkade/treasure-spend-plan.ts';
import {inspectTreasureDirectPolicy} from '../packages/integration/src/client/wallet-layer-arkade/treasure-direct-policy.ts';
import {Vault} from './test-wallets/vault.ts';
import {Operations} from './test-wallets/operations.ts';
import {verifiedInventory} from './test-wallets/inventory.ts';
for(const method of ['log','info','warn','error','debug','trace','dir'])console[method]=()=>{};
const [network,scenario,runId]=process.argv.slice(2);
const recovering=process.argv[5]==='--recover-expired';
let gameWallet,playerWallet,stage='arguments';
const vault=new Vault(),operations=new Operations(vault);
const transact=vault.transaction.bind(vault);
vault.transaction=async(...args)=>{
  for(let attempt=0;;attempt++)try{return await transact(...args);}
  catch(error){
    if(error.code!=='vault-locked'||attempt>=20)throw error;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
};
const requestFetch=globalThis.fetch;
globalThis.fetch=(input,init={})=>requestFetch(input,{...init,signal:AbortSignal.any([
  ...(init.signal?[init.signal]:[]),AbortSignal.timeout(init.method==='POST'?30000:10000),
])});
let currentOperation;
let originalRun;
try{
  if((process.argv.length!==5&&!(process.argv.length===6&&recovering))||network!=='mutinynet'||!['claim','reject','expiry'].includes(scenario)||
    !/^[a-z][a-z0-9-]{0,27}$/.test(runId??''))throw Error('treasure-live-invalid-arguments');
  // SDK 0.4.79's independent public Mutinynet pin. No endpoint-reported TOFU.
  const emulatorKey='03f823b9b2febc81f4af967e77aed2f541cbd3397c6d8f5a72e32eb7b471af889a';
  const endpoint='https://emulator.mutinynet.arkade.sh';
  stage='authorization';
  const [game,player]=await vault.transaction(async state=>{
    await verifiedInventory(state);
    originalRun=state.treasureProofRuns?.[runId];
    if(originalRun&&!recovering)throw Error('treasure-live-original-run-requires-reconciliation');
    if(recovering&&(!originalRun||originalRun.completedAt||originalRun.network!==network||originalRun.scenario!==scenario||
      originalRun.deadlineSeconds*1000>Date.now()||!originalRun.receipts?.some(r=>r.kind==='fund')||
      Object.keys(originalRun.recovery??{}).some(id=>id!==runId+'-fund')))
      throw Error('treasure-live-original-run-requires-reconciliation');
    const rows=['market-remint-game','market-remint-player'].map(label=>state.accounts.find(a=>a.label===label));
    if(rows.some(a=>!a?.grant?.active||!a.grant.networks.includes(network)||a.reportedPending?.[network]))
      throw Error('treasure-live-test-grant-unavailable');
    if((state.operations??[]).some(op=>op.intent.network===network&&
      rows.some(a=>[op.intent.profileId,op.intent.target?.profileId].includes(a.profileId))&&
      !['settled','failed','cancelled'].includes(op.state)))throw Error('treasure-live-reserved-account');
    return rows.map(row=>({...row}));
  });
  const identities=[game,player].map(a=>MnemonicIdentity.fromMnemonic(a.phrase,{isMainnet:false}));
  const ark=new RestArkProvider('https://mutinynet.arkade.sh');
  const indexer=new RestIndexerProvider('https://mutinynet.arkade.sh');
  const emulator=new RestEmulatorProvider(endpoint);
  stage='capability';
  const [info,emulatorInfo]=await Promise.all([ark.getInfo(),emulator.getInfo()]);
  if(info.network!==network||emulatorInfo.signerPubkey!==emulatorKey)throw Error('treasure-live-pin-or-network-mismatch');
  const policy=inspectTreasureDirectPolicy(network,info);
  // This runner has no intent-based settlement/renewal path. Fail before any
  // future accidental intent submission rather than treating CEL fees as zero.
  for(const method of ['registerIntent','submitIntent','deleteIntent'])if(typeof ark[method]==='function')
    ark[method]=async()=>{throw Error('treasure-live-intent-route-not-qualified');};
  async function saveRequest(kind,request){
    if(!currentOperation)throw Error('treasure-live-missing-operation');
    await vault.transaction(state=>{
      const run=state.treasureProofRuns[runId];
      run.recovery??={};run.recovery[currentOperation]??=[];
      run.recovery[currentOperation].push({kind,request});
    });
  }
  for(const [provider,name,methods] of [[ark,'operator',['submitTx','finalizeTx']],[emulator,'emulator',['submitTx']]])
    for(const method of methods){
      const original=provider[method].bind(provider);
      provider[method]=async(...args)=>{
        await saveRequest(name+'-'+method,args);
        try{
          const response=await original(...args);
          await saveRequest(name+'-'+method+'-response',[response]);
          return response;
        }catch(error){
          // Provider diagnostics can include signed requests. Keep them private.
          await saveRequest(name+'-'+method+'-failure',[String(error?.message??'unavailable')]);
          throw error;
        }
      };
    }
  const makeWallet=identity=>Wallet.create({identity,arkProvider:ark,indexerProvider:indexer,
    walletMode:'static',settlementConfig:false,storage:{walletRepository:new InMemoryWalletRepository(),
      contractRepository:new InMemoryContractRepository()}});
  [gameWallet,playerWallet]=await Promise.all(identities.map(makeWallet));
  const [gameAddress,playerAddress]=await Promise.all([gameWallet.getAddress(),playerWallet.getAddress()]);
  const available=(await gameWallet.getSpendableVtxos()).filter(coin=>!coin.assets?.length&&coin.value>=1330);
  if(!available.length)throw Error('treasure-live-insufficient-spendable-funds');
  const startedAtMs=Date.now();
  const currentParams={network,game:hex.encode(await identities[0].xOnlyPublicKey()),
    player:hex.encode(await identities[1].xOnlyPublicKey()),operator:info.signerPubkey.slice(2),
    emulator:emulatorKey.slice(2),gameDestination:hex.encode(ArkAddress.decode(gameAddress).vtxoTaprootKey),
    playerDestination:hex.encode(ArkAddress.decode(playerAddress).vtxoTaprootKey),
    startedAtMs,offerSessionId:runId,hostReference:'C094:'+runId,exitDelay:Number(info.unilateralExitDelay)};
  const params=originalRun?.params??currentParams;
  if(originalRun&&Object.keys(currentParams).some(key=>key!=='startedAtMs'&&currentParams[key]!==params[key]))
    throw Error('treasure-live-original-identity-mismatch');
  const built=compileTreasureProof(params);
  const client=await arkade.Arkade.connect({arkade:ark,indexer,emulator,emulatorPubkey:emulatorKey,
    identity:identities[1],network:getNetwork(network)});
  const contract=client.contract(built.program,built.args);
  if(hex.encode(contract.pkScript)!==hex.encode(built.script.pkScript))throw Error('treasure-live-compilation-mismatch');
  if(!recovering)await vault.transaction(state=>{
    state.treasureProofRuns??={};
    if(state.treasureProofRuns[runId])throw Error('treasure-live-original-run-requires-reconciliation');
    state.treasureProofRuns[runId]={network,scenario,params,game:game.profileId,player:player.profileId,
      deadlineSeconds:Number(built.args.deadline),receipts:[],recovery:{}};
  });
  async function verifyOutput(txid,script){
    for(let attempt=0;attempt<20;attempt++){
      const response=await indexer.getVirtualTxs([txid]);
      for(const encoded of response.txs){
        const tx=/^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded));
        if(tx.id!==txid)continue;
        const outputs=Array.from({length:tx.outputsLength},(_,vout)=>({vout,...tx.getOutput(vout)}))
          .filter(o=>o.amount===1000n&&o.script&&hex.encode(o.script)===script);
        if(outputs.length!==1)throw Error('treasure-live-wrong-wire-output');
        const vout=outputs[0].vout;
        const {vtxos}=await indexer.getVtxos({outpoints:[{txid,vout}]});
        if(vtxos.some(c=>c.txid===txid&&c.vout===vout&&c.value===1000&&c.script===script&&!c.assets?.length))
          return {txid,vout,value:1000};
      }
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    throw Error('treasure-live-original-output-unverified');
  }
  async function mutate(kind,signer,destination,script,send){
    stage=kind;currentOperation=runId+'-'+kind;
    if(inspectTreasureDirectPolicy(network,await ark.getInfo()).fingerprint!==policy.fingerprint)
      throw Error('treasure-live-policy-changed');
    await operations.prepare({id:currentOperation,account:signer.label,profileId:signer.profileId,
      generation:signer.generation,network,kind:kind==='fund'?'arkade-send':kind==='claim'?'claim':'refund',
      recipient:destination,amountSats:1000,feeSats:0,sourceOrigin:null});
    const pending=await operations.submit(currentOperation,async()=>({providerId:await send()}));
    let originalTxid=pending.providerId;
    if(!originalTxid){
      const requests=await vault.transaction(state=>state.treasureProofRuns[runId].recovery[currentOperation]??[]);
      const signed=requests.find(request=>request.kind==='emulator-submitTx');
      if(signed)originalTxid=Transaction.fromPSBT(base64.decode(signed.request[0])).id;
    }
    if(!originalTxid)throw Error('treasure-live-submission-unknown-reconcile-original');
    const outpoint=await verifyOutput(originalTxid,script);
    await operations.reconcile(currentOperation,async record=>({id:record.intent.id,fingerprint:record.fingerprint,
      providerId:outpoint.txid,outcome:'settled',verified:true}));
    await vault.transaction(state=>state.treasureProofRuns[runId].receipts.push({kind,...outpoint,script}));
    return outpoint;
  }
  const coin=available[0];
  const funding=recovering?await verifyOutput(originalRun.receipts.find(r=>r.kind==='fund').txid,hex.encode(contract.pkScript)):
    await mutate('fund',game,contract.address,hex.encode(contract.pkScript),()=>signAndSubmitOffchainTx({
    identity:identities[0],provider:ark,inputs:[{...coin,tapLeafScript:coin.forfeitTapLeafScript}],
    outputs:[{script:contract.pkScript,amount:1000n},{script:ArkAddress.decode(gameAddress).pkScript,amount:BigInt(coin.value)-1000n}],
    serverUnrollScript:client.checkpoint,
  }));
  async function rejectedFixture(label,fixtureBranch,destinationScript,signerIndexes){
    currentOperation=runId+'-'+label;stage=label;
    const signer=fixtureBranch==='claim'?player:game;
    const {arkTx,checkpoints}=await contract.functions[fixtureBranch]().from(funding).to(destinationScript,1000n).build();
    let tx=arkTx,cp=checkpoints;
    for(const index of signerIndexes){
      tx=await identities[index].sign(tx,[0]);cp=await Promise.all(cp.map(c=>identities[index].sign(c,[0])));
    }
    await operations.prepare({id:currentOperation,account:signer.label,profileId:signer.profileId,
      generation:signer.generation,network,kind:fixtureBranch==='claim'?'claim':'refund',
      recipient:contract.address,amountSats:1000,feeSats:0,sourceOrigin:null});
    const result=await operations.submit(currentOperation,async()=>{
      await emulator.submitTx(base64.encode(tx.toPSBT()),cp.map(c=>base64.encode(c.toPSBT())));
      return {providerId:tx.id};
    });
    const requests=await vault.transaction(state=>state.treasureProofRuns[runId].recovery[currentOperation]);
    const failure=requests.find(r=>r.kind==='emulator-submitTx-failure')?.request?.[0];
    let rejected=false;
    try{
      const detail=JSON.parse(failure.slice('Failed to submit tx to emulator: '.length));
      rejected=detail.code===3&&/execut.*script|script.*(fail|false)|opcode|VERIFY/i.test(detail.message);
    }catch{/* Transport failure or an unrecognized error is not a rejected spend. */}
    if(result.providerId||!rejected)throw Error('treasure-live-negative-outcome-unknown');
    const {vtxos}=await indexer.getVtxos({outpoints:[funding]});
    if(!vtxos.some(c=>c.txid===funding.txid&&c.vout===funding.vout&&!c.isSpent&&!c.spentBy&&
      c.value===1000&&c.script===hex.encode(contract.pkScript)))throw Error('treasure-live-negative-source-unverified');
    await operations.reconcile(currentOperation,async record=>({id:record.intent.id,fingerprint:record.fingerprint,
      providerId:tx.id,outcome:'failed',verified:true}));
    await vault.transaction(state=>{
      const run=state.treasureProofRuns[runId];run.negativeResults??=[];
      run.negativeResults.push({label,transactionId:tx.id,rejected:true});
    });
    process.stdout.write(JSON.stringify({runId,network,negativeFixture:label,rejected:true})+'\n');
  }
  let branch=recovering||scenario==='expiry'?'refund':scenario;
  if(scenario==='expiry'){
    if(Date.now()>=Number(built.args.deadline)*1000)throw Error('treasure-live-early-boundary-not-observed');
    await rejectedFixture('early-refund','refund',ArkAddress.decode(gameAddress).pkScript,[0]);
    if(Date.now()<Number(built.args.deadline)*1000)
      await rejectedFixture('wrong-destination','claim',ArkAddress.decode(gameAddress).pkScript,[1]);
    stage='waiting-expiry';
    process.stdout.write(JSON.stringify({runId,network,stage,deadlineSeconds:Number(built.args.deadline)})+'\n');
    while(Date.now()<Number(built.args.deadline)*1000)await new Promise(resolve=>setTimeout(resolve,1000));
    await rejectedFixture('late-claim','claim',ArkAddress.decode(playerAddress).pkScript,[1]);
  }
  const destination=branch==='claim'?playerAddress:gameAddress;
  const destinationScript=ArkAddress.decode(destination).pkScript;
  const receipt=await mutate(branch,branch==='claim'?player:game,destination,hex.encode(destinationScript),async()=>{
    const {arkTx,checkpoints}=await contract.functions[branch]().from(funding).to(destinationScript,1000n).build();
    if(arkTx.outputsLength!==3||arkTx.getOutput(0).amount!==1000n||
      hex.encode(arkTx.getOutput(0).script)!==hex.encode(destinationScript)||
      hex.encode(arkTx.getOutput(2).script)!=='51024e73')throw Error('treasure-live-layout-mismatch');
    const signers=branch==='reject'?identities:[branch==='claim'?identities[1]:identities[0]];
    let tx=arkTx,cp=checkpoints;
    for(const identity of signers){
      tx=await identity.sign(tx,[0]);cp=await Promise.all(cp.map(c=>identity.sign(c,[0])));
    }
    inspectTreasureSpendPlan(base64.encode(tx.toPSBT()),cp.map(c=>base64.encode(c.toPSBT())),{
      funding:{...funding,script:hex.encode(contract.pkScript)},destinationScript:hex.encode(destinationScript),
      participantKeys:signers.map((_,i)=>branch==='reject'?(i===0?params.game:params.player):branch==='claim'?params.player:params.game),
    });
    const result=await emulator.submitTx(base64.encode(tx.toPSBT()),cp.map(c=>base64.encode(c.toPSBT())));
    const returned=Transaction.fromPSBT(base64.decode(result.signedArkTx));
    if(returned.id!==arkTx.id)throw Error('treasure-live-returned-transaction-mismatch');
    return returned.id;
  });
  await vault.transaction(state=>{state.treasureProofRuns[runId].completedAt=Date.now();});
  process.stdout.write(JSON.stringify({ok:true,runId,network,scenario,receipt,
    compatibility:true,productionAcceptance:false})+'\n');
}catch(error){
  const reason=/^treasure-live-[a-z-]+$/.test(error?.message??'')?error.message:'treasure-live-operation-unavailable';
  process.stdout.write(JSON.stringify({ok:false,runId,network,stage,reason})+'\n');process.exitCode=1;
}finally{
  await gameWallet?.dispose();await playerWallet?.dispose();
}
