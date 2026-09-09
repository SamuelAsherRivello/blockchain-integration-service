import { MnemonicIdentity, DefaultVtxo, VtxoScript, CSVMultisigTapscript, RestArkProvider, RestIndexerProvider, signAndSubmitOffchainTx, claimWithPreimageIdentity, Extension, createAssetPacket } from '@arkade-os/sdk';
import { hex } from '@scure/base';
import { SIGNET_OPERATOR, requireSignet, type AccountSecret } from './account.ts';
import { buildLtoScript } from './lto-script.ts';
import { inspectSendTransaction, assetTotals } from './sending.ts';
import { eligibleUnreservedCoins, walletReservations, type ReservedOperation } from '../core/wallet-reservations.ts';
import { ContractError, finishContractOperation, markContractSubmission, type ContractRecord } from '../core/contracts.ts';
import type { ContractRecovery, ContractSpend } from '../core/contract-storage.ts';

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
async function terms() {
  const ark = new RestArkProvider(SIGNET_OPERATOR), indexer = new RestIndexerProvider(SIGNET_OPERATOR);
  const info = await ark.getInfo(); requireSignet(info.network);
  if (info.fees.txFeeRate !== '0' || Object.values(info.fees.intentFee).some(value => value !== '' && value !== '0')) throw new ContractError('Contract fees changed. Creation and spending need fee verification.');
  return { ark, indexer, info, operatorKey: hex.decode(info.signerPubkey).slice(-32) };
}
export async function prepareLtoRecovery(game: AccountSecret, player: AccountSecret, suppliedPlayerKey?: Uint8Array): Promise<ContractRecovery> {
  const { info, operatorKey } = await terms();
  const gameKey = await MnemonicIdentity.fromMnemonic(game.phrase,{isMainnet:false}).xOnlyPublicKey();
  const playerKey = suppliedPlayerKey ?? await MnemonicIdentity.fromMnemonic(player.phrase,{isMainnet:false}).xOnlyPublicKey();
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const defaults = { serverPubKey: operatorKey, csvTimelock: { type: 'seconds' as const, value: info.unilateralExitDelay } };
  const contract = buildLtoScript({ gameKey, playerKey, operatorKey, secretHash: await sha(secret), exitDelay: info.unilateralExitDelay });
  return { secretHex: hex.encode(secret), playerKey: hex.encode(playerKey), gameKey: hex.encode(gameKey), operatorKey: hex.encode(operatorKey), exitDelay: String(info.unilateralExitDelay),
    gameScript: hex.encode(new DefaultVtxo.Script({ ...defaults, pubKey: gameKey }).encode()), playerScript: hex.encode(new DefaultVtxo.Script({ ...defaults, pubKey: playerKey }).encode()), contractScript: hex.encode(contract.script.encode()) };
}
export async function reconcileLtoSpend(record: ContractRecord, recovery: ContractRecovery): Promise<{ record: ContractRecord; recovery: ContractRecovery }> {
  const spend = recovery.spend;
  if (!spend || record.operation.submission === 'confirmed' || record.operation.submission === 'not-submitted') return { record, recovery };
  const indexer = new RestIndexerProvider(record.scope.operator);
  const [{ vtxos: receipts }, { vtxos: sources }] = await Promise.all([
    indexer.getVtxos({outpoints:[{txid:spend.transactionId,vout:0},...(spend.change?[{txid:spend.transactionId,vout:1}]:[])]}),
    indexer.getVtxos({outpoints:spend.inputs.map(input=>({txid:input.txid,vout:input.vout}))}),
  ]);
  if (!verifyLtoReceipt(spend, receipts, sources)) return { record, recovery };
  return { record: finishContractOperation(record, { operationId: spend.operationId, kind: record.operation.kind, outcome: 'confirmed' }),
    recovery: record.operation.kind === 'fund' ? { ...recovery, fundingOutput: { txid: spend.transactionId, vout: 0, value: record.amountSats } } : recovery };
}

/** Resume only the already signed, journaled transaction. Never create a competing spend. */
export async function resumeLtoFinalization(record: ContractRecord, recovery: ContractRecovery) {
  if(record.scope.operator!==SIGNET_OPERATOR||record.scope.network!=='signet'||!recovery.finalization||recovery.finalization.transactionId!==recovery.spend?.transactionId||!['submitted','unknown'].includes(record.operation.submission))return {record,recovery};
  try {await new RestArkProvider(SIGNET_OPERATOR).finalizeTx(recovery.finalization.transactionId,[...recovery.finalization.checkpoints]);}catch{/* Read exact receipts even if finalize acknowledgement is unavailable. */}
  return reconcileLtoSpend(record,recovery);
}

