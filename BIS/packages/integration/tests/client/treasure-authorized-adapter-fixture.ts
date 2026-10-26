// Public synthetic identities and wire transactions. Never connects to a provider.
import {SingleKey,DefaultVtxo,Transaction,CSVMultisigTapscript} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {schnorr} from '@noble/curves/secp256k1.js';
import {buildAuthorizedTreasureScript} from '../../src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import {prepareAuthorizedTreasureTransaction,attachAuthorizedTreasurePlayerProof,completeAuthorizedTreasureTransaction} from '../../src/client/wallet-layer-arkade/treasure-authorized-transaction.ts';
import type {TreasureStagedBranch} from '../../src/client/wallet-layer-arkade/treasure-staged-script.ts';
import {signFixtureEmulator,signFixtureActors,signFixtureOperator,type StagedFixture} from './treasure-staged-fixture.ts';

export async function authorizedAdapterFixture(branch:TreasureStagedBranch='claim',checkpointDelay=4096n){
  const identities=[1,2,3,4,5].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
  const [player,game,operator,emulator,forfeit]=await Promise.all(identities.map(async i=>hex.encode(await i.xOnlyPublicKey())));
  const defaults={serverPubKey:hex.decode(operator),csvTimelock:{type:'seconds' as const,value:2048n}};
  const playerScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(player)}),gameScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(game)});
  const terms={network:'mutinynet' as const,offerSessionId:'adapter-offer',hostReference:'adapter-run',startedAtMs:1_800_000_000_123,
    player,game,operator,emulator,playerDestination:hex.encode(playerScript.pkScript.slice(2)),gameDestination:hex.encode(gameScript.pkScript.slice(2)),exitDelay:2048};
  const built=buildAuthorizedTreasureScript(terms),leaf=built.script.functionByName(branch)!;
  const unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(forfeit)],timelock:{type:'seconds',value:checkpointDelay}});
  const previous=new Transaction({version:3});previous.addInput({txid:'a5'.repeat(32),index:0,witnessUtxo:{script:gameScript.pkScript,amount:1000n}});
  previous.addOutput({script:built.script.pkScript,amount:1000n});previous.addOutput({script:hex.decode('51024e73'),amount:0n});
  const input={contractId:'adapter-contract-'+branch,operationId:'adapter-operation-'+branch,branch,terms,
    funding:{txid:previous.id,vout:0,value:1000 as const},previousTransaction:hex.encode(previous.toBytes(false,false)),checkpointTapscript:hex.encode(unroll.script)};
  const zero=prepareAuthorizedTreasureTransaction(input);
  const proof=(actor:'player'|'game')=>hex.encode(schnorr.sign(hex.decode(zero.digest),hex.decode((actor==='player'?'1':'2').padStart(64,'0')),new Uint8Array(32)));
  const template=branch==='refund'?zero:attachAuthorizedTreasurePlayerProof(zero,proof('player'));
  const binding=completeAuthorizedTreasureTransaction(template,branch==='claim'?undefined:proof('game'));
  const at=branch==='refund'?built.deadlineSeconds*1000:terms.startedAtMs+1000;
  // Existing signature helpers depend only on binding, leaf and public keys.
  const signerFixture={binding,built,leaf,identities,deadlineMs:built.deadlineSeconds*1000} as unknown as StagedFixture;
  return {input,zero,template,binding,built,leaf,identities,previous,forfeit,at,proof,
    emulatorPin:hex.encode(await identities[3].compressedPublicKey()),
    emulator:()=>{const result=signFixtureEmulator(signerFixture);return {...result,signedCheckpointTxs:[...result.signedCheckpointTxs]};},
    actors:(encoded:string)=>signFixtureActors(signerFixture,encoded),
    operator:async()=>{const result=await signFixtureOperator(signerFixture);return {...result,signedCheckpointTxs:[...result.signedCheckpointTxs]};}};
}
