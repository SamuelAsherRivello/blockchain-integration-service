import {RestArkProvider,RestIndexerProvider,EsploraProvider} from '@arkade-os/sdk';
import {readBoardingRecord,type BoardingRecord} from '../../integration/src/core/boarding-record';
import {transferStatus} from '../../integration/src/core/boarding-status';
const target='72b79ec0-9359-4d57-be8c-0bacf512a5ea';
const result=document.getElementById('result')!;
const check=document.getElementById('check') as HTMLButtonElement;
let record:BoardingRecord|undefined;
document.getElementById('read')!.onclick=()=>{
  try {
    for(let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i)!;
      if(!key.startsWith('bis-signet-boarding-operation-v1'))continue;
      const candidate=JSON.parse(localStorage.getItem(key)!);
      if(candidate.id===target)record=readBoardingRecord(candidate.profileId,target);
    }
    result.textContent=record?JSON.stringify({status:transferStatus(record),createdAt:record.createdAt,inputs:record.inputs,bitcoinAddress:record.bitcoinAddress,assetChange:record.assetChange,inputSats:record.quote.inputSats??record.quote.maxSats},null,2):'The named record is not present on this origin.';
    check.disabled=!record;
  }catch {result.textContent='The named journal could not be validated.';}
};
check.onclick=async()=>{
  if(!record)return;check.disabled=true;
  result.textContent='Reading public evidence...';
  try {
    const ark=new RestArkProvider('https://signet.arkade.sh');
    const info=await ark.getInfo();if(info.network!=='signet')throw Error();
    const indexer=new RestIndexerProvider('https://signet.arkade.sh');
    const chain=new EsploraProvider('https://mempool.space/signet/api');
    const [consumed,transactions,change]=await Promise.all([indexer.getVtxos({outpoints:record.inputs}),chain.getTransactions(record.bitcoinAddress),record.assetChange?indexer.getVtxos({scripts:[record.assetChange.script]}):undefined]);
    result.textContent=JSON.stringify({checkedAt:new Date().toISOString(),operation:record.id,network:info.network,sessionDuration:String(info.sessionDuration),consumed:consumed.vtxos,transactions:transactions.map(t=>({txid:t.txid,status:t.status,ownedOutputs:t.vout.filter(o=>o.scriptpubkey_address===record!.bitcoinAddress)})),change:change?.vtxos},(_key,value)=>typeof value==='bigint'?String(value):value,2);
  }catch {result.textContent='Public evidence read unavailable. No state was changed.';}
  finally {check.disabled=false;}
};
