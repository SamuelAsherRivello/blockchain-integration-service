import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {validatePaymentAssignment,assertExecutionAuthority,assertReviewedSource,assertAtomicPaymentBudget,ServerPaymentBrowser,remoteRequest,boundedResult,type PaymentAssignment,type PaymentMode} from './funded-workflow-live.ts';
import {createProtectedBrowserJournalReader} from './protected-browser-journal.ts';
const legacy=(path:string)=>import(new URL(path,import.meta.url).href);
const {Vault,repositoryRoot}=await legacy('../../../scripts/test-wallets/vault.ts');
const {Operations}=await legacy('../../../scripts/test-wallets/operations.ts');
const {verifiedInventory}=await legacy('../../../scripts/test-wallets/inventory.ts');
export type LifecycleAssignment=PaymentAssignment&Readonly<{workflow:'boarding'|'standard-lto';authorizationMode:'owner'|'player-proof';ltoAction?:'claim'|'reject-refund'}>;
export type LifecyclePlan={fingerprint:string;outpoints:string[];amountSats:number;feeSats:number;[key:string]:any};
export type LifecycleContext={a:LifecycleAssignment;mode:PaymentMode;owner:any;plan?:LifecyclePlan;saved:any;deadline:number;financial:boolean;serverOperationId?:string;sessionPublicKey?:string;planToken?:string;batchToken?:string;batchId?:string;
 save:(use:(run:any,state:any)=>any)=>Promise<any>;read:()=>Promise<any>;ledger:any;vault:any;counts:{server:number;sign:number;provider:number;sessionSign:number};
 operation:(kind:string,account:any,id:string,recipient:string,run:()=>Promise<string>,target?:any)=>Promise<any>};
export type LifecycleStrategy={workflow:LifecycleAssignment['workflow'];source:string;operationKinds:readonly string[];lifecycleCost:(a:LifecycleAssignment)=>number;
 prepare:(ctx:LifecycleContext)=>Promise<LifecyclePlan>;execute:(ctx:LifecycleContext)=>Promise<void>;observe:(ctx:LifecycleContext)=>Promise<any>;
 server:(ctx:LifecycleContext,path:string,body:any)=>Promise<void>;provider:(ctx:LifecycleContext,path:string,body:any)=>Promise<void>;
 operationScope?:(ctx:LifecycleContext,path:string,raw:any)=>Promise<void>;
 cleanup?:(ctx:LifecycleContext)=>Promise<void>};
