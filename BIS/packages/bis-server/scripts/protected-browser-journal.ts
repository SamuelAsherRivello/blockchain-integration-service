import {createHash} from 'node:crypto';
export type TestNetwork='signet'|'mutinynet';
type Reservation={id:string;transactionId?:string;inputs?:readonly {txid:string;vout:number}[];independent?:readonly {txid:string;vout:number}[]};
export type ClientWalletJournalSnapshot=Readonly<{revision:string;reservations:readonly Reservation[];rolling24hSpentSats:number;knownReservedSats:number;
  unknownOperations:readonly {network:TestNetwork;profileId?:string;profileIds?:readonly string[];outpoints?:readonly string[];exposureSats?:number;observedAtMs?:number}[]}>;
export type ClientWalletJournalReader={readNetworkSnapshot(profileId:string,network:TestNetwork,nowMs:number,excludeOperationIds:readonly string[]):Promise<ClientWalletJournalSnapshot>};

export type PublicJournalRow = Readonly<{
  id:string; status:'settled'|'pending'|'unknown'|'not-submitted';
  profileIds:readonly string[]; transactionIds:readonly string[];
  inputs:readonly {txid:string;vout:number}[];
  exposureSats?:number; observedAtMs?:number;
}>;
export type BrowserJournalDocument = Readonly<{
  revision:string; rows:readonly PublicJournalRow[];
  reservations:ClientWalletJournalSnapshot['reservations'];
}>;
export type VaultJournalEvidence = Readonly<{revision:number; ids:readonly string[]; transactionIds:readonly string[]}>;
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);

export function assertJournalAccess(input:{runId:string;slot?:string;profileId:string;network:string},runtime=process.versions.node){
  if(!/^24\./.test(runtime))throw Error('Acceptance requires Node 24 before private access.');
  if(!/^[a-z][a-z0-9-]{0,27}$/.test(input.runId)||input.slot!==input.runId||!hash(input.profileId)||!['signet','mutinynet'].includes(input.network))
    throw Error('Exact coordinator acceptance slot required before private access.');
}

/** Provider receipts join different browser/Vault operation identifiers. */
export function publicVaultEvidence(state:any,network:TestNetwork):VaultJournalEvidence{
  if(!Number.isSafeInteger(state?.revision)||!Array.isArray(state?.accounts)||!Array.isArray(state.operations??[]))throw Error('Protected journal unavailable.');
  const operations=(state.operations??[]).filter((row:any)=>row.intent?.network===network);
  const ids=new Set<string>(),transactions=new Set<string>();
  for(const row of operations){
    if(typeof row.intent?.id!=='string'||!hash(row.fingerprint)||!['prepared','submitting','pending','unknown','settled','failed','cancelled'].includes(row.state))throw Error('Protected journal unavailable.');
    ids.add(row.intent.id);
    if(row.providerId!==undefined){
      if(typeof row.providerId!=='string'||!/^[A-Za-z0-9:_-]{1,300}$/.test(row.providerId))throw Error('Protected receipt identifier unavailable.');
      if(hash(row.providerId))transactions.add(row.providerId);
    }
  }
  // A contract contains funding and payout operations. Exclude only individual
  // receipts already represented by a protected operation, never the whole LTO.
  for(const run of Object.values(state.treasureAdminRuns??{}) as any[]){
    if(run.network!==network||typeof run.contractId!=='string')continue;
    for(const receipt of run.receipts??[])if(['fund','claim','refund'].includes(receipt.kind)&&transactions.has(receipt.txid))ids.add(`contract:${run.contractId}:${receipt.kind}`);
  }
  return {revision:state.revision,ids:[...ids].sort(),transactionIds:[...transactions].sort()};
}

