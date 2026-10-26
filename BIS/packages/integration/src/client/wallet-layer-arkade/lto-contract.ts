import { signingIdentity, readonlyIdentity } from './wallet-identity.ts';
import { MnemonicIdentity, DefaultVtxo, VtxoScript, CSVMultisigTapscript, RestArkProvider, RestIndexerProvider, signAndSubmitOffchainTx, claimWithPreimageIdentity, Extension, createAssetPacket,Transaction,verifyTapscriptSignatures } from '@arkade-os/sdk';
import { hex,base64 } from '@scure/base';
import { operatorFor, type WalletAccount } from './account.ts';
import { readWalletNetworkPolicy } from './wallet-network-policy.ts';
import type { TestNetwork } from '../state-layer-core/test-network.ts';
import { requireZeroFeePolicy, WalletNetworkPolicyError } from '../state-layer-core/wallet-network-policy.ts';
import { buildLtoScript } from './lto-script.ts';
import { inspectSendTransaction, assetTotals } from './sending.ts';
import { eligibleUnreservedCoins, walletReservations, type ReservedOperation } from '../state-layer-core/wallet-reservations.ts';
import { ContractError, finishContractOperation, markContractSubmission, type ContractRecord } from '../state-layer-core/contracts.ts';
import type { ContractRecovery, ContractSpend } from '../state-layer-core/contract-storage.ts';
import {buildTreasureScript} from './treasure-script.ts';
import {TREASURE_EMULATOR,submitTreasureSpend,resumeTreasureSpend} from './treasure-contract.ts';
import {inspectTreasureRecoveryPlan} from './treasure-recovery-plan.ts';
import {inspectLtoRecoveryDescriptor} from './lto-recovery-descriptor.ts';
import {observeOtherLtoSpend} from './lto-observed-spend.ts';
import {treasureCoSignerAvailable} from './treasure-capability.ts';
import {observeTreasureRequest} from './treasure-observation.ts';
import {selectContractValidation,type ContractValidationPreference} from '../state-layer-core/contract-validation.ts';
import {inspectTreasureDirectPolicy} from './treasure-direct-policy.ts';

