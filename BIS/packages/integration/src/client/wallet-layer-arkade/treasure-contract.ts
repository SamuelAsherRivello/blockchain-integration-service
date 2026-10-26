import {arkade,RestArkProvider,RestIndexerProvider,RestEmulatorProvider,Transaction,getNetwork,VtxoScript} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {buildTreasureScript} from './treasure-script.ts';
import {inspectTreasureSpendPlan} from './treasure-spend-plan.ts';
import {inspectTreasureRecoveryPlan} from './treasure-recovery-plan.ts';
import {inspectTreasureDirectPolicy} from './treasure-direct-policy.ts';
import {operatorFor,type WalletAccount} from './account.ts';
import {signingIdentity} from './wallet-identity.ts';
import {createAccountStorage} from '../state-layer-core/account-storage.ts';
import {finishContractOperation,markContractSubmission,type ContractRecord} from '../state-layer-core/contracts.ts';
import type {ContractRecovery} from '../state-layer-core/contract-storage.ts';
import {TREASURE_EMULATOR} from './treasure-capability.ts';
import {observeTreasureRequest} from './treasure-observation.ts';

export {TREASURE_EMULATOR} from './treasure-capability.ts';
type Result={record:ContractRecord;recovery:ContractRecovery};
type Reconcile=(record:ContractRecord,recovery:ContractRecovery)=>Promise<Result>;
const attempts=new Map<string,number>();

