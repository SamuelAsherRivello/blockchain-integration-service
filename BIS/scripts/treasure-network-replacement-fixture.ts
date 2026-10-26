/** Deterministic browser fixture only. Uses real IndexedDB encryption, network
 * storage and LTO service, but synthetic recovery/output data and no SDK spend.
 * Never load this fixture in a protected wallet browser or call it live proof.
 */
export async function exerciseDeterministicNetworkReplacement(originalNetwork:'signet'|'mutinynet') {
  const {createNetworkScopedContractStorage}=await import('/BIS/packages/integration/src/client/state-layer-core/contract-storage.ts');
  const {emptyContractLedger,startLto,finishContractOperation}=await import('/BIS/packages/integration/src/client/state-layer-core/contracts.ts');
  const {createLtoService}=await import('/BIS/packages/integration/src/client/state-layer-core/lto-service.ts');
  const {operatorFor}=await import('/BIS/packages/integration/src/client/wallet-layer-arkade/account.ts');
  const {createTestNetworkSession}=await import('/BIS/packages/integration/src/client/state-layer-core/test-network.ts');
  const session=createTestNetworkSession();
  let network=session.select(originalNetwork);
  const select=(selected:'signet'|'mutinynet')=>{network=session.select(selected);};
  const otherNetwork=network==='signet'?'mutinynet':'signet';
  const storage=createNetworkScopedContractStorage(()=>session.getSelected());
  // A fresh browser context is mandatory. Refuse to overwrite either journal.
  for(const selected of [originalNetwork,otherNetwork]){
    select(selected);
    const document=await storage.load();
    if(document.revision!==0||document.ledger.contracts.length)throw Error('network-fixture-requires-empty-storage');
  }
  select(originalNetwork);
  const now=Date.now(),id=crypto.randomUUID(),sessionId=crypto.randomUUID();
  const allocated=startLto(emptyContractLedger(),{id,sessionId,operationId:crypto.randomUUID(),purpose:'treasureLTO',
    scope:{network,operator:operatorFor(network),playerId:'fixture-player',gameId:'fixture-game',exclusivityKey:'fixture'},
    hostReference:'deterministic-only',amountSats:1000,startedAt:now,expiresAt:now+90000},now);
  const funded=finishContractOperation(allocated.contract,{operationId:allocated.contract.operation.id,kind:'fund',outcome:'confirmed'});
  const recovery={secretHex:'12'.repeat(32),playerKey:'23'.repeat(32),gameKey:'34'.repeat(32),operatorKey:'45'.repeat(32),
    exitDelay:'512',gameScript:'00',playerScript:'01',contractScript:'02',fundingOutput:{txid:'ab'.repeat(32),vout:0,value:1000}};
  await storage.save({version:1,revision:0,ledger:{...allocated.ledger,contracts:[funded]},recovery:{[id]:recovery}});
  const original=JSON.stringify(await storage.load());
  let financialCalls=0;
  const forbidden=async()=>{financialCalls++;throw Error('network-fixture-financial-path-forbidden');};
  // Identical profile IDs on both networks catch accidental identity-only checks.
  const context={getState:()=>({phase:'active',profileId:'fixture-player',network}),showToast:()=>{},refreshBalance:async()=>{}};
  const gameWallet={getState:()=>({status:'ready',profileId:'fixture-game',network}),refresh:async()=>{}};
  const service=createLtoService({context,gameWallet,creationEnabled:false},{storage,poll:false,
    playerStorage:{load:async()=>({generation:0,account:{profileId:'fixture-player',network,phrase:'not-a-wallet'}})},
    gameStorage:{load:async()=>({profileId:'fixture-game',network,phrase:'not-a-wallet'}),dispose:()=>{}},
    prepare:forbidden,submit:forbidden,reconcile:forbidden,resume:forbidden});
  try{
    const before=(await service.checkContractsAsync({sessionId,includeResolved:true})).contracts.find(c=>c.id===id);
    if(!before?.canClaim)throw Error('network-fixture-original-unavailable');
    select(otherNetwork);
    const otherBefore=JSON.stringify(await storage.load());
    const foreign=await service.checkContractsAsync({sessionId,includeResolved:true,includeOtherNetworks:true});
    const claim=await service.claim(id),reject=await service.reject(id),refund=await service.refund(id);
    await service.endSession(sessionId);
    const otherUnchanged=JSON.stringify(await storage.load())===otherBefore;
    const selectedNetworkReplaced=session.getSelected()===otherNetwork;
    select(originalNetwork);
    const restored=(await service.checkContractsAsync({sessionId,includeResolved:true})).contracts.find(c=>c.id===id);
    const assertions={selectedStorageNetworkReplaced:selectedNetworkReplaced,sameProfileIds:true,foreignOriginalHidden:foreign.status==='ready'&&!foreign.contracts.some(c=>c.id===id),
      wrongNetworkClaimDenied:claim.status==='unavailable',wrongNetworkRejectDenied:reject.status==='unavailable',wrongNetworkRefundDenied:refund.status==='unavailable',
      otherJournalUnchanged:otherUnchanged,originalJournalUnchanged:JSON.stringify(await storage.load())===original,
      originalRestored:restored?.id===id&&restored?.canClaim===true&&restored.expiresAt===before.expiresAt,noFinancialCalls:financialCalls===0};
    if(Object.values(assertions).some(value=>value!==true))throw Error('network-fixture-invariant-failed:'+JSON.stringify(assertions));
    return {originalNetwork,otherNetwork,assertions,qualification:'deterministic storage/service isolation only; no live contract or wallet'};
  }finally{select(originalNetwork);service.dispose({endSessions:false});}
}