export const lifecycleHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const sameOutpoints=(left:readonly string[],right:readonly string[])=>JSON.stringify([...left].sort())===JSON.stringify([...right].sort());
export function validateLifecycleAssignment(value:any,workflow:LifecycleAssignment['workflow']):LifecycleAssignment{
 const {authorizationMode,workflow:given,ltoAction,...base}=value??{};validatePaymentAssignment(base);
 if(workflow==='boarding'&&ltoAction!==undefined||workflow==='standard-lto'&&ltoAction!==undefined&&!['claim','reject-refund'].includes(ltoAction))throw Error('Exact LTO action required.');
 if(given!==workflow||!['owner','player-proof'].includes(authorizationMode)||workflow==='standard-lto'&&base.amountSats!==1000)throw Error('Exact lifecycle assignment required.');
 for(const path of ['BIS/packages/bis-server/scripts/funded-workflow-lifecycle.ts',`BIS/packages/bis-server/scripts/funded-workflow-${workflow==='standard-lto'?'lto':'boarding'}.ts`])
  if(!/^[a-f0-9]{64}$/.test(base.sourceHashes[path]??''))throw Error('Reviewed lifecycle source required.');
 return Object.freeze({...base,workflow,authorizationMode,...(workflow==='standard-lto'?{ltoAction:ltoAction??'claim'}:{})});
}
export function assertLifecycleAuthority(a:LifecycleAssignment,mode:string,runId:string,env:NodeJS.ProcessEnv,runtime=process.versions.node){
 assertExecutionAuthority(a,mode,runId,env,runtime);
 if(a.authorizationMode==='owner'&&!env.BIS_ACCEPTANCE_OWNER_TOKEN||a.authorizationMode==='player-proof'&&env.BIS_ACCEPTANCE_OWNER_TOKEN)throw Error('Exact lifecycle authority required.');
}
export function lifecycleScope(a:LifecycleAssignment){const {approvedOutpoints:_o,approvedFingerprint:_f,...rest}=a;return lifecycleHash({...rest,sourceHashes:Object.fromEntries(Object.entries(rest.sourceHashes).sort(([a],[b])=>a.localeCompare(b)))});}
export function assertLifecyclePlan(plan:LifecyclePlan,a:LifecycleAssignment){
 if(!plan||!Number.isSafeInteger(plan.amountSats)||plan.amountSats!==a.amountSats||plan.feeSats!==a.feeSats||!plan.outpoints?.length||plan.outpoints.length>100||
  plan.outpoints.some(point=>!/^[a-f0-9]{64}:\d+$/.test(point))||new Set(plan.outpoints).size!==plan.outpoints.length||!/^[a-f0-9]{64}$/.test(plan.fingerprint))throw Error('Original lifecycle quote unavailable.');
}
export function assertLifecycleConnection(body:any,a:LifecycleAssignment){
 if(body?.network!==a.network||body.gameId!=='stealth-and-steel'||Object.keys(body).some(key=>!['gameId','network','profileId','requirement'].includes(key)))throw Error('Assigned server connection required.');
 if(body.profileId!==undefined){if(body.profileId!==a.gameProfileId||body.requirement!==undefined)throw Error('Original server identity required.');}
 else if(body.requirement!==undefined&&JSON.stringify(body.requirement)!==JSON.stringify(a.workflow==='boarding'?{purpose:'boarding'}:{arkadeSats:a.amountSats}))throw Error('Original lifecycle requirement changed.');
}
export function assertLifecycleResponse(response:{status:number;text:string},a:LifecycleAssignment){
 const info=JSON.parse(response.text);
 if(response.status!==200||info.runtime!=='vercel'||info.network!==a.network||info.gameId!=='stealth-and-steel'||info.profileId!==a.gameProfileId||info.publicKey!==a.serverPublicKey||info.slot!==a.candidateId.split(':')[1]||typeof info.token!=='string'||!info.token)throw Error('Reviewed hosted identity changed.');
}
export async function runLifecycle(assignment:LifecycleAssignment,mode:PaymentMode,strategy:LifecycleStrategy,env:NodeJS.ProcessEnv=process.env){
 const a=validateLifecycleAssignment(assignment,strategy.workflow);assertLifecycleAuthority(a,mode,a.runId,env);await assertReviewedSource(a);
 const vault=new Vault(),ledger=new Operations(vault),scope=lifecycleScope(a);let owner:any,stage='protected-registration',clientExposure=0;
 const ctx:LifecycleContext={a,mode,owner:undefined,saved:undefined,deadline:0,financial:false,vault,ledger,counts:{server:0,sign:0,provider:0,sessionSign:0},
  save:use=>vault.transaction((state:any)=>{state.serverLifecycleRuns??={};return use(state.serverLifecycleRuns[a.runId],state);}),
  read:async()=> (await vault.read({initialize:false})).serverLifecycleRuns?.[a.runId],
  operation:async(kind,account,id,recipient,run,target)=>{
   if(!ctx.financial||Date.now()>=ctx.deadline)throw Error('Original lifecycle deadline exhausted.');
   await ledger.prepare({id,account:account.label,profileId:account.profileId,generation:account.generation,network:a.network,kind,recipient,amountSats:a.amountSats,feeSats:a.feeSats,sourceOrigin:'http://127.0.0.1:5174',...(target?{target:{account:target.label,profileId:target.profileId,generation:target.generation}}:{})});
   return ledger.submit(id,async()=>({providerId:await boundedResult(run(),Math.max(1,ctx.deadline-Date.now()))}));
  }};
 const transaction=vault.transaction.bind(vault);
 vault.transaction=async(use:any,options?:any)=>transaction(async(state:any)=>{
  const ids=new Set((state.operations??[]).map((row:any)=>row.intent.id)),result=await use(state);
  for(const row of state.operations??[])if(!ids.has(row.intent.id)){
   if(!row.intent.id.startsWith(a.runId+'-')||!strategy.operationKinds.includes(row.intent.kind)||![a.gameProfileId,a.playerProfileId].includes(row.intent.profileId)||row.intent.network!==a.network||row.intent.amountSats!==a.amountSats||row.intent.feeSats!==a.feeSats)throw Error('Unassigned lifecycle operation.');
   assertAtomicPaymentBudget(state.operations??[],row.intent,clientExposure);
  }return result;
 },options);
 try{
  await vault.transaction(async(state:any)=>{
   await verifiedInventory(state);const pair=state.pairs.find((row:any)=>row.label===a.pair&&row.network===a.network),player=state.accounts.find((row:any)=>row.label===pair?.player),game=state.accounts.find((row:any)=>row.label===pair?.game);
   if(player?.profileId!==a.playerProfileId||game?.profileId!==a.gameProfileId||[player,game].some(row=>!row.grant?.active||!row.grant.networks.includes(a.network)||row.reportedPending?.[a.network]))throw Error('Registered lifecycle pair unavailable.');
   ctx.saved=state.serverLifecycleRuns?.[a.runId];const previous=ctx.saved;
   if(previous&&previous.scope!==scope||mode==='prepare'&&previous||mode==='run'&&previous?.phase!=='prepared'||mode==='reconcile'&&(!previous||previous.phase!=='unresolved'||previous.originalReconciliations))throw Error('Original lifecycle requires reconciliation.');
   if((state.operations??[]).some((row:any)=>row.intent.network===a.network&&[row.intent.profileId,row.intent.target?.profileId].some(id=>[a.playerProfileId,a.gameProfileId].includes(id))&&!['settled','failed','cancelled'].includes(row.state)&&!(mode==='reconcile'&&row.intent.id.startsWith(a.runId+'-'))))throw Error('Unresolved original wallet work.');
   if(mode==='reconcile')previous.originalReconciliations=1;
  });
  stage='reviewed-https-connection';let cached=await remoteRequest(a.endpoint,'connect',{network:a.network,gameId:'stealth-and-steel',profileId:a.gameProfileId},{'Content-Type':'application/json',...(a.authorizationMode==='owner'?{Authorization:`Bearer ${env.BIS_ACCEPTANCE_OWNER_TOKEN}`}:{})},env);ctx.counts.server++;assertLifecycleResponse(cached,a);
  const browserEndpoint=a.authorizationMode==='player-proof'?a.endpoint:undefined,serverOrigin=browserEndpoint?new URL(browserEndpoint).origin:'http://127.0.0.1:5174';
  const cors={'Access-Control-Allow-Origin':'http://127.0.0.1:5174','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-BIS-Signing-Grant'};
  const allowed=()=>ctx.financial&&Date.now()<ctx.deadline;
  const proxy=async(route:any)=>{
   const request=route.request(),url=new URL(request.url());
   try{
    if(url.origin===serverOrigin&&url.pathname.startsWith('/api/bis/')){
     const path=url.pathname.slice('/api/bis/'.length);
     if(request.method()==='OPTIONS'){
      if(request.headers().origin!=='http://127.0.0.1:5174'||request.headers()['access-control-request-method']!=='POST')throw Error('Unassigned preflight.');
      return route.fulfill({status:204,headers:cors});
     }
     if(request.method()!=='POST'||(request.postDataBuffer()?.length??0)>1024*1024)throw Error('Unexpected server transport.');const body=request.postDataJSON();
     if(path==='connect')assertLifecycleConnection(body,a);
     else{
      if(!allowed()||ctx.counts.server>=100)throw Error('Signing disabled.');
      if(['player/challenge','player/authenticate'].includes(path)){
       if(a.authorizationMode!=='player-proof'||body.gameId!=='stealth-and-steel'||body.network!==a.network||body.profileId!==a.gameProfileId||typeof body.operationId!=='string')throw Error('Player proof scope changed.');
       if(path==='player/challenge'&&(!/^0[23][a-f0-9]{64}$/.test(body.playerPublicKey??'')||createHash('sha256').update(Buffer.from(body.playerPublicKey,'hex')).digest('hex')!==a.playerProfileId))throw Error('Original Player proof key changed.');
       await strategy.operationScope?.(ctx,path,body);
       if(ctx.serverOperationId&&body.operationId!==ctx.serverOperationId)throw Error('Original signing operation changed.');ctx.serverOperationId=body.operationId;
      }else{
       const raw=body.request??body;
       if(raw.network!==a.network||raw.profileId!==a.gameProfileId||typeof raw.operationId!=='string')throw Error('Original signing scope changed.');
       await strategy.operationScope?.(ctx,path,raw);
       if(ctx.serverOperationId&&raw.operationId!==ctx.serverOperationId)throw Error('Original signing scope changed.');
       ctx.serverOperationId=raw.operationId;await strategy.server(ctx,path,body);
      }
      await ctx.save(run=>{run.serverRequests??=[];run.serverRequests.push({path,body,grant:request.headers()['x-bis-signing-grant']});});
     }
     const useCached=path==='connect'&&cached&&body.requirement===undefined;
     const headers={'Content-Type':'application/json',...(request.headers().origin?{Origin:request.headers().origin}:{}),...(request.headers().authorization?{Authorization:request.headers().authorization}:{}),...(request.headers()['x-bis-signing-grant']?{'X-BIS-Signing-Grant':request.headers()['x-bis-signing-grant']}:{})};
     const response=useCached?cached:await remoteRequest(a.endpoint,path,body,headers,env);if(useCached)cached=undefined as any;else ctx.counts.server++;
     if(path==='connect')assertLifecycleResponse(response,a);
     if(path.endsWith('settlement/plan')&&response.status===200){const info=JSON.parse(response.text),token=info[a.authorizationMode==='owner'?'ownerSettlementPlan':'settlementPlan'];if(!/^0[23][a-f0-9]{64}$/.test(info.sessionPublicKey??'')||typeof token!=='string'||!token)throw Error('Original session key unavailable.');ctx.sessionPublicKey=info.sessionPublicKey;ctx.planToken=token;await ctx.save(run=>{run.sessionPublicKey=info.sessionPublicKey;run.planToken=token;});}
     if(path.endsWith('settlement/batch')&&response.status===200){const info=JSON.parse(response.text);if(typeof info.settlementBatchPlan!=='string'||!info.settlementBatchPlan)throw Error('Original batch authority unavailable.');ctx.batchToken=info.settlementBatchPlan;await ctx.save(run=>{run.batchToken=info.settlementBatchPlan;});}
     if(path==='sign'&&response.status===200&&(body.request??body).method==='session.sign')ctx.counts.sessionSign++;
     if(path==='sign'&&response.status===200){ctx.counts.sign++;const raw=body.request??body;await ctx.save(run=>{run.successfulServerSigns??=[];run.successfulServerSigns.push({id:raw.id,operationId:raw.operationId,method:raw.method});});}
     return route.fulfill({status:response.status,contentType:'application/json',headers:cors,body:response.text});
    }
    if(['GET','HEAD','OPTIONS'].includes(request.method())||url.origin===`https://${a.network}.arkade.sh`&&url.pathname.startsWith('/v1/indexer/'))return route.continue();
    if(!allowed()||url.origin!==`https://${a.network}.arkade.sh`||ctx.counts.provider>=20)throw Error('Unassigned lifecycle provider call.');
    const body=request.postDataJSON();await strategy.provider(ctx,url.pathname,body);
    await ctx.save(run=>{run.providerRequests??=[];run.providerRequests.push({path:url.pathname,body});});
    if(!allowed())throw Error('Original observation expired.');ctx.counts.provider++;return route.continue();
   }catch{return route.abort('blockedbyclient').catch(()=>{});}
  };
  stage='owned-player-only-browser';owner=new ServerPaymentBrowser(vault,{pair:a.pair,origin:'http://127.0.0.1:5174',app:'admin',stableSource:true,recoveryProfile:'life-'+a.runId});ctx.owner=owner;
  owner.acceptance={assignment:a,proxy,ownerToken:env.BIS_ACCEPTANCE_OWNER_TOKEN,...(browserEndpoint?{browserEndpoint}:{})};await owner.start();await owner.inspect();
  if(mode!=='reconcile'){
   const journal=createProtectedBrowserJournalReader({page:owner.page,vault,runId:a.runId,slot:env.BIS_SERVER_ACCEPTANCE_SLOT,profileId:a.gameProfileId,network:a.network});const snapshot=await journal.readNetworkSnapshot(a.gameProfileId,a.network,Date.now(),[]);
   if(snapshot.reservations.length||snapshot.unknownOperations.length)throw Error('Original source journal unresolved.');clientExposure=snapshot.rolling24hSpentSats+snapshot.knownReservedSats;
   stage='actual-unsigned-preparation';ctx.plan=await strategy.prepare(ctx);assertLifecyclePlan(ctx.plan,a);
   if(ctx.counts.sign||ctx.counts.provider)throw Error('Preparation attempted a financial action.');
   if(mode==='prepare'){
    await ctx.save((_run,state)=>{if(state.serverLifecycleRuns[a.runId])throw Error('Original preparation exists.');state.serverLifecycleRuns[a.runId]={scope,workflow:a.workflow,phase:'prepared',plan:ctx.plan,assignment:a};});
    return {verifiedPreparation:true,workflow:a.workflow,authorizationMode:a.authorizationMode,plan:ctx.plan,financialActions:0,signingActions:0,transport:'controlled document and authenticated Preview proxy; deployed Pages CSP/CORS unverified'};
   }
   if(ctx.plan.fingerprint!==a.approvedFingerprint||!sameOutpoints(ctx.plan.outpoints,a.approvedOutpoints!)||ctx.plan.fingerprint!==ctx.saved.plan.fingerprint)throw Error('Original lifecycle approval changed.');
   await assertReviewedSource(a);await owner.inspect();
   await vault.transaction((state:any)=>{assertAtomicPaymentBudget(state.operations??[],{id:a.runId+'-lifecycle-reserve',network:a.network,amountSats:strategy.lifecycleCost(a),feeSats:0},clientExposure);const run=state.serverLifecycleRuns[a.runId];if(run.phase!=='prepared')throw Error('Original lifecycle already started.');run.phase='execution-started';});
   ctx.financial=true;ctx.deadline=Date.now()+120000;stage='original-'+a.workflow;await strategy.execute(ctx);ctx.financial=false;
  }else{ctx.plan=ctx.saved.plan;ctx.sessionPublicKey=ctx.saved.sessionPublicKey;ctx.deadline=Date.now()+120000;}
  stage='original-read-only-reconciliation';const receipt=await boundedResult(strategy.observe(ctx),Math.max(1,ctx.deadline-Date.now()));
  if(mode==='run'&&ctx.counts.sign<1)throw Error('Actual remote signing not observed.');
  await ctx.save(run=>{run.phase='settled';run.receipt=receipt;run.completedAt=new Date().toISOString();});
  return {verifiedLifecycle:true,workflow:a.workflow,authorizationMode:a.authorizationMode,receipt,counts:ctx.counts,transport:'controlled document and authenticated Preview proxy; deployed Pages CSP/CORS unverified'};
 }catch{
  ctx.financial=false;if(mode!=='prepare')await ctx.save(run=>{if(run?.phase==='execution-started')run.phase='unresolved';}).catch(()=>{});
  throw Error(`Lifecycle acceptance stopped at ${stage}; preserve original protected journals.`);
 }finally{ctx.financial=false;await strategy.cleanup?.(ctx).catch(()=>{});await owner?.page?.evaluate(()=>{const s=(globalThis as any).__serverAcceptance;s?.game?.dispose();s?.ui?.unmount();s?.context?.dispose();delete (globalThis as any).__serverAcceptance;}).catch(()=>{});await owner?.close().catch(()=>{});}
}
export async function lifecycleCli(strategy:LifecycleStrategy){
 for(const method of ['log','info','warn','error','debug','trace','dir'] as const)console[method]=()=>{};
 try{
  if(!/^24\./.test(process.versions.node)||!process.env.BIS_SERVER_ACCEPTANCE_SLOT||process.argv.length!==5)throw Error('Exact lifecycle slot required.');
  const [mode,path,runId]=process.argv.slice(2),a=validateLifecycleAssignment(JSON.parse(await readFile(resolve(path),'utf8')),strategy.workflow);assertLifecycleAuthority(a,mode,runId,process.env);
  const result=await runLifecycle(a,mode as PaymentMode,strategy),directory=resolve(repositoryRoot,'output/reports/bis-server/milestone-1');await mkdir(directory,{recursive:true});await writeFile(resolve(directory,`${a.workflow}-${a.runId}-${mode}.json`),JSON.stringify(result,null,2)+'\n');process.stdout.write(JSON.stringify({runId:a.runId,mode,...result})+'\n');
 }catch{process.stdout.write(JSON.stringify({ok:false,reason:'guarded-lifecycle-acceptance-incomplete',qualification:'No success inferred; retain and inspect exact original recovery.'})+'\n');process.exitCode=1;}
}
