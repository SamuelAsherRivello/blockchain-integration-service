import {CSVMultisigTapscript,Transaction} from '@arkade-os/sdk';
import {Transaction as BitcoinTransaction} from '@scure/btc-signer';
import {base64,hex} from '@scure/base';
import {treasureAuthorizationDigest} from './treasure-authorized-script.ts';
import {encodeSigningValue,decodeSigningValue} from './server-wallet-protocol.ts';
import {advanceTreasureServerJournal,prepareTreasureServerRequest,validateTreasureServerJournal,
  type TreasureServerJournal,type TreasureServerRequestPurpose} from './treasure-server-journal.ts';
import type {createTreasureServerTransport} from './treasure-server-transport.ts';

type Options=Readonly<{
  read:()=>Promise<TreasureServerJournal>;
  commit:(before:TreasureServerJournal,after:TreasureServerJournal)=>Promise<void>;
  transport:Pick<ReturnType<typeof createTreasureServerTransport>,'request'|'recover'>;
  isCurrent:()=>boolean;now?:()=>number;
}>;
const fail=()=>Error('Original Treasure signing journal could not be reconciled. Its original requests remain reserved.');
const decode=(value:string)=>Transaction.fromPSBT(base64.decode(value));
const encode=(value:Transaction)=>base64.encode(value.toPSBT());

/** Typed bridge for actual Game RPCs. Callers cannot supply a request ID,
 * arbitrary message, signing method, plan or connection credential. Root and
 * checkpoint arguments are authenticated against the journal's original pair.
 * All request purposes share one lane, including a multi-input funding ROOT.
 */
export function createTreasureJournalSigner(options:Options){
  const now=options.now??Date.now;let lane:Promise<unknown>=Promise.resolve();
  function current(){if(!options.isCurrent())throw fail();}
  async function load(){current();const journal=await options.read();current();validateTreasureServerJournal(journal);return journal;}
  function find(journal:TreasureServerJournal,purpose:TreasureServerRequestPurpose,index?:number){
    return journal.requests.find(record=>record.purpose===purpose&&(purpose!=='checkpoint'||record.checkpointIndex===index));
  }
  function serialize<T>(work:()=>Promise<T>):Promise<T>{
    const result=lane.then(work).catch(()=>{throw fail();});lane=result.catch(()=>{});return result;
  }
  async function invoke(purpose:TreasureServerRequestPurpose,argsJson:string,index?:number){
    let journal=await load(),record=find(journal,purpose,index);
    if(record&&record.argsJson!==argsJson)throw fail();
    // Another uncertain original must be looked up before preparing fresh work.
    if(journal.requests.some(value=>value.id!==record?.id&&['sign-pending','sign-unknown'].includes(value.phase)))throw fail();
    if(!record){
      const next=prepareTreasureServerRequest(journal,{purpose,id:crypto.randomUUID(),argsJson,
        ...(purpose==='checkpoint'?{checkpointIndex:index}:{})},now());
      advanceTreasureServerJournal(journal,next);current();await options.commit(journal,next);
      journal=await load();if(JSON.stringify(journal)!==JSON.stringify(next))throw fail();record=find(journal,purpose,index);
    }
    if(!record)throw fail();current();await options.transport.request(record.id);
    const saved=await load(),completed=find(saved,purpose,index);
    if(saved.bindingCommitment!==journal.bindingCommitment||!completed||completed.id!==record.id||completed.phase!=='completed'||
      completed.argsJson!==argsJson||!completed.responseJson)throw fail();
    return decodeSigningValue(JSON.parse(completed.responseJson).result);
  }
  async function actor(){
    const journal=await load(),b=journal.binding;if(b.kind!=='spend')throw fail();
    const message=treasureAuthorizationDigest(b.terms,b.branch,{arkTx:decode(b.actorTemplate.arkTx),checkpoint:decode(b.actorTemplate.checkpoint),
      funding:b.funding,checkpointTapscript:CSVMultisigTapscript.decode(hex.decode(b.checkpointTapscript))});
    const result=await invoke('actor-proof',JSON.stringify(encodeSigningValue([message,'schnorr'])));
    if(!(result instanceof Uint8Array)||result.length!==64)throw fail();return hex.encode(result);
  }
  async function sign(purpose:'root'|'checkpoint',encoded:string,index?:number){
    const tx=decode(encoded),indexes=Array.from({length:tx.inputsLength},(_,i)=>i);
    const result=await invoke(purpose,JSON.stringify(encodeSigningValue([tx,indexes])),index);
    if(!(result instanceof BitcoinTransaction))throw fail();return encode(result);
  }
  return Object.freeze({
    actorProof(){return serialize(actor);},
    root(encoded:string){return serialize(()=>sign('root',encoded));},
    checkpoint(encoded:string,index:number){return serialize(()=>sign('checkpoint',encoded,index));},
    /** Used before computing any new local Player partial. A completed Game
     * response already retains the exact original Player/Emulator partials. */
    completed(purpose:TreasureServerRequestPurpose,index?:number){return serialize(async()=>{
      const record=find(await load(),purpose,index);if(record?.phase!=='completed'||!record.responseJson)return undefined;
      const result=decodeSigningValue(JSON.parse(record.responseJson).result);
      if(purpose==='actor-proof'){if(!(result instanceof Uint8Array)||result.length!==64)throw fail();return hex.encode(result);}
      if(!(result instanceof BitcoinTransaction))throw fail();return encode(result);
    });},
    state(purpose:TreasureServerRequestPurpose,index?:number){return serialize(async()=>find(await load(),purpose,index)?.phase??'absent');},
    /** Exact persisted signing argument, including original actor partials. */
    original(purpose:'root'|'checkpoint',index?:number){return serialize(async()=>{
      const record=find(await load(),purpose,index);if(!record)return undefined;
      const args=decodeSigningValue(JSON.parse(record.argsJson));
      if(!Array.isArray(args)||!(args[0] instanceof BitcoinTransaction))throw fail();return encode(args[0]);
    });},
    /** Read-only original-result requests. This cannot plan, sign or continue
     * a different transaction after a lost response or a browser restart. */
    recoverOutstanding(){return serialize(async()=>{
      const pending=(await load()).requests.filter(record=>['sign-pending','sign-unknown'].includes(record.phase));
      for(const record of pending){current();await options.transport.recover(record.id);}
      return !(await load()).requests.some(record=>['sign-pending','sign-unknown'].includes(record.phase));
    });},
  });
}
