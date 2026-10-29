import {readFile,mkdir,writeFile,open} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {ArkAddress,RestIndexerProvider,Transaction} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import {decodeSigningValue} from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {createProtectedBrowserJournalReader,assertJournalAccess,type TestNetwork} from './protected-browser-journal.ts';
import {vercelCurlConfig} from './vercel-curl-config.ts';
import {hasVerifiedBoardingNonSubmission} from '../../../scripts/test-wallets/boarding-non-submission.ts';

// Existing protected test tooling is dynamically loaded at this explicit bridge.
// It is runtime-tested legacy script code outside the application tsconfig.
const legacy=(path:string)=>import(new URL(path,import.meta.url).href);
const {Vault,repositoryRoot,validatePrivatePath}=await legacy('../../../scripts/test-wallets/vault.ts');
const {Operations}=await legacy('../../../scripts/test-wallets/operations.ts');
const {OwnedBrowser,ownedProfileKey}=await legacy('../../../scripts/test-wallets/owned-browser.ts');
const {browserEnvironment}=await legacy('../../../scripts/test-wallets/browser-public.ts');
const {loadAddresses}=await legacy('../../integration/src/client/wallet-layer-arkade/addresses.ts');
const {verifiedInventory}=await legacy('../../../scripts/test-wallets/inventory.ts');
const {findTestActor,actorSource,assertAssignedServerActor}=await legacy('../../../scripts/test-wallets/server-actors.ts');
const {createProtectedVaultCaseJournalReader,prepareAssignedCase,preparePaymentCaseQuote}=await legacy('./tests/funded-workflow-preflight.ts');

export type PaymentAssignment=Readonly<{
  runId:string;network:TestNetwork;pair:string;candidateId:string;
  playerProfileId:string;gameProfileId:string;serverPublicKey:string;endpoint:string;
  amountSats:number;feeSats:0;sourceHashes:Readonly<Record<string,string>>;
  approvedOutpoints?:readonly string[];approvedFingerprint?:string;
}>;
export type PaymentMode='prepare'|'run'|'reconcile';
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validHash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const samePoints=(a:readonly string[],b:readonly string[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const permittedFields=new Set(['runId','network','pair','candidateId','playerProfileId','gameProfileId','serverPublicKey','endpoint','amountSats','feeSats','sourceHashes','approvedOutpoints','approvedFingerprint']);

export function validatePaymentAssignment(value:any):PaymentAssignment{
  if(!value||typeof value!=='object'||Object.keys(value).some(key=>!permittedFields.has(key))||
    !/^[a-z][a-z0-9-]{7,23}$/.test(value.runId??'')||!['signet','mutinynet'].includes(value.network)||
    !/^[a-z][a-z0-9-]{0,39}$/.test(value.pair??'')||!new RegExp(`^${value.network}:0[123]$`).test(value.candidateId)||
    !validHash(value.playerProfileId)||!validHash(value.gameProfileId)||value.playerProfileId===value.gameProfileId||
    !/^(02|03)[a-f0-9]{64}$/i.test(value.serverPublicKey??'')||!Number.isSafeInteger(value.amountSats)||value.amountSats<1||value.amountSats>5000||value.feeSats!==0)
    throw Error('Invalid public payment assignment.');
  const endpoint=new URL(value.endpoint);
  if(createHash('sha256').update(Buffer.from(value.serverPublicKey,'hex')).digest('hex')!==value.gameProfileId)throw Error('Reviewed server identity mismatch.');
  if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.vercel.app')||endpoint.username||endpoint.password||endpoint.port||endpoint.search||endpoint.hash||endpoint.pathname!=='/api/bis/')throw Error('Reviewed protected Vercel endpoint required.');
  if(!value.sourceHashes||typeof value.sourceHashes!=='object'||!Object.keys(value.sourceHashes).length)throw Error('Reviewed source hashes required.');
  for(const path of ['BIS/packages/bis-server/scripts/funded-workflow-live.ts','BIS/packages/bis-server/scripts/protected-browser-journal.ts','BIS/packages/bis-server/scripts/tests/funded-workflow-preflight.ts'])if(!validHash(value.sourceHashes[path]))throw Error('The executable and journal source hashes are required.');
  for(const [path,hash] of Object.entries(value.sourceHashes))if(!/^BIS\/(?:packages\/(?:bis-server|integration)\/(?:scripts|src)\/|scripts\/test-wallets\/)[A-Za-z0-9/_-]+\.tsx?$/.test(path)||!validHash(hash))throw Error('Invalid reviewed source path.');
  if(value.approvedOutpoints!==undefined&&(!Array.isArray(value.approvedOutpoints)||!value.approvedOutpoints.length||value.approvedOutpoints.length>100||new Set(value.approvedOutpoints).size!==value.approvedOutpoints.length||value.approvedOutpoints.some((point:unknown)=>typeof point!=='string'||!/^[a-f0-9]{64}:\d+$/.test(point))))throw Error('Invalid approved source inputs.');
  if(value.approvedFingerprint!==undefined&&!validHash(value.approvedFingerprint))throw Error('Invalid approved payment fingerprint.');
  return Object.freeze(value);
}
export function assertExecutionAuthority(assignment:PaymentAssignment,mode:string,requestedRunId:string,env:Record<string,string|undefined>,runtime=process.versions.node){
  assertJournalAccess({runId:assignment.runId,slot:env.BIS_SERVER_ACCEPTANCE_SLOT,profileId:assignment.gameProfileId,network:assignment.network},runtime);
  if(!['prepare','run','reconcile'].includes(mode)||requestedRunId!==assignment.runId)throw Error('Exact coordinator command required.');
  if(mode==='run'&&(env.BIS_SERVER_FINANCIAL_SLOT!==assignment.runId||!assignment.approvedOutpoints?.length||!assignment.approvedFingerprint))throw Error('Exact financial slot and approved original quote required.');
}
export function assignmentScope(assignment:PaymentAssignment){
  const {approvedFingerprint:_fingerprint,approvedOutpoints:_points,...scope}=assignment;
  return sha({...scope,sourceHashes:Object.fromEntries(Object.entries(scope.sourceHashes).sort(([a],[b])=>a.localeCompare(b)))});
}
export async function assertReviewedSource(assignment:PaymentAssignment){
  for(const [path,expected] of Object.entries(assignment.sourceHashes)){
    const target=resolve(repositoryRoot,path),inside=relative(repositoryRoot,target);
    if(inside.startsWith('..')||isAbsolute(inside)||createHash('sha256').update(await readFile(target)).digest('hex')!==expected)throw Error('Reviewed source changed.');
  }
}
function decodeTx(encoded:string){return /^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded));}

