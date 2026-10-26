/** Runs inside the protected acceptance browser. Uses production factories and
 * existing encrypted storage, with no injected wallet/provider implementation.
 * Returns only public assertions. Never returns recovery or signing material.
 */
export async function endOriginalTreasureSession(input:{network:string;playerId:string;gameId:string;contractId:string;sessionId:string;expiresAt:number}) {
  const {createBisContext,createBisGameWallet,createBisLto}=await import('/BIS/packages/integration/src/index.ts');
  const context=createBisContext();let game,offers;
  try {
    await context.readyAsync();
    const selected=context.getState();
    if(selected.phase!=='active'||selected.profileId!==input.playerId||selected.network!==input.network)throw Error('acceptance-player-binding');
    game=createBisGameWallet({playerProfileId:()=>context.getState().profileId,playerNetwork:()=>context.getState().network,
      playerSubscribe:context.subscribe,playerSessionKey:()=>JSON.stringify([context.getState().profileId,context.getState().network])});
    await game.refresh();
    if(game.getState().profileId!==input.gameId||game.getState().network!==input.network)throw Error('acceptance-game-binding');
    offers=createBisLto({context,gameWallet:game,creationEnabled:false});
    const query={purpose:'treasureLTO',sessionId:input.sessionId,gameId:input.gameId,includeResolved:true};
    const original=(await offers.checkContractsAsync(query)).contracts.find(c=>c.id===input.contractId);
    if(!original||original.financial!=='funded'||original.expiresAt!==input.expiresAt||!original.canClaim)throw Error('acceptance-original-binding');
    const start=Date.now();
    const denied=await offers.start({purpose:'treasureLTO',sessionId:input.sessionId+'-disabled',hostReference:'acceptance-disabled',
      exclusivityKey:original.scope.exclusivityKey,startedAt:start,expiresAt:start+90000,amountSats:1000});
    if(denied.status!=='unavailable'||denied.contract)throw Error('acceptance-creation-not-disabled');
    const wrong=await offers.claim(input.contractId+'-wrong');
    if(wrong.status!=='unavailable')throw Error('acceptance-wrong-contract-accepted');
    // A selected profile prevents network replacement. Exercise that public
    // safeguard, without pretending a network switch actually took place.
    context.selectNetwork(input.network==='signet'?'mutinynet':'signet');
    if(context.getState().network!==input.network)throw Error('acceptance-network-replaced');
    const before=(await offers.checkContractsAsync(query)).contracts.find(c=>c.id===input.contractId);
    if(before?.financial!=='funded'||!before.canClaim||before.expiresAt!==input.expiresAt)throw Error('acceptance-original-mutated');
    // Both calls target the exact original session. The normal BIS lock and
    // journal must coalesce/reconcile them rather than fund or spend twice.
    await Promise.all([offers.endSession(input.sessionId),offers.endSession(input.sessionId)]);
    return {creationDisabled:true,wrongContractDenied:true,networkReplacementPrevented:true,duplicateSessionEnd:true,
      originalContractId:input.contractId,originalDeadline:input.expiresAt};
  } finally {
    offers?.dispose({endSessions:false});game?.dispose();context.dispose();
  }
}

/** No secret argument: both profiles must already exist in protected storage.
 * Uses real profile selection and real competing production commands.
 */
export async function exerciseTreasureIdentityRace(input:{network:string;playerId:string;alternatePlayerId:string;gameId:string;contractId:string;sessionId:string;expiresAt:number}){
  const {createBisContext,createBisGameWallet,createBisLto}=await import('/BIS/packages/integration/src/index.ts');
  const context=createBisContext();let game,offers;
  try{
    await context.readyAsync();
    const state=context.getState();
    if(state.phase!=='active'||state.profileId!==input.playerId||state.network!==input.network||
      input.alternatePlayerId===input.playerId||input.alternatePlayerId===input.gameId||!state.savedProfiles.includes(input.alternatePlayerId))throw Error('identity-fixture-unavailable');
    game=createBisGameWallet({playerProfileId:()=>context.getState().profileId,playerNetwork:()=>context.getState().network,
      playerSubscribe:context.subscribe,playerSessionKey:()=>JSON.stringify([context.getState().profileId,context.getState().network])});
    await game.refresh();
    if(game.getState().profileId!==input.gameId||game.getState().network!==input.network)throw Error('identity-game-binding');
    offers=createBisLto({context,gameWallet:game,creationEnabled:false});
    const query={purpose:'treasureLTO',sessionId:input.sessionId,gameId:input.gameId,includeResolved:true};
    const original=(await offers.checkContractsAsync(query)).contracts.find(c=>c.id===input.contractId);
    if(!original?.canClaim||original.financial!=='funded'||original.expiresAt!==input.expiresAt)throw Error('identity-original-binding');
    await context.selectProfile(input.alternatePlayerId);
    if(context.getState().phase!=='active'||context.getState().profileId!==input.alternatePlayerId||context.getState().network!==input.network)throw Error('identity-switch-unverified');
    const foreign=(await offers.checkContractsAsync(query)).contracts;
    const wrongClaim=await offers.claim(input.contractId),wrongReject=await offers.reject(input.contractId);
    if(foreign.some(c=>c.id===input.contractId)||wrongClaim.status!=='unavailable'||wrongReject.status!=='unavailable')throw Error('identity-not-enforced');
    await context.selectProfile(input.playerId);await game.refresh();
    if(context.getState().profileId!==input.playerId||context.getState().phase!=='active'||game.getState().profileId!==input.gameId)throw Error('identity-restore-unverified');
    const restored=(await offers.checkContractsAsync(query)).contracts.find(c=>c.id===input.contractId);
    if(!restored?.canClaim||restored.financial!=='funded'||restored.expiresAt!==input.expiresAt)throw Error('identity-original-mutated');
    const [claim,reject]=await Promise.all([offers.claim(input.contractId),offers.reject(input.contractId)]);
    return {actualProfileSwitch:true,originalProfileRestored:true,wrongIdentityClaimDenied:true,wrongIdentityRejectDenied:true,
      originalContractId:input.contractId,originalDeadline:input.expiresAt,claimStatus:claim.status,rejectStatus:reject.status};
  }finally{
    // Restore the original selection even on a failed assertion. Do not submit
    // recovery, end a session, reset storage or override an unknown operation.
    if(context.getState().profileId===input.alternatePlayerId)await context.selectProfile(input.playerId).catch(()=>{});
    offers?.dispose({endSessions:false});game?.dispose();context.dispose();
  }
}

/** Read-only public-controller diagnostic. No LTO or signing command exists. */
export async function inspectTreasureWalletReadiness(input:{network:string;playerId:string;gameId:string}){
  const {createBisContext,createBisGameWallet}=await import('/BIS/packages/integration/src/index.ts');
  const context=createBisContext();let game;
  try{
    await context.readyAsync();const selected=context.getState();
    if(selected.phase!=='active'||selected.profileId!==input.playerId||selected.network!==input.network)throw Error('readiness-player-binding');
    game=createBisGameWallet({playerProfileId:()=>context.getState().profileId,playerNetwork:()=>context.getState().network,
      playerSubscribe:context.subscribe,playerSessionKey:()=>JSON.stringify([context.getState().profileId,context.getState().network])});
    await game.refresh();const state=game.getState();
    return {status:state.status,readStatus:state.readStatus??'none',source:state.source??'none',
      playerConnected:state.playerConnected===true,gameBound:state.profileId===input.gameId,networkBound:state.network===input.network,
      hasAddresses:!!state.addresses,availableSats:state.balance?.availableSats??null};
  }finally{game?.dispose();context.dispose();}
}
