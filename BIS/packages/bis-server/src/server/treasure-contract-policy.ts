import {isDeepStrictEqual} from 'node:util';
import {Transaction,DefaultVtxo,buildOffchainTx,Extension,EmulatorPacket,PrevArkTxField,getArkPsbtFields,setArkPsbtField,verifyTapscriptSignatures,CSVMultisigTapscript} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {schnorr} from '@noble/curves/secp256k1.js';
import {buildAuthorizedTreasureScript,treasureAuthorizationActors,treasureAuthorizationDigest} from '../../../integration/src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import {RawWitness} from '@scure/btc-signer';
import {createHash} from 'node:crypto';
import {buildStagedTreasureScript} from '../../../integration/src/client/wallet-layer-arkade/treasure-staged-script.ts';
import {assertTreasurePsbtEquivalent,assertTreasureSignatureRetention,decodeTreasurePsbtMaps} from '../../../integration/src/client/wallet-layer-arkade/treasure-psbt-equivalence.ts';
import {MAX_OPERATION_EXPOSURE_SATS} from './signing-limits.ts';
import {TREASURE_EMULATOR} from '../../../integration/src/client/wallet-layer-arkade/treasure-capability.ts';
import type {TreasureScriptTerms} from '../../../integration/src/client/wallet-layer-arkade/treasure-script.ts';
import type {TrustedPaymentContext} from './offchain-policy.ts';

type TreasureIntentFields=Readonly<{kind:'fund'|'refund';branch:'fund'|'reject'|'cancel'|'refund';offerSessionId:string;hostReference:string;startedAtMs:number}>;
export type TreasureContractIntent=(TreasureIntentFields&Readonly<{artifactVersion:3}>)|(TreasureIntentFields&Readonly<{artifactVersion:4}>);
export type TreasureTrustedContext=Readonly<{intent:TreasureContractIntent;terms:TreasureScriptTerms;observedAtMs:number;previousTransaction?:string}>;
export type TreasureSigningPolicy=Readonly<{artifactVersion:3;intent:TreasureContractIntent;terms:TreasureScriptTerms;observedAtMs:number;deadlineMs:number}>|
 Readonly<{artifactVersion:4;intent:TreasureContractIntent;terms:TreasureScriptTerms;observedAtMs:number;deadlineMs:number;checkpointTapscript:string;previousTransactionDigest?:string;fundingOutpoint?:Readonly<{txid:string;vout:number}>}>;
const deny=()=>Error('Offchain payment treasure contract is outside the signing policy.');
const encode=(tx:Transaction)=>base64.encode(tx.toPSBT());

export function assertTreasureObservation(intent:TreasureContractIntent,deadlineMs:number,atMs:number){
 if(!Number.isSafeInteger(atMs)||atMs<intent.startedAtMs||(intent.branch==='refund'?atMs<deadlineMs:atMs>=deadlineMs))throw deny();
}

/** A late reject/cancel observation is only eligible for V4. This helper is
 * deliberately monotonic-only: authorization still requires the canonical
 * packet, original funding ancestry, actor VM proofs, and pinned ROOT
 * signatures before a late observation may be used to finish the spend. */
export function assertTreasurePolicyObservation(policy:TreasureSigningPolicy,atMs:number){
 const {intent}=policy;
 if(policy.artifactVersion===4&&intent.artifactVersion===4&&intent.kind==='refund'&&['reject','cancel'].includes(intent.branch)){
  if(!Number.isSafeInteger(atMs)||atMs<intent.startedAtMs||atMs<policy.observedAtMs)throw deny();
  return;
 }
 assertTreasureObservation(intent,policy.deadlineMs,atMs);
}

/** V4 non-refund spend ROOT acceptance is witnessed by its already-present
 * pinned emulator signature, which commits to successful VM deadline checks.
 * Keep receipt time monotonic, but do not mistake later completion for late
 * authorization. */