/** Exact original inputs and recipient are checked before remote authorization. */
export function inspectPaymentPlan(payload:any,assignment:PaymentAssignment,quote:{outpoints:readonly string[]},recipient:string){
  const request=payload?.request;
  if(request?.network!==assignment.network||request.profileId!==assignment.gameProfileId||request.method!=='sign'||!Array.isArray(payload.outpoints)||
    !samePoints(payload.outpoints.map((point:any)=>`${point.txid}:${point.vout}`),quote.outpoints))throw Error('Remote payment plan changed.');
  const args=decodeSigningValue(request.args),decoded=args?.[0];
  // SDK browser/Node exports can wrap separate copies of the transaction class.
  // Reparse the protocol PSBT to validate actual wire data across that boundary.
  if(typeof decoded?.toPSBT!=='function')throw Error('Remote payment destination changed.');
  const tx=Transaction.fromPSBT(decoded.toPSBT());
  if(!tx.getOutput(0).script||tx.getOutput(0).amount!==BigInt(assignment.amountSats)||hex.encode(tx.getOutput(0).script!)!==hex.encode(ArkAddress.decode(recipient).pkScript))throw Error('Remote payment destination changed.');
  return tx.id;
}
export function inspectOriginalSubmission(payload:any,assignment:PaymentAssignment,transactionId:string){
  if(typeof payload?.signedArkTx!=='string'||!Array.isArray(payload.checkpointTxs)||payload.checkpointTxs.length!==assignment.approvedOutpoints?.length)throw Error('Original payment submission unavailable.');
  const tx=decodeTx(payload.signedArkTx),checkpoints=payload.checkpointTxs.map(decodeTx);
  if(tx.id!==transactionId||tx.inputsLength!==checkpoints.length)throw Error('Original payment transaction changed.');
  const source=checkpoints.map((checkpoint:Transaction)=>{
    if(checkpoint.inputsLength!==1)throw Error('Original checkpoint source changed.');
    const input=checkpoint.getInput(0);return `${hex.encode(input.txid!)}:${input.index}`;
  });
  if(!samePoints(source,assignment.approvedOutpoints!))throw Error('Original payment inputs changed.');
  for(let index=0;index<tx.inputsLength;index++){
    const input=tx.getInput(index);
    if(input.index!==0||!checkpoints.some((checkpoint:Transaction)=>checkpoint.id===hex.encode(input.txid!)))throw Error('Original checkpoint chain changed.');
  }
  return {transactionId:tx.id,checkpointIds:checkpoints.map((checkpoint:Transaction)=>checkpoint.id)};
}

/** Fresh index and wire ancestry, value and asset-conservation evidence. */
export async function verifyPaymentReceipt(indexer:any,input:{transactionId:string;outpoints:readonly string[];recipient:string;gameAddress:string;amountSats:number}){
  const points=input.outpoints.map(point=>{const [txid,vout]=point.split(':');return {txid,vout:Number(vout)};});
  const {vtxos}=await indexer.getVtxos({outpoints:[...points,{txid:input.transactionId,vout:0},{txid:input.transactionId,vout:1}]});
  const sources=points.map(point=>vtxos.find((coin:any)=>coin.txid===point.txid&&coin.vout===point.vout));
  const recipientScript=hex.encode(ArkAddress.decode(input.recipient).pkScript),gameScript=hex.encode(ArkAddress.decode(input.gameAddress).pkScript);
  if(sources.some((coin:any)=>!coin?.isSpent||!validHash(coin.spentBy)||!Number.isSafeInteger(coin.value)||coin.value<1))throw Error('Original spent inputs unverified.');
  const checkpointIds=sources.map((coin:any)=>coin.spentBy);
  const encoded=await indexer.getVirtualTxs([input.transactionId,...checkpointIds]);
  const txs=encoded.txs.map(decodeTx),payment=txs.find((tx:Transaction)=>tx.id===input.transactionId);
  if(!payment||payment.inputsLength!==sources.length)throw Error('Payment wire unavailable.');
  for(let index=0;index<payment.inputsLength;index++){
    const child=payment.getInput(index),checkpoint=txs.find((tx:Transaction)=>tx.id===hex.encode(child.txid!));
    const original=checkpoint?.getInput(0);
    const source=sources.find((coin:any)=>coin.spentBy===checkpoint?.id);
    if(child.index!==0||!checkpoint||checkpoint.inputsLength!==1||!original||!source||hex.encode(original.txid!)!==source.txid||original.index!==source.vout||checkpoint.getOutput(0).amount!==BigInt(source.value))throw Error('Payment ancestry changed.');
  }
  const payout=vtxos.find((coin:any)=>coin.txid===input.transactionId&&coin.vout===0);
  if(!payout||payout.value!==input.amountSats||payout.script!==recipientScript||payout.assets?.length||payment.getOutput(0).amount!==BigInt(input.amountSats)||hex.encode(payment.getOutput(0).script!)!==recipientScript)throw Error('Payment recipient receipt unverified.');
  const total=sources.reduce((sum:number,coin:any)=>sum+coin.value,0),change=total-input.amountSats;
  if(!Number.isSafeInteger(total)||total<0)throw Error('Payment source amount unavailable.');
  let outputTotal=0n;for(let index=0;index<payment.outputsLength;index++)outputTotal+=payment.getOutput(index).amount??0n;
  if(change<0||outputTotal!==BigInt(total))throw Error('Payment fee or amount changed.');
  const totals=(coins:any[])=>{
    const values=new Map<string,bigint>();for(const coin of coins)for(const asset of coin.assets??[]){
      if(!/^[a-f0-9]{68}$/i.test(asset.assetId)||BigInt(asset.amount)<=0n)throw Error('Payment asset evidence unavailable.');
      values.set(asset.assetId,(values.get(asset.assetId)??0n)+BigInt(asset.amount));
    }
    return [...values].sort(([a],[b])=>a.localeCompare(b)).map(([assetId,amount])=>({assetId,amount:String(amount)}));
  };
  const retained=totals(sources);
  if(change>0){
    const receipt=vtxos.find((coin:any)=>coin.txid===input.transactionId&&coin.vout===1);
    if(!receipt||receipt.value!==change||receipt.script!==gameScript||payment.getOutput(1).amount!==BigInt(change)||hex.encode(payment.getOutput(1).script!)!==gameScript||JSON.stringify(totals([receipt]))!==JSON.stringify(retained))throw Error('Payment change or assets unverified.');
  }else if(retained.length)throw Error('Payment asset preservation unverified.');
  return {transactionId:input.transactionId,amountSats:input.amountSats,feeSats:0,checkpointIds,sourceOutpoints:[...input.outpoints],assetsPreserved:true};
}

