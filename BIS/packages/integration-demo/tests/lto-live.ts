import {MnemonicIdentity,SingleKey,DefaultVtxo,CSVMultisigTapscript,RestArkProvider,RestIndexerProvider,signAndSubmitOffchainTx,claimWithPreimageIdentity,Transaction} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import {createGameWalletStorage} from '../../integration/src/core/game-wallet-storage.ts';
import {withWalletMutation} from '../../integration/src/core/boarding-record.ts';
import {walletReservations} from '../../integration/src/core/wallet-reservations.ts';
import {buildLtoScript} from '../../integration/src/arkade/lto-script.ts';

const button=document.querySelector<HTMLButtonElement>('#run')!, result=document.querySelector<HTMLPreElement>('#result')!;
const log=(data:unknown)=>{result.textContent+='\n'+JSON.stringify(data);};
const sha=async(bytes:Uint8Array)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)));
const ark=new RestArkProvider('https://signet.arkade.sh'),indexer=new RestIndexerProvider('https://signet.arkade.sh');
let phase='ready';
const raceMode=new URL(location.href).searchParams.get('mode')==='race';
if(raceMode)button.textContent='Run funded claim/refund race probe';
async function output(txid:string,script:Uint8Array,value=1000,vout=0) {
  const until=Date.now()+30000;
  do {
    const coins=(await indexer.getVtxos({outpoints:[{txid,vout}]})).vtxos;
    const coin=coins.find(c=>c.script===hex.encode(script)&&c.value===value&&!c.assets?.length&&!c.isSpent&&!c.isSwept&&!c.isUnrolled);
    if(coin)return coin;
    await new Promise(resolve=>setTimeout(resolve,1000));
  }while(Date.now()<until);
  throw Error('OUTPUT_NOT_VERIFIED');
}
button.onclick=async()=>{
  button.disabled=true;result.textContent='Starting';
  const storage=createGameWalletStorage();
  try {
    const account=await storage.load();
    if(!account)throw Error('GAME_WALLET_NOT_CONFIGURED');
    await withWalletMutation(async()=>{
      if(walletReservations(account.profileId).length)throw Error('EXISTING_WALLET_OPERATION_PENDING');
      const info=await ark.getInfo();
      if(info.network!=='signet'||info.fees.txFeeRate!=='0'||Object.values(info.fees.intentFee).some(v=>v!==''&&v!=='0'))throw Error('UNSUPPORTED_NETWORK_OR_FEES');
      log({phase:'info',network:info.network,feeRate:info.fees.txFeeRate,gameId:account.profileId});
      const game=MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false});
      const operatorKey=hex.decode(info.signerPubkey).slice(-32),gameKey=await game.xOnlyPublicKey();
      const defaults={serverPubKey:operatorKey,csvTimelock:{type:'seconds' as const,value:info.unilateralExitDelay}};
      const gameScript=new DefaultVtxo.Script({...defaults,pubKey:gameKey});
      const checkpoint=CSVMultisigTapscript.decode(hex.decode(info.checkpointTapscript));
      const evidenceKey=`bis-lto-probe-public-v1:${account.profileId}`;
      const evidence:unknown[]=JSON.parse(localStorage.getItem(evidenceKey)??'[]');
      const save=(data:unknown)=>{evidence.push(data);localStorage.setItem(evidenceKey,JSON.stringify(evidence));log(data);};
      // All derived private data remains local and reproducible from the game signer.
      for(const scenario of raceMode?['race']:['claim','cancel','expiry']) {
        const derive=async(label:string)=>sha(await game.signSchnorrDeterministic(await sha(new TextEncoder().encode(`bis-lto-probe-browser-v1:${scenario}:${label}`))));
        const player=SingleKey.fromPrivateKey(await derive('player'));
        const secret=await derive('secret');
        const playerScript=new DefaultVtxo.Script({...defaults,pubKey:await player.xOnlyPublicKey()});
        const contract=buildLtoScript({playerKey:await player.xOnlyPublicKey(),gameKey,operatorKey,secretHash:await sha(secret),exitDelay:info.unilateralExitDelay});
        const previous=(await indexer.getVtxos({scripts:[hex.encode(contract.script.pkScript)],spendableOnly:true})).vtxos;
        if(previous.length)throw Error('EXISTING_PROBE_CONTRACT_RECOVERY_REQUIRED');
        phase=`${scenario}:prepare`;
        const before=(await indexer.getVtxos({scripts:[hex.encode(gameScript.pkScript)],spendableOnly:true})).vtxos;
        const eligible=before.filter(c=>!c.assets?.length&&!c.isSpent&&!c.isSwept&&!c.isUnrolled&&(raceMode?c.value>=1330:(c.value===1000||c.value>=1330))).sort((a,b)=>a.value-b.value);
        const coin=eligible[0];if(!coin)throw Error('NO_ELIGIBLE_ASSET_FREE_INPUT');
        const initial=(await indexer.getVtxos({scripts:[hex.encode(playerScript.pkScript)],spendableOnly:true})).vtxos;
        if(initial.length)throw Error('TEST_PLAYER_NOT_EMPTY');
        const spend=async(input:typeof coin,script:DefaultVtxo.Script|typeof contract.script,leaf:ReturnType<typeof script.findLeaf>,signer:typeof game|typeof player,destination:Uint8Array,lostAck=false)=>{
          const change=input.value-1000;
          if(input.assets?.length||change<0||(change>0&&change<330))throw Error('INVALID_INPUT');
          let id:string|undefined;
          const provider={submitTx:async(encoded:string,checkpoints:string[])=>{
            id=Transaction.fromPSBT(base64.decode(encoded)).id;
            save({phase,submittedId:id,input:{txid:input.txid,vout:input.vout},destination:hex.encode(destination),changeSats:change});
            return ark.submitTx(encoded,checkpoints);
          },finalizeTx:async(txid:string,checkpoints:string[])=>{await ark.finalizeTx(txid,checkpoints);if(lostAck)throw Error('LOST_ACK');}};
          try {
            id=await signAndSubmitOffchainTx({identity:signer,provider,inputs:[{txid:input.txid,vout:input.vout,value:input.value,tapLeafScript:leaf,tapTree:script.encode()}],outputs:[{script:destination,amount:1000n},...(change?[{script:gameScript.pkScript,amount:BigInt(change)}]:[])],serverUnrollScript:checkpoint,verifyServerSignatures:{serverPubkey:operatorKey}});
          }catch(error){if(!(lostAck&&error instanceof Error&&error.message==='LOST_ACK'&&id))throw error;}
          if(!id)throw Error('MISSING_TRANSACTION_ID');
          const received=await output(id,destination);
          if(change)await output(id,gameScript.pkScript,change,1);
          return received;
        };
        phase=`${scenario}:fund`;let started=Date.now();
        const funded=await spend(coin,gameScript,gameScript.forfeit(),game,contract.script.pkScript);
        save({phase,txid:funded.txid,verified:true,elapsedMs:Date.now()-started});
        if(raceMode) {
          phase='race:resolve';started=Date.now();
          // This deliberately races both valid branches on the same disposable contract.
          // A losing provider response is never treated as proof of the winner.
          const outcomes=await Promise.allSettled([
            spend(funded,contract.script,contract.script.findLeaf(hex.encode(contract.claim)),claimWithPreimageIdentity(player,secret),playerScript.pkScript,true),
            spend(funded,contract.script,contract.script.findLeaf(hex.encode(contract.refund)),game,gameScript.pkScript),
          ]);
          const source=(await indexer.getVtxos({outpoints:[{txid:funded.txid,vout:funded.vout}]})).vtxos[0];
          const matching=outcomes.flatMap((outcome,index)=>outcome.status==='fulfilled'&&outcome.value.txid===source?.arkTxId?[{index,coin:outcome.value}]:[]);
          if(!source?.spentBy||matching.length!==1)throw Error('RACE_WINNER_NOT_VERIFIED');
          const winner=matching[0];
          save({phase,verified:true,txid:winner.coin.txid,winner:winner.index===0?'claim':'refund',receivedSats:winner.coin.value,elapsedMs:Date.now()-started,loserOutcome:outcomes[1-winner.index].status});
          if(winner.index===0) {
            phase='race:return-reward';
            const returned=await spend(winner.coin,playerScript,playerScript.forfeit(),player,gameScript.pkScript);
            save({phase,txid:returned.txid,returnedSats:returned.value});
          }
          const unrelated=before.filter(c=>c.txid!==coin.txid||c.vout!==coin.vout);
          const after=unrelated.length?(await indexer.getVtxos({outpoints:unrelated.map(c=>({txid:c.txid,vout:c.vout}))})).vtxos:[];
          if(!unrelated.every(old=>after.some(c=>c.txid===old.txid&&c.vout===old.vout&&c.value===old.value&&c.script===old.script&&!c.isSpent&&!c.spentBy&&JSON.stringify(c.assets??[])===JSON.stringify(old.assets??[]))))throw Error('UNRELATED_INPUTS_CHANGED');
          save({phase:'race:preservation',verified:true,unrelatedInputs:unrelated.length,assetInputs:unrelated.filter(c=>c.assets?.length).length,changeSats:coin.value-1000});
          continue;
        }
        if(scenario==='expiry')await new Promise(resolve=>setTimeout(resolve,1000));
        phase=`${scenario}:resolve`;started=Date.now();
        const claiming=scenario==='claim';
        const received=await spend(funded,contract.script,contract.script.findLeaf(hex.encode(claiming?contract.claim:contract.refund)),claiming?claimWithPreimageIdentity(player,secret):game,claiming?playerScript.pkScript:gameScript.pkScript,claiming);
        const source=(await indexer.getVtxos({outpoints:[{txid:funded.txid,vout:funded.vout}]})).vtxos[0];
        if(!source?.spentBy||source.arkTxId!==received.txid)throw Error('SOURCE_SPEND_NOT_VERIFIED');
        save({phase,txid:received.txid,receivedSats:received.value,verified:true,sourceSpent:true,elapsedMs:Date.now()-started,lostAckReconciled:claiming});
        if(claiming){phase='claim:return-reward';const returned=await spend(received,playerScript,playerScript.forfeit(),player,gameScript.pkScript);save({phase,txid:returned.txid,returnedSats:returned.value});}
      }
      log({result:'PASS'});
    },account.profileId);
  }catch(error){
    const message=error instanceof Error?error.message:'';
    const known=message.match(/GAME_WALLET_NOT_CONFIGURED|EXISTING_WALLET_OPERATION_PENDING|UNSUPPORTED_NETWORK_OR_FEES|EXISTING_PROBE_CONTRACT_RECOVERY_REQUIRED|NO_ELIGIBLE_ASSET_FREE_INPUT|OUTPUT_NOT_VERIFIED|SOURCE_SPEND_NOT_VERIFIED|RACE_WINNER_NOT_VERIFIED|UNRELATED_INPUTS_CHANGED|TEST_PLAYER_NOT_EMPTY|INVALID_SIGNATURE|INVALID_PSBT|fetch failed|Failed to fetch/);
    log({result:'BLOCKED',phase,errorClass:error instanceof Error?error.name:'Error',reason:known?.[0]??'Provider failure; raw payload suppressed'});
  }finally{storage.dispose();button.disabled=false;}
};
