// Public synthetic cryptographic fixtures only. No provider or wallet storage.
import {SingleKey,Transaction,CSVMultisigTapscript,buildOffchainTx,Extension,EmulatorPacket,PrevArkTxField,setArkPsbtField} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {schnorr,secp256k1} from '@noble/curves/secp256k1.js';
import {tapLeafHash} from '@scure/btc-signer/payment.js';
import {buildStagedTreasureScript,type TreasureStagedBranch} from '../../src/client/wallet-layer-arkade/treasure-staged-script.ts';
import type {StagedTreasureBinding,StagedTreasureOperatorResponse,StagedTreasureSignedPair} from '../../src/client/wallet-layer-arkade/treasure-staged-state.ts';

export const encode=(tx:Transaction)=>base64.encode(tx.toPSBT());
export const decode=(encoded:string)=>Transaction.fromPSBT(base64.decode(encoded));
export async function stagedFixture(branch:TreasureStagedBranch='claim'){
  const identities=[1,2,3,4].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
  const [player,game,operator,emulator]=await Promise.all(identities.map(async identity=>hex.encode(await identity.xOnlyPublicKey())));
  const terms={network:'mutinynet' as const,offerSessionId:'offer-a',hostReference:'run-a',startedAtMs:1_800_000_000_123,
    player,game,operator,emulator,playerDestination:player,gameDestination:game,exitDelay:2048};
  const built=buildStagedTreasureScript(terms),leaf=built.script.functionByName(branch)!;
  const unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(operator)],timelock:{type:'seconds',value:2048n}});
  const previous=new Transaction({version:3});previous.addInput({txid:'a1'.repeat(32),index:0,witnessUtxo:{script:hex.decode('5120'+game),amount:1000n}});
  previous.addOutput({script:built.script.pkScript,amount:1000n});previous.addOutput({script:hex.decode('51024e73'),amount:0n});
  const raw=previous.toBytes(false,false),packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:new Uint8Array([0])}])]);
  const pair=buildOffchainTx([{txid:previous.id,vout:0,value:1000,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
    [{script:hex.decode('5120'+(branch==='claim'?player:game)),amount:1000n},packet.txOut()],unroll);
  setArkPsbtField(pair.arkTx,0,PrevArkTxField,raw);
  const binding:StagedTreasureBinding={artifactVersion:3,contractId:'contract-'+branch,operationId:'operation-'+branch,branch,terms,
    funding:{txid:previous.id,vout:0,value:1000},previousTransaction:hex.encode(raw),checkpointTapscript:hex.encode(unroll.script),
    original:{arkTx:encode(pair.arkTx),checkpoints:[encode(pair.checkpoints[0])]}};
  return {binding,built,leaf,identities,deadlineMs:built.deadlineSeconds*1000};
}
export type StagedFixture=Awaited<ReturnType<typeof stagedFixture>>;
// v0.0.9 tweaked signer arithmetic, checked against SDK's compiled signer key.
export function fixtureEmulatorSecret(f:StagedFixture){
  const n=secp256k1.Point.CURVE().n,point=secp256k1.Point.BASE.multiply(4n),base=point.toBytes(true)[0]===3?n-4n:4n;
  const tweak=BigInt('0x'+hex.encode(schnorr.utils.taggedHash('ArkScriptHash',f.leaf.arkadeScript!)))%n;
  return hex.decode(((base+tweak)%n).toString(16).padStart(64,'0'));
}
export function signFixtureEmulator(f:StagedFixture):StagedTreasureSignedPair{
  const secret=fixtureEmulatorSecret(f),key=f.leaf.signerKeys[1];
  if(hex.encode(schnorr.getPublicKey(secret))!==hex.encode(key))throw Error('Synthetic tweaked key mismatch');
  const ark=decode(f.binding.original.arkTx),cp=decode(f.binding.original.checkpoints[0]);
  for(const tx of [ark,cp]){
    const input=tx.getInput(0),script=input.tapLeafScript![0][1];
    const digest=tx.preimageWitnessV1(0,[input.witnessUtxo!.script],0,[input.witnessUtxo!.amount],undefined,script.subarray(0,-1),script.at(-1));
    const leafHash=tapLeafHash(script.subarray(0,-1),script.at(-1));
    tx.updateInput(0,{tapScriptSig:[[{pubKey:key,leafHash},schnorr.sign(digest,secret,new Uint8Array(32))]]});
  }
  return {signedArkTx:encode(ark),signedCheckpointTxs:[encode(cp)]};
}
export async function signFixtureActors(f:StagedFixture,encoded:string){
  const actors=f.binding.branch==='claim'?[f.identities[0]]:f.binding.branch==='refund'?[f.identities[1]]:[f.identities[0],f.identities[1]];
  let tx=decode(encoded);for(const actor of actors)tx=await actor.sign(tx,[0]);return encode(tx);
}
export async function signFixtureOperator(f:StagedFixture):Promise<StagedTreasureOperatorResponse>{
  const ark=await f.identities[2].sign(decode(f.binding.original.arkTx),[0]);
  const cp=await f.identities[2].sign(decode(f.binding.original.checkpoints[0]),[0]);
  return {arkTxid:ark.id,finalArkTx:encode(ark),signedCheckpointTxs:[encode(cp)]};
}
