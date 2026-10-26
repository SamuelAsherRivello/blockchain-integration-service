import {SingleKey,Transaction,CSVMultisigTapscript,buildOffchainTx,Extension,EmulatorPacket} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {hex} from '@scure/base';
import {buildAuthorizedTreasureScript,treasureAuthorizationActors,treasureAuthorizationDigest} from '../../packages/integration/src/client/wallet-layer-arkade/treasure-authorized-script.ts';

// Published, trivial test scalars only. No wallet, provider or real outpoint.
type VmFixture={name:string;script:string;transaction:string;prevScript:string;inputAmount:number;now:number;expiry:number|null;witness:string[];expected:boolean};
export async function publicFixtures(){
  const identities=[1,2,3,4].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
  const [player,game,operator,emulator]=await Promise.all(identities.map(async key=>hex.encode(await key.xOnlyPublicKey())));
  const terms={network:'mutinynet' as const,offerSessionId:'native-public-offer',hostReference:'native-public-run',startedAtMs:1_999_999_910_123,
    player,game,operator,emulator,playerDestination:player,gameDestination:game,exitDelay:2048};
  const built=buildAuthorizedTreasureScript(terms),cases:VmFixture[]=[];
  // The real operator advertises a distinct checkpoint forfeit authority.
  // Keep that role separate in every native fixture too.
  const forfeit=await SingleKey.fromHex('5'.padStart(64,'0')).xOnlyPublicKey();
  const unroll=CSVMultisigTapscript.encode({pubkeys:[forfeit],timelock:{type:'seconds',value:2048n}});
  for(const branch of ['claim','reject','cancel','refund'] as const){
    const leaf=built.script.functionByName(branch)!,actors=treasureAuthorizationActors(branch),funding={txid:'a4'.repeat(32),vout:2,value:1000 as const};
    const pairFor=(proofs:Uint8Array[])=>buildOffchainTx([{...funding,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
      [{script:hex.decode('5120'+(branch==='claim'?player:game)),amount:1000n},
       Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:RawWitness.encode(proofs)}])]).txOut()],unroll);
    const placeholder=pairFor(actors.map(()=>new Uint8Array(64)));
    const digest=treasureAuthorizationDigest(terms,branch,{arkTx:placeholder.arkTx,checkpoint:placeholder.checkpoints[0],funding,checkpointTapscript:unroll});
    const proofs=await Promise.all(actors.map(actor=>identities[actor==='player'?0:1].signMessage(digest,'schnorr')));
    const valid=pairFor(proofs),eligible=branch==='refund'?built.deadlineSeconds:built.deadlineSeconds-1;
    const row=(name:string,pair:ReturnType<typeof buildOffchainTx>,now:number,expected:boolean,expiry:number|null=2_200_000_000,inputAmount=1000)=>{
      const entry=Extension.fromTx(pair.arkTx).getEmulatorPacket()!.entries[0];
      cases.push({name:branch+':'+name,script:hex.encode(leaf.arkadeScript!),transaction:hex.encode(pair.arkTx.toBytes(false,false)),
        prevScript:hex.encode(pair.arkTx.getInput(0).witnessUtxo!.script),inputAmount,now,expiry,
        witness:RawWitness.decode(entry.witness!).map(hex.encode),expected});
    };
    for(const now of [built.deadlineSeconds-1,built.deadlineSeconds,built.deadlineSeconds+1,built.deadlineSeconds+120])
      row('clock-'+now,valid,now,branch==='refund'?now>=built.deadlineSeconds:now<built.deadlineSeconds);
    row('source-expiry-absent',valid,eligible,false,null);
    row('source-expiry-zero',valid,eligible,false,0);
    row('proof-missing',pairFor([]),eligible,false);
    row('proof-empty',pairFor(proofs.map(()=>new Uint8Array())),eligible,false);
    row('proof-changed',pairFor(proofs.map(proof=>{const copy=proof.slice();copy[0]^=1;return copy;})),eligible,false);
    row('proof-extra',pairFor([...proofs,new Uint8Array(64)]),eligible,false);
    row('principal-changed',valid,eligible,false,2_200_000_000,999);
    const changed=Transaction.fromPSBT(valid.arkTx.toPSBT());changed.updateOutput(0,{script:hex.decode('5120'+emulator)});
    row('destination-changed',{...valid,arkTx:changed},eligible,false);
    if(proofs.length>1)row('proof-order',pairFor([...proofs].reverse()),eligible,false);
  }
  return {qualification:'Public synthetic local VM fixtures only; no remote funding/admission/settlement evidence.',
    deadlineSeconds:built.deadlineSeconds,artifactVersion:4,cases};
}