/** Pure aggregation fails closed when an unmatched journal lacks cost evidence. */
export function aggregateBrowserJournal(document:BrowserJournalDocument,evidence:VaultJournalEvidence,profileId:string,network:TestNetwork,nowMs:number,excludeOperationIds:readonly string[]=[]):ClientWalletJournalSnapshot{
  if(!hash(document.revision)||!hash(profileId)||!Number.isSafeInteger(nowMs)||nowMs<0||!Array.isArray(document.rows)||document.rows.length>10000||!Array.isArray(document.reservations))throw Error('Browser journal unavailable.');
  const ids=new Set([...evidence.ids,...excludeOperationIds]),transactions=new Set(evidence.transactionIds),seen=new Map<string,string>();
  let spent=0,reserved=0;
  const unknown:ClientWalletJournalSnapshot['unknownOperations'][number][]=[];
  for(const row of document.rows){
    if(typeof row.id!=='string'||row.id.length>256||!Array.isArray(row.profileIds)||row.profileIds.some((id:string)=>!hash(id))||!Array.isArray(row.transactionIds)||row.transactionIds.some((id:string)=>!hash(id))||!Array.isArray(row.inputs)||row.inputs.some((point:{txid:string;vout:number})=>!hash(point.txid)||!Number.isSafeInteger(point.vout)||point.vout<0)||!['settled','pending','unknown','not-submitted'].includes(row.status))throw Error('Browser journal unavailable.');
    if(ids.has(row.id)||ids.has(row.id.slice(row.id.indexOf(':')+1))||row.transactionIds.some((id:string)=>transactions.has(id)))continue;
    if(!row.profileIds.includes(profileId)||row.status==='not-submitted')continue;
    const key=row.transactionIds[0]??row.id,canonical=digest({...row,id:undefined}),prior=seen.get(key);
    if(prior!==undefined){if(prior!==canonical)throw Error('Conflicting browser operation evidence.');continue;}
    seen.set(key,canonical);
    if(!Number.isSafeInteger(row.exposureSats)||row.exposureSats!<0||row.observedAtMs!==undefined&&(!Number.isSafeInteger(row.observedAtMs)||row.observedAtMs<0))throw Error('Browser operation cost or time unavailable.');
    const recent=row.observedAtMs===undefined||row.observedAtMs>nowMs||nowMs-row.observedAtMs<86400000;
    if(row.status==='settled'){if(recent)spent+=row.exposureSats!;}
    else if(row.status==='pending')reserved+=row.exposureSats!;
    else unknown.push({network,profileId,profileIds:row.profileIds,outpoints:row.inputs.map((point:{txid:string;vout:number})=>`${point.txid}:${point.vout}`),exposureSats:row.exposureSats,observedAtMs:row.observedAtMs});
  }
  if(!Number.isSafeInteger(spent)||!Number.isSafeInteger(reserved))throw Error('Browser exposure overflow.');
  return Object.freeze({revision:digest({browser:document.revision,evidence}),reservations:document.reservations,
    rolling24hSpentSats:spent,knownReservedSats:reserved,unknownOperations:unknown});
}

