import {Transaction,DefaultVtxo,buildOffchainTx,Extension,EmulatorPacket,PrevArkTxField,setArkPsbtField,
  assertValidServerUnrollScript,defaultCheckpointExitDelayPolicy,getNetwork,canSpendOffchain,type ArkInfo,type VirtualCoin} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {schnorr} from '@noble/curves/secp256k1.js';
import {base64,hex} from '@scure/base';
import {buildAuthorizedTreasureScript,treasureAuthorizationDigest} from '../../../integration/src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import {assertTreasurePsbtEquivalent,assertTreasureSignatureRetention,decodeTreasurePsbtMaps} from '../../../integration/src/client/wallet-layer-arkade/treasure-psbt-equivalence.ts';
import {inspectTreasureDirectPolicy} from '../../../integration/src/client/wallet-layer-arkade/treasure-direct-policy.ts';
import {TREASURE_EMULATOR} from '../../../integration/src/client/wallet-layer-arkade/treasure-capability.ts';
import type {TreasureScriptTerms} from '../../../integration/src/client/wallet-layer-arkade/treasure-script.ts';

export type TreasureActorBranch='reject'|'cancel'|'refund';
type Branch=TreasureActorBranch;
type Outpoint=Readonly<{txid:string;vout:number}>;
export type AuthenticatedTreasureActorScope=Readonly<{
  network:'mutinynet';gamePublicKey:string;playerPublicKey:string;operationId:string;
}>;

/** Privileged server dependencies, never JSON supplied by the signing requester.
 * authenticatedScope verifies the Player authority token and authenticated Game
 * connection, binding the trusted identities and original operation. It must
 * not claim that request-supplied offer terms or a branch were already verified.
 * info/coins/transactions query the configured operator/indexer, bypassing
 * requester caches/data.
 * This helper does not authenticate a bearer token or establish an HTTP route.
 * Existing payment-context.ts uses the same fresh info/outpoints/raw-tx boundary.
 */