/** Private adapter. No provider error, PSBT, identity or raw response reaches the public DTO. */
export async function submitTreasureSpend(initial:ContractRecord,recovery:ContractRecovery,account:WalletAccount,
  commit:(record:ContractRecord,recovery:ContractRecovery)=>Promise<void>,isCurrent:()=>boolean,reconcile:Reconcile):Promise<Result>{
  let record=initial,material=recovery,called=false;
  try{
    const t=material.treasure,fund=material.fundingOutput;
    if(!t||!fund||t.network!=='mutinynet'||record.scope.network!==t.network||record.scope.operator!==operatorFor(t.network)||
      record.scope.playerId===record.scope.gameId||account.network!==t.network||record.operation.submission!=='prepared'||
      t.offerSessionId!==record.sessionId||t.hostReference!==record.hostReference||t.startedAtMs!==record.startedAt||
      (Math.floor(t.startedAtMs/1000)+90)*1000!==record.expiresAt||record.amountSats!==1000||
      record.validationMode!=='arkade-covenant-v2'||t.emulator!==TREASURE_EMULATOR.key.slice(2))throw Error();
    const ark=new RestArkProvider(operatorFor(t.network)),indexer=new RestIndexerProvider(operatorFor(t.network));
    const emulator=new RestEmulatorProvider(TREASURE_EMULATOR.url);
    const [info,emulatorInfo]=await observeTreasureRequest(Promise.all([ark.getInfo(),emulator.getInfo()]));
    inspectTreasureDirectPolicy(t.network,info);
    if(info.signerPubkey.slice(2)!==t.operator||emulatorInfo.signerPubkey!==TREASURE_EMULATOR.key)throw Error();
    const built=buildTreasureScript(t);
    if(hex.encode(built.script.encode())!==material.contractScript)throw Error();
    const source=(await observeTreasureRequest(indexer.getVtxos({outpoints:[fund]}))).vtxos;
    if(source.length!==1||source[0].script!==hex.encode(built.script.pkScript)||source[0].value!==1000||
      source[0].isSpent||source[0].spentBy||source[0].isUnrolled||source[0].isSwept||source[0].assets?.length)throw Error();
    const branch=record.operation.kind==='claim'?'claim':Date.now()>=record.expiresAt?'refund':
      record.ended==='rejected'?'reject':record.ended==='session-ended'?'cancel':undefined;
    if(!branch||(branch==='claim'&&Date.now()>=record.expiresAt))throw Error();
    const identity=signingIdentity(account);
    const expected=branch==='claim'?t.player:t.game;
    if(hex.encode(await identity.xOnlyPublicKey())!==expected||account.profileId!==(branch==='claim'?record.scope.playerId:record.scope.gameId))throw Error();
    const signers=[identity];
    if(branch==='reject'||branch==='cancel'){
      const player=(await createAccountStorage(t.network).load()).account;
      if(!player||player.profileId!==record.scope.playerId||player.network!==t.network)throw Error();
      const playerIdentity=signingIdentity(player);
      if(hex.encode(await playerIdentity.xOnlyPublicKey())!==t.player)throw Error();
      signers.push(playerIdentity);
    }
    const client=await observeTreasureRequest(arkade.Arkade.connect({arkade:ark,indexer,emulator,emulatorPubkey:TREASURE_EMULATOR.key,
      identity,network:getNetwork(t.network)}));
    const contract=client.contract(built.program,built.args);
    if(hex.encode(contract.pkScript)!==hex.encode(built.script.pkScript))throw Error();
    const destination=VtxoScript.decode(hex.decode(branch==='claim'?material.playerScript:material.gameScript)).pkScript;
    const {arkTx,checkpoints}=await observeTreasureRequest(contract.functions[branch]().from(fund).to(destination,1000n).build());
    let signed=arkTx,cps=checkpoints;
    for(const signer of signers){signed=await signer.sign(signed,[0]);cps=await Promise.all(cps.map(cp=>signer.sign(cp,[0])));}
    const encoded=base64.encode(signed.toPSBT()),encodedCps=cps.map(cp=>base64.encode(cp.toPSBT()));
    const plan=inspectTreasureSpendPlan(encoded,encodedCps,{funding:{...fund,script:hex.encode(contract.pkScript)},
      destinationScript:hex.encode(destination),participantKeys:branch==='claim'?[t.player]:branch==='refund'?[t.game]:[t.player,t.game]});
    material={...material,spend:{operationId:record.operation.id,transactionId:plan.transactionId,inputs:[fund],
      destinationScript:hex.encode(destination),amountSats:1000},emulatorSubmission:{transactionId:plan.transactionId,arkTx:encoded,checkpoints:encodedCps}};
    record=markContractSubmission(record,record.operation.id,Date.now());
    await commit(record,material);
    if(!isCurrent()||(branch!=='refund'&&Date.now()>=record.expiresAt))throw Error();
    called=true;
    attempts.set(plan.transactionId,Date.now());
    const response=await observeTreasureRequest(emulator.submitTx(encoded,encodedCps),30000);
    if(Transaction.fromPSBT(base64.decode(response.signedArkTx)).id!==plan.transactionId)throw Error();
    const result=await observeTreasureRequest(reconcile(record,material));await commit(result.record,result.recovery);return result;
  }catch{
    record=called?markContractSubmission(record,record.operation.id,Date.now(),true):
      finishContractOperation({...record,operation:{...record.operation,submission:'prepared'}},
        {operationId:record.operation.id,kind:record.operation.kind,outcome:'not-submitted'});
    await commit(record,material);return {record,recovery:material};
  }
}

/** Original-transaction recovery only. No re-signing, replacement or change of enforcement mode. */
export async function resumeTreasureSpend(record:ContractRecord,recovery:ContractRecovery,reconcile:Reconcile):Promise<Result>{
  inspectTreasureRecoveryPlan(record,recovery);
  const observed=await observeTreasureRequest(reconcile(record,recovery));
  if(observed.record.operation.submission==='confirmed')return observed;
  const saved=recovery.emulatorSubmission!;
  try{
    if(Date.now()-(attempts.get(saved.transactionId)??0)<60000)return observed;
    const emulator=new RestEmulatorProvider(TREASURE_EMULATOR.url);
    if((await observeTreasureRequest(emulator.getInfo())).signerPubkey!==TREASURE_EMULATOR.key)return observed;
    attempts.set(saved.transactionId,Date.now());
    await observeTreasureRequest(emulator.submitTx(saved.arkTx,[...saved.checkpoints]),30000);
  }catch{/* A generic provider error is uncertainty, never a competing refund. */}
  return observeTreasureRequest(reconcile(record,recovery));
}