export function assertTreasurePolicyCompletion(policy:TreasureSigningPolicy,completedAtMs:number){
 assertTreasurePolicyObservation(policy,completedAtMs);
}

function assertTreasureContextObservation(intent:TreasureContractIntent,deadlineMs:number,atMs:number){
 if(intent.artifactVersion===4&&intent.kind==='refund'&&['reject','cancel'].includes(intent.branch)){
  if(!Number.isSafeInteger(atMs)||atMs<intent.startedAtMs)throw deny();
  return;
 }
 assertTreasureObservation(intent,deadlineMs,atMs);
}

/** Trusted network keys and local observation, never client scripts or VM bytes. */
export function treasureContractScripts(intent:TreasureContractIntent,game:DefaultVtxo.Script,keys:{gameKey:Uint8Array;playerKey:Uint8Array;operatorKey:Uint8Array;exitDelay:bigint},observation:{network:string;observedAtMs:number}){
 if(observation.network!=='mutinynet'||keys.exitDelay>BigInt(Number.MAX_SAFE_INTEGER))throw deny();
 const player=new DefaultVtxo.Script({pubKey:keys.playerKey,serverPubKey:keys.operatorKey,csvTimelock:{type:'seconds',value:keys.exitDelay}});
 const terms:TreasureScriptTerms={network:'mutinynet',offerSessionId:intent.offerSessionId,hostReference:intent.hostReference,startedAtMs:intent.startedAtMs,
  player:hex.encode(keys.playerKey),game:hex.encode(keys.gameKey),operator:hex.encode(keys.operatorKey),emulator:TREASURE_EMULATOR.key.slice(2),
  playerDestination:hex.encode(player.pkScript.slice(2)),gameDestination:hex.encode(game.pkScript.slice(2)),exitDelay:Number(keys.exitDelay)};
 const built=intent.artifactVersion===4?buildAuthorizedTreasureScript(terms):buildStagedTreasureScript(terms);assertTreasureContextObservation(intent,built.deadlineSeconds*1000,observation.observedAtMs);
 const leaf=intent.branch==='fund'?undefined:built.script.functionByName(intent.branch);
 if(intent.branch!=='fund'&&!leaf?.arkadeScript)throw deny();
 return {source:intent.kind==='fund'?game:built.script,leaf:intent.kind==='fund'?game.forfeit():leaf!.tapLeafScript,
  recipientScript:intent.kind==='fund'?built.script.pkScript:game.pkScript,
  treasure:{intent,terms,observedAtMs:observation.observedAtMs} as TreasureTrustedContext};
}

/** Fetch this creating transaction independently; a client PrevArkTx is not authority. */
export function verifyTreasureFundingTransaction(treasure:TreasureTrustedContext,inputs:TrustedPaymentContext['inputs'],encoded:string){
 try{
  if(inputs.length!==1||inputs[0].value!==1000||inputs[0].assets.length||typeof encoded!=='string'||encoded.length>500_000)throw deny();
  const tx=/^[a-f0-9]+$/.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded));
  const coin=inputs[0],output=tx.getOutput(coin.vout),built=treasure.intent.artifactVersion===4?buildAuthorizedTreasureScript(treasure.terms):buildStagedTreasureScript(treasure.terms);
  if(tx.id!==coin.txid||output.amount!==1000n||!isDeepStrictEqual(output.script,built.script.pkScript))throw deny();
  return hex.encode(tx.toBytes(false,false));
 }catch{throw deny();}
}

/** Preserve raw globals/unknown fields across the public RPC decoding boundary. */
export function assertTreasureRawSigningValue(args:unknown,tx:Transaction){
 const raw=(args as any)?.[0];
 if(raw?.$type!=='transaction'||typeof raw.value!=='string'||!/^(?:[a-f0-9]{2})+$/.test(raw.value))throw deny();
 assertTreasureSignatureRetention(base64.encode(hex.decode(raw.value)),encode(tx),tx.inputsLength,tx.outputsLength);
}