type Coin = { txid: string; vout: number; value: number; script: string; assets?: readonly {assetId:string;amount:bigint}[]; isSpent?: boolean; isSwept?: boolean; isUnrolled?: boolean; spentBy?: string; arkTxId?: string };
const sha = async (bytes: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)));
export function selectLtoInputs<T extends Coin>(coins: readonly T[], amount: number, minimum: number, reservations: readonly ReservedOperation[]): T[] {
  if (!Number.isSafeInteger(amount) || amount < minimum || !Number.isSafeInteger(minimum) || minimum < 1) throw new ContractError('Invalid contract amount.');
  const candidates = eligibleUnreservedCoins(coins.filter(coin => !coin.isSpent && !coin.spentBy && !coin.isSwept && !coin.isUnrolled), reservations)
    .sort((a,b) => Number(!!a.assets?.length)-Number(!!b.assets?.length) || a.value - b.value || a.txid.localeCompare(b.txid) || a.vout - b.vout);
  const selected: T[] = []; let total = 0;
  const seen = new Set<string>();
  for (const coin of candidates) {
    const id = `${coin.txid}:${coin.vout}`;
    if (!Number.isSafeInteger(coin.value) || coin.value <= 0 || seen.has(id)) throw new ContractError('Contract funding inputs could not be verified.');
    seen.add(id); selected.push(coin); total += coin.value;
    if (!Number.isSafeInteger(total)) throw new ContractError('Contract amount exceeds supported range.');
    const retained=assetTotals(selected);
    if ((!retained.length && total === amount) || total >= amount + minimum) return selected;
  }
  throw new ContractError('Insufficient available game funds for this offer.');
}
/** Absence is uncertainty; a balance change or another spend is never confirmation. */
export function verifyLtoReceipt(spend: ContractSpend, receipts: readonly Coin[], sources: readonly Coin[]): boolean {
  try {
    const retained=spend.change?.assets??[];
    const sameAssets=(coins:readonly Coin[],expected:typeof retained)=>JSON.stringify(assetTotals(coins))===JSON.stringify(expected);
    const output = (vout: number, script: string, value: number,assets:typeof retained=[]) => receipts.some(coin => coin.txid === spend.transactionId && coin.vout === vout && coin.script === script && coin.value === value && sameAssets([coin],assets));
    const inputs=spend.inputs.map(input=>sources.find(coin=>coin.txid===input.txid&&coin.vout===input.vout&&coin.value===input.value&&!!coin.spentBy&&coin.arkTxId===spend.transactionId));
    return inputs.every((coin):coin is Coin=>!!coin) && sameAssets(inputs,retained) && output(0,spend.destinationScript,spend.amountSats) && (!spend.change||output(1,spend.change.script,spend.change.value,retained));
  }catch{return false;}
}
async function terms(network:TestNetwork='signet',direct=false) {
  const operator=operatorFor(network), ark = new RestArkProvider(operator), indexer = new RestIndexerProvider(operator);
  const {info,policy}=await readWalletNetworkPolicy(network,ark);
  if(direct)inspectTreasureDirectPolicy(network,info);else requireZeroFeePolicy(policy,'contract creation and spending');
  return { ark, indexer, info, operatorKey: hex.decode(info.signerPubkey).slice(-32) };
}
export async function prepareLtoRecovery(game: WalletAccount, player: WalletAccount, suppliedPlayerKey?: Uint8Array,
  offer?:{record:ContractRecord;preference?:ContractValidationPreference}): Promise<ContractRecovery> {
  const treasureOffer=offer?.record.purpose==='treasureLTO';
  const network=game.network??'signet';
  const { info, operatorKey } = await terms(network,treasureOffer);
  const gameKey = await signingIdentity(game).xOnlyPublicKey();
  const playerKey = suppliedPlayerKey ?? await signingIdentity(player).xOnlyPublicKey();
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const defaults = { serverPubKey: operatorKey, csvTimelock: { type: 'seconds' as const, value: info.unilateralExitDelay } };
  const gameScript=new DefaultVtxo.Script({...defaults,pubKey:gameKey}),playerScript=new DefaultVtxo.Script({...defaults,pubKey:playerKey});
  if(treasureOffer){
    let available=false;
    if(network==='mutinynet'&&offer?.preference!=='browser-policy-v1'){
      available=await treasureCoSignerAvailable();
    }
    const mode=selectContractValidation(network,offer?.preference??'auto',available);
    if(mode==='arkade-covenant-v2'){
      if(offer.record.amountSats!==1000)throw new ContractError('Treasure reward must be 1000 sats.');
      const treasure={network,offerSessionId:offer.record.sessionId,hostReference:offer.record.hostReference,startedAtMs:offer.record.startedAt,
        player:hex.encode(playerKey),game:hex.encode(gameKey),operator:hex.encode(operatorKey),emulator:TREASURE_EMULATOR.key.slice(2),
        playerDestination:hex.encode(playerScript.pkScript.slice(2)),gameDestination:hex.encode(gameScript.pkScript.slice(2)),exitDelay:Number(info.unilateralExitDelay)};
      const built=buildTreasureScript(treasure);
      if(built.deadlineSeconds*1000!==offer.record.expiresAt)throw new ContractError('Treasure deadline changed.');
      return {treasure,playerKey:hex.encode(playerKey),gameKey:hex.encode(gameKey),operatorKey:hex.encode(operatorKey),exitDelay:String(info.unilateralExitDelay),
        gameScript:hex.encode(gameScript.encode()),playerScript:hex.encode(playerScript.encode()),contractScript:hex.encode(built.script.encode())};
    }
  }
  const contract = buildLtoScript({ gameKey, playerKey, operatorKey, secretHash: await sha(secret), exitDelay: info.unilateralExitDelay });
  return { secretHex: hex.encode(secret), playerKey: hex.encode(playerKey), gameKey: hex.encode(gameKey), operatorKey: hex.encode(operatorKey), exitDelay: String(info.unilateralExitDelay),
    gameScript: hex.encode(new DefaultVtxo.Script({ ...defaults, pubKey: gameKey }).encode()), playerScript: hex.encode(new DefaultVtxo.Script({ ...defaults, pubKey: playerKey }).encode()), contractScript: hex.encode(contract.script.encode()) };
}
export async function reconcileLtoSpend(record: ContractRecord, recovery: ContractRecovery): Promise<{ record: ContractRecord; recovery: ContractRecovery }> {
  if(record.recoveryRequired)return reconcileImportedLto(record,recovery);
  if(record.financial==='funded'&&recovery.fundingOutput){
    const script=await inspectLtoRecoveryDescriptor(record,recovery);
    return await observeTreasureRequest(observeOtherLtoSpend(new RestIndexerProvider(record.scope.operator),record,recovery,script))??{record:{...record,recoveryRequired:true},recovery};
  }
  const spend = recovery.spend;
  if (!spend || record.operation.submission === 'confirmed' || record.operation.submission === 'not-submitted') return { record, recovery };
  if(recovery.treasure&&record.operation.kind!=='fund')inspectTreasureRecoveryPlan(record,recovery);
  const indexer = new RestIndexerProvider(record.scope.operator);
  const observation=Promise.all([
    indexer.getVtxos({outpoints:[{txid:spend.transactionId,vout:0},...(spend.change?[{txid:spend.transactionId,vout:1}]:[])]}),
    indexer.getVtxos({outpoints:spend.inputs.map(input=>({txid:input.txid,vout:input.vout}))}),
  ]);
  const [{vtxos:receipts},{vtxos:sources}]=await (record.purpose==='treasureLTO'?observeTreasureRequest(observation):observation);
  if (!verifyLtoReceipt(spend, receipts, sources)) {
    if(record.operation.kind!=='fund'&&recovery.fundingOutput&&sources.some(c=>c.isSpent&&c.arkTxId&&c.arkTxId!==spend.transactionId)){
      const script=await inspectLtoRecoveryDescriptor(record,recovery);
      return await observeTreasureRequest(observeOtherLtoSpend(indexer,record,recovery,script))??{record,recovery};
    }
    return { record, recovery };
  }
  return { record: finishContractOperation(record, { operationId: spend.operationId, kind: record.operation.kind, outcome: 'confirmed' }),
    recovery: record.operation.kind === 'fund' ? { ...recovery, fundingOutput: { txid: spend.transactionId, vout: 0, value: record.amountSats } } : recovery };
}