/** Executed in the owned browser. Recovery objects never leave this function. */
export async function readBrowserJournalDocument(input:{profileId:string;network:TestNetwork}):Promise<BrowserJournalDocument>{
  const load=(path:string)=>import(/* @vite-ignore */path);
  const root='/BIS/packages/integration/src/client/state-layer-core/';
  const [sending,boarding,assets,burning,delivery,migration,continuation,onboarding,reservation,contracts]=await Promise.all([
    'sending.ts','boarding-record.ts','assets.ts','burning.ts','asset-delivery.ts','asset-migration-record.ts','continuation.ts','onboarding-record.ts','wallet-reservations.ts','contract-storage.ts',
  ].map(path=>load(root+path)));
  const {profileId,network}=input;
  const continuations=continuation.readContinuations(profileId),onboardingRecords=onboarding.readAccountOnboarding(profileId);
  const groups=[
    ['send',sending.readSendRecords(profileId,network)],['boarding',boarding.readBoardingRecords(profileId,network)],
    ['mint',assets.readAssetRecords(profileId,network)],['burn',burning.readBurnRecords(profileId,network)],
    ['delivery',delivery.readAssetDeliveryRecords(profileId,network)],['migration',migration.readAssetMigrationRecords(profileId,network)],
    ['continuation',continuations.filter((row:any)=>(row.send?.network??'signet')===network)],['onboarding',onboardingRecords.filter((row:any)=>row.network===network)],
  ] as [string,any[]][];
  const document=await contracts.createContractStorage(undefined,network).load();
  const rows:PublicJournalRow[]=[];
  for(const [kind,records] of groups)for(const record of records){
    if(record.network!==undefined&&record.network!==network)throw Error('Browser journal network mismatch.');
    // Existing-funds readiness has no operation or submission to charge.
    if(kind==='onboarding'&&record.status==='complete'&&record.readyReason==='existing-funds')continue;
    const source=kind==='continuation'&&record.send?record.send:record;
    const id=source.id??source.request?.operationId;
    const state=record.status;
    const status=state==='succeeded'||state==='complete'?'settled':state==='not-submitted'?'not-submitted':state==='pending'?'pending':'unknown';
    const total=kind==='boarding'?record.quote?.amountSats:kind==='onboarding'?record.plan?.totalSats:source.quote?.totalSats;
    rows.push({id:`${kind}:${id}`,status,profileIds:[profileId],transactionIds:[source.transactionId,source.commitmentTxid].filter(value=>typeof value==='string'),
      inputs:(source.inputs??source.plan?.inputs??[]).map((point:any)=>({txid:point.txid,vout:point.vout})),
      // Send totals and boarding debit amounts include fees. Other untracked
      // records require a protected receipt; absent cost is never assumed zero.
      ...(Number.isSafeInteger(total)?{exposureSats:total}:{}),
      ...(Number.isSafeInteger(record.createdAt)?{observedAtMs:record.createdAt}:{}),});
  }
  for(const record of document.ledger.contracts.filter((record:any)=>[record.scope.playerId,record.scope.gameId].includes(profileId))){
    const recovery=document.recovery[record.id];
    const inputs=(recovery?.fundingInputs??[]).map((point:any)=>({txid:point.txid,vout:point.vout}));
    const scope=[record.scope.playerId,record.scope.gameId];
    const resolved=['claimed','refunded'].includes(record.financial);
    const failed=record.financial==='failed'&&record.operation.submission==='not-submitted';
    rows.push({id:`contract:${record.id}:fund`,status:failed?'not-submitted':resolved?'settled':'unknown',profileIds:scope,
      transactionIds:[recovery?.fundingOutput?.txid].filter(value=>typeof value==='string'),inputs,exposureSats:record.amountSats});
    if(resolved)rows.push({id:`contract:${record.id}:${record.financial==='claimed'?'claim':'refund'}`,status:'settled',profileIds:scope,
      transactionIds:[recovery?.spend?.transactionId].filter(value=>typeof value==='string'),inputs:[],exposureSats:record.amountSats});
  }
  const excludedReservationIds=new Set([
    ...onboardingRecords.filter((row:any)=>row.network!==network).map((row:any)=>`onboarding:${row.id}`),
    ...continuations.filter((row:any)=>(row.send?.network??'signet')!==network).map((row:any)=>`continue:${row.request.operationId}`),
  ]);
  const reservations=reservation.walletReservations(profileId,network).filter((row:any)=>!excludedReservationIds.has(row.id)).map((row:any)=>({id:row.id,
    ...(row.transactionId?{transactionId:row.transactionId}:{}),...(row.inputs?{inputs:row.inputs.map((point:any)=>({txid:point.txid,vout:point.vout}))}:{}),
    ...(row.independent?{independent:row.independent.map((point:any)=>({txid:point.txid,vout:point.vout}))}:{})}));
  const bytes=new TextEncoder().encode(JSON.stringify({groups,document,reservations}));
  const revision=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
  return {revision,rows,reservations};
}

export function createProtectedBrowserJournalReader(input:{page:{url():string;evaluate(fn:any,arg:any):Promise<any>};vault:{read(options:{initialize:false}):Promise<any>};runId:string;slot?:string;profileId:string;network:TestNetwork}):ClientWalletJournalReader{
  return {async readNetworkSnapshot(profileId,network,nowMs,excludeOperationIds){
    assertJournalAccess({...input,profileId,network});
    if(profileId!==input.profileId||network!==input.network||input.page.url()!=='http://127.0.0.1:5174/admin/')throw Error('Owned browser scope mismatch.');
    const before=await input.vault.read({initialize:false});
    const account=before.accounts.find((row:any)=>row.profileId===profileId);
    if(!account?.grant?.active||!account.grant.networks.includes(network)||account.reportedPending?.[network])throw Error('Registered journal identity unavailable.');
    const evidence=publicVaultEvidence(before,network);
    const document=await input.page.evaluate(readBrowserJournalDocument,{profileId,network});
    const verified=await input.page.evaluate(readBrowserJournalDocument,{profileId,network});
    const after=await input.vault.read({initialize:false});
    if(before.revision!==after.revision||document.revision!==verified.revision)throw Error('Protected source changed during browser inspection.');
    return aggregateBrowserJournal(document,evidence,profileId,network,nowMs,excludeOperationIds);
  }};
}
