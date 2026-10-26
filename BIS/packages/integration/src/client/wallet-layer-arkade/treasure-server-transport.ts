import type {AppPlayerProof} from './app-player-proof.ts';
import {base64,hex} from '@scure/base';
import type {ServerWalletReference} from './server-wallet.ts';
import type {TreasureActorProofRequest} from './treasure-authorization-protocol.ts';
import {decodeSigningValue} from './server-wallet-protocol.ts';
import {advanceTreasureServerJournal,transitionTreasureServerRequest,validateTreasureServerJournal,
  type TreasureServerJournal,type TreasureServerRequest} from './treasure-server-journal.ts';

type Options=Readonly<{
  account:ServerWalletReference;authority:'owner'|'player-proof';connectionToken:string;
  ownerToken?:()=>string|undefined;playerProof?:AppPlayerProof;fetcher?:typeof fetch;signal:AbortSignal;
  isCurrent:()=>boolean;now?:()=>number;
  read:()=>Promise<TreasureServerJournal>;
  /** Must atomically compare the original encrypted journal before replacing it. */
  commit:(before:TreasureServerJournal,after:TreasureServerJournal)=>Promise<void>;
}>;
const fail=()=>Error('Original Treasure server operation is unavailable. Reconcile its saved request before retrying.');
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
function object(value:unknown):asserts value is Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw fail();
}
function token(value:unknown,max=512*1024):asserts value is string{
  if(typeof value!=='string'||value.length===0||value.length>max)throw fail();
}

/** Private journal transport, inactive until supplied by the scoped Game lease.
 * It accepts only a request already validated and saved in that journal. It
 * never signs an arbitrary digest or exports owner credentials into recovery.
 */
