// Sanitized protected-journal inspection. No signing, submission or settlement inference.
import {Vault} from './test-wallets/vault.ts';
import {RestIndexerProvider} from '@arkade-os/sdk';
for(const method of ['log','info','warn','error','debug','trace','dir'])console[method]=()=>{};
try{
  const runId=process.argv[2];if(!/^[a-z][a-z0-9-]{0,27}$/.test(runId??''))throw Error();
  const result=await new Vault().transaction(state=>{
    const run=state.treasureProofRuns?.[runId];if(!run)throw Error();
    const errors=Object.entries(run.recovery??{}).flatMap(([operation,requests])=>requests
      .filter(r=>r.kind.endsWith('-failure')).map(r=>{
        const text=r.request[0];let code;
        try{const parsed=JSON.parse(text.slice('Failed to submit tx to emulator: '.length));if(Number.isInteger(parsed.code))code=parsed.code;}catch{}
        return {operation,code,flags:Object.fromEntries(['script','execute','execution','signature','opcode','stack','time',
          'finaliz','pending','spent','not found','false','VERIFY'].map(token=>[token,text.toLowerCase().includes(token.toLowerCase())]))};
      }));
    return {runId,network:run.network,deadlineSeconds:run.deadlineSeconds,completedAt:run.completedAt??null,
      receipts:run.receipts,negativeResults:run.negativeResults??[],errors,
      operations:(state.operations??[]).filter(row=>row.intent.id.startsWith(runId+'-'))
        .map(row=>({id:row.intent.id,state:row.state,providerId:row.providerId,createdAt:row.createdAt,updatedAt:row.updatedAt}))};
  });
  const funding=result.receipts.find(receipt=>receipt.kind==='fund');
  if(funding){
    const indexer=new RestIndexerProvider(result.network==='mutinynet'?'https://mutinynet.arkade.sh':'https://signet.arkade.sh');
    const {vtxos}=await indexer.getVtxos({outpoints:[{txid:funding.txid,vout:funding.vout}]});
    result.indexedFunding=vtxos.map(({txid,vout,isSpent,spentBy,arkTxId,value})=>({txid,vout,isSpent,spentBy,arkTxId,value}));
  }
  process.stdout.write(JSON.stringify({ok:true,...result})+'\n');
}catch{process.stdout.write(JSON.stringify({ok:false,reason:'protected-proof-status-unavailable'})+'\n');process.exitCode=1;}
