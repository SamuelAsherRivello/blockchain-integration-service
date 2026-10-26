
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SingleKey,Transaction,DefaultVtxo,CSVMultisigTapscript,buildOffchainTx,Extension,EmulatorPacket,PrevArkTxField,setArkPsbtField} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {tapLeafHash} from '@scure/btc-signer/payment.js';
import {base64,hex} from '@scure/base';
import {schnorr,secp256k1} from '@noble/curves/secp256k1.js';
import {buildAuthorizedTreasureScript,treasureAuthorizationDigest} from '../../../src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import type {TreasureActorSigningBody} from '../../../src/client/wallet-layer-arkade/treasure-authorization-protocol.ts';
import {encodeSigningValue} from '../../../src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {createTreasureServerJournal,validateTreasureServerJournal,prepareTreasureServerRequest,transitionTreasureServerRequest,
  advanceTreasureServerJournal,treasureServerResultLookup,type TreasureServerJournalBinding,type TreasureServerJournal,
  type TreasureServerRequestPurpose} from '../../../src/client/wallet-layer-arkade/treasure-server-journal.ts';

// Public synthetic keys and genuine local SDK signatures. No VM, wallet,
// provider, encryption/persistence wiring, remote service or financial action.
const [player,game,operator,emulator]=[1,2,3,4].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
const [playerKey,gameKey,operatorKey,emulatorKey]=await Promise.all([player,game,operator,emulator].map(async k=>hex.encode(await k.xOnlyPublicKey())));
const publicKey=hex.encode(await game.compressedPublicKey()),profileId=createHash('sha256').update(hex.decode(publicKey)).digest('hex');
const start=1_800_000_000_123,clock=start+91_000;
const wallet=(pubKey:string)=>new DefaultVtxo.Script({pubKey:hex.decode(pubKey),serverPubKey:hex.decode(operatorKey),csvTimelock:{type:'seconds' as const,value:2048n}});
// Public scalar-5 forfeit key. It deliberately differs from the operator's
// ordinary scalar-3 signing authority, matching the real provider's roles.
const forfeitKey='2f8bde4d1a07209355b4a7250a5c5128e88b84bddc619ab7cba8d569b240efe4';
const gameWallet=wallet(gameKey),playerWallet=wallet(playerKey),unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(forfeitKey)],timelock:{type:'seconds' as const,value:2048n}});
const terms={network:'mutinynet' as const,offerSessionId:'journal-offer',hostReference:'journal-run',startedAtMs:start,
  player:playerKey,game:gameKey,operator:operatorKey,emulator:emulatorKey,
  playerDestination:hex.encode(playerWallet.pkScript.slice(2)),gameDestination:hex.encode(gameWallet.pkScript.slice(2)),exitDelay:2048};
const encode=(tx:Transaction)=>base64.encode(tx.toPSBT()),wireArgs=(tx:Transaction)=>JSON.stringify(encodeSigningValue([tx,[...Array(tx.inputsLength).keys()]]));
const token=(name:string)=>name+'.'+'a'.repeat(43),connection=token('original-connection'),plan=token('original-plan'),receipt=token('original-root-receipt');
const common={artifactVersion:4 as const,contractId:'journal-contract',operationId:'journal-operation',endpoint:'https://journal.invalid/api/bis/',
  gameId:'stealth-and-steel',network:'mutinynet' as const,profileId,publicKey,authority:'player-proof' as 'owner'|'player-proof',terms,
  checkpointTapscript:hex.encode(unroll.script)};
