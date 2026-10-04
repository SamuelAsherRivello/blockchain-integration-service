// Disposable Signet-only probe. Secrets stay in process memory; output is public evidence only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RestArkProvider,RestIndexerProvider,SingleKey,MnemonicIdentity,DefaultVtxo,CSVMultisigTapscript,signAndSubmitOffchainTx,claimWithPreimageIdentity,Transaction} from '@arkade-os/sdk';
import {createInterface} from 'node:readline';
import {buildLtoScript} from '../packages/integration/src/arkade/lto-script.ts';

const OPERATOR='https://signet.arkade.sh';
const hex=value=>Buffer.from(value).toString('hex');
const fromHex=value=>new Uint8Array(Buffer.from(value,'hex'));
const originalFetch=globalThis.fetch;
globalThis.fetch=(url,options={})=>originalFetch(url,{...options,signal:AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(15000)])});
const ark=new RestArkProvider(OPERATOR),indexer=new RestIndexerProvider(OPERATOR);
const emit=value=>console.log(JSON.stringify(value));
let phase='info';
async function findOutput(txid,script) {
  const deadline=Date.now()+45000;
  do {
    const {vtxos}=await indexer.getVtxos(txid?{outpoints:[{txid,vout:0}]}:{scripts:[hex(script.pkScript)]});
    const coin=vtxos.find(c=>c.script===hex(script.pkScript)&&c.value===1000&&!c.isSpent&&!c.isSwept&&!c.isUnrolled&&!c.assets?.length);
    if(coin)return coin;
    await new Promise(resolve=>setTimeout(resolve,1500));
  }while(Date.now()<deadline);
  throw Error('OUTPUT_NOT_VERIFIED');
}
try {
  let configuredGame;
  if(process.argv.includes('--funded-stdin')) {
    phase='private-input';
    const reader=createInterface({input:process.stdin,terminal:false});
    let phrase='';
    for await(const line of reader){phrase=line.trim();break;}
    reader.close();
    configuredGame=MnemonicIdentity.fromMnemonic(phrase,{isMainnet:false});
    phrase='';
  }
  phase='info';
  const info=await ark.getInfo();
  assert.equal(info.network,'signet');
  assert.equal(info.fees.txFeeRate,'0');
  assert(Object.values(info.fees.intentFee).every(f=>f===''||f==='0'));
  const operatorKey=fromHex(info.signerPubkey).slice(-32);
  const serverUnrollScript=CSVMultisigTapscript.decode(fromHex(info.checkpointTapscript));
  emit({phase,network:info.network,sdk:'0.4.71',operatorVersion:info.version,fees:info.fees,minVtxo:String(info.vtxoMinAmount),exitDelay:String(info.unilateralExitDelay)});
  for(const scenario of ['claim','cancel','expiry']) {
    const game=configuredGame??SingleKey.fromRandomBytes();
    // Configured probes derive test claim keys from the supplied signer, so an
    // interruption does not make the test receiver permanently unrecoverable.
    const derive=async label=>new Uint8Array(createHash('sha256').update(await game.signSchnorrDeterministic(new Uint8Array(createHash('sha256').update(`bis-lto-probe-v1:${scenario}:${label}`).digest()))).digest());
    const player=configuredGame?SingleKey.fromPrivateKey(await derive('player')):SingleKey.fromRandomBytes();
    const gameKey=await game.xOnlyPublicKey(),playerKey=await player.xOnlyPublicKey();
    const options={serverPubKey:operatorKey,csvTimelock:{type:'seconds',value:info.unilateralExitDelay}};
    const gameScript=new DefaultVtxo.Script({...options,pubKey:gameKey});
    const playerScript=new DefaultVtxo.Script({...options,pubKey:playerKey});
    const secret=configuredGame?await derive('claim-secret'):crypto.getRandomValues(new Uint8Array(32));
    const contract=buildLtoScript({gameKey,playerKey,operatorKey,secretHash:new Uint8Array(createHash('sha256').update(secret).digest()),exitDelay:info.unilateralExitDelay});
    const initial=await indexer.getVtxos({scripts:[hex(playerScript.pkScript)]});
    assert.equal(initial.vtxos.length,0);
    const address=gameScript.address('tark',operatorKey).encode();
    let gameCoin;
    if(configuredGame) {
      phase=`${scenario}:funded-wallet`;
      const existing=await indexer.getVtxos({scripts:[hex(contract.script.pkScript)],spendableOnly:true});
      if(existing.vtxos.length)throw Error('EXISTING_PROBE_CONTRACT_RECOVERY_REQUIRED');
      const available=await indexer.getVtxos({scripts:[hex(gameScript.pkScript)],spendableOnly:true});
      gameCoin=available.vtxos.filter(c=>!c.isSpent&&!c.isSwept&&!c.isUnrolled&&!c.assets?.length&&(c.value===1000||c.value>=1330)).sort((a,b)=>a.value-b.value)[0];
      if(!gameCoin)throw Error('NO_ELIGIBLE_ASSET_FREE_INPUT');
      emit({phase,address,inputSats:gameCoin.value});
    } else {
      phase=`${scenario}:faucet`;
      const faucet=await fetch('https://faucet.signet.arkade.sh/faucet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address,amount:1000})});
      emit({phase,httpStatus:faucet.status,address});
      // Reconcile even a failed acknowledgement without requesting funds again.
      try { gameCoin=await findOutput(undefined,gameScript); }
      catch(error) { if(!faucet.ok)throw Error(`FAUCET_HTTP_${faucet.status}`); throw error; }
    }
    const spend=async(coin,script,leaf,identity,destination,simulateLostAck=false)=>{
      let submittedId;
      const provider={submitTx:async(...args)=>{
        const local=Transaction.fromPSBT(new Uint8Array(Buffer.from(args[0],'base64')));
        submittedId=local.id;
        return ark.submitTx(...args);
      },finalizeTx:async(...args)=>{await ark.finalizeTx(...args);if(simulateLostAck)throw Error('SIMULATED_LOST_FINALIZE_ACK');}};
      assert(!coin.assets?.length);
      const change=coin.value-1000;
      assert(change===0||change>=330);
      try {return await signAndSubmitOffchainTx({identity,provider,inputs:[{txid:coin.txid,vout:coin.vout,value:coin.value,tapLeafScript:leaf,tapTree:script.encode()}],outputs:[{script:destination.pkScript,amount:1000n},...(change?[{script:gameScript.pkScript,amount:BigInt(change)}]:[])],serverUnrollScript,verifyServerSignatures:{serverPubkey:operatorKey}});}
      catch(error){if(simulateLostAck&&error.message==='SIMULATED_LOST_FINALIZE_ACK'&&submittedId)return submittedId;throw error;}
    };
    phase=`${scenario}:fund`;
    let started=Date.now();
    const fundingId=await spend(gameCoin,gameScript,gameScript.forfeit(),game,contract.script);
    const funded=await findOutput(fundingId,contract.script);
    emit({phase,transactionId:fundingId,amountSats:funded.value,elapsedMs:Date.now()-started});
    if(scenario==='expiry') {
      // Short probe eligibility deadline; production gameplay uses 90 seconds.
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    phase=`${scenario}:resolve`;
    started=Date.now();
    const destination=scenario==='claim'?playerScript:gameScript;
    const signer=scenario==='claim'?claimWithPreimageIdentity(player,secret):game;
    const leaf=contract.script.findLeaf(hex(scenario==='claim'?contract.claim:contract.refund));
    const resolutionId=await spend(funded,contract.script,leaf,signer,destination,scenario==='claim');
    const received=await findOutput(resolutionId,destination);
    const source=(await indexer.getVtxos({outpoints:[{txid:fundingId,vout:0}]})).vtxos[0];
    assert(source?.isSpent||source?.spentBy);
    assert.equal(source.arkTxId,resolutionId);
    emit({phase,transactionId:resolutionId,receivedSats:received.value,elapsedMs:Date.now()-started,sourceSpent:true,sourceArkTxId:source.arkTxId,zeroStartingPlayer:scenario==='claim',lostFinalizeAckReconciled:scenario==='claim'});
    if(configuredGame&&scenario==='claim') {
      phase='claim:return-test-reward';
      const returnedId=await spend(received,playerScript,playerScript.forfeit(),player,gameScript);
      await findOutput(returnedId,gameScript);
      emit({phase,transactionId:returnedId,returnedSats:1000});
    }
  }
  emit({result:'PASS'});
}catch(error){
  // Do not print provider payloads or stack locals: they may contain signed artifacts/preimages.
  const message=String(error?.message??'');
  const known=message.match(/FAUCET_HTTP_\d+|OUTPUT_NOT_VERIFIED|EXISTING_PROBE_CONTRACT_RECOVERY_REQUIRED|NO_ELIGIBLE_ASSET_FREE_INPUT|INVALID_SIGNATURE|INVALID_PSBT|TX_REJECTED|fetch failed|timed out|Missing expected|Expected values/);
  emit({result:'BLOCKED',phase,errorClass:error?.name??'Error',reason:known?.[0]??'Provider or assertion failure; raw payload suppressed.'});
  process.exitCode=1;
}