/** Rebuild a V4 spend from its authenticated funding outpoint and packet proofs.
 * The Game VM proof is removed for the digest template, then verified against
 * that template; caller-supplied recovery templates never enter server authority. */
export function buildTreasureV4CanonicalPair(root:Transaction,policy:TreasureSigningPolicy){
 try{
  if(policy.artifactVersion!==4||policy.intent.artifactVersion!==4||policy.intent.branch==='fund'||
    policy.intent.kind!=='refund'||!policy.checkpointTapscript||
    !/^(?:[a-f0-9]{2})+$/.test(policy.checkpointTapscript)||!policy.previousTransactionDigest||
    !/^[a-f0-9]{64}$/.test(policy.previousTransactionDigest)||root.inputsLength!==1||root.outputsLength!==3)throw deny();
  const terms=policy.terms,built=buildAuthorizedTreasureScript(terms),leaf=built.script.functionByName(policy.intent.branch);
  if(!leaf?.arkadeScript)throw deny();
  const funding=policy.fundingOutpoint,outpoint=funding?
    {txid:funding.txid,vout:funding.vout,value:1000}:undefined;
  if(!outpoint||!/^[a-f0-9]{64}$/.test(outpoint.txid)||!Number.isSafeInteger(outpoint.vout)||outpoint.vout<0||outpoint.vout>0xffffffff||outpoint.value!==1000)throw deny();
  const previousFields=getArkPsbtFields(root,0,PrevArkTxField);
  if(previousFields.length!==1||createHash('sha256').update(previousFields[0]).digest('hex')!==policy.previousTransactionDigest)throw deny();
  const previous=Transaction.fromRaw(previousFields[0]),funded=previous.getOutput(outpoint.vout);
  if(previous.id!==outpoint.txid||!funded?.script||funded.amount!==1000n||!Buffer.from(funded.script).equals(Buffer.from(built.script.pkScript)))throw deny();
  const unroll=CSVMultisigTapscript.decode(hex.decode(policy.checkpointTapscript));
  if(unroll.params.pubkeys.length!==1||hex.encode(unroll.params.pubkeys[0])!==terms.operator)throw deny();
  const extension=Extension.fromTx(root);if(extension.getAssetPacket())throw deny();
  const entries=extension.getEmulatorPacket()?.entries;
  if(entries?.length!==1||entries[0].vin!==0||!Buffer.from(entries[0].script).equals(Buffer.from(leaf.arkadeScript))||!entries[0].witness)throw deny();
  const witness=entries[0].witness,proofs=RawWitness.decode(witness),actors=treasureAuthorizationActors(policy.intent.branch);
  if(!Buffer.from(RawWitness.encode(proofs)).equals(Buffer.from(witness))||proofs.length!==actors.length||proofs.some(proof=>proof.length!==64))throw deny();
  const gameIndex=actors.indexOf('game'),playerIndex=actors.indexOf('player');if(gameIndex<0)throw deny();
  const game= new DefaultVtxo.Script({pubKey:hex.decode(terms.game),serverPubKey:hex.decode(terms.operator),csvTimelock:{type:'seconds',value:BigInt(terms.exitDelay)}});
  if(hex.encode(game.pkScript)!=='5120'+terms.gameDestination)throw deny();
  const pair=(proofWitness:Uint8Array[])=>{
    const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:RawWitness.encode(proofWitness)}])]);
    const candidate=buildOffchainTx([{...outpoint,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
      [{script:game.pkScript,amount:1000n},packet.txOut()],unroll);
    setArkPsbtField(candidate.arkTx,0,PrevArkTxField,previous.toBytes(false,false));return candidate;
  };
  const zero=new Uint8Array(64),template=pair(actors.map((actor,index)=>actor==='game'?zero:proofs[index]));
  const message=treasureAuthorizationDigest(terms,policy.intent.branch,{arkTx:template.arkTx,checkpoint:template.checkpoints[0],
    funding:{...outpoint,value:1000},checkpointTapscript:unroll});
  if(!schnorr.verify(proofs[gameIndex],message,hex.decode(terms.game))||
    playerIndex>=0&&!schnorr.verify(proofs[playerIndex],message,hex.decode(terms.player)))throw deny();
  const actual=pair(proofs);
  assertTreasurePsbtEquivalent(encode(root),encode(actual.arkTx),root.inputsLength,root.outputsLength);
  return actual;
 }catch{throw deny();}
}

