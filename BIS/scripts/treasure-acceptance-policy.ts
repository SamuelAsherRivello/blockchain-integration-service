import {hasVerifiedBoardingNonSubmission} from './test-wallets/boarding-non-submission.ts';

export const acceptanceScenarios=['probe','readiness','claim','feedback-claim','identity-race','network-replacement','legacy-rollback','asset-claim','duplicate-claim','empty-duplicate-claim','lost-claim-ack','insufficient','session-rollback','reject','expiry','portable','recover','peer'] as const;
export const needsAcceptanceReadDiagnostics=(scenario:string)=>['readiness','network-replacement'].includes(scenario);
/** Public endpoint classes only. Never inspect headers, bodies, query strings,
 * credentials, dynamic path identifiers or raw request error text. */
export function acceptanceReadRequest(request:{url():string;method():string},network:string){
  const url=new URL(request.url());
  const hosts=['signet.arkade.sh','mutinynet.arkade.sh','emulator.mutinynet.arkade.sh','mempool.space','mempool.signet.arkade.sh','mempool.mutinynet.arkade.sh','127.0.0.1'];
  const segments=new Set(['api','bis','connect','identity','sign','authorize','v1','v2','indexer','vtxos','virtualTx','script','subscribe','unsubscribe',
    'info','health','assets','asset','tx','txs','address','utxo','chain','balance','statistics','fees','recommended','scripthash','outspends','status','blocks','tip','height','network','ping','events','signet','mutinynet','testnet','testnet4']);
  const method=request.method();
  return {service:url.hostname===network+'.arkade.sh'?'operator':url.hostname.includes('mempool')?'bitcoin-explorer':url.origin==='http://127.0.0.1:5174'?'local-host':'other',
    hostname:hosts.includes(url.hostname)?url.hostname:'other',method:['GET','POST','HEAD','OPTIONS','PUT','PATCH','DELETE'].includes(method)?method:'other',
    path:url.pathname.split('/').slice(0,8).map(part=>!part||segments.has(part)?part:':value').join('/')};
}
export function acceptanceReadFailure(errorText:string|undefined){
  const text=errorText??'';
  return Object.fromEntries(['ERR_CONNECTION_REFUSED','ERR_NAME_NOT_RESOLVED','ERR_TIMED_OUT','ERR_NETWORK_CHANGED','ERR_ABORTED','ERR_BLOCKED_BY_CLIENT','ERR_FAILED',
    'ERR_HTTP2_PROTOCOL_ERROR','ERR_HTTP_RESPONSE_CODE_FAILURE','ERR_CONNECTION_CLOSED','ERR_CONNECTION_RESET','ERR_SSL_PROTOCOL_ERROR','ERR_CERT_AUTHORITY_INVALID','ERR_INTERNET_DISCONNECTED',
    'UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','ENOTFOUND','ECONNRESET','ECONNREFUSED','ETIMEDOUT','EHOSTUNREACH','ENETUNREACH']
    .map(flag=>[flag,text.includes(flag)]));
}
export function readOnlyAcceptanceRequestAllowed(request:{url():string;method():string}){
  if(['GET','HEAD','OPTIONS'].includes(request.method()))return true;
  if(request.method()!=='POST')return false;
  const url=new URL(request.url());
  return url.href==='http://127.0.0.1:5174/api/bis/connect'||
    url.protocol==='https:'&&['signet.arkade.sh','mutinynet.arkade.sh'].includes(url.hostname)&&!url.username&&!url.password&&url.pathname.startsWith('/v1/indexer/');
}
export function assertProtectedScenarioSlot(scenario:string,runId:string,assigned:string|undefined){
  if(['network-replacement','legacy-rollback'].includes(scenario)&&assigned!==runId)throw Error('coordinator-financial-slot-required');
}
export function validateOtherNetworkFixture(input:{originalNetwork:string;otherNetwork:string;registered:boolean;saved:boolean;playerSelected:boolean;gameSelected:boolean;localGame:boolean;unresolved:boolean}){
  if(!['signet','mutinynet'].includes(input.originalNetwork)||!['signet','mutinynet'].includes(input.otherNetwork)||input.originalNetwork===input.otherNetwork||
    !input.registered||!input.saved||!input.playerSelected||!input.gameSelected||!input.localGame||input.unresolved)throw Error('network-fixture-unavailable');
}
/** Conservative rolling-day test grant. Count reserved and unknown operations
 * as well as completed ones, and never free this budget on a failed result.
 */
