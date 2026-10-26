/** Test-only composition of the actual BIS restore UI. No signing or contract
 * controller is created and no secret is accepted/returned by these helpers.
 */
export async function openTreasureProfileRestore(input:{network:string;playerId:string;alternatePlayerId:string}){
  if(window.__bisTreasureProfileSetup)throw Error('profile-setup-already-open');
  const {createBisContext,createBisUi}=await import('/BIS/packages/integration/src/index.ts');
  const context=createBisContext();let ui,host;
  try{
    await context.readyAsync();const state=context.getState();
    if(state.phase!=='active'||state.network!==input.network||state.profileId!==input.playerId||input.playerId===input.alternatePlayerId)throw Error('profile-setup-binding');
    if(state.savedProfiles.includes(input.alternatePlayerId)){context.dispose();return {alreadySaved:true};}
    host=document.createElement('div');host.setAttribute('data-treasure-profile-setup','');document.body.append(host);
    ui=createBisUi(context);ui.mount(host);
    window.__bisTreasureProfileSetup={context,ui,host,playerId:input.playerId,network:input.network};
    context.openProfileChooser();context.openRestoreAccount();
    return {alreadySaved:false};
  }catch(error){ui?.unmount();context.dispose();host?.remove();delete window.__bisTreasureProfileSetup;throw error;}
}

/** Resume interrupted nonfinancial setup before the owned browser checks its
 * original identity. Only the two explicitly registered profiles are eligible.
 */
export async function restoreOriginalTreasureProfile(input:{network:string;playerId:string;alternatePlayerId:string}){
  const {createBisContext}=await import('/BIS/packages/integration/src/index.ts');
  const context=createBisContext();
  try{
    await context.readyAsync();const state=context.getState();
    if(state.phase!=='active'||state.network!==input.network||
      ![input.playerId,input.alternatePlayerId].includes(state.profileId)||
      !state.savedProfiles.includes(input.playerId))throw Error('profile-setup-binding');
    if(state.profileId!==input.playerId)await context.selectProfile(input.playerId);
    await context.readyAsync();
    if(context.getState().phase!=='active'||context.getState().profileId!==input.playerId)throw Error('original-profile-not-restored');
    return {originalProfileRestored:true};
  }finally{context.dispose();}
}

export async function finishTreasureProfileRestore(input:{playerId:string;alternatePlayerId:string;requireSaved:boolean}){
  const setup=window.__bisTreasureProfileSetup;
  if(!setup){if(input.requireSaved)throw Error('profile-setup-not-open');return {restored:false};}
  const {context,ui,host}=setup;
  try{
    if(setup.playerId!==input.playerId||context.getState().network!==setup.network)throw Error('profile-setup-binding');
    if(input.requireSaved&&(!context.getState().savedProfiles.includes(input.alternatePlayerId)||context.getState().profileId!==input.alternatePlayerId||context.getState().phase!=='active'))throw Error('alternate-profile-not-saved');
    // Close/cancel only this setup's UI. Do not logout, reset, end sessions or
    // run contract reconciliation while restoring the original selection.
    context.closeAccount();await context.readyAsync();await context.selectProfile(input.playerId);
    if(context.getState().profileId!==input.playerId||context.getState().phase!=='active')throw Error('original-profile-not-restored');
    return {restored:true,alternateSaved:context.getState().savedProfiles.includes(input.alternatePlayerId)};
  }finally{ui.unmount();context.dispose();host.remove();delete window.__bisTreasureProfileSetup;}
}
