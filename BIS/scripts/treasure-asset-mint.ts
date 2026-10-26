// Test fixture issuance, never a reward or contract success simulation.
import {Vault} from './test-wallets/vault.ts';
import {OwnedBrowser} from './test-wallets/owned-browser.ts';
import {runGuardedScenario} from './test-wallets/guarded-scenarios.ts';
import {observeAcceptance} from './treasure-acceptance-policy.ts';
for(const method of ['log','info','warn','error','debug','trace','dir'])console[method]=()=>{};
const [operation,network,action]=process.argv.slice(2),vault=new Vault();let owner;
try{
  if(![4,5].includes(process.argv.length)||action!==undefined&&action!=='recover'||!/^[a-z][a-z0-9-]{0,27}$/.test(operation??'')||!['signet','mutinynet'].includes(network))throw Error('invalid-fixture');
  const pairLabel=network==='signet'?'treasure-signet-pair':'market-remint-pair';
  await vault.transaction(state=>{
    const pair=state.pairs.find(p=>p.label===pairLabel),ids=[pair?.player,pair?.game].map(label=>state.accounts.find(a=>a.label===label)?.profileId);
    if(!pair||pair.network!==network||ids.some(id=>!id)||state.operations?.some(op=>op.intent.network===network&&ids.some(id=>[op.intent.profileId,op.intent.target?.profileId].includes(id))&&!['settled','failed','cancelled'].includes(op.state)&&!(action==='recover'&&op.intent.id===operation)))throw Error('fixture-reserved');
    const original=state.operations?.find(op=>op.intent.id===operation);
    if(action==='recover'){
      if(!original||original.intent.network!==network||original.intent.kind!=='mint'||original.intent.profileId!==ids[1]||original.state==='prepared')throw Error('original-mint-binding');
    }else if(original)throw Error('original-mint-requires-reconciliation');
  });
  owner=new OwnedBrowser(vault,{pair:pairLabel,origin:'http://127.0.0.1:5174',app:'admin',stableSource:true});await owner.start();
  const result=await observeAcceptance(runGuardedScenario(owner,{command:'run',scenario:'mint-delivery',operation,destination:'game'},{observationTimeoutMs:115000}));
  process.stdout.write(JSON.stringify({operation,network,originalOnly:action==='recover',kind:'test-asset-issuance-not-a-contract',state:result.operation.state,assetId:result.assetId,transactionId:result.transactionId})+'\n');
  if(result.operation.state!=='settled')process.exitCode=1;
}catch{process.stdout.write(JSON.stringify({operation,network,verified:false,reason:'protected-test-mint-incomplete'})+'\n');process.exitCode=1;}
finally{await owner?.close().catch(()=>{});}
