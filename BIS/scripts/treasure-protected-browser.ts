/** Protected harness helpers. No wallet/provider implementation is injected.
 * Never return recovery material except snapshotLegacyOriginal, whose result
 * must go directly into the protected vault, never console/output artifacts.
 */
export async function inspectOtherNetworkFixture(input:{network:string;playerId:string;gameId:string}){
  const {createAccountStorage}=await import('/BIS/packages/integration/src/client/state-layer-core/account-storage.ts');
  const {createGameWalletStorage}=await import('/BIS/packages/integration/src/client/state-layer-core/game-wallet-storage.ts');
  const {createContractStorage}=await import('/BIS/packages/integration/src/client/state-layer-core/contract-storage.ts');
  const players=createAccountStorage(input.network),games=createGameWalletStorage(input.network);
  try{
    const [saved,player,game,document]=await Promise.all([players.listProfiles(),players.load(),games.load(),createContractStorage(undefined,input.network).load()]);
    return {saved:saved.profiles.includes(input.playerId),playerSelected:player.account?.profileId===input.playerId,
      gameSelected:game?.profileId===input.gameId,localGame:!!game&&!('server' in game),
      unresolved:document.ledger.contracts.some(c=>!['claimed','refunded','failed'].includes(c.financial))};
  }finally{games.dispose();}
}

/** Both networks must be actually readable before funding a switch case.
 * Run only in the blank owned harness with the financial POST guard installed. */
export async function preflightProtectedNetworkWallets(input:{network:string;playerId:string;gameId:string;otherNetwork:string;otherPlayerId:string;otherGameId:string}){
  const api=await import('/BIS/packages/integration/src/index.ts');
  const {createTestNetworkSession}=await import('/BIS/packages/integration/src/client/state-layer-core/test-network.ts');
  const preference=createTestNetworkSession();let context,game;
  const stop=()=>{game?.dispose();game=undefined;context?.dispose();context=undefined;};
  try{
    if(preference.getSelected()!==input.network||input.network===input.otherNetwork)throw Error('network-fixture-selection-unavailable');
    for(const [network,playerId,gameId] of [[input.otherNetwork,input.otherPlayerId,input.otherGameId],[input.network,input.playerId,input.gameId]]){
      stop();preference.select(network);context=api.createBisContext();await context.readyAsync();
      const state=context.getState();
      if(state.phase!=='active'||state.network!==network||state.profileId!==playerId||!state.savedProfiles.includes(playerId))throw Error('network-fixture-player-unavailable');
      game=api.createBisGameWallet({playerProfileId:()=>context.getState().profileId,playerNetwork:()=>context.getState().network,
        playerSubscribe:context.subscribe,playerSessionKey:()=>JSON.stringify([context.getState().profileId,context.getState().network])});
      await game.refresh();const result=game.getState();
      if(result.status!=='ready'||result.profileId!==gameId||result.network!==network)throw Error('network-fixture-game-unavailable');
      if(network===input.network&&(!Number.isSafeInteger(result.balance?.availableSats)||result.balance.availableSats<1000))throw Error('network-fixture-funding-unavailable');
    }
    return {bothNetworkWalletsReady:true,originalSelectionRestored:true,financialActions:0};
  }finally{stop();preference.select(input.network);}
}

