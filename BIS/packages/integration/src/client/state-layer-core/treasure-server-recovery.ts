import {Transaction,Extension,EmulatorPacket} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {base64,hex} from '@scure/base';
import type {ContractRecord} from './contracts.ts';
import type {ContractRecovery} from './contract-storage.ts';
import {TREASURE_EMULATOR} from '../wallet-layer-arkade/treasure-capability.ts';
import {validateTreasureServerJournal,advanceTreasureServerJournal,type TreasureServerJournal} from '../wallet-layer-arkade/treasure-server-journal.ts';
import {assertTreasurePsbtEquivalent} from '../wallet-layer-arkade/treasure-psbt-equivalence.ts';

export type TreasureServerJournals=Readonly<Record<string,TreasureServerJournal>>;
const deny=()=>Error('Treasure server recovery could not be verified. Original operations remain reserved.');
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(key=>[key,(v as Record<string,unknown>)[key]])):v);
const same=(a:unknown,b:unknown)=>stable(a)===stable(b);
const decode=(value:string)=>Transaction.fromPSBT(base64.decode(value));
function journals(value:unknown):asserts value is TreasureServerJournals{
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||
    Object.keys(value).length>1000||Reflect.ownKeys(value).length!==Object.keys(value).length||
    Object.entries(Object.getOwnPropertyDescriptors(value)).some(([key,descriptor])=>
      !/^[a-zA-Z0-9-]{1,100}$/.test(key)||['constructor','prototype','__proto__'].includes(key)||!Object.hasOwn(descriptor,'value')))throw deny();
}
function spendRoot(journal:TreasureServerJournal){
  const b=journal.binding;if(b.kind!=='spend')throw deny();
  const actor=journal.requests.find(r=>r.purpose==='actor-proof'&&r.phase==='completed');if(!actor?.responseJson)throw deny();
  // The journal validator already authenticates this proof against its exact
  // branch/checkpoint digest and Game key. It is not a new signing operation.
  const result=JSON.parse(actor.responseJson).result as {$type:string;value:string},proof=hex.decode(result.value);
  const root=decode(b.actorTemplate.arkTx),packet=Extension.fromTx(root).getEmulatorPacket(),entry=packet?.entries[0];
  if(!entry||packet!.entries.length!==1)throw deny();
  const player=b.actorTemplate.playerProof,witness=RawWitness.encode(player?[hex.decode(player),proof]:[proof]);
  root.updateOutput(1,Extension.create([EmulatorPacket.create([{vin:0,script:entry.script,witness}])]).txOut());
  return root;
}
function currentSpend(record:ContractRecord,recovery:ContractRecovery,journal:TreasureServerJournal){
  const b=journal.binding;if(b.kind!=='spend'||record.operation.kind!=='refund'||
    b.branch==='reject'&&record.ended!=='rejected'||b.branch==='cancel'&&record.ended!=='session-ended')throw deny();
  const stage=recovery.treasureStage;
  if(stage){
    if(stage.binding.operationId!==b.operationId||stage.binding.artifactVersion!==4||stage.binding.branch!==b.branch||
      stage.binding.checkpointTapscript!==b.checkpointTapscript)throw deny();
    assertTreasurePsbtEquivalent(stage.binding.original.checkpoints[0],b.actorTemplate.checkpoint,1,2);
  }
  const request=journal.requests.find(r=>r.purpose==='root'),spend=recovery.spend;
  if(spend||stage||request){
    const root=spendRoot(journal);
    if(stage&&decode(stage.binding.original.arkTx).id!==root.id)throw deny();
    if(request){
      const args=JSON.parse(request.argsJson) as [{$type:string;value:string},unknown];
      const actual=Transaction.fromPSBT(hex.decode(args[0].value));if(actual.id!==root.id)throw deny();
    }
    if(spend&&(spend.operationId!==b.operationId||spend.transactionId!==root.id||spend.amountSats!==1000||spend.change!==undefined||
      spend.destinationScript!=='5120'+b.terms.gameDestination||!same(spend.inputs,[b.funding])))throw deny();
  }
}

/** Called after the existing versioned descriptor validator. All nested private
 * journals are authenticated even when they belong to older operations. */