/** Imported cache is not financial evidence. A competing spend keeps recovery blocked. */
async function reconcileImportedLto(record:ContractRecord,recovery:ContractRecovery) {
  const script=await inspectLtoRecoveryDescriptor(record,recovery);
  const indexer=new RestIndexerProvider(record.scope.operator),spend=recovery.spend;
  const fund=recovery.fundingOutput;
  if(record.financial==='funded'&&fund){
    return await observeTreasureRequest(observeOtherLtoSpend(indexer,record,recovery,script))??{record,recovery};
  }
  if(spend&&['submitted','unknown'].includes(record.operation.submission)){
    const expectedSource=record.operation.kind==='fund'?hex.encode(VtxoScript.decode(hex.decode(recovery.gameScript)).pkScript):script;
    const {vtxos}=await observeTreasureRequest(indexer.getVtxos({outpoints:[...spend.inputs]}));
    if(!spend.inputs.every(input=>vtxos.some(c=>c.txid===input.txid&&c.vout===input.vout&&c.value===input.value&&c.script===expectedSource)))return {record,recovery};
    const result=await reconcileLtoSpend({...record,recoveryRequired:false},recovery);
    if(result.record.operation.submission==='confirmed')return result;
    if(recovery.finalization&&await originalFinalizationVerified(record,recovery))return {record:{...record,recoveryRequired:false},recovery};
  }
  return {record,recovery};
}