export async function exerciseProtectedNetworkReplacement(input:{network:string;playerId:string;gameId:string;otherNetwork:string;otherPlayerId:string;otherGameId:string;contractId:string;sessionId:string;expiresAt:number;fundingTxid:string}){
  const api=await import('/BIS/packages/integration/src/index.ts');
  const {createTestNetworkSession}=await import('/BIS/packages/integration/src/client/state-layer-core/test-network.ts');
  const {createContractStorage}=await import('/BIS/packages/integration/src/client/state-layer-core/contract-storage.ts');
  const preference=createTestNetworkSession();let context,game,offers;
  const stop=()=>{offers?.dispose({endSessions:false});offers=undefined;game?.dispose();game=undefined;context?.dispose();context=undefined;};
  const open=async(network,playerId,gameId)=>{
    stop();preference.select(network);context=api.createBisContext();await context.readyAsync();
    const state=context.getState();
    if(state.phase!=='active'||state.network!==network||state.profileId!==playerId||!state.savedProfiles.includes(playerId))throw Error('network-fixture-player-unavailable');
    game=api.createBisGameWallet({playerProfileId:()=>context.getState().profileId,playerNetwork:()=>context.getState().network,
      playerSubscribe:context.subscribe,playerSessionKey:()=>JSON.stringify([context.getState().profileId,context.getState().network])});
    await game.refresh();if(game.getState().profileId!==gameId||game.getState().network!==network)throw Error('network-fixture-game-unavailable');
    offers=api.createBisLto({context,gameWallet:game,creationEnabled:false});
  };
  const query={purpose:'treasureLTO',sessionId:input.sessionId,gameId:input.gameId,includeResolved:true};
  try{
    if(input.network===input.otherNetwork||preference.getSelected()!==input.network)throw Error('network-fixture-selection-unavailable');
    const original=await createContractStorage(undefined,input.network).load();
    const originalRecord=original.ledger.contracts.find(c=>c.id===input.contractId);
    if(!originalRecord||originalRecord.financial!=='funded'||originalRecord.expiresAt!==input.expiresAt||
      originalRecord.scope.playerId!==input.playerId||originalRecord.scope.gameId!==input.gameId||
      original.recovery[input.contractId]?.fundingOutput?.txid!==input.fundingTxid)throw Error('network-original-unverified');
    const other=await createContractStorage(undefined,input.otherNetwork).load();
    await open(input.otherNetwork,input.otherPlayerId,input.otherGameId);
    const visible=await offers.checkContractsAsync({...query,includeOtherNetworks:true});
    const claim=await offers.claim(input.contractId),reject=await offers.reject(input.contractId),refund=await offers.refund(input.contractId);
    if(visible.status!=='ready'||visible.contracts.some(c=>c.id===input.contractId)||[claim,reject,refund].some(r=>r.status!=='unavailable'))throw Error('network-wrong-scope-accepted');
    stop();
    if(JSON.stringify(await createContractStorage(undefined,input.otherNetwork).load())!==JSON.stringify(other)||
      JSON.stringify(await createContractStorage(undefined,input.network).load())!==JSON.stringify(original))throw Error('network-original-journal-changed');
    await open(input.network,input.playerId,input.gameId);
    const restored=(await offers.checkContractsAsync(query)).contracts.find(c=>c.id===input.contractId);
    if(!restored?.canClaim||restored.financial!=='funded'||restored.expiresAt!==input.expiresAt||restored.fundingTransactionId!==input.fundingTxid)throw Error('network-original-not-restored');
    return {actualNetworkReplacement:true,originalNetwork:input.network,otherNetwork:input.otherNetwork,wrongScopeActionsDenied:true,
      bothJournalsUnchanged:true,originalRestored:true,originalContractId:input.contractId,originalDeadline:input.expiresAt};
  }finally{stop();preference.select(input.network);}
}

export async function initializeLegacyAcceptance(input:{entryUrl:string;network:string;playerId:string;gameId:string}){
  if(input.entryUrl!=='/BIS/scripts/fixtures/treasure-legacy-0.0.23.js'||globalThis.__bisLegacyAcceptance)throw Error('legacy-harness-unavailable');
  const api=await import(/* @vite-ignore */ input.entryUrl);
  const context=api.createBisContext();let game,offers;
  try{
    await context.readyAsync();const selected=context.getState();
    if(selected.phase!=='active'||selected.network!==input.network||selected.profileId!==input.playerId)throw Error('legacy-player-unavailable');
    game=api.createBisGameWallet({playerProfileId:()=>context.getState().profileId,playerNetwork:()=>context.getState().network,
      playerSubscribe:context.subscribe,playerSessionKey:()=>JSON.stringify([context.getState().profileId,context.getState().network])});
    await game.refresh();const state=game.getState();
    if(state.status!=='ready'||state.profileId!==input.gameId||state.network!==input.network)throw Error('legacy-game-unavailable');
    if(!Number.isSafeInteger(state.balance?.availableSats)||state.balance.availableSats<1000)throw Error('legacy-funding-unavailable');
    offers=api.createBisLto({context,gameWallet:game});
    globalThis.__bisLegacyAcceptance={context,game,offers};
    return {ready:true,version:'0.0.23',financialActions:0};
  }catch(error){offers?.dispose({endSessions:false});game?.dispose();context.dispose();throw error;}
}

export async function startLegacyAcceptance(input:{sessionId:string;startedAt:number;expiresAt:number}){
  const owned=globalThis.__bisLegacyAcceptance;if(!owned||owned.started)throw Error('legacy-original-only');
  owned.started=true; // Set before the actual command, including thrown/unknown outcomes.
  const result=await owned.offers.start({purpose:'treasureLTO',sessionId:input.sessionId,hostReference:'protected-original-legacy',
    exclusivityKey:'treasure',amountSats:1000,startedAt:input.startedAt,expiresAt:input.expiresAt});
  return {status:result.status,contractId:result.contract?.id};
}