export async function remoteRequest(endpoint:string,path:string,body:any,headers:Record<string,string>,env:NodeJS.ProcessEnv){
  const target=new URL(path,endpoint);
  if(target.origin!==new URL(endpoint).origin||!target.pathname.startsWith('/api/bis/'))throw Error('Remote signing route changed.');
  if(env.BIS_ACCEPTANCE_VERCEL_CLI){
    const config=vercelCurlConfig(body,headers)+'\nwrite-out = "\\n%{http_code}"';
    const stdout=await new Promise<string>((resolve,reject)=>{
      const child=spawn(process.execPath,[env.BIS_ACCEPTANCE_VERCEL_CLI!,'--scope','ashers-projects-d3be6036','curl',target.pathname,'--deployment',target.origin,'--','--config','-'],
        {cwd:repositoryRoot,env:Object.fromEntries(Object.entries(env).filter(([key])=>!/^BIS_|^UPSTASH_|^KV_|^REDIS_/.test(key))),windowsHide:true,stdio:['pipe','pipe','pipe']});
      let output='';const timer=setTimeout(()=>{child.kill();reject(Error('Protected transport observation timed out.'));},45000);
      child.stdout.on('data',chunk=>{output+=chunk;if(output.length>2*1024*1024)child.kill();});child.stderr.resume();
      child.stdin.on('error',()=>{});child.stdin.end(config);
      child.on('error',()=>{clearTimeout(timer);reject(Error('Protected transport unavailable.'));});
      child.on('close',code=>{clearTimeout(timer);code===0?resolve(output):reject(Error('Protected transport unavailable.'));});
    });
    const marker=stdout.lastIndexOf('\n'),status=Number(stdout.slice(marker+1).trim()),text=stdout.slice(0,marker);
    if(marker<0||!Number.isInteger(status)||status<100||status>599)throw Error('Protected HTTP response unavailable.');
    return {status,text};
  }
  const response=await fetch(target,{method:'POST',headers,body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(35000)});
  return {status:response.status,text:await response.text()};
}

/** Only Player recovery enters this browser. Game identity is always remote. */
export function acceptanceBrowserEndpoint(assignment:Pick<PaymentAssignment,'endpoint'>,requested?:string){
  if(requested===undefined)return '/api/bis/';
  const endpoint=new URL(assignment.endpoint);
  if(requested!==assignment.endpoint||endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.vercel.app')||
    endpoint.username||endpoint.password||endpoint.port||endpoint.search||endpoint.hash||endpoint.pathname!=='/api/bis/')throw Error('Reviewed browser endpoint required.');
  return requested;
}
export function acceptanceDocumentPolicy(policy:string,endpoint?:string){
  if(endpoint===undefined)return policy;
  acceptanceBrowserEndpoint({endpoint},endpoint);
  const directives=policy.split(';').map(value=>value.trim()).filter(Boolean);
  const connect=directives.filter(value=>/^connect-src(?:\s|$)/.test(value));
  if(connect.length!==1)throw Error('Owned document connection policy unavailable.');
  const origin=new URL(endpoint).origin;
  return directives.map(value=>value===connect[0]?[...new Set([...value.split(/\s+/),origin])].join(' '):value).join('; ');
}
/** This explicit Node transport exercises hosted authorization from an owned
 * loopback document. It makes no claim about deployed browser CORS. Forward
 * only the real authorization inputs; never spoof a permitted browser Origin. */