export interface TreasureActorAuthorizationReader{
  authenticatedScope():Promise<AuthenticatedTreasureActorScope>;
  info():Promise<ArkInfo>;
  coins(outpoints:readonly Outpoint[]):Promise<{vtxos:readonly VirtualCoin[];page?:unknown}>;
  transactions(ids:readonly string[]):Promise<{txs:readonly string[]}>;
  /** Server clock dependency; production readers must use server Date.now. */
  now():number;
}
export type TreasureActorAuthorizationRequest=Readonly<{
  artifactVersion:4;branch:Branch;operationId:string;offerSessionId:string;hostReference:string;startedAtMs:number;
  funding:Outpoint;arkTx:string;checkpoint:string;playerProof?:string;
}>;
export type DerivedTreasureGameActorAuthorization=Readonly<{
  artifactVersion:4;branch:Branch;operationId:string;gamePublicKey:string;
  funding:Outpoint;checkpointId:string;templateRootId:string;message:Uint8Array;
  observedAtMs:number;deadlineMs:number;
}>;
const deny=()=>Error('Treasure Game actor authorization is outside the signing policy.');
const encode=(tx:Transaction)=>base64.encode(tx.toPSBT());
function object(value:unknown,keys:readonly string[],optional:readonly string[]=[]):asserts value is Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||
    Object.keys(value).some(key=>!keys.includes(key))||keys.some(key=>!optional.includes(key)&&!Object.hasOwn(value,key)))throw deny();
}
const text=(value:unknown)=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=256&&!/[\x00-\x1f\x7f]/.test(value);
export function parseTreasureActorAuthorizationRequest(value:unknown):TreasureActorAuthorizationRequest{
  object(value,['artifactVersion','branch','operationId','offerSessionId','hostReference','startedAtMs','funding','arkTx','checkpoint','playerProof'],['playerProof']);
  if(value.artifactVersion!==4||!['reject','cancel','refund'].includes(String(value.branch))||
    ![value.operationId,value.offerSessionId,value.hostReference].every(text)||!Number.isSafeInteger(value.startedAtMs)||
    (value.startedAtMs as number)<500_000_000_000||(value.startedAtMs as number)>Number.MAX_SAFE_INTEGER-90_000)throw deny();
  object(value.funding,['txid','vout']);
  if(typeof value.funding.txid!=='string'||!/^[a-f0-9]{64}$/.test(value.funding.txid)||!Number.isSafeInteger(value.funding.vout)||
    (value.funding.vout as number)<0||(value.funding.vout as number)>0xffffffff||
    typeof value.arkTx!=='string'||typeof value.checkpoint!=='string'||value.arkTx.length>250_000||value.checkpoint.length>250_000||
    (value.branch==='refund'?Object.hasOwn(value,'playerProof'):typeof value.playerProof!=='string'||!/^[a-f0-9]{128}$/.test(value.playerProof)))throw deny();
  return Object.freeze({...value,funding:Object.freeze({...value.funding})}) as TreasureActorAuthorizationRequest;
}
function time(branch:Branch,start:number,deadline:number,now:number){
  if(!Number.isSafeInteger(now)||now<start||(branch==='refund'?now<deadline:now>=deadline))throw deny();
}
function unsigned(encoded:string,canonical:Transaction){
  const inputCount=canonical.inputsLength,outputCount=canonical.outputsLength;
  const maps=decodeTreasurePsbtMaps(encoded,inputCount,outputCount);
  // This is the pre-emulator message stage. No ordinary signatures, finalization
  // fields, unexpected globals or proprietary metadata are admitted.
  if(maps.slice(1,1+inputCount).some(entries=>entries.some(({key})=>[0x02,0x07,0x08,0x13,0x14].includes(key[0]))))throw deny();
  assertTreasurePsbtEquivalent(encoded,encode(canonical),inputCount,outputCount);
  const tx=Transaction.fromPSBT(base64.decode(encoded));
  assertTreasureSignatureRetention(encoded,encode(tx),inputCount,outputCount);
  return tx;
}

/** Derivation only: never signs, grants authority, submits, or activates a route.
 * The eventual signing wrapper must recheck the server clock immediately before
 * and after signing, and persist the immutable original request/result. This
 * return value is not a reusable signing grant, remote admission or recovery lease.
 */