/** Caller owns contract and wallet locks. Commit persists recovery/reservations before network submission. */
export async function submitLtoSpend(initial: ContractRecord, recovery: ContractRecovery, account: AccountSecret,
  commit: (record: ContractRecord, recovery: ContractRecovery) => Promise<void>, isCurrent: () => boolean, suppliedIdentity?: import('@arkade-os/sdk').Identity): Promise<{ record: ContractRecord; recovery: ContractRecovery }> {
  let record = initial, material = recovery, providerCalled = false;
  const kind = record.operation.kind;
  try {
    if (record.scope.operator !== SIGNET_OPERATOR || record.scope.network !== 'signet' || record.operation.submission !== 'prepared') throw new ContractError('Contract submission is unavailable.');
    const { ark, indexer, info, operatorKey } = await terms();
    const identity = suppliedIdentity ?? MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false});
    if (hex.encode(operatorKey) !== material.operatorKey || hex.encode(await identity.xOnlyPublicKey()) !== (kind === 'claim' ? material.playerKey : material.gameKey)) throw new ContractError('Contract signing account changed.');
    const contract = buildLtoScript({ gameKey: hex.decode(material.gameKey), playerKey: hex.decode(material.playerKey), operatorKey, secretHash: await sha(hex.decode(material.secretHex)), exitDelay: BigInt(material.exitDelay) });
    if (hex.encode(contract.script.encode()) !== material.contractScript) throw new ContractError('Contract recovery script changed.');
    const gameScript = VtxoScript.decode(hex.decode(material.gameScript));
    const playerScript = VtxoScript.decode(hex.decode(material.playerScript));
    const minimum = Math.max(Number(info.vtxoMinAmount), 330);
    if (info.vtxoMaxAmount > 0n && BigInt(record.amountSats) > info.vtxoMaxAmount) throw new ContractError('Contract amount exceeds the operator limit.');
    let inputs;
    if (kind === 'fund') {
      const coins = (await indexer.getVtxos({scripts:[hex.encode(gameScript.pkScript)],spendableOnly:true})).vtxos;
      inputs = selectLtoInputs(coins.filter(coin => coin.script === hex.encode(gameScript.pkScript)), record.amountSats, minimum, walletReservations(account.profileId).filter(operation => operation.id !== `contract:${record.id}`));
    } else {
      if (!material.fundingOutput) throw new ContractError('Contract funding needs reconciliation.');
      const coins = (await indexer.getVtxos({outpoints:[material.fundingOutput]})).vtxos;
      inputs = coins.filter(coin => coin.txid === material.fundingOutput!.txid && coin.vout === material.fundingOutput!.vout && coin.value === record.amountSats && coin.script === hex.encode(contract.script.pkScript) && !coin.assets?.length && !coin.isSpent && !coin.isSwept && !coin.isUnrolled && !coin.spentBy);
      if (inputs.length !== 1) throw new ContractError('Contract spend needs reconciliation.');
    }
    const total = inputs.reduce((sum,coin) => sum + coin.value,0), change = total - record.amountSats, retained=assetTotals(inputs);
    const extension=retained.length?Extension.create([createAssetPacket(new Map(inputs.flatMap((coin,i)=>coin.assets?.length?[[i,coin.assets] as const]:[])),[{address:'',amount:record.amountSats}],{address:'',amount:change,assets:retained.map(a=>({assetId:a.assetId,amount:BigInt(a.amount)}))})]).txOut():undefined;
    const source = kind === 'fund' ? gameScript : contract.script;
    const leaf = kind === 'fund' ? source.leaves[0] : source.findLeaf(hex.encode(kind === 'claim' ? contract.claim : contract.refund));
    const destination = kind === 'fund' ? contract.script.pkScript : kind === 'claim' ? playerScript.pkScript : gameScript.pkScript;
    const quote = { id: record.operation.id, profileId: account.profileId, recipient: '', amountSats: record.amountSats, feeSats: 0, totalSats: record.amountSats, maxSats: total, expiresAt: record.expiresAt, fingerprint: '' };
    const provider = {
      submitTx: async (encoded: string, checkpoints: string[]) => {
        if (!isCurrent()) throw new ContractError('Contract account or session changed.');
        const transactionId = inspectSendTransaction(encoded, checkpoints, quote, inputs, hex.encode(destination), hex.encode(gameScript.pkScript));
        material = { ...material, spend: { operationId: record.operation.id, transactionId, inputs: inputs.map(coin=>({txid:coin.txid,vout:coin.vout,value:coin.value})), destinationScript: hex.encode(destination), amountSats: record.amountSats, ...(change ? {change:{script:hex.encode(gameScript.pkScript),value:change,...(retained.length?{assets:retained}:{})}} : {}) } };
        record = markContractSubmission(record, record.operation.id, Date.now());
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
    await signAndSubmitOffchainTx({ identity: kind === 'claim' ? claimWithPreimageIdentity(identity,hex.decode(material.secretHex)) : identity, provider,
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
      record={...record,operation:{...record.operation,failure:Object.hasOwn(known,message)?known[message]:'preparation-failed'}};
    }
    await commit(record,material);
    return {record,recovery:material};
  }
}
