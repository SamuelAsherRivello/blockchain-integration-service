// Credential/journal harness only. Financial execution is in the SDK-only child.
import {fork} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Vault} from './test-wallets/vault.ts';
import {readSharedEnvironment} from '../packages/shared/src/server/environment.ts';
const [version,method,runId]=process.argv.slice(2);
const entries={stable:'../../node_modules/@arkade-os/sdk/',rc:'../../output/tools/signet-sdk-rc/node_modules/@arkade-os/sdk/'};
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
try {
  if(!Object.hasOwn(entries,version)||!['read','ramps','settle','default','reconcile'].includes(method)||!/^[a-z][a-z0-9-]{0,40}$/.test(runId??''))throw Error('Invalid probe arguments.');
  if(method==='reconcile'){
    const result=await new Vault().transaction(state=>{
      const run=state.signetSdkProbes?.[runId];
      const latest=run?.checkpoints.filter(c=>c.phase==='intent').at(-1)?.intent;
      if(!run||!['unresolved',undefined].includes(run.status)||latest?.state!=='batch_failed'||!latest.batchId||latest.commitmentTransactionId)throw Error('No authoritative terminal batch event.');
      run.originalResult=run.result;
      run.result={...run.result,outcome:'network-batch-failed',terminalIntents:[{state:latest.state,batchId:latest.batchId}]};
      run.status='network-batch-failed';run.reconciledAt=Date.now();return run.result;
    });
    emit({runId,...result});
    process.exit(0);
  }
  const base=new URL(entries[version],import.meta.url);
  const metadata=JSON.parse(await readFile(new URL('package.json',base),'utf8'));
  const balance=await(await fetch('http://127.0.0.1:5190/api/faucet/balance?network=signet',{signal:AbortSignal.timeout(15000)})).json();
  if(balance.network!=='signet'||balance.onboarding?.status==='pending')throw Error('Existing faucet operation must be reconciled.');
  const addresses=await(await fetch('http://127.0.0.1:5190/api/faucet/addresses?network=signet',{signal:AbortSignal.timeout(15000)})).json();
  if(!addresses.arkadeAddress)throw Error('Faucet identity unavailable.');
  const vault=new Vault();
  await vault.transaction(state=>{
    const probes=state.signetSdkProbes??={};
    if(probes[runId]||Object.values(probes).some(row=>['pending','unresolved'].includes(row.status)))throw Error('Original SDK probe requires reconciliation.');
    probes[runId]={version:metadata.version,method,status:'pending',createdAt:Date.now(),checkpoints:[]};
  });
  const {values}=readSharedEnvironment({keys:['FAUCET_SIGNET_MNEMONIC'],legacyFaucetFallback:true});
  if(!values.FAUCET_SIGNET_MNEMONIC)throw Error('Faucet credential unavailable.');
  const child=fork(fileURLToPath(new URL('../tools/signet-onboarding/sdk-reproduce.ts',import.meta.url)),[],{
    execArgv:['--experimental-eventsource'],stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,
    env:{...process.env,SDK_PROBE_MNEMONIC:values.FAUCET_SIGNET_MNEMONIC,SDK_PROBE_EXPECTED_ADDRESS:addresses.arkadeAddress,
      SDK_PROBE_ENTRY:new URL('dist/index.js',base).href,SDK_PROBE_VERSION:metadata.version,SDK_PROBE_METHOD:method},
    serialization:'advanced',
  });
  let queue=Promise.resolve(),result;
  child.on('message',message=>{
    queue=queue.then(async()=>{
      if(message.kind==='checkpoint'){
        try{await vault.transaction(state=>{state.signetSdkProbes[runId].checkpoints.push(JSON.parse(JSON.stringify(message.payload,(_,v)=>typeof v==='bigint'?v.toString():v)));});child.send({kind:'checkpoint-ack',id:message.id,ok:true});
          if(message.payload.phase==='intent')emit({runId,progress:'SDK intent',state:message.payload.intent.state,batchId:message.payload.intent.batchId});
        }
        catch{child.send({kind:'checkpoint-ack',id:message.id,ok:false});}
      }else if(message.kind==='result'){
        result={...message.result,outcome:message.result.outcome??'unresolved'};
        await vault.transaction(state=>{Object.assign(state.signetSdkProbes[runId],{status:result.outcome,result,updatedAt:Date.now()});});
        emit({runId,...result});
      }
    });
  });
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  await queue;
  if(!result){emit({runId,outcome:'unresolved',reason:'SDK child exited before a durable result. Original journal retained.'});process.exitCode=1;}
}catch{emit({runId,outcome:'unresolved',reason:'Probe prerequisite or protected journal unavailable. No automatic retry.'});process.exitCode=1;}