export function createTreasureServerTransport(options:Options){
  const account=structuredClone(options.account),fetcher=options.fetcher??fetch,now=options.now??Date.now;
  const inflight=new Map<string,Promise<unknown>>();
  function current(){options.signal.throwIfAborted();if(!options.isCurrent())throw fail();}
  async function load(){
    current();const journal=await options.read();current();validateTreasureServerJournal(journal);
    const b=journal.binding;
    if(b.endpoint!==account.server.endpoint||b.gameId!==account.server.gameId||b.publicKey!==account.server.publicKey||
      b.profileId!==account.profileId||b.network!==account.network||b.authority!==options.authority)throw fail();
    return journal;
  }
  async function persist(before:TreasureServerJournal,id:string,event:Parameters<typeof transitionTreasureServerRequest>[2]){
    current();const after=transitionTreasureServerRequest(before,id,event);advanceTreasureServerJournal(before,after);
    await options.commit(before,after);current();
    const saved=await load();if(!same(saved,after))throw fail();return saved;
  }
  function request(journal:TreasureServerJournal,id:string){const saved=journal.requests.find(value=>value.id===id);if(!saved)throw fail();return saved;}
  function access(connectionToken:string){
    current();token(connectionToken,4096);
    const owner=options.authority==='owner',secret=owner?options.ownerToken?.():undefined;
    if(owner)token(secret,4096);
    return {owner,headers:{'Content-Type':'application/json',Authorization:`Bearer ${owner?secret:connectionToken}`}};
  }
  async function send(path:string,payload:unknown,connectionToken:string,grant?:string){
    const originalAccess=access(connectionToken);
    const response=await fetcher(account.server.endpoint+path,{method:'POST',
      headers:{...originalAccess.headers,...(grant?{'X-BIS-Signing-Grant':grant}:{})},body:JSON.stringify(payload),
      signal:AbortSignal.any([options.signal,AbortSignal.timeout(30_000)]),cache:'no-store',redirect:'error'});
    current();
    // Forgetting/changing owner access cannot accept a response into this lease.
    if(originalAccess.headers.Authorization!==access(connectionToken).headers.Authorization)throw fail();
    if(!response.ok)throw fail();
    const text=await response.text();current();if(text.length>1_048_576)throw fail();
    const result:unknown=JSON.parse(text);object(result);return result;
  }
  async function player(journal:TreasureServerJournal){
    if(options.authority==='owner')return undefined;
    if(!options.playerProof)throw fail();
    const proof=await options.playerProof({account,operationId:journal.binding.operationId,signal:options.signal,fetcher});
    current();proof.assertCurrent?.();
    if(proof.playerPublicKey.slice(2)!==journal.binding.terms.player)throw fail();return proof;
  }
  function originalToken(journal:TreasureServerJournal){
    return journal.requests.find(value=>value.connectionToken)?.connectionToken??options.connectionToken;
  }
  function baseBody(journal:TreasureServerJournal,saved:TreasureServerRequest){
    return {id:saved.id,operationId:journal.binding.operationId,network:journal.binding.network,
      profileId:journal.binding.profileId,method:saved.purpose==='actor-proof'?'signMessage':'sign',args:JSON.parse(saved.argsJson)};
  }
  function initialClock(journal:TreasureServerJournal,saved:TreasureServerRequest){
    const b=journal.binding,time=now(),deadline=(Math.floor(b.terms.startedAtMs/1000)+90)*1000;
    if(!Number.isSafeInteger(time)||time<b.terms.startedAtMs)throw fail();
    if(b.kind==='fund'&&saved.purpose==='root'&&time>=deadline||saved.purpose==='actor-proof'&&
      b.kind==='spend'&&(b.branch==='refund'?time<deadline:time>=deadline))throw fail();
  }
  function actorRequest(journal:TreasureServerJournal):TreasureActorProofRequest{
    const b=journal.binding;if(b.kind!=='spend')throw fail();
    return {artifactVersion:4,branch:b.branch,operationId:b.operationId,offerSessionId:b.terms.offerSessionId,
      hostReference:b.terms.hostReference,startedAtMs:b.terms.startedAtMs,funding:{txid:b.funding.txid,vout:b.funding.vout},
      arkTx:b.actorTemplate.arkTx,checkpoint:b.actorTemplate.checkpoint,
      ...(b.actorTemplate.playerProof?{playerProof:b.actorTemplate.playerProof}:{})};
  }
  async function plan(journal:TreasureServerJournal,id:string,proof:Awaited<ReturnType<typeof player>>){
    const saved=request(journal,id),b=journal.binding,connectionToken=originalToken(journal),owner=options.authority==='owner';
    const body:Record<string,unknown>=baseBody(journal,saved);
    if(saved.purpose==='actor-proof'){
      body.treasureActorProof=actorRequest(journal);body.connectionToken=connectionToken;
      proof?.assertCurrent?.();
      const planned=await send(owner?'owner/treasure/actor/plan':'treasure/actor/plan',
        owner?{request:body,connectionToken,contractPlayerPublicKey:'02'+b.terms.player}:{request:body,playerToken:proof!.token},connectionToken);
      token(planned.treasureActorPlan,8192);body.treasureActorPlan=planned.treasureActorPlan;
    }else{
      const field=owner?'ownerPlan':'paymentPlan';
      if(saved.purpose==='checkpoint'){
        const root=journal.requests.find(value=>value.purpose==='root'&&value.phase==='completed');
        if(!root?.bodyJson||!root.responseJson||root.connectionToken!==connectionToken)throw fail();
        body[field]=JSON.parse(root.bodyJson)[field];body.treasureRootReceipt=JSON.parse(root.responseJson).treasureRootReceipt;
        body.connectionToken=connectionToken;
      }else{
        const contract={artifactVersion:4,kind:b.kind==='fund'?'fund':'refund',branch:b.kind==='fund'?'fund':b.branch,
          offerSessionId:b.terms.offerSessionId,hostReference:b.terms.hostReference,startedAtMs:b.terms.startedAtMs};
        const outpoints=b.kind==='fund'?b.original.checkpoints.map(encoded=>{
          // The authenticated original journal owns source selection. Decode
          // only its canonical SDK checkpoints, never caller-supplied inputs.
          const tx=decodeSigningValue({$type:'transaction',value:base64ToHex(encoded)});
          const input=tx.getInput(0);return {txid:bytesHex(input.txid),vout:input.index};
        }):[{txid:b.funding.txid,vout:b.funding.vout}];
        proof?.assertCurrent?.();
        const planned=await send(owner?'owner/plan':'payment/plan',owner?
          {request:body,connectionToken,outpoints,contract,contractPlayerPublicKey:'02'+b.terms.player}:
          {request:body,playerToken:proof!.token,outpoints,contract},connectionToken);
        token(planned[field]);body[field]=planned[field];
      }
      if(owner)body.connectionToken=connectionToken;
    }
    proof?.assertCurrent?.();
    return persist(journal,id,{type:'planned',bodyJson:JSON.stringify(body),connectionToken,atMs:now()});
  }
  async function recover(journal:TreasureServerJournal,id:string){
    const saved=request(journal,id);
    if(saved.phase==='completed')return decodeSigningValue(JSON.parse(saved.responseJson!).result);
    if(!['sign-pending','sign-unknown'].includes(saved.phase)||!saved.bodyJson||!saved.bodyDigest||!saved.connectionToken)throw fail();
    const response=await send('treasure/recover',{version:1,requestId:id,requestDigest:saved.bodyDigest,
      requestJson:saved.bodyJson,connectionToken:saved.connectionToken},saved.connectionToken);
    const next=await persist(journal,id,{type:'completed',responseJson:JSON.stringify(response),atMs:now()});
    return decodeSigningValue(JSON.parse(request(next,id).responseJson!).result);
  }
  async function execute(id:string){
    let journal=await load(),saved=request(journal,id);
    if(['sign-pending','sign-unknown','completed'].includes(saved.phase))return recover(journal,id);
    initialClock(journal,saved);
    const proof=await player(journal);
    if(saved.phase==='prepared'){journal=await plan(journal,id,proof);saved=request(journal,id);}
    if(saved.phase!=='planned'||!saved.bodyJson||!saved.connectionToken)throw fail();
    const owner=options.authority==='owner',body=JSON.parse(saved.bodyJson),actor=saved.purpose==='actor-proof';
    proof?.assertCurrent?.();initialClock(journal,saved);
    const checkpoint=saved.purpose==='checkpoint';
    const authorized=checkpoint?undefined:await send(actor?(owner?'owner/treasure/actor/authorize':'treasure/actor/authorize'):
      owner?'owner/authorize':'payment/authorize',owner?{request:body,connectionToken:saved.connectionToken,
        ...(actor?{contractPlayerPublicKey:'02'+journal.binding.terms.player}:{})}:{request:body,playerToken:proof!.token},saved.connectionToken);
    const grant=authorized?.grant;
    if(!checkpoint)token(grant,4096);proof?.assertCurrent?.();initialClock(journal,saved);
    journal=await persist(journal,id,{type:'sign-pending',atMs:now()});
    try{
      initialClock(journal,saved);
      const response=checkpoint?await send(owner?'owner/treasure/checkpoint/complete':'treasure/checkpoint/complete',{
        version:1,requestId:id,requestDigest:saved.bodyDigest,requestJson:saved.bodyJson,connectionToken:saved.connectionToken,
        ...(!owner?{playerToken:proof!.token}:{}),
      },saved.connectionToken):await send('sign',body,saved.connectionToken,typeof grant==='string'?grant:undefined);
      proof?.assertCurrent?.();
      const next=await persist(journal,id,{type:'completed',responseJson:JSON.stringify(response),atMs:now()});
      return decodeSigningValue(JSON.parse(request(next,id).responseJson!).result);
    }catch{
      // The pending write already protects a lost response, including failure
      // to persist this optional uncertainty marker after the scope changes.
      try{journal=await load();if(request(journal,id).phase==='sign-pending')await persist(journal,id,{type:'sign-unknown',atMs:now()});}catch{}
      throw fail();
    }
  }
  return Object.freeze({
    request(id:string){
      const existing=inflight.get(id);if(existing)return existing;
      const pending=execute(id).catch(()=>{throw fail();}).finally(()=>inflight.delete(id));
      inflight.set(id,pending);return pending;
    },
    recover(id:string){return load().then(journal=>recover(journal,id)).catch(()=>{throw fail();});},
  });
}

// Browser-safe decoding. No Node polyfill or private server module is imported.
const base64ToHex=(value:string)=>hex.encode(base64.decode(value));
const bytesHex=(value:Uint8Array)=>hex.encode(value);