export function assertAcceptanceBudget(records:readonly {createdAt:string;observedFeeSats?:number;feeEvidence?:{kind?:string;feeSats?:number};state?:string;resolution?:unknown;intent:{id:string;network:string;amountSats:number;feeSats:number|null}}[],
  intent:{id:string;network:string;amountSats:number;feeSats:number|null},now=Date.now()){
  const cost=(row:{amountSats:number;feeSats:number|null;observedFeeSats?:number;feeEvidence?:{kind?:string;feeSats?:number}})=>{
    const fee=row.feeSats??(row.feeEvidence?.kind==='verified-transaction-fee'&&row.feeEvidence.feeSats===row.observedFeeSats?row.observedFeeSats:undefined);
    if(!Number.isSafeInteger(row.amountSats)||row.amountSats<0||!Number.isSafeInteger(fee)||fee!<0)throw Error('acceptance-budget-unverified');
    const value=row.amountSats+fee!;
    if(!Number.isSafeInteger(value))throw Error('acceptance-budget-unverified');return value;
  };
  if(!Number.isSafeInteger(now)||cost(intent)>5000)throw Error('acceptance-operation-limit');
  let spent=0;
  for(const row of records){
    if(row.intent.id===intent.id||row.intent.network!==intent.network)continue;
    if(hasVerifiedBoardingNonSubmission(row))continue;
    const created=Date.parse(row.createdAt);
    if(!Number.isFinite(created)||created>now)throw Error('acceptance-budget-unverified');
    if(created>=now-86400000)spent+=cost({ ...row.intent, observedFeeSats: row.observedFeeSats, feeEvidence: row.feeEvidence });
  }
  if(spent+cost(intent)>10000)throw Error('acceptance-network-day-limit');
}
export function validateAlternateProfile(input:{playerId:string;gameId:string;alternatePlayerId:string;registered:boolean;savedProfiles:readonly string[]}){
  if(!input.registered||!/^[a-f0-9]{64}$/.test(input.alternatePlayerId)||input.alternatePlayerId===input.playerId||
    input.alternatePlayerId===input.gameId||!input.savedProfiles.includes(input.alternatePlayerId))throw Error('identity-fixture-unavailable');
}
/** Read only the exact most recent Wallet Status object, never a neighbour's
 * nested ready field. A truncated or overwritten log supplies no readiness.
 */
export function gameReadinessFromConsole(text:string):'ready'|'unavailable'|'empty'|'loading'|undefined{
  if(typeof text!=='string'||text.length>2_000_000)return;
  const marker=[...text.matchAll(/"operation"\s*:\s*"A\.G\.3 Wallet Status"/g)].at(-1);
  if(!marker)return;
  const start=text.lastIndexOf('{',marker.index);if(start<0)return;
  let depth=0,quoted=false,escaped=false;
  for(let i=start;i<text.length;i++){
    const c=text[i];
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;continue;}
    if(c==='{')depth++;
    if(c==='}'&&--depth===0){
      try{
        const record=JSON.parse(text.slice(start,i+1));
        if(record.operation==='A.G.3 Wallet Status'&&['ready','unavailable','empty','loading'].includes(record.status))return record.status;
      }catch{}
      return;
    }
  }
}
/** Await each browser read explicitly. Playwright's predicate poller can treat
 * an async predicate's Promise as truthy before its status has been read.
 */
export async function observeGameReadiness(read:()=>Promise<ReturnType<typeof gameReadinessFromConsole>>,milliseconds=75000){
  if(!Number.isSafeInteger(milliseconds)||milliseconds<1||milliseconds>120000)throw Error('observation-limit-exceeded');
  const deadline=Date.now()+milliseconds;
  while(Date.now()<deadline){
    const status=await observeAcceptance(read(),Math.max(1,deadline-Date.now()));
    if(status==='ready'||status==='unavailable'||status==='empty')return status;
    await new Promise(resolve=>setTimeout(resolve,Math.min(100,Math.max(1,deadline-Date.now()))));
  }
  throw Error('original-operation-observation-timeout');
}
export function validateAcceptanceSelection(mode:string,scenario:string,runId:string,network:string){
  if(!['signet','mutinynet'].includes(network)||!['browser','cosigner'].includes(mode)||network==='signet'&&mode!=='browser'||
    !acceptanceScenarios.includes(scenario as typeof acceptanceScenarios[number])||!/^[a-z][a-z0-9-]{0,27}$/.test(runId??'')||
    scenario==='lost-claim-ack'&&(network!=='mutinynet'||mode!=='browser')||scenario==='legacy-rollback'&&mode!=='browser')throw Error('invalid-arguments');
}
export function verifyInsufficientEvidence(record:{financial?:string;submission?:string;failure?:string;transactionId?:string;fundingTransactionId?:string}|undefined,attemptedSubmissions:number){
  if(!record||record.financial!=='failed'||record.submission!=='not-submitted'||record.failure!=='insufficient-funds'||
    record.transactionId||record.fundingTransactionId||attemptedSubmissions!==0)throw Error('insufficient-funds-unproven');
}
export function assertOriginalRun(original:undefined|{mode:string;network:string},mode:string,scenario:string,network:string){
  const recovery=['recover','peer'].includes(scenario);
  if(original&&!recovery||recovery&&(!original||original.mode!==mode||original.network!==network))throw Error('original-admin-run-requires-reconciliation');
}
/** Observation only. A timeout never cancels or retries the original promise. */
export async function observeAcceptance<T>(original:Promise<T>,milliseconds=120000):Promise<T>{
  if(!Number.isSafeInteger(milliseconds)||milliseconds<1||milliseconds>120000)throw Error('observation-limit-exceeded');
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([original,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('original-operation-observation-timeout')),milliseconds);})]);}
  finally{clearTimeout(timer);}
}