export function assertTreasureV4AuthorizationPair(root:Transaction,checkpoint:Transaction,policy:TreasureSigningPolicy){
 try{const actual=buildTreasureV4CanonicalPair(root,policy);
  if(checkpoint.inputsLength!==1||checkpoint.outputsLength!==2)throw deny();
  assertTreasurePsbtEquivalent(encode(checkpoint),encode(actual.checkpoints[0]),checkpoint.inputsLength,checkpoint.outputsLength);
  }catch{throw deny();}
}

/** Only exact leaf signatures are admitted, never unknown actor keys or sighashes. */
export function assertTreasureSigningTransaction(tx:Transaction,canonical:Transaction,policy:TreasureSigningPolicy,root:boolean,requireAdmission=true){
 assertTreasurePsbtEquivalent(encode(tx),encode(canonical),tx.inputsLength,tx.outputsLength);
 const built=policy.artifactVersion===4?buildAuthorizedTreasureScript(policy.terms):buildStagedTreasureScript(policy.terms),leaf=policy.intent.branch==='fund'?undefined:built.script.functionByName(policy.intent.branch);
 const permitted=leaf?[...leaf.signerKeys.map(hex.encode),...(policy.artifactVersion===4?[policy.terms.game]:[])]:[policy.terms.game,policy.terms.operator];
 for(let i=0;i<tx.inputsLength;i++){
  const input=tx.getInput(i),maps=decodeTreasurePsbtMaps(encode(tx),tx.inputsLength,tx.outputsLength);
  if(maps[i+1].some(({key})=>[0x02,0x07,0x08,0x13].includes(key[0]))||input.sighashType!==undefined&&![0,1].includes(input.sighashType))throw deny();
  const signatures=input.tapScriptSig??[],keys=signatures.map(([key])=>hex.encode(key.pubKey));
  if(new Set(keys).size!==keys.length||keys.some(key=>!permitted.includes(key)))throw deny();
  for(const [,signature] of signatures)if(signature.length!==64&&!(signature.length===65&&signature[64]===1))throw deny();
  if(keys.length)verifyTapscriptSignatures(tx,i,keys,[],[0,1]);
  if(leaf&&requireAdmission){
   const required=policy.artifactVersion===4
    ?[...(root?[]:[policy.terms.operator]),hex.encode(leaf.signerKeys[1]),...(['reject','cancel'].includes(policy.intent.branch)?[policy.terms.player]:[])]
    :root?leaf.signerKeys.slice(1).map(hex.encode).filter(key=>key!==policy.terms.game):[policy.terms.operator,hex.encode(leaf.signerKeys[1]),...(['reject','cancel'].includes(policy.intent.branch)?[policy.terms.player]:[])];
   if(required.some(key=>!keys.includes(key)))throw deny();
  }
 }
}

