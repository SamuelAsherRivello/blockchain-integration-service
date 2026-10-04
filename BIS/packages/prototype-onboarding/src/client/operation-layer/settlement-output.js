export function renderSettlementOutput(container,state,accountId,evidence,makeCard){
 container.replaceChildren();
 if(!accountId||evidence.accountId!==accountId||(state.accountId&&state.accountId!==accountId)||!state.inputs||['idle','waiting'].includes(state.phase))return;
 for(const [id,label] of [[state.boardingCommitment,'1 · Bitcoin to Arkade'],[state.commitment,state.mode==='full-board'?'Bitcoin to Arkade':'2 · Bitcoin remainder returned']]){
  if(id)container.append(makeCard(id,label,evidence.transactions.find(tx=>tx.txid===id)?.status.confirmed));
 }
}