export async function stopLegacyAcceptance(){
  const owned=globalThis.__bisLegacyAcceptance;if(!owned)return;
  owned.offers.dispose({endSessions:false});owned.game.dispose();owned.context.dispose();delete globalThis.__bisLegacyAcceptance;
}

/** Private return. Caller must persist directly into protected vault. */
export async function snapshotLegacyOriginal(input:{network:string;contractId:string;playerId:string;gameId:string;sessionId:string;expiresAt:number;fundingTxid:string;contractPkScript:string}){
  const {createContractStorage}=await import('/BIS/packages/integration/src/client/state-layer-core/contract-storage.ts');
  const {inspectLtoRecoveryDescriptor}=await import('/BIS/packages/integration/src/client/wallet-layer-arkade/lto-recovery-descriptor.ts');
  const document=await createContractStorage(undefined,input.network).load();
  const record=document.ledger.contracts.find(c=>c.id===input.contractId),recovery=document.recovery[input.contractId];
  if(!record||record.validationMode!==undefined||recovery?.treasure||!recovery?.secretHex||!recovery.fundingOutput||record.financial!=='funded'||
    record.scope.network!==input.network||record.scope.playerId!==input.playerId||record.scope.gameId!==input.gameId||record.sessionId!==input.sessionId||
    record.expiresAt!==input.expiresAt||record.amountSats!==1000||recovery.fundingOutput.txid!==input.fundingTxid||
    recovery.fundingOutput.vout!==0||recovery.fundingOutput.value!==1000)throw Error('legacy-original-unverified');
  if(await inspectLtoRecoveryDescriptor(record,recovery)!==input.contractPkScript)throw Error('legacy-original-script-unverified');
  return document;
}

/** Current factories, creation disabled. No reconstructed or relabeled record. */
export async function actOnOriginalAcceptance(input:{network:string;playerId:string;gameId:string;contractId:string;sessionId:string;expiresAt:number;kind:'claim'|'legacy-refund'}){
  if(globalThis.__bisOriginalAcceptance||!['claim','legacy-refund'].includes(input.kind))throw Error('original-action-already-started');
  globalThis.__bisOriginalAcceptance={started:true};
  const api=await import('/BIS/packages/integration/src/index.ts');
  const context=api.createBisContext();let game,offers;
  try{
    await context.readyAsync();const state=context.getState();
    if(state.phase!=='active'||state.profileId!==input.playerId||state.network!==input.network)throw Error('original-player-unavailable');
    game=api.createBisGameWallet({playerProfileId:()=>context.getState().profileId,playerNetwork:()=>context.getState().network,
      playerSubscribe:context.subscribe,playerSessionKey:()=>JSON.stringify([context.getState().profileId,context.getState().network])});
    await game.refresh();if(game.getState().profileId!==input.gameId||game.getState().network!==input.network)throw Error('original-game-unavailable');
    offers=api.createBisLto({context,gameWallet:game,creationEnabled:false});
    const original=(await offers.checkContractsAsync({sessionId:input.sessionId,includeResolved:true})).contracts.find(c=>c.id===input.contractId);
    if(!original||original.financial!=='funded'||original.expiresAt!==input.expiresAt)throw Error('original-contract-unavailable');
    const now=Date.now();const denied=await offers.start({purpose:'treasureLTO',sessionId:input.sessionId+'-disabled',hostReference:'must-not-create',
      exclusivityKey:'treasure',amountSats:1000,startedAt:now,expiresAt:now+90000});
    if(denied.status!=='unavailable'||denied.contract)throw Error('original-creation-not-disabled');
    const result=input.kind==='claim'?await offers.claim(input.contractId):await offers.reject(input.contractId);
    // Keep this controller alive until the protected runner verifies the exact
    // receipt. Disposing immediately could interrupt an asynchronously queued spend.
    globalThis.__bisOriginalAcceptance={context,game,offers};
    return {status:result.status,creationDisabled:true,originalContractId:input.contractId};
  }catch(error){offers?.dispose({endSessions:false});game?.dispose();context.dispose();throw error;}
}

export async function stopOriginalAcceptance(){
  const owned=globalThis.__bisOriginalAcceptance;if(!owned)return;
  owned.offers?.dispose({endSessions:false});owned.game?.dispose();owned.context?.dispose();delete globalThis.__bisOriginalAcceptance;
}

/** Preference only, used with the wrong-scope financial guard still installed
 * before closing a browser whose bounded helper observation timed out. */
export async function restoreAcceptanceNetworkPreference(network:string){
  const {createTestNetworkSession}=await import('/BIS/packages/integration/src/client/state-layer-core/test-network.ts');
  createTestNetworkSession().select(network);
}
