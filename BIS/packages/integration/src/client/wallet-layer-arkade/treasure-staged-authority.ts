import {Transaction,type Identity} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import type {createTreasureJournalSigner} from './treasure-journal-signer.ts';
import {createStagedTreasureState,validateStagedTreasureBinding,type StagedTreasureBinding} from './treasure-staged-state.ts';
import {treasureAuthorizationActors} from './treasure-authorized-script.ts';
import {assertTreasurePsbtEquivalent,assertTreasureSignatureRetention} from './treasure-psbt-equivalence.ts';
import type {TreasureStagedSigningIntent,TreasureStagedSigningResult,TreasureStagedSigningClaim} from './treasure-staged-submit.ts';

type JournalSigner=ReturnType<typeof createTreasureJournalSigner>;
type Options=Readonly<{
  binding:StagedTreasureBinding;player?:Identity;game?:JournalSigner;localGame?:Identity;
  isCurrent:()=>boolean;
}>;
const fail=()=>Error('Original Treasure signing authority is unavailable. Its original operation remains reserved.');
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(key=>[key,(v as Record<string,unknown>)[key]])):v);
const same=(left:unknown,right:unknown)=>stable(left)===stable(right);
const decode=(value:string)=>Transaction.fromPSBT(base64.decode(value));
const encode=(value:Transaction)=>base64.encode(value.toPSBT());

/** Private callback composition for an already saved V4 spend. The stage
 * validator authenticates every resulting signature before persistence. Local
 * Player work never creates a fictitious remote signing receipt. Game work
 * always uses the exact durable journal and its original request arguments. */
export function createTreasureStagedAuthority(options:Options){
  const binding=structuredClone(options.binding);
  if(options.game&&options.localGame)throw fail();
  validateStagedTreasureBinding(binding);
  const referenceTime=binding.branch==='refund'?(Math.floor(binding.terms.startedAtMs/1000)+90)*1000:binding.terms.startedAtMs;
  const commitment=createStagedTreasureState(binding,referenceTime).bindingCommitment;
  function current(){if(!options.isCurrent())throw fail();}
  function inspect(intent:TreasureStagedSigningIntent,actual:StagedTreasureBinding){
    current();if(!same(actual,binding)||intent.artifactVersion!==4||intent.contractId!==binding.contractId||
      intent.operationId!==binding.operationId||intent.bindingCommitment!==commitment||
      !same(intent.actors,treasureAuthorizationActors(binding.branch))||!['root','checkpoint'].includes(intent.kind)||
      intent.actors.includes('player')&&!options.player||intent.actors.includes('game')&&!options.game&&!options.localGame)throw fail();
    if(intent.checkpoints.length!==binding.original.checkpoints.length)throw fail();
    assertTreasurePsbtEquivalent(intent.arkTx,binding.original.arkTx,1,3);
    intent.checkpoints.forEach((checkpoint,index)=>assertTreasurePsbtEquivalent(checkpoint,binding.original.checkpoints[index],1,2));
  }
  async function completed(intent:TreasureStagedSigningIntent):Promise<TreasureStagedSigningResult|undefined>{
    if(!intent.actors.includes('game')||!options.game)return undefined;
    if(intent.kind==='root'){
      const result=await options.game!.completed('root');return result?{arkTx:result}:undefined;
    }
    const results=await Promise.all(intent.checkpoints.map((_cp,index)=>options.game!.completed('checkpoint',index)));
    return results.every((value):value is string=>typeof value==='string')?{checkpoints:results}:undefined;
  }
  return Object.freeze({
    async claimSigning(intent:TreasureStagedSigningIntent,actual:StagedTreasureBinding):Promise<TreasureStagedSigningClaim>{
      inspect(intent,actual);const result=await completed(intent);current();if(result)return {status:'completed',result};
      if(intent.actors.includes('game')&&options.game){
        const states=intent.kind==='root'?[await options.game!.state('root')]:
          await Promise.all(intent.checkpoints.map((_cp,index)=>options.game!.state('checkpoint',index)));
        current();if(states.some(state=>state==='sign-pending'||state==='sign-unknown'))return {status:'pending'};
      }
      return {status:'granted'};
    },
    async sign(intent:TreasureStagedSigningIntent,actual:StagedTreasureBinding):Promise<TreasureStagedSigningResult>{
      inspect(intent,actual);
      async function one(encoded:string,index?:number){
        const purpose=index===undefined?'root':'checkpoint';
        const saved=intent.actors.includes('game')&&options.game?await options.game.original(purpose,index):undefined;
        current();let signed=saved??encoded;
        const outputCount=index===undefined?3:2;
        assertTreasurePsbtEquivalent(signed,encoded,1,outputCount);
        // A saved request already contains the exact original Player partial.
        // Replacing it with a newly randomized signature changes request bytes.
        if(!saved&&intent.actors.includes('player')){
          if(hex.encode(await options.player!.xOnlyPublicKey())!==binding.terms.player)throw fail();current();
          const tx=decode(encoded);signed=encode(await options.player!.sign(tx,Array.from({length:tx.inputsLength},(_,i)=>i)));current();
          assertTreasureSignatureRetention(encoded,signed,1,outputCount);
        }
        if(intent.actors.includes('game')&&options.localGame){
          if(hex.encode(await options.localGame.xOnlyPublicKey())!==binding.terms.game)throw fail();current();
          const tx=decode(signed),before=signed;
          signed=encode(await options.localGame.sign(tx,Array.from({length:tx.inputsLength},(_,i)=>i)));current();
          assertTreasureSignatureRetention(before,signed,1,outputCount);
        }
        if(intent.actors.includes('game')&&options.game)signed=index===undefined?await options.game.root(signed):await options.game.checkpoint(signed,index);
        current();return signed;
      }
      if(intent.kind==='root')return {arkTx:await one(intent.arkTx)};
      // Keep checkpoint request allocation and local signing sequential too.
      const checkpoints:string[]=[];for(let i=0;i<intent.checkpoints.length;i++)checkpoints.push(await one(intent.checkpoints[i],i));
      return {checkpoints};
    },
    async completeSigning(intent:TreasureStagedSigningIntent,result:TreasureStagedSigningResult,actual:StagedTreasureBinding){
      inspect(intent,actual);if(intent.actors.includes('game')&&options.game&&!same(await completed(intent),result))throw fail();current();
    },
    async markSigningUnknown(intent:TreasureStagedSigningIntent,actual:StagedTreasureBinding){
      // Transport persistence owns remote pending/unknown transitions. A local
      // signature failure does not prove a remote signing call was attempted.
      inspect(intent,actual);
    },
  });
}
