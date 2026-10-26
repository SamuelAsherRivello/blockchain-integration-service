// Standalone official SDK reproduction. No BIS wallet/service/contract imports.
// The parent supplies credentials privately and durably checkpoints signed
// requests over IPC before they can leave this process. Never print raw errors.
import { createHash } from 'node:crypto';

for (const method of ['log','info','warn','error','debug','trace','dir']) console[method]=()=>{};
const sdk = await import(process.env.SDK_PROBE_ENTRY);
const operator='https://signet.arkade.sh';
const acknowledgements=new Map();let sequence=0;
process.on('message',message=>{
  if(message?.kind==='checkpoint-ack')acknowledgements.get(message.id)?.(message.ok);
});
async function checkpoint(payload) {
  if(!process.send)throw Error('Private durable journal required.');
  const id=++sequence;
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{acknowledgements.delete(id);reject(Error('Private journal unavailable.'));},30000);
    acknowledgements.set(id,ok=>{clearTimeout(timer);acknowledgements.delete(id);ok?resolve():reject(Error('Private journal unavailable.'));});
    process.send({kind:'checkpoint',id,payload});
  });
}
const flags=text=>Object.fromEntries(['fee-estimation-unavailable','failed to estimate fee rate','HTTP 400','duplicated input',
  'timeout','fetch failed','insufficient','invalid','unsupported'].map(token=>[token,String(text).toLowerCase().includes(token.toLowerCase())]));
const observedIntents=new Map();
let wallet, intentRepository, result={sdk:process.env.SDK_PROBE_VERSION,method:process.env.SDK_PROBE_METHOD,network:'signet',requests:[]};
const request=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  const method=init.method??(typeof input==='object'?input.method:undefined)??'GET';
  const watched=url.origin===operator;
  if(watched&&method!=='GET'&&method!=='HEAD')await checkpoint({phase:'request',path:url.pathname,method,body:init.body});
  const response=await request(input,init);
  if(watched){
    const observation={method,path:url.pathname,status:response.status};
    if(!response.ok){const text=await response.clone().text();observation.flags=flags(text);
      await checkpoint({phase:'response',...observation,body:text});}
    result.requests.push(observation);
  }
  return response;
};
try {
  if(!globalThis.EventSource)throw Error('EventSource unavailable.');
  sdk.configureEventSource(url=>new globalThis.EventSource(url));
  class JournaledIntents extends sdk.InMemoryIntentRepository {
    async saveIntent(intent) { await checkpoint({phase:'intent',intent}); await super.saveIntent(intent); observedIntents.set(intent.intentTxId,structuredClone(intent)); }
  }
  const provider=new sdk.RestArkProvider(operator);
  intentRepository=new JournaledIntents();
  wallet=await sdk.Wallet.create({identity:sdk.MnemonicIdentity.fromMnemonic(process.env.SDK_PROBE_MNEMONIC,{isMainnet:false}),
    arkProvider:provider,indexerProvider:new sdk.RestIndexerProvider(operator),settlementConfig:false,
    storage:{walletRepository:new sdk.InMemoryWalletRepository(),contractRepository:new sdk.InMemoryContractRepository(),intentRepository}});
  const address=await wallet.getAddress();
  if(address!==process.env.SDK_PROBE_EXPECTED_ADDRESS)throw Error('Faucet identity mismatch.');
  const info=await provider.getInfo();
  if(info.network!=='signet')throw Error('Operator network mismatch.');
  const boarding=(await wallet.getBoardingUtxos()).filter(coin=>coin.status?.confirmed===true);
  const total=boarding.reduce((sum,coin)=>sum+BigInt(coin.value),0n);
  const before=await wallet.getBalance();
  Object.assign(result,{confirmedInputs:boarding.length,boardingSats:String(total),availableBefore:String(before.available),
    inputHash:createHash('sha256').update(JSON.stringify(boarding.map(({txid,vout,value})=>({txid,vout,value:String(value)})).sort((a,b)=>(a.txid+':'+a.vout).localeCompare(b.txid+':'+b.vout)))).digest('hex'),
    fees:info.fees});
  await checkpoint({phase:'prepared',address,inputs:boarding,result});
  const method=process.env.SDK_PROBE_METHOD;
  if(method==='read')result.outcome='read-only';
  else {
    if(total===0n||Number(before.available)>0)throw Error('Existing funds require reconciliation, not another onboarding.');
    const txid=method==='ramps'?await new sdk.Ramps(wallet).onboard(info.fees,boarding)
      :method==='settle'?await wallet.settle({inputs:boarding,outputs:[{address,amount:total}]})
      :method==='default'?await wallet.settle():(()=>{throw Error('Invalid probe method.');})();
    result.outcome='completed';result.commitmentTxid=txid;
    result.availableAfter=String((await wallet.getBalance()).available);
  }
} catch(error) {
  result.error={name:error?.name==='Error'?'Error':'SDK error',flags:flags(error?.message)};
  result.terminalIntents=[...observedIntents.values()].map(({state,batchId,commitmentTransactionId})=>({state,batchId,commitmentTransactionId}));
  result.outcome=result.terminalIntents.some(row=>row.state==='batch_failed'&&row.batchId&&!row.commitmentTransactionId)?'network-batch-failed'
    :result.requests.some(row=>row.path==='/v1/batch/registerIntent'&&row.status===400&&row.flags?.['fee-estimation-unavailable'])
    ?'explicit-registration-rejection':'unresolved';
  await checkpoint({phase:'error',message:String(error?.message??'unknown')}).catch(()=>{});
} finally {
  await wallet?.dispose?.().catch(()=>{});
  await checkpoint({phase:'result',result});
  process.send({kind:'result',result});
  process.disconnect();
}
