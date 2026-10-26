// Read-only diagnostic of the actual public BIS controller. No financial action.
import {Vault} from './test-wallets/vault.ts';
import {OwnedBrowser} from './test-wallets/owned-browser.ts';
import {inspectTreasureWalletReadiness} from './treasure-acceptance-browser.ts';
import {observeAcceptance} from './treasure-acceptance-policy.ts';
for(const method of ['log','info','warn','error','debug','trace','dir'])console[method]=()=>{};
const vault=new Vault();let owner;
try{
  if(process.argv.length!==2)throw Error('arguments');
  const ids=await vault.transaction(state=>{
    const pair=state.pairs.find(row=>row.label==='treasure-signet-pair');
    const player=state.accounts.find(row=>row.label===pair?.player),game=state.accounts.find(row=>row.label===pair?.game);
    if(pair?.network!=='signet'||[player,game].some(row=>!row?.grant?.active||!row.grant.networks.includes('signet')||row.reportedPending?.signet)||
      (state.operations??[]).some(row=>row.intent.network==='signet'&&[player.profileId,game.profileId].some(id=>[row.intent.profileId,row.intent.target?.profileId].includes(id))&&!['settled','failed','cancelled'].includes(row.state)))throw Error('readiness-scope-unavailable');
    return {network:'signet',playerId:player.profileId,gameId:game.profileId};
  });
  owner=new OwnedBrowser(vault,{pair:'treasure-signet-pair',origin:'http://127.0.0.1:5174',app:'admin',stableSource:true});
  await owner.start();
  const result=await observeAcceptance(owner.page.evaluate(inspectTreasureWalletReadiness,ids),90000);
  process.stdout.write(JSON.stringify({completed:true,result,financialActions:0})+'\n');
}catch(error){process.stdout.write(JSON.stringify({completed:false,timeout:String(error?.message).includes('observation-timeout'),financialActions:0})+'\n');process.exitCode=1;}
finally{await owner?.close().catch(()=>{});}