async function spendFixture(branch:'refund'|'reject'='refund'){
  const built=buildAuthorizedTreasureScript(terms),leaf=built.script.functionByName(branch)!;
  const previous=new Transaction({version:3});previous.addInput({txid:'ab'.repeat(32),index:0,witnessUtxo:{script:gameWallet.pkScript,amount:1000n}});
  previous.addOutput({script:built.script.pkScript,amount:1000n});previous.addOutput({script:hex.decode('51024e73'),amount:0n});
  const funding={txid:previous.id,vout:0,value:1000 as const};
  const build=(proofs:readonly Uint8Array[])=>{
    const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:RawWitness.encode([...proofs])}])]);
    const pair=buildOffchainTx([{...funding,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
      [{script:gameWallet.pkScript,amount:1000n},packet.txOut()],unroll);setArkPsbtField(pair.arkTx,0,PrevArkTxField,previous.toBytes(false,false));return pair;
  };
  const empty=build(branch==='reject'?[new Uint8Array(64),new Uint8Array(64)]:[new Uint8Array(64)]);
  const message=treasureAuthorizationDigest(terms,branch,{arkTx:empty.arkTx,checkpoint:empty.checkpoints[0],funding,checkpointTapscript:unroll});
  const playerProof=branch==='reject'?await player.signMessage(message,'schnorr'):undefined;
  const template=build(playerProof?[playerProof,new Uint8Array(64)]:[new Uint8Array(64)]);
  const binding:TreasureServerJournalBinding={...common,kind:'spend',branch,funding,previousTransaction:hex.encode(previous.toBytes(false,false)),
    actorTemplate:{arkTx:encode(template.arkTx),checkpoint:encode(template.checkpoints[0]),...(playerProof?{playerProof:hex.encode(playerProof)}:{})}};
  const actorRequest={artifactVersion:4 as const,branch,operationId:binding.operationId,offerSessionId:terms.offerSessionId,hostReference:terms.hostReference,
    startedAtMs:terms.startedAtMs,funding:{txid:funding.txid,vout:0},arkTx:binding.actorTemplate.arkTx,checkpoint:binding.actorTemplate.checkpoint,
    ...(playerProof?{playerProof:hex.encode(playerProof)}:{})};
  return {binding,message,actorRequest,template,build,playerProof,leaf};
}
function signSyntheticEmulator(original:Transaction,leaf:ReturnType<ReturnType<typeof buildAuthorizedTreasureScript>['script']['functionByName']>){
  if(!leaf?.arkadeScript)throw Error('Missing synthetic VM leaf');
  const tx=Transaction.fromPSBT(original.toPSBT()),n=secp256k1.Point.CURVE().n,point=secp256k1.Point.BASE.multiply(4n);
  const base=point.toBytes(true)[0]===3?n-4n:4n,tweak=BigInt('0x'+hex.encode(schnorr.utils.taggedHash('ArkScriptHash',leaf.arkadeScript)))%n;
  const secret=hex.decode(((base+tweak)%n).toString(16).padStart(64,'0')),key=leaf.signerKeys[1];
  assert.deepEqual(schnorr.getPublicKey(secret),key);
  const input=tx.getInput(0),script=input.tapLeafScript![0][1];
  const digest=tx.preimageWitnessV1(0,[input.witnessUtxo!.script],0,[input.witnessUtxo!.amount],undefined,script.subarray(0,-1),script.at(-1));
  tx.updateInput(0,{tapScriptSig:[...(input.tapScriptSig??[]),[{pubKey:key,leafHash:tapLeafHash(script.subarray(0,-1),script.at(-1))},schnorr.sign(digest,secret,new Uint8Array(32))]]});
  return tx;
}
function fundFixture(authority:'owner'|'player-proof'='player-proof'){
  const built=buildAuthorizedTreasureScript(terms),sources=[1500n,700n].map((amount,i)=>{
    const tx=new Transaction({version:3});tx.addInput({txid:(i?'bc':'cd').repeat(32),index:0,witnessUtxo:{script:gameWallet.pkScript,amount}});
    tx.addOutput({script:gameWallet.pkScript,amount});tx.addOutput({script:hex.decode('51024e73'),amount:0n});return tx;
  });
  const pair=buildOffchainTx(sources.map(tx=>({txid:tx.id,vout:0,value:Number(tx.getOutput(0).amount),tapLeafScript:gameWallet.forfeit(),tapTree:gameWallet.encode()})),
    [{script:built.script.pkScript,amount:1000n},{script:gameWallet.pkScript,amount:1200n}],unroll);
  const binding:TreasureServerJournalBinding={...common,authority,kind:'fund',original:{arkTx:encode(pair.arkTx),checkpoints:pair.checkpoints.map(encode)},sourceTransactions:sources.map(tx=>hex.encode(tx.toBytes(false,false)))};
  return {binding,pair,sources};
}

export {fundFixture,spendFixture,game,operator,player,common,clock,connection,plan,receipt,token,wireArgs};