/** Check the original signed root/checkpoint plan against live input facts before replay. */
async function originalFinalizationVerified(record:ContractRecord,r:ContractRecovery):Promise<boolean> {
  try {
    if(!r.finalization||!r.spend||(r.submission&&r.submission.transactionId!==r.spend.transactionId)||
      r.finalization.transactionId!==r.spend.transactionId)return false;
    await inspectLtoRecoveryDescriptor(record,r);
    const source=(await observeTreasureRequest(new RestIndexerProvider(record.scope.operator).getVtxos({outpoints:[...r.spend.inputs]}))).vtxos;
    const expectedScript=hex.encode(VtxoScript.decode(hex.decode(record.operation.kind==='fund'?r.gameScript:r.contractScript)).pkScript);
    const coins=r.spend.inputs.map(input=>source.find(c=>c.txid===input.txid&&c.vout===input.vout&&c.value===input.value&&c.script===expectedScript));
    if(coins.some(c=>!c))return false;
    let saved=r.submission;
    // Older journals predate root-PSBT retention. Reconstruct its transaction ID
    // from the exact fully signed checkpoints and verified destination/change.
    // No new signature or replacement transaction is produced.
    if(!saved){
      const root=new Transaction({version:3});
      for(const encoded of r.finalization.checkpoints){
        const cp=Transaction.fromPSBT(base64.decode(encoded)),out=cp.getOutput(0);
        root.addInput({txid:cp.id,index:0,witnessUtxo:{amount:out.amount!,script:out.script!}});
      }
      root.addOutput({amount:BigInt(record.amountSats),script:hex.decode(r.spend.destinationScript)});
      if(r.spend.change)root.addOutput({amount:BigInt(r.spend.change.value),script:hex.decode(r.spend.change.script)});
      const retained=assetTotals(coins.filter(c=>!!c));
      if(retained.length)root.addOutput(Extension.create([createAssetPacket(new Map(coins.flatMap((c,i)=>c?.assets?.length?[[i,c.assets] as const]:[])),
        [{address:'',amount:record.amountSats}],{address:'',amount:r.spend.change!.value,assets:retained.map(a=>({assetId:a.assetId,amount:BigInt(a.amount)}))})]).txOut());
      root.addOutput({amount:0n,script:hex.decode('51024e73')});
      saved={transactionId:root.id,arkTx:base64.encode(root.toPSBT()),checkpoints:r.finalization.checkpoints};
    }
    const total=r.spend.inputs.reduce((sum,c)=>sum+c.value,0);
    const quote={id:record.operation.id,profileId:record.scope.gameId,recipient:'',amountSats:record.amountSats,
      feeSats:0,totalSats:record.amountSats,maxSats:total,expiresAt:record.expiresAt,fingerprint:''};
    if(inspectSendTransaction(saved.arkTx,[...saved.checkpoints],quote,coins.filter(c=>!!c),
      r.spend.destinationScript,hex.encode(VtxoScript.decode(hex.decode(r.gameScript)).pkScript))!==r.spend.transactionId)return false;
    const participant=record.operation.kind==='claim'?r.playerKey:r.gameKey;
    if(r.submission)verifyTapscriptSignatures(Transaction.fromPSBT(base64.decode(saved.arkTx)),0,[participant]);
    if(r.finalization.checkpoints.length!==saved.checkpoints.length)return false;
    const original=saved.checkpoints.map(c=>Transaction.fromPSBT(base64.decode(c)).id);
    const seen=new Set<string>();
    for(const encoded of r.finalization.checkpoints){
      const checkpoint=Transaction.fromPSBT(base64.decode(encoded));
      if(!checkpoint.getInput(0).witnessUtxo?.script||hex.encode(checkpoint.getInput(0).witnessUtxo!.script)!==expectedScript)return false;
      if(!original.includes(checkpoint.id)||seen.has(checkpoint.id))return false;
      seen.add(checkpoint.id);verifyTapscriptSignatures(checkpoint,0,[participant,r.operatorKey]);
    }
    return true;
  }catch{return false;}
}

/** Resume only the already signed, journaled transaction. Never create a competing spend. */
export async function resumeLtoFinalization(record: ContractRecord, recovery: ContractRecovery) {
  if(record.recoveryRequired)return reconcileLtoSpend(record,recovery);
  if(recovery.treasure&&recovery.emulatorSubmission)return resumeTreasureSpend(record,recovery,reconcileLtoSpend);
  if(record.scope.network!=='signet'&&record.scope.network!=='mutinynet')return {record,recovery};
  if(record.scope.operator!==operatorFor(record.scope.network)||!recovery.finalization||recovery.finalization.transactionId!==recovery.spend?.transactionId||!['submitted','unknown'].includes(record.operation.submission))return {record,recovery};
  const observed=await reconcileLtoSpend(record,recovery);
  if(observed.record.operation.submission==='confirmed')return observed;
  if(!await originalFinalizationVerified(record,recovery))return observed;
  try {await new RestArkProvider(operatorFor(record.scope.network)).finalizeTx(recovery.finalization.transactionId,[...recovery.finalization.checkpoints]);}catch{/* Read exact receipts even if finalize acknowledgement is unavailable. */}
  return reconcileLtoSpend(record,recovery);
}

