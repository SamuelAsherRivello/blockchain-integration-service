import test from 'node:test';
import assert from 'node:assert/strict';
import {MnemonicIdentity,SingleKey,CSVMultisigTapscript,RestArkProvider,RestIndexerProvider,VtxoScript,Transaction} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import {prepareLtoRecovery,submitLtoSpend,reconcileLtoSpend,resumeLtoFinalization} from '../../src/client/wallet-layer-arkade/lto-contract.ts';
import {startLto,emptyContractLedger,beginContractOperation} from '../../src/client/state-layer-core/contracts.ts';

async function fixture(t){
  // Public, unfunded deterministic test identities. Every network boundary is mocked.
  const keys=[1,2,3].map(n=>SingleKey.fromPrivateKey(new Uint8Array(32).fill(n)));
  const operator=await keys[0].xOnlyPublicKey(),game={profileId:'game',phrase:'test-game'},player={profileId:'player',phrase:'test-player'};
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected test network');});
  t.mock.method(MnemonicIdentity,'fromMnemonic',phrase=>phrase==='test-game'?keys[1]:keys[2]);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
  const state={fee:'0',intentFee:{},calls:0,coins:[],saved:[],evidence:false};
  const info={network:'signet',fees:{txFeeRate:'0',intentFee:{}},signerPubkey:hex.encode(operator),unilateralExitDelay:512n,vtxoMinAmount:1n,vtxoMaxAmount:0n,
    checkpointTapscript:hex.encode(CSVMultisigTapscript.encode({pubkeys:[operator],timelock:{type:'seconds',value:512n}}).script)};
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({...info,fees:{...info.fees,txFeeRate:state.fee,intentFee:state.intentFee}}));
  t.mock.method(RestArkProvider.prototype,'submitTx',async()=>{state.calls++;assert.ok(state.saved.at(-1).record.operation.submission==='submitted');throw Error('Acknowledgement lost');});
  t.mock.method(RestIndexerProvider.prototype,'getVtxos',async query=>{
    if(query.scripts)return {vtxos:state.coins};
    const spend=state.saved.at(-1)?.recovery.spend;
    if(query.outpoints.every(p=>state.coins.some(c=>c.txid===p.txid&&c.vout===p.vout)))
      return {vtxos:state.coins.map(c=>state.evidence?{...c,spentBy:'ef'.repeat(32),arkTxId:spend?.transactionId}:c)};
    if(!state.evidence||!spend)return {vtxos:[]};
    return {vtxos:query.outpoints[0].txid===spend.transactionId?
      [{txid:spend.transactionId,vout:0,value:1000,script:spend.destinationScript},...(spend.change?[{txid:spend.transactionId,vout:1,value:spend.change.value,script:spend.change.script}]:[])]:
      spend.inputs.map(input=>({...input,spentBy:'ef'.repeat(32),arkTxId:spend.transactionId}))};
  });
  const recovery=await prepareLtoRecovery(game,player);
  state.coins=[{txid:'ab'.repeat(32),vout:0,value:2000,script:hex.encode(VtxoScript.decode(hex.decode(recovery.gameScript)).pkScript)}];
  const now=Date.now(),record=startLto(emptyContractLedger(),{id:'contract',sessionId:'session',operationId:'fund',purpose:'test',hostReference:'test',amountSats:1000,startedAt:now,expiresAt:now+90000,scope:{playerId:'player',gameId:'game',operator:'https://signet.arkade.sh',network:'signet',exclusivityKey:'test'}},now).contract;
  return {state,keys,game,player,record,recovery,commit:async(record,recovery)=>state.saved.push({record,recovery})};
}
test('changed fees, insufficient eligible funds and a replaced account are explicitly not submitted',async t=>{
  const f=await fixture(t);
  for(const kind of ['fees','assets','account']){
    f.state.fee=kind==='fees'?'1':'0';f.state.coins[0].assets=kind==='assets'?[{assetId:'asset'}]:[];
    const result=await submitLtoSpend(f.record,f.recovery,f.game,f.commit,()=>kind!=='account');
    assert.equal(result.record.operation.submission,'not-submitted');assert.equal(f.state.calls,0);
    assert.equal(result.record.operation.failure,{fees:'fee-change',assets:'invalid-assets',account:'account-changed'}[kind]);
  }
});
test('real SDK construction journals exact inputs/change before a lost submission and reconciles only receipt evidence',async t=>{
  const f=await fixture(t);
  f.state.fee='0.0';f.state.intentFee={offchainInput:'0.0',offchainOutput:'0.0',onchainInput:'0.0',onchainOutput:'0.0'};
  const unknown=await submitLtoSpend(f.record,f.recovery,f.game,f.commit,()=>true);
  assert.equal(f.state.calls,1);assert.equal(unknown.record.financial,'unknown');
  assert.equal(Transaction.fromPSBT(base64.decode(unknown.recovery.submission.arkTx)).id,unknown.recovery.spend.transactionId);
  assert.equal(unknown.recovery.submission.checkpoints.length,unknown.recovery.spend.inputs.length);
  assert.deepEqual(f.state.saved.find(s=>s.recovery.submission).recovery.submission,unknown.recovery.submission);
  assert.equal(unknown.recovery.spend.change.value,1000);
  assert.equal((await reconcileLtoSpend(unknown.record,unknown.recovery)).record.financial,'unknown');
  f.state.evidence=true;const funded=await reconcileLtoSpend(unknown.record,unknown.recovery);
  assert.equal(funded.record.financial,'funded');assert.equal(funded.recovery.fundingOutput.txid,unknown.recovery.spend.transactionId);
});