export function acceptanceProxyHeaders(headers:Record<string,string>){
  return {'Content-Type':'application/json',...(headers.authorization?{Authorization:headers.authorization}:{}),
    ...(headers['x-bis-signing-grant']?{'X-BIS-Signing-Grant':headers['x-bis-signing-grant']}:{})};
}
export class ServerPaymentBrowser extends OwnedBrowser{
  [key:string]:any;
  acceptance:any;
  constructor(vault:any,options:any){super(vault,options);}
  async start():Promise<any>{
    // The base start() restores both manual roles. This variant retains its
    // registry, ACL and ownership checks, but installs the real server proxy and
    // financial backstop BEFORE navigation, and restores only the Player.
    const a=this.acceptance.assignment;
    acceptanceBrowserEndpoint(a,this.acceptance.browserEndpoint);
    this.registration=await this.vault.transaction(async(state:any)=>{
      await verifiedInventory(state);
      const application=state.applications?.find((row:any)=>row.app==='admin'&&row.origin==='http://127.0.0.1:5174'&&row.path==='/admin/');
      const pair=state.pairs.find((row:any)=>row.label===a.pair&&row.network===a.network);
      const player=state.accounts.find((row:any)=>row.label===pair?.player),game=findTestActor(state,pair?.game);
      if(!application||player?.profileId!==a.playerProfileId||game?.profileId!==a.gameProfileId)throw Error('Owned server profile registration unavailable.');
      assertAssignedServerActor(game,a);
      return {application,pair,player,game};
    });
    const key=ownedProfileKey(a.pair,a.network,'http://127.0.0.1:5174','admin',this.options.recoveryProfile),profile=join(this.vault.root,'profiles',key);
    await validatePrivatePath(profile);this.lockPath=join(this.vault.root,`profile-${key}.lock`);this.lock=await open(this.lockPath,'wx',0o600);
    try{
      await this.lock.writeFile(JSON.stringify({pid:process.pid,sessionId:this.sessionId}));await this.lock.sync();
      await this.validateRegistration();await mkdir(profile,{recursive:true,mode:0o700});await this.vault.protector.check(profile);
      for(const name of ['DEBUG','PWDEBUG','DEBUG_FILE'])delete process.env[name];
      const {chromium}=await import('playwright');
      this.context=await chromium.launchPersistentContext(profile,{headless:true,acceptDownloads:false,viewport:{width:1280,height:900},timeout:20000,env:browserEnvironment()});
      this.context.setDefaultTimeout(20000);this.page=this.context.pages()[0]??await this.context.newPage();
      this.context.on('page',(page:any)=>{if(page!==this.page)void page.close().catch(()=>{});});
      await this.context.route('**/*',async(route:any)=>{
        const request=route.request(),url=new URL(request.url());
        if(request.isNavigationRequest()&&request.frame()===this.page.mainFrame()&&(url.origin!=='http://127.0.0.1:5174'||url.pathname!=='/admin/'||url.search))return route.abort('blockedbyclient');
        return this.acceptance.proxy(route);
      });
      await this.context.routeWebSocket((url:URL)=>url.host==='127.0.0.1:5174',(socket:any)=>{
        const server=socket.connectToServer();server.onMessage((message:any)=>{
          try{if(['update','full-reload'].includes(JSON.parse(String(message)).type))return;}catch{}
          socket.send(message);
        });
      });
      const deadline=AbortSignal.timeout(30000);
      this.expected={player:await loadAddresses({...this.registration.player,network:a.network},deadline),game:await loadAddresses({...this.registration.game,network:a.network},deadline)};
      await this.page.goto('http://127.0.0.1:5174/admin/',{waitUntil:'domcontentloaded'});await this.restorePair();return this.inspect();
    }catch{await this.close();throw Error('Owned remote browser unavailable.');}
  }
  async restorePair(){
    const {assignment}=this.acceptance;
    const browserEndpoint=acceptanceBrowserEndpoint(assignment,this.acceptance.browserEndpoint);
    await enterServerDocument(this.page,this.acceptance.browserEndpoint);
    await this.page.evaluate(async (input:any)=>{
      const load=(path:string)=>import(/* @vite-ignore */path),api=await load('/BIS/packages/integration/src/index.ts');
      const {createTestNetworkSession}=await load('/BIS/packages/integration/src/client/state-layer-core/test-network.ts');
      const {configureBisServer}=await load('/BIS/packages/integration/src/client/wallet-layer-arkade/server-wallet.ts');
      const {createServerProfileMemory}=await load('/BIS/packages/integration/src/client/state-layer-core/server-first-game-wallet.ts');
      createTestNetworkSession().select(input.network);configureBisServer({url:input.browserEndpoint,...(input.ownerToken?{ownerToken:input.ownerToken}:{})});
      createServerProfileMemory(localStorage,()=>input.browserEndpoint).save({profileId:input.gameId,network:input.network,server:{endpoint:input.browserEndpoint,publicKey:input.serverPublicKey,gameId:'stealth-and-steel'}});
      const context=api.createBisContext();await context.readyAsync();
      const state=context.getState();if(state.phase!=='idle'&&!(state.phase==='active'&&state.profileId===input.playerId))throw Error('Assigned Player unavailable.');
      const host=document.createElement('div');document.body.append(host);const ui=api.createBisUi(context);ui.mount(host);
      (globalThis as any).__serverAcceptance={context,ui,host,api};
      if(state.phase==='idle')context.openRestoreAccount();
    },{network:assignment.network,playerId:assignment.playerProfileId,gameId:assignment.gameProfileId,serverPublicKey:assignment.serverPublicKey,ownerToken:this.acceptance.ownerToken,browserEndpoint});
    const active=()=>this.page.evaluate(()=>{const state=(globalThis as any).__serverAcceptance.context.getState();return {phase:state.phase,profileId:state.profileId};});
    if((await active()).phase!=='active'){
      await this.entry(this.registration.player.phrase,'⚡ Restore');
      await boundedPoll(async()=>{
        const phase=(await active()).phase;
        if(phase==='restore-confirmation'){
          await this.page.getByRole('dialog',{name:'Create New Account?',exact:true}).getByRole('button',{name:'Create Account',exact:true}).click();
        }
        return (await active()).phase==='active';
      },30000);
    }
    await this.page.evaluate(async (expected:any)=>{
      const s=(globalThis as any).__serverAcceptance,state=s.context.getState();
      if(state.phase!=='active'||state.profileId!==expected.playerId||state.network!==expected.network)throw Error('Assigned Player changed.');
      s.game=s.api.createBisGameWallet({playerProfileId:()=>s.context.getState().profileId,playerNetwork:()=>s.context.getState().network,
        playerSubscribe:s.context.subscribe,playerSessionKey:()=>JSON.stringify([s.context.getState().profileId,s.context.getState().network])});
      await s.game.refresh();const game=s.game.getState();
      if(game.status!=='ready'||game.source!=='server'||game.profileId!==expected.gameId||game.network!==expected.network)throw Error('Actual remote Game source unavailable.');
    },{playerId:assignment.playerProfileId,gameId:assignment.gameProfileId,network:assignment.network});
    this.restored=true;
  }
  async inspect():Promise<any>{
    await this.validateRegistration();
    return this.page.evaluate((expected:any)=>{
      const s=(globalThis as any).__serverAcceptance,player=s.context.getState(),game=s.game.getState();
      if(player.phase!=='active'||player.profileId!==expected.playerId||player.network!==expected.network||game.source!=='server'||game.profileId!==expected.gameId||game.network!==expected.network)throw Error('Original server source changed.');
      return {playerProfileId:player.profileId,gameProfileId:game.profileId,network:game.network,source:game.source};
    },{playerId:this.acceptance.assignment.playerProfileId,gameId:this.acceptance.assignment.gameProfileId,network:this.acceptance.assignment.network});
  }
}
export async function boundedPoll(read:()=>Promise<boolean>,milliseconds:number){
  const end=Date.now()+milliseconds;
  while(Date.now()<end){if(await boundedResult(read(),Math.max(1,end-Date.now())))return;await new Promise(resolve=>setTimeout(resolve,250));}
  throw Error('Original observation timed out.');
}
async function enterServerDocument(page:any,endpoint?:string){
  if(page.url()!=='http://127.0.0.1:5174/admin/')throw Error('Owned document scope changed.');
  await page.route('http://127.0.0.1:5174/admin/',async(route:any)=>{
    if(!route.request().isNavigationRequest())return route.continue();
    const response=await route.fetch();
    const headers=response.headers();
    if(endpoint)headers['content-security-policy']=acceptanceDocumentPolicy(headers['content-security-policy']??'',endpoint);
    await route.fulfill({response,headers,body:'<!doctype html><html><head><title>Protected server acceptance</title></head><body></body></html>'});
  });
  await page.goto('http://127.0.0.1:5174/admin/',{waitUntil:'domcontentloaded'});
}
export function assertAtomicPaymentBudget(records:readonly any[],intent:{id:string;network:string;amountSats:number;feeSats:number},clientExposure:number,now=Date.now(),options:Readonly<{allowZeroExposure?:boolean}>={}){
  const cost=intent.amountSats+intent.feeSats;
  const minimum=options.allowZeroExposure===true?0:1;
  if(options.allowZeroExposure!==undefined&&typeof options.allowZeroExposure!=='boolean'||!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(intent.amountSats)||intent.amountSats<minimum||!Number.isSafeInteger(intent.feeSats)||intent.feeSats<0||!Number.isSafeInteger(cost)||cost<minimum||cost>5000||!Number.isSafeInteger(clientExposure)||clientExposure<0)throw Error('Approved test operation ceiling exceeded.');
  let total=cost+clientExposure;
  for(const row of records){
    if(row.intent?.id===intent.id||row.intent?.network!==intent.network)continue;
    if(hasVerifiedBoardingNonSubmission(row))continue;
    const created=Date.parse(row.createdAt);
    if(!Number.isFinite(created)||created>now)throw Error('Protected budget timestamp unavailable.');
    if(created<now-86400000)continue;
    const fee=row.observedFeeSats??row.intent.feeSats;
    if(!Number.isSafeInteger(row.intent.amountSats)||row.intent.amountSats<0||fee!==null&&fee!==undefined&&(!Number.isSafeInteger(fee)||fee<0))throw Error('Protected operation cost unavailable.');
    total+=row.intent.amountSats+(fee===null||fee===undefined?5000:fee);
  }
  if(!Number.isSafeInteger(total)||total>10000)throw Error('Approved rolling network ceiling exceeded.');
}