/** Caller owns contract and wallet locks. Commit persists recovery/reservations before network submission. */
export async function submitLtoSpend(initial: ContractRecord, recovery: ContractRecovery, account: WalletAccount,
  commit: (record: ContractRecord, recovery: ContractRecovery) => Promise<void>, isCurrent: () => boolean, suppliedIdentity?: import('@arkade-os/sdk').Identity,
  prepareSigning?: (inputs: readonly { txid: string; vout: number }[], contract: import('./server-wallet.ts').ServerContractIntent) => void): Promise<{ record: ContractRecord; recovery: ContractRecovery }> {
  if(recovery.treasure&&initial.operation.kind!=='fund')return submitTreasureSpend(initial,recovery,account,commit,isCurrent,reconcileLtoSpend);
  let record = initial, material = recovery, providerCalled = false;
  const kind = record.operation.kind;
  try {
    if(record.recoveryRequired)throw new ContractError('Imported recovery needs network verification.');
    const network=account.network ?? 'signet';
    if (record.scope.operator !== operatorFor(network) || record.scope.network !== network || record.operation.submission !== 'prepared') throw new ContractError('Contract submission is unavailable.');
    const { ark, indexer, info, operatorKey } = await terms(network,record.purpose==='treasureLTO');
    const identity = suppliedIdentity ?? signingIdentity(account);
    const secretHex = material.secretHex;
    if (!secretHex&&!material.treasure) throw new ContractError('This contract requires its original recovery adapter.');
    if (hex.encode(operatorKey) !== material.operatorKey || hex.encode(await identity.xOnlyPublicKey()) !== (kind === 'claim' ? material.playerKey : material.gameKey)) throw new ContractError('Contract signing account changed.');
    const legacy = material.treasure?undefined:buildLtoScript({ gameKey: hex.decode(material.gameKey), playerKey: hex.decode(material.playerKey), operatorKey, secretHash: await sha(hex.decode(secretHex!)), exitDelay: BigInt(material.exitDelay) });
    const script=material.treasure?buildTreasureScript(material.treasure).script:legacy!.script;
    if (hex.encode(script.encode()) !== material.contractScript) throw new ContractError('Contract recovery script changed.');
    const gameScript = VtxoScript.decode(hex.decode(material.gameScript));
    const playerScript = VtxoScript.decode(hex.decode(material.playerScript));
    const minimum = Math.max(Number(info.vtxoMinAmount), 330);
    if (info.vtxoMaxAmount > 0n && BigInt(record.amountSats) > info.vtxoMaxAmount) throw new ContractError('Contract amount exceeds the operator limit.');
    let inputs;
    if (kind === 'fund') {
      const coins = (await indexer.getVtxos({scripts:[hex.encode(gameScript.pkScript)],spendableOnly:true})).vtxos;
      inputs = selectLtoInputs(coins.filter(coin => coin.script === hex.encode(gameScript.pkScript)), record.amountSats, minimum, walletReservations(account.profileId,network).filter(operation => operation.id !== `contract:${record.id}`));
    } else {
      if (!material.fundingOutput) throw new ContractError('Contract funding needs reconciliation.');
      const coins = (await indexer.getVtxos({outpoints:[material.fundingOutput]})).vtxos;
      inputs = coins.filter(coin => coin.txid === material.fundingOutput!.txid && coin.vout === material.fundingOutput!.vout && coin.value === record.amountSats && coin.script === hex.encode(script.pkScript) && !coin.assets?.length && !coin.isSpent && !coin.isSwept && !coin.isUnrolled && !coin.spentBy);
      if (inputs.length !== 1) throw new ContractError('Contract spend needs reconciliation.');
    }
    const total = inputs.reduce((sum,coin) => sum + coin.value,0), change = total - record.amountSats, retained=assetTotals(inputs);
    const extension=retained.length?Extension.create([createAssetPacket(new Map(inputs.flatMap((coin,i)=>coin.assets?.length?[[i,coin.assets] as const]:[])),[{address:'',amount:record.amountSats}],{address:'',amount:change,assets:retained.map(a=>({assetId:a.assetId,amount:BigInt(a.amount)}))})]).txOut():undefined;
    const source = kind === 'fund' ? gameScript : script;
    const leaf = kind === 'fund' ? source.leaves[0] : source.findLeaf(hex.encode(kind === 'claim' ? legacy!.claim : legacy!.refund));
    const destination = kind === 'fund' ? script.pkScript : kind === 'claim' ? playerScript.pkScript : gameScript.pkScript;
    const quote = { id: record.operation.id, profileId: account.profileId, recipient: '', amountSats: record.amountSats, feeSats: 0, totalSats: record.amountSats, maxSats: total, expiresAt: record.expiresAt, fingerprint: '' };
    const provider = {
      submitTx: async (encoded: string, checkpoints: string[]) => {
        if (!isCurrent()) throw new ContractError('Contract account or session changed.');
        const transactionId = inspectSendTransaction(encoded, checkpoints, quote, inputs, hex.encode(destination), hex.encode(gameScript.pkScript));
        material = { ...material, spend: { operationId: record.operation.id, transactionId, inputs: inputs.map(coin=>({txid:coin.txid,vout:coin.vout,value:coin.value})), destinationScript: hex.encode(destination), amountSats: record.amountSats, ...(change ? {change:{script:hex.encode(gameScript.pkScript),value:change,...(retained.length?{assets:retained}:{})}} : {}) } };
        record = markContractSubmission(record, record.operation.id, Date.now());
        material={...material,submission:{transactionId,arkTx:encoded,checkpoints:[...checkpoints]}};
        await commit(record, material);
        if (!isCurrent() || (kind === 'claim' && Date.now() >= record.expiresAt)) throw new ContractError('Contract account or deadline changed.');
        providerCalled = true;
        return ark.submitTx(encoded, checkpoints);
      },
      finalizeTx: async (txid: string, checkpoints: string[]) => {
        if(txid!==material.spend?.transactionId)throw new ContractError('Contract finalization needs reconciliation.');
        material={...material,finalization:{transactionId:txid,checkpoints:[...checkpoints]}};
        await commit(record,material);
        return ark.finalizeTx(txid,checkpoints);
      },
    };
    if (prepareSigning && legacy && kind !== 'claim') prepareSigning(inputs, { kind, secretHash: hex.encode(await sha(hex.decode(secretHex!))), playerPublicKey: '02' + material.playerKey });
    await signAndSubmitOffchainTx({ identity: kind === 'claim' ? claimWithPreimageIdentity(identity,hex.decode(secretHex!)) : identity, provider,
      inputs: inputs.map(coin=>({txid:coin.txid,vout:coin.vout,value:coin.value,tapLeafScript:leaf,tapTree:source.encode()})),
      outputs:[{script:destination,amount:BigInt(record.amountSats)},...(change?[{script:gameScript.pkScript,amount:BigInt(change)}]:[]),...(extension?[extension]:[])],
      serverUnrollScript:CSVMultisigTapscript.decode(hex.decode(info.checkpointTapscript)), verifyServerSignatures:{serverPubkey:operatorKey} });
    const result = await reconcileLtoSpend(record,material);
    await commit(result.record,result.recovery); return result;
  } catch(error) {
    record = providerCalled ? markContractSubmission(record,record.operation.id,Date.now(),true)
      : finishContractOperation({...record,operation:{...record.operation,submission:'prepared'}},{operationId:record.operation.id,kind,outcome:'not-submitted'});
    if(!providerCalled) {
      // Only fixed codes reach storage/UI. Never expose raw SDK/provider errors.
      const known:Record<string,NonNullable<ContractRecord['operation']['failure']>>={
        'Insufficient available game funds for this offer.':'insufficient-funds',
        'Contract fees changed. Creation and spending need fee verification.':'fee-change',
        'Live asset data is unavailable.':'invalid-assets',
        'Contract account or session changed.':'account-changed',
        'Contract account or deadline changed.':'account-changed',
        'Contract signing account changed.':'account-changed',
        'Pending operation inputs could not be verified. Open recovery details; receiving and inspection remain available.':'input-recovery'
      };
      const message=error instanceof Error?error.message:'';
      record={...record,operation:{...record.operation,failure:error instanceof WalletNetworkPolicyError&&error.reason==='unsupported-fees'?'fee-change':Object.hasOwn(known,message)?known[message]:'preparation-failed'}};
    }
    await commit(record,material);
    return {record,recovery:material};
  }
}