export function validateTreasureContractTransaction(tx:Transaction,context:TrustedPaymentContext,intent:TreasureContractIntent){
 const trusted=context.treasure;if(!trusted||!isDeepStrictEqual(trusted.intent,intent)||trusted.terms.network!=='mutinynet'||trusted.terms.emulator!==TREASURE_EMULATOR.key.slice(2))throw deny();
 const built=trusted.intent.artifactVersion===4?buildAuthorizedTreasureScript(trusted.terms):buildStagedTreasureScript(trusted.terms),deadlineMs=built.deadlineSeconds*1000;
 if(!isDeepStrictEqual(context.changeScript,hex.decode('5120'+trusted.terms.gameDestination))||!isDeepStrictEqual(context.recipientScript,intent.kind==='fund'?built.script.pkScript:context.changeScript))throw deny();
 assertTreasureContextObservation(intent,deadlineMs,trusted.observedAtMs);
 if(context.inputs.length<1||context.inputs.length>100||context.inputs.some(input=>input.assets.length||!Number.isSafeInteger(input.value)||input.value<=0)||!Number.isSafeInteger(context.maximumExposureSats)||context.maximumExposureSats<1000||context.maximumExposureSats>MAX_OPERATION_EXPOSURE_SATS)throw deny();
 const policy:TreasureSigningPolicy=intent.artifactVersion===4
  ?{artifactVersion:4,intent,terms:trusted.terms,observedAtMs:trusted.observedAtMs,deadlineMs,checkpointTapscript:hex.encode(context.serverUnrollScript.script),
    ...(trusted.previousTransaction?{previousTransactionDigest:createHash('sha256').update(hex.decode(trusted.previousTransaction)).digest('hex')}:{ }),
    ...(intent.kind==='refund'&&context.inputs.length===1&&context.inputs[0].txid&&Number.isSafeInteger(context.inputs[0].vout)?
      {fundingOutpoint:{txid:context.inputs[0].txid,vout:context.inputs[0].vout}}:{ })}
  :{artifactVersion:3,intent,terms:trusted.terms,observedAtMs:trusted.observedAtMs,deadlineMs};
 let plan:ReturnType<typeof buildOffchainTx>;
 if(intent.kind==='fund'){
  const total=context.inputs.reduce((sum,input)=>sum+BigInt(input.value),0n),change=total-1000n;if(change<0n)throw deny();
  plan=buildOffchainTx([...context.inputs],[{script:built.script.pkScript,amount:1000n},...(change?[{script:context.changeScript,amount:change}]:[])],context.serverUnrollScript);
 }else if(intent.artifactVersion===4){
  if(policy.artifactVersion!==4||context.inputs.length!==1||context.inputs[0].value!==1000||!trusted.previousTransaction||!isDeepStrictEqual(context.recipientScript,context.changeScript)||
    !policy.previousTransactionDigest)throw deny();
  const previous=verifyTreasureFundingTransaction(trusted,context.inputs,trusted.previousTransaction);
  if(createHash('sha256').update(hex.decode(previous)).digest('hex')!==policy.previousTransactionDigest)throw deny();
  const pair=buildTreasureV4CanonicalPair(tx,policy);plan=pair;
  assertTreasureSigningTransaction(tx,plan.arkTx,policy,true);
 }else{
  if(context.inputs.length!==1||context.inputs[0].value!==1000||!trusted.previousTransaction||!isDeepStrictEqual(context.recipientScript,context.changeScript))throw deny();
  const previous=verifyTreasureFundingTransaction(trusted,context.inputs,trusted.previousTransaction),leaf=built.script.functionByName(intent.branch)!;
  const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:new Uint8Array([0])}])]);
  plan=buildOffchainTx([...context.inputs],[{script:context.changeScript,amount:1000n},packet.txOut()],context.serverUnrollScript);
  setArkPsbtField(plan.arkTx,0,PrevArkTxField,hex.decode(previous));
 }
 // Planning grants no signature. Actual authorization separately requires the
 // real emulator/actor admission signatures on this exact canonical payload.
 assertTreasureSigningTransaction(tx,plan.arkTx,policy,true,false);
 assertTreasurePolicyObservation(policy,Date.now());
 return {...plan,exposureSats:intent.kind==='fund'?1000:0,recipientSats:1000,sourceOutpoints:context.inputs.map(input=>`${input.txid}:${input.vout}`),contractPolicy:true as const,treasurePolicy:policy};
}
