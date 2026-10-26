import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {SingleKey,DefaultVtxo} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {aggregateBrowserJournal,assertJournalAccess,createProtectedBrowserJournalReader,publicVaultEvidence,readBrowserJournalDocument,type BrowserJournalDocument,type PublicJournalRow} from '../scripts/protected-browser-journal.ts';

const profile='a'.repeat(64),target='b'.repeat(64),txid='c'.repeat(64),point={txid:'d'.repeat(64),vout:2};
async function bounded<T>(work:Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Isolated browser fixture timed out.')),20000);})]);}finally{clearTimeout(timer);}}
const row=(patch:Partial<PublicJournalRow>={}):PublicJournalRow=>({id:'send:browser-uuid',status:'settled',profileIds:[profile],transactionIds:[txid],inputs:[point],exposureSats:1000,...patch});
const document=(rows:readonly PublicJournalRow[]):BrowserJournalDocument=>({revision:'e'.repeat(64),rows,reservations:[]});
const evidence={revision:4,ids:[],transactionIds:[]};

test('different Vault and browser UUIDs join through the actual transaction receipt',()=>{
  const records=publicVaultEvidence({revision:4,accounts:[],operations:[{intent:{id:'root-case-pay',network:'signet'},fingerprint:'f'.repeat(64),providerId:txid,state:'settled'}]},'signet');
  const result=aggregateBrowserJournal(document([row()]),records,profile,'signet',100000);
  assert.equal(result.rolling24hSpentSats,0);
  assert.deepEqual(result.unknownOperations,[]);
});

test('source and target views of the same full transaction exposure count once',()=>{
  const original=row({status:'unknown',profileIds:[profile,target],exposureSats:6000});
  const result=aggregateBrowserJournal(document([original,{...original,id:'send:another-view'}]),evidence,profile,'signet',100000);
  assert.equal(result.unknownOperations.length,1);
  assert.equal(result.unknownOperations[0].exposureSats,6000);
  assert.deepEqual(result.unknownOperations[0].profileIds,[profile,target]);
  assert.deepEqual(result.unknownOperations[0].outpoints,[`${point.txid}:2`]);
  assert.throws(()=>aggregateBrowserJournal(document([original,{...original,id:'another-view',exposureSats:8000}]),evidence,profile,'signet',100000),/Conflicting/);
});

test('unmatched costs fail closed and missing dates are charged conservatively',()=>{
  assert.throws(()=>aggregateBrowserJournal(document([row({exposureSats:undefined})]),evidence,profile,'signet',100000),/cost or time/);
  const current=aggregateBrowserJournal(document([row()]),evidence,profile,'signet',100000000);
  assert.equal(current.rolling24hSpentSats,1000);
  const old=aggregateBrowserJournal(document([row({observedAtMs:1})]),evidence,profile,'signet',100000000);
  assert.equal(old.rolling24hSpentSats,0);
  const unknown=aggregateBrowserJournal(document([row({status:'unknown',observedAtMs:1})]),evidence,profile,'signet',100000000);
  assert.equal(unknown.unknownOperations.length,1,'old unknown conflict evidence is retained');
});

test('reservations survive deduplication and input corruption is rejected',()=>{
  const doc={...document([row({status:'pending'})]),reservations:[{id:'send:browser-uuid',inputs:[point]}]};
  const result=aggregateBrowserJournal(doc,{...evidence,transactionIds:[txid]},profile,'signet',1000);
  assert.deepEqual(result.reservations,doc.reservations);
  assert.equal(result.knownReservedSats,0);
  assert.throws(()=>aggregateBrowserJournal(document([row({inputs:[{txid:'bad',vout:-1}]})]),evidence,profile,'signet',1000),/unavailable/);
});

test('contract exclusions are per protected receipt and non-transaction provider identifiers remain valid history',()=>{
  const source={revision:4,accounts:[],operations:[
    {intent:{id:'root-fund',network:'signet'},fingerprint:'f'.repeat(64),providerId:txid,state:'settled'},
    {intent:{id:'other-network',network:'mutinynet'},fingerprint:'f'.repeat(64),providerId:'opaque-provider-reference',state:'pending'},
  ],treasureAdminRuns:{case:{network:'signet',contractId:'contract-1',receipts:[{kind:'fund',txid},{kind:'claim',txid:'1'.repeat(64)}]}}};
  const result=publicVaultEvidence(source,'signet');
  assert.ok(result.ids.includes('contract:contract-1:fund'));
  assert.ok(!result.ids.includes('contract:contract-1:claim'));
  assert.doesNotThrow(()=>publicVaultEvidence(source,'mutinynet'));
});

test('actual runtime and exact slot checks precede protected reads',async()=>{
  const access={runId:'server-case-1',slot:'server-case-1',profileId:profile,network:'signet'};
  assert.doesNotThrow(()=>assertJournalAccess(access,'24.21.0'));
  assert.throws(()=>assertJournalAccess(access,'26.0.0'),/Node 24/);
  assert.throws(()=>assertJournalAccess({...access,slot:'another-case'},'24.21.0'),/Exact coordinator/);
  let reads=0;
  const reader=createProtectedBrowserJournalReader({page:{url:()=> 'http://127.0.0.1:5174/admin/',evaluate:async()=>{throw Error('must not evaluate');}},
    vault:{read:async()=>{reads++;throw Error('must not read');}},runId:access.runId,slot:'wrong',profileId:profile,network:'signet'});
  await assert.rejects(reader.readNetworkSnapshot(profile,'signet',1000,[]));
  assert.equal(reads,0);
});

test('the concrete page/Vault transport verifies stable revisions without mutating either source',async()=>{
  let reads=0,evaluations=0;
  const state={revision:4,accounts:[{profileId:profile,grant:{active:true,networks:['signet']}}],operations:[]};
  const reader=createProtectedBrowserJournalReader({page:{url:()=> 'http://127.0.0.1:5174/admin/',evaluate:async(_fn,input)=>{evaluations++;assert.deepEqual(input,{profileId:profile,network:'signet'});return document([row()]);}},
    vault:{read:async options=>{assert.deepEqual(options,{initialize:false});reads++;return state;}},runId:'server-case-1',slot:'server-case-1',profileId:profile,network:'signet'});
  if(!process.versions.node.startsWith('24.')){
    await assert.rejects(reader.readNetworkSnapshot(profile,'signet',1000,[]),/Node 24/);assert.equal(reads,0);return;
  }
  const result=await reader.readNetworkSnapshot(profile,'signet',1000,[]);
  assert.equal(result.rolling24hSpentSats,1000);assert.equal(reads,2);assert.equal(evaluations,2);
  const changed=createProtectedBrowserJournalReader({page:{url:()=> 'http://127.0.0.1:5174/admin/',evaluate:async()=>{state.revision++;return document([]);}},
    vault:{read:async()=>({...state})},runId:'server-case-1',slot:'server-case-1',profileId:profile,network:'signet'});
  await assert.rejects(changed.readNetworkSnapshot(profile,'signet',1000,[]),/changed/);
  let browserRevision=0;
  const browserChanged=createProtectedBrowserJournalReader({page:{url:()=> 'http://127.0.0.1:5174/admin/',evaluate:async()=>({...document([]),revision:String(++browserRevision).repeat(64)})},
    vault:{read:async()=>({...state})},runId:'server-case-1',slot:'server-case-1',profileId:profile,network:'signet'});
  await assert.rejects(browserChanged.readNetworkSnapshot(profile,'signet',1000,[]),/changed/);
});

test('real browser getters preserve network reservations and redact private journal fields',{timeout:60000},async()=>{
  // A fresh ephemeral browser and synthetic unfunded record, never a user wallet.
  const {buildLtoScript}=await import(new URL('../../integration/src/client/wallet-layer-arkade/lto-script.ts',import.meta.url).href);
  const {emptyContractLedger,startLto,finishContractOperation}=await import(new URL('../../integration/src/client/state-layer-core/contracts.ts',import.meta.url).href);
  const [playerKey,gameKey,operatorKey]=await Promise.all([1,2,3].map(async n=>await SingleKey.fromHex(String(n).padStart(64,'0')).xOnlyPublicKey()));
  const secret=new Uint8Array(32).fill(18),secretHash=new Uint8Array(await crypto.subtle.digest('SHA-256',secret));
  const script=buildLtoScript({playerKey,gameKey,operatorKey,secretHash,exitDelay:512n});
  const defaults={serverPubKey:operatorKey,csvTimelock:{type:'seconds' as const,value:512n}},now=Date.now();
  const request={id:'synthetic-contract',sessionId:'synthetic-session',operationId:'synthetic-fund',purpose:'treasureLTO',hostReference:'unfunded-journal-test',amountSats:1000,
    startedAt:now,expiresAt:now+90000,scope:{network:'signet',operator:'https://signet.arkade.sh',playerId:target,gameId:profile,exclusivityKey:'treasure'}};
  const ledger=startLto(emptyContractLedger(),request,now).ledger;
  const record=finishContractOperation(ledger.contracts[0],{operationId:request.operationId,kind:'fund',outcome:'confirmed'});
  const contractDocument={version:1,revision:0,ledger:{...ledger,contracts:[record]},recovery:{[record.id]:{
    playerKey:hex.encode(playerKey),gameKey:hex.encode(gameKey),operatorKey:hex.encode(operatorKey),secretHex:hex.encode(secret),exitDelay:'512',
    playerScript:hex.encode(new DefaultVtxo.Script({...defaults,pubKey:playerKey}).encode()),gameScript:hex.encode(new DefaultVtxo.Script({...defaults,pubKey:gameKey}).encode()),
    contractScript:hex.encode(script.script.encode()),fundingOutput:{txid:'ab'.repeat(32),vout:0,value:1000},
  }}};
  const modules=['sending','boarding-record','assets','burning','asset-delivery','asset-migration-record','continuation','onboarding-record','wallet-reservations','contract-storage'];
  // Bundle the actual pure journal modules to avoid a dev server or its private
  // configuration. The only isolated boundary is nonfinancial operator naming.
  const bundled=await build({stdin:{contents:modules.map(name=>`export * from './BIS/packages/integration/src/client/state-layer-core/${name}.ts';`).join('\n'),resolveDir:process.cwd()},
    bundle:true,write:false,platform:'browser',format:'esm',plugins:[{name:'unfunded-journal-account-boundary',setup(builder){
      builder.onLoad({filter:/[\\/]wallet-layer-arkade[\\/]account\.ts$/},()=>({contents:"export const operatorFor=(network='signet')=>network==='mutinynet'?'https://mutinynet.arkade.sh':'https://signet.arkade.sh';",loader:'js'}));
    }}]});
  const server=createServer((request,response)=>{
    if(request.url==='/admin/'){response.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><html><head></head><body>Unfunded journal fixture</body></html>');return;}
    response.writeHead(200,{'Content-Type':'application/javascript'}).end(request.url==='/journal-exports.js'?bundled.outputFiles[0].text:"export * from '/journal-exports.js';");
  });
  let browser;
  try{
    await new Promise<void>(ready=>server.listen(0,'127.0.0.1',ready));browser=await chromium.launch({headless:true});const page=await browser.newPage();
    const address=server.address();if(!address||typeof address==='string')throw Error('Isolated test listener unavailable.');
    const base=`http://127.0.0.1:${address.port}`;let remoteCalls=0;
    await page.route('https://**',route=>{remoteCalls++;return route.abort('blockedbyclient');});
    await page.route(new URL('/admin/',base).href,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head></head><body>Unfunded journal fixture</body></html>'}));
    await page.goto(new URL('/admin/',base).href);
    await bounded(page.evaluate(async input=>{
      const load=(path:string)=>import(/* @vite-ignore */path);
      const {writeSendRecord}=await load('/BIS/packages/integration/src/client/state-layer-core/sending.ts');
      writeSendRecord({version:1,id:'synthetic-send',profileId:input.profile,network:'signet',status:'pending',transactionId:input.txid,
        quote:{id:'quote-1',profileId:input.profile,recipient:'tark1'+'q'.repeat(80),amountSats:1000,feeSats:0,totalSats:1000,maxSats:1000,expiresAt:Date.now()+60000,fingerprint:'f'.repeat(64)},
        inputs:[input.point],recipientScript:'5120'+'1'.repeat(64)});
      const {createContractStorage}=await load('/BIS/packages/integration/src/client/state-layer-core/contract-storage.ts');
      await createContractStorage(undefined,'signet').save(input.contractDocument);
    },{profile,txid,point,contractDocument}));
    const first=await bounded(page.evaluate(readBrowserJournalDocument,{profileId:profile,network:'signet' as const}));
    assert.equal(first.rows.length,2);assert.equal(first.rows[0].exposureSats,1000);
    assert.deepEqual(first.reservations,[{id:'send:synthetic-send',inputs:[point]}]);
    assert.ok(!JSON.stringify(first).includes(hex.encode(secret)));
    assert.ok(!JSON.stringify(first).includes('secretHex'));
    const other=await bounded(page.evaluate(readBrowserJournalDocument,{profileId:profile,network:'mutinynet' as const}));
    assert.deepEqual(other.rows,[]);assert.deepEqual(other.reservations,[]);
    await page.evaluate(async profileId=>{
      const load=(path:string)=>import(/* @vite-ignore */path);
      const {readSendRecords,writeSendRecord}=await load('/BIS/packages/integration/src/client/state-layer-core/sending.ts');
      writeSendRecord({...readSendRecords(profileId,'signet')[0],status:'succeeded'});
    },profile);
    const second=await bounded(page.evaluate(readBrowserJournalDocument,{profileId:profile,network:'signet' as const}));
    assert.notEqual(first.revision,second.revision,'durable source changes invalidate the snapshot');
    assert.equal(second.rows[0].status,'settled');assert.deepEqual(second.reservations,[]);assert.equal(remoteCalls,0);
  }finally{await browser?.close();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}
});