test('depleted game inputs fail before any provider submission',async t=>{
  const f=await fixture(t);f.state.coins=[];
  const result=await submitLtoSpend(f.record,f.recovery,f.game,f.commit,()=>true);
  assert.equal(result.record.operation.submission,'not-submitted');
  assert.equal(f.state.calls,0);
  assert.equal(result.recovery.submission,undefined);
});

test('direct Game signer receives public contract scope before SDK signing without a recovery preimage', async t => {
  const f = await fixture(t), identity = MnemonicIdentity.fromMnemonic(f.game.phrase);
  const sign = identity.sign.bind(identity);
  let prepared: { inputs: unknown; contract: any } | undefined, signed = 0;
  t.mock.method(identity, 'sign', async (...args) => {
    assert.ok(prepared, 'contract scope must be captured before any SDK signature');
    signed++;
    return sign(...args);
  });
  const result = await submitLtoSpend(f.record, f.recovery, f.game, f.commit, () => true, identity, (inputs, contract) => {
    prepared = { inputs: inputs.map(({ txid, vout }) => ({ txid, vout })), contract };
  });
  assert.ok(signed > 0);
  assert.equal(f.state.calls, 1);
  assert.equal(result.record.financial, 'unknown', 'a signing result never fabricates a completed funding transaction');
  assert.deepEqual(prepared!.inputs, f.state.coins.map(({ txid, vout }) => ({ txid, vout })));
  assert.deepEqual(Object.keys(prepared!.contract).sort(), ['kind', 'playerPublicKey', 'secretHash']);
  assert.equal(prepared!.contract.kind, 'fund');
  assert.equal(prepared!.contract.playerPublicKey, '02' + f.recovery.playerKey);
  const hash = hex.encode(new Uint8Array(await crypto.subtle.digest('SHA-256', hex.decode(f.recovery.secretHex))));
  assert.equal(prepared!.contract.secretHash, hash);
  assert.equal(JSON.stringify(prepared).includes(f.recovery.secretHex), false);
});

test('refused direct signing scope cannot reach an SDK signature or network submission', async t => {
  const f = await fixture(t), identity = MnemonicIdentity.fromMnemonic(f.game.phrase);
  let signatures = 0;
  t.mock.method(identity, 'sign', async () => { signatures++; throw Error('Unexpected signature.'); });
  const result = await submitLtoSpend(f.record, f.recovery, f.game, f.commit, () => true, identity, () => { throw Error('Scope retired.'); });
  assert.equal(result.record.operation.submission, 'not-submitted');
  assert.equal(signatures, 0);
  assert.equal(f.state.calls, 0);
});
test('finalization recovery retries exactly the journaled transaction and never submits a competing spend',async t=>{
  const f=await fixture(t);const unknown=await submitLtoSpend(f.record,f.recovery,f.game,f.commit,()=>true);
  const checkpoints=[];
  for(const encoded of unknown.recovery.submission.checkpoints){
    let cp=Transaction.fromPSBT(base64.decode(encoded));
    cp=await f.keys[0].sign(cp,[0]);cp=await f.keys[1].sign(cp,[0]);checkpoints.push(base64.encode(cp.toPSBT()));
  }
  const material={...unknown.recovery,finalization:{transactionId:unknown.recovery.spend.transactionId,checkpoints}};
  let finalized=0;t.mock.method(RestArkProvider.prototype,'finalizeTx',async(id,checkpoints)=>{finalized++;assert.equal(id,material.spend.transactionId);assert.deepEqual(checkpoints,material.finalization.checkpoints);f.state.evidence=true;});
  const corrupt={...material,finalization:{...material.finalization,checkpoints:['dGVzdA==']}};
  assert.equal((await resumeLtoFinalization(unknown.record,corrupt)).record.financial,'unknown');assert.equal(finalized,0);
  const result=await resumeLtoFinalization(unknown.record,material);
  assert.equal(result.record.financial,'funded');assert.equal(finalized,1);assert.equal(f.state.calls,1);
  await resumeLtoFinalization(unknown.record,material);assert.equal(finalized,1,'an existing exact receipt prevents another finalization');
  const claim=beginContractOperation(result.record,'claim','claim',Date.now());
  assert.throws(()=>beginContractOperation({...claim,financial:'unknown',operation:{...claim.operation,submission:'unknown'}},'refund','refund',Date.now()));
  f.state.evidence=false;
  const legacy=await resumeLtoFinalization(unknown.record,{...material,submission:undefined});
  assert.equal(legacy.record.financial,'funded');assert.equal(finalized,2,'legacy journals reconstruct the same root without producing a new signature');
  assert.equal(f.state.calls,1);
});
