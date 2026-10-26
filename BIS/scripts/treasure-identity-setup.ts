// Protected profile setup only. Uses normal BIS recovery entry and never funds,
// claims, refunds, mints, sends or reconciles a financial operation.
import {Vault} from './test-wallets/vault.ts';
import {OwnedBrowser} from './test-wallets/owned-browser.ts';
import {openTreasureProfileRestore,finishTreasureProfileRestore,restoreOriginalTreasureProfile} from './treasure-profile-browser.ts';
for(const method of ['log','info','warn','error','debug','trace','dir'])console[method]=()=>{};
const [runId,network]=process.argv.slice(2),vault=new Vault();let owner,originalId,alternateId,stage='arguments';
const emit=value=>process.stdout.write(JSON.stringify({runId,stage,...value})+'\n');
try{
  if(process.argv.length!==4||network!=='signet'||!/^[a-z][a-z0-9-]{0,27}$/.test(runId??''))throw Error('invalid-profile-setup');
  const selected=await vault.transaction(state=>{
    const pair=state.pairs.find(p=>p.label==='treasure-signet-pair');
    if(!pair||pair.network!==network)throw Error('profile-pair-unavailable');
    const labels=[pair.player,pair.game,'treasure-empty-m-browser'];
    const accounts=labels.map(label=>state.accounts.find(a=>a.label===label));
    if(accounts.some(a=>!a?.grant?.active||!a.grant.networks.includes(network)||a.reportedPending?.[network])||new Set(accounts.map(a=>a.profileId)).size!==3||
      (state.operations??[]).some(op=>op.intent.network===network&&accounts.some(a=>[op.intent.profileId,op.intent.target?.profileId].includes(a.profileId))&&!['settled','failed','cancelled'].includes(op.state)))throw Error('profile-fixture-reserved');
    return {player:accounts[0],alternate:accounts[2]};
  });
  originalId=selected.player.profileId;alternateId=selected.alternate.profileId;
  stage='protected-browser';
  class ProfileSetupBrowser extends OwnedBrowser{
    async restorePair(){
      await this.page.evaluate(restoreOriginalTreasureProfile,{network,playerId:originalId,alternatePlayerId:alternateId});
      return super.restorePair();
    }
  }
  owner=new ProfileSetupBrowser(vault,{pair:'treasure-signet-pair',origin:'http://127.0.0.1:5174',app:'admin',stableSource:true,
    onPublicFailure:details=>emit({browserFailure:details})});await owner.start();
  stage='initial-account-menu';await owner.accountMenu();
  stage='close-original-dialog';await owner.page.locator('.bis-card').last().getByRole('button',{name:'Back',exact:true}).click();
  stage='normal-restore-ui';
  const opened=await owner.page.evaluate(openTreasureProfileRestore,{network,playerId:originalId,alternatePlayerId:alternateId});
  emit({checkpoint:'profile-inspected',alternateAlreadySaved:opened.alreadySaved});
  if(!opened.alreadySaved){
    stage='protected-phrase-entry';
    await owner.entry(selected.alternate.phrase,'⚡ Restore');
    stage='alternate-confirmation';
    await owner.page.waitForFunction(id=>{
      const state=window.__bisTreasureProfileSetup?.context.getState();
      return state?.phase==='restore-confirmation'||state?.phase==='restore-error'||state?.phase==='error'||state?.profileId===id&&state?.phase==='active';
    },alternateId,{timeout:60000});
    if(await owner.page.evaluate(()=>window.__bisTreasureProfileSetup?.context.getState().phase==='restore-confirmation'))
      await owner.page.getByRole('dialog',{name:'Create New Account?',exact:true}).getByRole('button',{name:'Create Account',exact:true}).click();
    stage='alternate-save';
    await owner.page.waitForFunction(id=>{
      const state=window.__bisTreasureProfileSetup?.context.getState();
      return state?.phase==='active'&&state.profileId===id&&state.savedProfiles.includes(id);
    },alternateId,{timeout:60000});
    stage='restore-original-selection';
    await owner.page.evaluate(finishTreasureProfileRestore,{playerId:originalId,alternatePlayerId:alternateId,requireSaved:true});
  }
  stage='verify-original-account';
  await owner.page.evaluate(restoreOriginalTreasureProfile,{network,playerId:originalId,alternatePlayerId:alternateId});
  stage='verify-saved-profiles';
  const saved=await owner.page.evaluate(async({network,originalId,alternateId})=>{
    const {createAccountStorage}=await import('/BIS/packages/integration/src/client/state-layer-core/account-storage.ts');
    const state=await createAccountStorage(network).listProfiles();
    return state.activeProfileId===originalId&&state.profiles.includes(alternateId);
  },{network,originalId,alternateId});
  if(!saved)throw Error('profile-selection-unverified');
  await vault.transaction(state=>{state.treasureProfileSetups??={};state.treasureProfileSetups[runId]={network,originalId,alternateId,completedAt:Date.now()};});
  emit({verified:true,network,originalProfileRestored:true,alternateProfileSaved:true,financialActions:0});
}catch(error){
  const publicUi=await owner?.page?.evaluate(()=>({
    cards:document.querySelectorAll('.bis-card').length,
    screen:['Account','Accounts Details','Developer','Game Wallet'].find(name=>[...document.querySelectorAll('.bis-card h2')].at(-1)?.textContent===name)??'other',
    accountButtons:[...document.querySelectorAll('button')].filter(button=>button.textContent==='A.P.4. Account Dialog').length,
    backButtons:[...document.querySelectorAll('.bis-card button')].filter(button=>button.textContent==='Back').length,
  })).catch(()=>undefined);
  const allowed=['profile-setup-not-open','profile-setup-binding','alternate-profile-not-saved','original-profile-not-restored','profile-selection-unverified'];
  emit({verified:false,reason:'protected-profile-setup-incomplete',
    diagnostic:allowed.find(code=>String(error?.message).endsWith(code))??'unclassified',
    timeout:error?.name==='TimeoutError',publicUi});process.exitCode=1;
}
finally{
  if(owner?.page&&originalId)await owner.page.evaluate(finishTreasureProfileRestore,{playerId:originalId,alternatePlayerId:alternateId,requireSaved:false}).catch(()=>{});
  await owner?.close().catch(()=>{});
}