export async function runPaymentAcceptance(assignment:PaymentAssignment,mode:PaymentMode,env:NodeJS.ProcessEnv=process.env){
  assignment=validatePaymentAssignment(assignment);
  assertExecutionAuthority(assignment,mode,assignment.runId,env);await assertReviewedSource(assignment);
  const vault=new Vault(),ledger=new Operations(vault),operationId=assignment.runId+'-pay',scope=assignmentScope(assignment);
  let stage='registered-identity',owner:any,financialEnabled=false,quote:any,recipient='',plannedTxid:string|undefined;
  let serverRequests=0,signRequests=0,providerRequests=0,clientExposure=0,observationDeadline=0;
  const originalTransaction=vault.transaction.bind(vault);
  vault.transaction=async(use:any,options?:any)=>originalTransaction(async(state:any)=>{
    const ids=new Set((state.operations??[]).map((row:any)=>row.intent.id)),result=await use(state);
    for(const row of state.operations??[])if(!ids.has(row.intent.id)){
      if(row.intent.id!==operationId||row.intent.profileId!==assignment.gameProfileId||row.intent.target?.profileId!==assignment.playerProfileId||row.intent.amountSats!==assignment.amountSats||row.intent.feeSats!==0||row.intent.network!==assignment.network)throw Error('Unassigned test operation refused.');
      assertAtomicPaymentBudget(state.operations??[],row.intent,clientExposure);
    }
    return result;
  },options);
  try{
    await vault.transaction(async(state:any)=>{
      await verifiedInventory(state);
      const pair=state.pairs.find((row:any)=>row.label===assignment.pair&&row.network===assignment.network);
      const player=state.accounts.find((row:any)=>row.label===pair?.player),game=findTestActor(state,pair?.game);
      if(player?.profileId!==assignment.playerProfileId||game?.profileId!==assignment.gameProfileId)throw Error('Registered pair does not match assignment.');
      assertAssignedServerActor(game,assignment);
      for(const account of [player,game])if(!account.grant?.active||!account.grant.networks.includes(assignment.network)||account.reportedPending?.[assignment.network])throw Error('Registered test grant unavailable.');
      const previous=state.serverSdkRuns?.[assignment.runId];
      if(previous&&previous.scope!==scope||mode==='reconcile'&&!previous||mode!=='reconcile'&&previous&&previous.phase!=='prepared')throw Error('Original case requires reconciliation.');
      if(mode==='reconcile'){
        if(!previous.originalSubmit||previous.originalReconciliations)throw Error('Original reconciliation unavailable or already used.');
        previous.originalReconciliations=1;
      }
      if((state.operations??[]).some((row:any)=>row.intent.network===assignment.network&&[row.intent.profileId,row.intent.target?.profileId].some(id=>[assignment.gameProfileId,assignment.playerProfileId].includes(id))&&!['settled','failed','cancelled'].includes(row.state)&&!(mode==='reconcile'&&row.intent.id===operationId)))throw Error('Original source has unresolved test work.');
    });
    stage='deployed-identity';
    // Protected CLI startup can exceed the public controller's 1.5s discovery
    // window. Fetch its exact original pinned connection first, then consume
    // this real response once when the controller requests the same identity.
    let initialConnection=await remoteRequest(assignment.endpoint,'connect',{network:assignment.network,gameId:'stealth-and-steel',profileId:assignment.gameProfileId},
      {'Content-Type':'application/json',...(env.BIS_ACCEPTANCE_OWNER_TOKEN?{Authorization:`Bearer ${env.BIS_ACCEPTANCE_OWNER_TOKEN}`}:{})},env);
    serverRequests++;
    const connected=JSON.parse(initialConnection.text);
    if(initialConnection.status!==200||connected.profileId!==assignment.gameProfileId||connected.publicKey!==assignment.serverPublicKey||connected.network!==assignment.network||connected.runtime!=='vercel')throw Error('Reviewed deployed Game identity changed.');
    const browserEndpoint=env.BIS_ACCEPTANCE_OWNER_TOKEN?undefined:assignment.endpoint;
    const browserServerOrigin=browserEndpoint?new URL(browserEndpoint).origin:'http://127.0.0.1:5174';
    // Authenticated Preview traffic passes through the coordinator transport.
    // Controlled CORS headers let the real browser bind Player proof to HTTPS;
    // deployed Pages CORS/CSP are separate live acceptance gates.
    const proxyHeaders=browserEndpoint?{'Access-Control-Allow-Origin':'http://127.0.0.1:5174',
      'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-BIS-Signing-Grant','Vary':'Origin'}:{};
    const proxy=async(route:any)=>{
      const request=route.request(),url=new URL(request.url());
      try{
        if(url.origin===browserServerOrigin&&url.pathname.startsWith('/api/bis/')){
          const path=url.pathname.slice('/api/bis/'.length);
          if(browserEndpoint&&request.method()==='OPTIONS'){
            if(request.headers().origin!=='http://127.0.0.1:5174')throw Error('Unassigned browser origin.');
            await route.fulfill({status:204,headers:proxyHeaders,body:''});return;
          }
          if(request.method()!=='POST'||(request.postDataBuffer()?.length??0)>1024*1024)throw Error('Unexpected server transport.');
          const body=request.postDataJSON();
          if(path!=='connect'&&!financialEnabled)throw Error('Signing is disabled during preparation and reconciliation.');
          if(path==='connect'){
            if(body.network!==assignment.network||body.gameId!=='stealth-and-steel')throw Error('Remote connection scope changed.');
          }else if(['owner/plan','payment/plan'].includes(path)){
            plannedTxid=inspectPaymentPlan(body,assignment,quote,recipient);
            await vault.transaction((state:any)=>{state.serverSdkRuns[assignment.runId].plannedTransactionId=plannedTxid;});
          }else if(!['owner/authorize','payment/authorize','player/challenge','player/authenticate','sign','authorize'].includes(path))throw Error('Unsupported payment signing method.');
          if(path==='sign'){
            if(!plannedTxid||body.network!==assignment.network||body.profileId!==assignment.gameProfileId||body.method!=='sign')throw Error('Unplanned signing refused.');
            await vault.transaction((state:any)=>{
              const run=state.serverSdkRuns[assignment.runId];run.originalSigningRequests??=[];
              if(typeof body.id!=='string'||run.originalSigningRequests.some((row:any)=>row.body.id===body.id))throw Error('Original signing request already exists. Reconcile only.');
              // Signed recovery/protocol material stays encrypted in the vault.
              run.originalSigningRequests.push({path,body,grant:request.headers()['x-bis-signing-grant']});
            });
          }
          const headers=acceptanceProxyHeaders(request.headers());
          const cached=path==='connect'&&initialConnection&&body.profileId===assignment.gameProfileId&&body.requirement===undefined;
          const response=cached?initialConnection:await remoteRequest(assignment.endpoint,path,body,headers,env);
          if(cached)initialConnection=undefined as any;else serverRequests++;
          if(path==='sign'&&response.status===200)signRequests++;
          if(path==='connect'&&response.status===200){
            const actual=JSON.parse(response.text);
            if(actual.profileId!==assignment.gameProfileId||actual.publicKey!==assignment.serverPublicKey||actual.network!==assignment.network||actual.runtime!=='vercel')throw Error('Reviewed deployed Game identity changed.');
          }
          await route.fulfill({status:response.status,contentType:'application/json',headers:proxyHeaders,body:response.text});return;
        }
        if(['GET','HEAD','OPTIONS'].includes(request.method())||url.origin===`https://${assignment.network}.arkade.sh`&&url.pathname.startsWith('/v1/indexer/'))return route.continue();
        if(!financialEnabled||url.origin!==`https://${assignment.network}.arkade.sh`||!['/v1/tx/submit','/v1/tx/finalize'].includes(url.pathname))throw Error('Unassigned financial request refused.');
        const body=request.postDataJSON();
        if(url.pathname==='/v1/tx/submit'){
          if(!plannedTxid)throw Error('Original remote signing plan unavailable.');
          inspectOriginalSubmission(body,assignment,plannedTxid);
          const browser=await owner.page.evaluate(async (input:any)=>{
            const load=(path:string)=>import(/* @vite-ignore */path),{readSendRecords}=await load('/BIS/packages/integration/src/client/state-layer-core/sending.ts');
            const rows=readSendRecords(input.profileId,input.network).filter((row:any)=>row.transactionId===input.txid);
            if(rows.length!==1||rows[0].quote.fingerprint!==input.fingerprint)throw Error('Durable original browser journal unavailable.');
            return {id:rows[0].id,transactionId:rows[0].transactionId,inputs:rows[0].inputs};
          },{profileId:assignment.gameProfileId,network:assignment.network,txid:plannedTxid,fingerprint:quote.fingerprint});
          await vault.transaction((state:any)=>{const run=state.serverSdkRuns[assignment.runId];
            if(run.originalSubmit)throw Error('An original submission already exists. Reconcile only.');
            run.browserOperationId=browser.id;run.originalSubmit=body;run.originalTransactionId=plannedTxid;
          });
        }else await vault.transaction((state:any)=>{
          const run=state.serverSdkRuns[assignment.runId];
          if(!run.originalSubmit||run.originalFinalize||body.arkTxid!==run.originalTransactionId||!Array.isArray(body.finalCheckpointTxs)||!samePoints(body.finalCheckpointTxs.map((encoded:string)=>decodeTx(encoded).id),run.originalSubmit.checkpointTxs.map((encoded:string)=>decodeTx(encoded).id)))throw Error('Original finalization changed or repeated.');
          run.originalFinalize=body;
        });
        providerRequests++;await route.continue();
      }catch{await route.abort('blockedbyclient').catch(()=>{});}
    };
    stage='owned-remote-browser';
    owner=new ServerPaymentBrowser(vault,{pair:assignment.pair,origin:'http://127.0.0.1:5174',app:'admin',stableSource:true,recoveryProfile:'srv-'+assignment.runId});
    owner.acceptance={assignment,proxy,ownerToken:env.BIS_ACCEPTANCE_OWNER_TOKEN,browserEndpoint};await owner.start();
    await owner.inspect();
    recipient=(await owner.page.evaluate(async()=>await (globalThis as any).__serverAcceptance.context.getPaymentRecipient())).address;
    if(recipient!==owner.expected.player.arkadeAddress)throw Error('Original payment recipient changed.');
    if(mode!=='reconcile'){
      stage='fresh-payment-preparation';
      const client=createProtectedBrowserJournalReader({page:owner.page,vault,runId:assignment.runId,slot:env.BIS_SERVER_ACCEPTANCE_SLOT,profileId:assignment.gameProfileId,network:assignment.network,...(actorSource(owner.registration.game)?{serverSource:actorSource(owner.registration.game)}:{})});
      const journal=createProtectedVaultCaseJournalReader({vault,client});
      const account=owner.registration.game;
      quote=await prepareAssignedCase({assignedRunId:assignment.runId,assignedCandidateId:assignment.candidateId,requestedRunId:assignment.runId,requestedCandidateId:assignment.candidateId,
        assignment:{workflow:'payment',network:assignment.network,candidateId:assignment.candidateId,accountLabel:account.label,generation:account.generation,profileId:assignment.gameProfileId,outpoints:[],allInSats:assignment.amountSats,amountSats:assignment.amountSats,recipient},
        ...(account.server?{loadServerReference:async()=>account}:{loadMnemonic:async()=>account.phrase}),journal,prepareQuote:preparePaymentCaseQuote});
      const clientSnapshot=await client.readNetworkSnapshot(assignment.gameProfileId,assignment.network,Date.now(),[]);
      clientExposure=clientSnapshot.rolling24hSpentSats+clientSnapshot.knownReservedSats+clientSnapshot.unknownOperations.reduce((sum,row)=>sum+(row.exposureSats??5000),0);
      await vault.transaction((state:any)=>{state.serverSdkRuns??={};const previous=state.serverSdkRuns[assignment.runId];
        if(previous&&previous.scope!==scope||previous&&previous.phase!=='prepared')throw Error('Original case changed.');
        state.serverSdkRuns[assignment.runId]={scope,phase:'prepared',endpoint:assignment.endpoint,network:assignment.network,gameProfileId:assignment.gameProfileId,playerProfileId:assignment.playerProfileId,quote,recipient,gameAddress:owner.expected.game.arkadeAddress};
      });
      if(mode==='prepare')return {verifiedPreparation:true,financialActions:0,source:'server',authorizationMode:env.BIS_ACCEPTANCE_OWNER_TOKEN?'owner':'player-proof',transport:'controlled document and authenticated Preview proxy; deployed Pages CSP/CORS unverified',quote,recipient,serverRequests,unsupportedWorkflows:['mint','delivery','burn','boarding','standard-lto']};
      if(quote.fingerprint!==assignment.approvedFingerprint||!samePoints(quote.outpoints,assignment.approvedOutpoints!))throw Error('The fresh payment quote differs from the reviewed original.');
      await assertReviewedSource(assignment);await owner.inspect();
      await vault.transaction((state:any)=>{const run=state.serverSdkRuns[assignment.runId];if(run.phase!=='prepared')throw Error('Original run already attempted.');run.phase='execution-started';});
      stage='original-payment';
      await ledger.prepare({id:operationId,account:account.label,profileId:account.profileId,generation:account.generation,network:assignment.network,kind:'arkade-send',recipient,
        ...(actorSource(account)?{serverSource:actorSource(account)}:{}),
        amountSats:assignment.amountSats,feeSats:0,sourceOrigin:'http://127.0.0.1:5174',target:{account:owner.registration.player.label,profileId:assignment.playerProfileId,generation:owner.registration.player.generation}});
      financialEnabled=true;observationDeadline=Date.now()+120000;
      await ledger.submit(operationId,async()=>{
        const original=owner.page.evaluate(async (input:any)=>{
          const s=(globalThis as any).__serverAcceptance,recipient=await s.context.getPaymentRecipient();
          if(recipient.profileId!==input.playerId||recipient.address!==input.recipient||s.game.getState().source!=='server'||s.game.getState().profileId!==input.gameId)throw Error('Original remote payment scope changed.');
          return s.game.payPlayer(recipient,input.amountSats);
        },{playerId:assignment.playerProfileId,gameId:assignment.gameProfileId,recipient,amountSats:assignment.amountSats});
        const result:any=await boundedResult(original,Math.max(1,observationDeadline-Date.now()));
        if(!validHash(result?.transactionId))throw Error('Original payment acknowledgement unavailable.');
        return {providerId:result.transactionId};
      });
      financialEnabled=false;
    }
    stage='original-reconciliation';
    let receipt:any;
    const saved=await vault.transaction((state:any)=>state.serverSdkRuns[assignment.runId]);
    if(!saved||saved.scope!==scope||!saved.originalTransactionId||!saved.originalSubmit)throw Error('Original submission unavailable; preserve reservation.');
    if(mode==='reconcile')observationDeadline=Date.now()+120000;
    if(Date.now()>=observationDeadline)throw Error('Original observation exhausted; preserve reservation.');
    await boundedResult(owner.page.evaluate(async()=>await (globalThis as any).__serverAcceptance.game.checkPlayerPayment()),Math.max(1,observationDeadline-Date.now()));
    const indexer=new RestIndexerProvider(`https://${assignment.network}.arkade.sh`);
    await boundedPoll(async()=>{
      try{receipt=await verifyPaymentReceipt(indexer,{transactionId:saved.originalTransactionId,outpoints:saved.quote.outpoints,recipient:saved.recipient,gameAddress:saved.gameAddress,amountSats:assignment.amountSats});return true;}catch{return false;}
    },Math.max(1,observationDeadline-Date.now()));
    const settled=await ledger.reconcile(operationId,async(row:any)=>({id:row.intent.id,fingerprint:row.fingerprint,providerId:receipt.transactionId,outcome:'settled',verified:true,feeSats:0}));
    if(settled.state!=='settled'||mode==='run'&&signRequests<1)throw Error('Actual remote payment acceptance incomplete.');
    await vault.transaction((state:any)=>{Object.assign(state.serverSdkRuns[assignment.runId],{phase:'settled',receipt,completedAt:new Date().toISOString()});});
    return {verifiedPayment:true,source:'server',authorizationMode:env.BIS_ACCEPTANCE_OWNER_TOKEN?'owner':'player-proof',transport:'controlled document and authenticated Preview proxy; deployed Pages CSP/CORS unverified',receipt,serverRequests,signRequests,providerRequests,unsupportedWorkflows:['mint','delivery','burn','boarding','standard-lto']};
  }catch{
    if(mode!=='prepare')await vault.transaction((state:any)=>{const run=state.serverSdkRuns?.[assignment.runId];if(run&&run.phase==='execution-started')run.phase='unresolved';}).catch(()=>{});
    throw Error(`Acceptance stopped at ${stage}; inspect only the original protected case.`);
  }finally{
    financialEnabled=false;
    await owner?.page?.evaluate(()=>{const s=(globalThis as any).__serverAcceptance;s?.game?.dispose();s?.ui?.unmount();s?.context?.dispose();delete (globalThis as any).__serverAcceptance;}).catch(()=>{});
    await owner?.close().catch(()=>{});
  }
}
export async function boundedResult<T>(work:Promise<T>,milliseconds:number):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Original observation timed out.')),milliseconds);})]);}
  finally{clearTimeout(timer);}
}
if(import.meta.main){
  for(const method of ['log','info','warn','error','debug','trace','dir'] as const)console[method]=()=>{};
  try{
    if(!/^24\./.test(process.versions.node))throw Error('Node 24 required.');
    const [mode,path,requestedRunId]=process.argv.slice(2);
    if(process.argv.length!==5||!process.env.BIS_SERVER_ACCEPTANCE_SLOT)throw Error('Exact assignment command and acceptance slot required.');
    const assignment=validatePaymentAssignment(JSON.parse(await readFile(resolve(path),'utf8')));
    assertExecutionAuthority(assignment,mode,requestedRunId,process.env);
    const result=await runPaymentAcceptance(assignment,mode as PaymentMode);
    const directory=resolve(repositoryRoot,'output/reports/bis-server/milestone-1');await mkdir(directory,{recursive:true});
    await writeFile(resolve(directory,`payment-${assignment.runId}-${mode}.json`),JSON.stringify(result,null,2)+'\n');
    process.stdout.write(JSON.stringify({runId:assignment.runId,mode,...result})+'\n');
  }catch{process.stdout.write(JSON.stringify({ok:false,reason:'guarded-payment-acceptance-incomplete',qualification:'No success inferred; preserve and inspect any original protected operation.'})+'\n');process.exitCode=1;}
}