export async function deriveTreasureGameActorAuthorization(value:unknown,reader:TreasureActorAuthorizationReader):Promise<DerivedTreasureGameActorAuthorization>{
  try{
    const request=parseTreasureActorAuthorizationRequest(value),scope=structuredClone(await reader.authenticatedScope()),started=reader.now();
    const key=(value:string)=>{if(!/^0[23][a-f0-9]{64}$/.test(value))throw deny();return hex.decode(value.slice(2));};
    const gameKey=key(scope.gamePublicKey),playerKey=key(scope.playerPublicKey);
    if(scope.network!=='mutinynet'||scope.operationId!==request.operationId)throw deny();
    const info=await reader.info();inspectTreasureDirectPolicy('mutinynet',info);
    if(typeof info.unilateralExitDelay!=='bigint'||info.unilateralExitDelay<512n||info.unilateralExitDelay>BigInt(Number.MAX_SAFE_INTEGER))throw deny();
    const operatorKey=key(info.signerPubkey),forfeitKey=key(info.forfeitPubkey);
    const unroll=assertValidServerUnrollScript(info.checkpointTapscript,{...defaultCheckpointExitDelayPolicy(getNetwork('mutinynet')),advertisedForfeitPubkey:forfeitKey});
    const wallet=(pubKey:Uint8Array)=>new DefaultVtxo.Script({pubKey,serverPubKey:operatorKey,csvTimelock:{type:'seconds',value:info.unilateralExitDelay}});
    const game=wallet(gameKey),player=wallet(playerKey);
    // Offer identifiers are request metadata, not authority. Their trust comes
    // from binding this exact tree to the independently fetched creating tx and
    // current indexed funding coin below. Branch consent is independently
    // established by the Player VM proof over the canonical checkpoint digest.
    const terms:TreasureScriptTerms={network:'mutinynet',offerSessionId:request.offerSessionId,hostReference:request.hostReference,
      startedAtMs:request.startedAtMs,player:hex.encode(playerKey),game:hex.encode(gameKey),operator:hex.encode(operatorKey),emulator:TREASURE_EMULATOR.key.slice(2),
      playerDestination:hex.encode(player.pkScript.slice(2)),gameDestination:hex.encode(game.pkScript.slice(2)),exitDelay:Number(info.unilateralExitDelay)};
    const built=buildAuthorizedTreasureScript(terms),leaf=built.script.functionByName(request.branch)!,deadlineMs=built.deadlineSeconds*1000;
    time(request.branch,terms.startedAtMs,deadlineMs,started);
    const found=await reader.coins([request.funding]);
    if(found.page||!Array.isArray(found.vtxos)||found.vtxos.length!==1)throw deny();
    const coin=found.vtxos[0],now=reader.now();
    if(coin.txid!==request.funding.txid||coin.vout!==request.funding.vout||coin.value!==1000||coin.script!==hex.encode(built.script.pkScript)||
      coin.isSpent!==false||coin.isSwept!==false||coin.isUnrolled!==false||coin.isPreconfirmed||coin.expiresAtHeight!==undefined||
      !(coin.expiresAt instanceof Date)||!Number.isFinite(coin.expiresAt.getTime())||coin.expiresAt.getTime()<=now||!canSpendOffchain(coin,{timestamp:new Date(now)})||
      coin.assets!==undefined&&(!Array.isArray(coin.assets)||coin.assets.length!==0))throw deny();
    const fetched=await reader.transactions([request.funding.txid]);
    if(!Array.isArray(fetched.txs)||fetched.txs.length!==1||typeof fetched.txs[0]!=='string'||fetched.txs[0].length>500_000)throw deny();
    const encoded=fetched.txs[0],previous=/^(?:[a-f0-9]{2})+$/.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded));
    const previousOutput=previous.getOutput(request.funding.vout);
    if(previous.id!==request.funding.txid||!previousOutput?.script||previousOutput.amount!==1000n||!Buffer.from(previousOutput.script).equals(Buffer.from(built.script.pkScript)))throw deny();
    const proof=request.playerProof===undefined?undefined:hex.decode(request.playerProof);
    const witness=RawWitness.encode(proof?[proof,new Uint8Array(64)]:[new Uint8Array(64)]);
    const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness}])]);
    const canonical=buildOffchainTx([{txid:coin.txid,vout:coin.vout,value:1000,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
      [{script:game.pkScript,amount:1000n},packet.txOut()],unroll);
    setArkPsbtField(canonical.arkTx,0,PrevArkTxField,previous.toBytes(false,false));
    const arkTx=unsigned(request.arkTx,canonical.arkTx),checkpoint=unsigned(request.checkpoint,canonical.checkpoints[0]);
    const message=treasureAuthorizationDigest(terms,request.branch,{arkTx,checkpoint,funding:{...request.funding,value:1000},checkpointTapscript:unroll});
    if(proof&&!schnorr.verify(proof,message,playerKey))throw deny();
    const observedAtMs=reader.now();time(request.branch,terms.startedAtMs,deadlineMs,observedAtMs);
    if(!Number.isSafeInteger(started)||observedAtMs<started||observedAtMs-started>10_000)throw deny();
    return Object.freeze({artifactVersion:4,branch:request.branch,operationId:request.operationId,gamePublicKey:scope.gamePublicKey,
      funding:request.funding,checkpointId:checkpoint.id,templateRootId:arkTx.id,message,observedAtMs,deadlineMs});
  }catch{throw deny();}
}