export function validateTreasureServerRecovery(record:ContractRecord,recovery:ContractRecovery):void{
  try{
    const map=recovery.treasureServerJournals;if(map===undefined)return;journals(map);
    if(recovery.treasureArtifactVersion!==4||!recovery.treasure||recovery.treasure.emulator!==TREASURE_EMULATOR.key.slice(2)||
      record.purpose!=='treasureLTO'||record.validationMode!=='arkade-covenant-v2'||record.amountSats!==1000)throw deny();
    let identity:Readonly<{endpoint:string;gameId:string;publicKey:string}>|undefined;
    for(const [operationId,journal] of Object.entries(map)){
      validateTreasureServerJournal(journal);const b=journal.binding,current=operationId===record.operation.id;
      if(b.artifactVersion!==4||b.operationId!==operationId||b.contractId!==record.id||b.network!==record.scope.network||
        b.profileId!==record.scope.gameId||!same(b.terms,recovery.treasure)||b.publicKey.slice(2)!==recovery.gameKey)throw deny();
      const original={endpoint:b.endpoint,gameId:b.gameId,publicKey:b.publicKey};
      if(identity&&!same(identity,original))throw deny();identity=original;
      if(b.kind==='fund'){
        const root=decode(b.original.arkTx),point={txid:root.id,vout:0,value:1000};
        if(recovery.fundingOutput&&!same(recovery.fundingOutput,point)||!current&&!recovery.fundingOutput||current&&record.operation.kind!=='fund')throw deny();
        if(current&&recovery.spend){
          const spend=recovery.spend,output=root.getOutput(0),inputs=b.original.checkpoints.map(value=>{
            const source=decode(value).getInput(0);return {txid:hex.encode(source.txid!),vout:source.index!,value:Number(source.witnessUtxo!.amount)};
          });
          const change=root.outputsLength===3?root.getOutput(1):undefined;
          if(spend.operationId!==operationId||spend.transactionId!==root.id||spend.amountSats!==1000||
            spend.destinationScript!==hex.encode(output.script!)||!same(spend.inputs,inputs)||
            (change?(!spend.change||spend.change.value!==Number(change.amount)||spend.change.script!==hex.encode(change.script!)||
              spend.change.assets!==undefined&&spend.change.assets.length!==0):spend.change!==undefined))throw deny();
        }
      }else{
        if(!recovery.fundingOutput||!same(b.funding,recovery.fundingOutput))throw deny();
        if(current)currentSpend(record,recovery,journal);
      }
    }
  }catch{throw deny();}
}

/** Returns the ordinary journal mutation count so a document CAS can serialize
 * changes across contracts too. Fresh explicitly flagged imports adopt their
 * authenticated historical state, not a new signing authority. */
export function advanceTreasureServerRecovery(beforeRecord:ContractRecord|undefined,afterRecord:ContractRecord,
  before:ContractRecovery|undefined,after:ContractRecovery):number{
  try{
    const previous=before?.treasureServerJournals,next=after.treasureServerJournals;
    if(previous!==undefined&&next===undefined)throw deny();
    if(!beforeRecord&&afterRecord.recoveryRequired)return 0;
    if(!beforeRecord&&next!==undefined&&afterRecord.operation.kind!=='fund')throw deny();
    // The old snapshot controls this save. Resolving an acknowledgement cannot
    // authorize a replacement operation or another signing request in the same CAS.
    const observing=before!==undefined&&treasureServerRecoveryPending(before);
    if(observing&&beforeRecord&&(beforeRecord.operation.id!==afterRecord.operation.id||
      beforeRecord.operation.kind!==afterRecord.operation.kind))throw deny();
    let changes=0;
    for(const [id,journal] of Object.entries(previous??{})){
      const updated=next?.[id];if(!updated)throw deny();if(same(journal,updated))continue;
      advanceTreasureServerJournal(journal,updated);changes++;
      if(observing||id!==afterRecord.operation.id){
        if(journal.requests.length!==updated.requests.length)throw deny();
        const changed=journal.requests.filter((request,i)=>!same(request,updated.requests[i]));
        if(changed.length!==1||!['sign-pending','sign-unknown'].includes(changed[0].phase)||
          !((observing?['sign-unknown','completed']:['completed']).includes(updated.requests.find(r=>r.id===changed[0].id)?.phase??'')))throw deny();
      }
    }
    for(const [id,journal] of Object.entries(next??{}))if(!Object.hasOwn(previous??{},id)){
      if(observing||id!==afterRecord.operation.id||journal.requests.length!==0||afterRecord.operation.submission!=='prepared')throw deny();changes++;
    }
    if(changes>1)throw deny();return changes;
  }catch{throw deny();}
}

/** A confirmed network receipt does not resolve a lost signing acknowledgement. */
export function treasureServerRecoveryPending(recovery:ContractRecovery):boolean{
  const map=recovery.treasureServerJournals;if(map===undefined)return false;journals(map);
  return Object.values(map).some(journal=>journal.requests.some(request=>
    request.phase==='sign-pending'||request.phase==='sign-unknown'));
}

/** Public outpoints only, for the conservative pre-cleanup reservation shadow.
 * No body, token, plan, signature or private journal enters that shadow. */
export function treasureServerRecoveryInputs(recovery:ContractRecovery):ReadonlyArray<Readonly<{txid:string;vout:number}>>{
  try{
    const map=recovery.treasureServerJournals;if(map===undefined)return [];journals(map);
    const inputs=new Map<string,{txid:string;vout:number}>();
    for(const journal of Object.values(map)){
      if(!journal.requests.some(r=>r.phase==='sign-pending'||r.phase==='sign-unknown'))continue;
      const b=journal.binding,points=b.kind==='fund'?b.original.checkpoints.map(value=>{
        const input=decode(value).getInput(0);if(!input.txid||input.index===undefined)throw deny();
        return {txid:hex.encode(input.txid),vout:input.index};
      }):[{txid:b.funding.txid,vout:b.funding.vout}];
      for(const point of points)inputs.set(point.txid+':'+point.vout,point);
    }
    return [...inputs.values()];
  }catch{throw deny();}
}
