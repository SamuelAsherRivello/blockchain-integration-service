import { ArkAddress, CSVMultisigTapscript, VtxoScript, Extension, createAssetPacket, claimWithPreimageIdentity,
  signAndSubmitOffchainTx, type ExtendedVirtualCoin, type VirtualCoin, type Wallet } from '@arkade-os/sdk';
import { hex } from '@scure/base';
// These are pure SDK compiler/transaction checks, not a BIS Account or service.
import { buildLtoScript } from '../../../integration/src/client/wallet-layer-arkade/lto-script.ts';
import { inspectTreasureDirectPolicy } from '../../../integration/src/client/wallet-layer-arkade/treasure-direct-policy.ts';
import { assetTotals, inspectSendTransaction } from '../../../integration/src/client/wallet-layer-arkade/sending.ts';
import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import { maintenanceJournal, maintenanceLock, type MaintenanceRecord } from './wallet-maintenance-state.ts';
import { managedWalletScope } from './wallet-maintenance.ts';
import { treasureSdkStorage, type TreasureStorage } from './treasure-sdk-storage.ts';

type Point = { txid: string; vout: number; value: number; script: string; assets?: { assetId: string; amount: string }[] };
type Spend = { id: string; kind: 'fund' | 'claim' | 'reject' | 'refund'; state: 'prepared' | 'submitting' | 'unknown' | 'confirmed' | 'not-submitted';
  inputs: Point[]; destination: string; change: string; transactionId?: string; arkTx?: string; checkpoints?: string[];
  finalization?: string[]; resumes?: number };
export type TreasureSdkRecord = { version: 1; id: string; network: TestNetwork; owner: string; operator: string; exitDelay: string;
  startedAt: number; expiresAt: number; secret: string; script: string; destination: string; spends: Spend[] };
export type TreasureSdkResult = { status: 'not-submitted' | 'pending' | 'claimable' | 'expired' | 'claimed' | 'refunded' | 'unknown' | 'unavailable';
  message: string; contractId?: string; contractAddress?: string; expiresAt?: number; transactionId?: string; verified: boolean };
type ReservationWriter = (record: TreasureSdkRecord, spend: Spend) => void | Promise<void>;
const digest = async (value: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(value)));
const validHex = (value: unknown, length: number) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
const point = (coin: VirtualCoin): Point => ({ txid: coin.txid, vout: coin.vout, value: coin.value, script: coin.script,
  ...(coin.assets?.length ? { assets: coin.assets.map(a => ({ assetId: a.assetId, amount: String(a.amount) })) } : {}) });
const asCoins = (coins: Point[]) => coins.map(c => ({ ...c, assets: c.assets?.map(a => ({ assetId: a.assetId, amount: BigInt(a.amount) })) }));

/** Real hashlock and refund leaves, including real unilateral CSV exits.
 * The 90-second eligibility is browser policy, not a covenant upper bound.
 * The same supplied Sandbox wallet may occupy both roles. */
export async function compileTreasureSdk(record: Pick<TreasureSdkRecord, 'owner' | 'operator' | 'secret' | 'exitDelay'>) {
  if (![record.owner, record.operator, record.secret].every(v => validHex(v, 64)) || record.owner === record.operator || !/^[1-9][0-9]{0,12}$/.test(record.exitDelay)) throw Error('Treasure contract terms are invalid.');
  const owner = hex.decode(record.owner), operator = hex.decode(record.operator);
  return buildLtoScript({ playerKey: owner, gameKey: owner, operatorKey: operator,
    secretHash: await digest(hex.decode(record.secret)), exitDelay: BigInt(record.exitDelay), prototypeSameWallet: true });
}

export async function validateTreasureSdkRecord(record: TreasureSdkRecord, network: TestNetwork, owner: string) {
  if (!record || record.version !== 1 || record.network !== network || record.owner !== owner || !/^[a-zA-Z0-9-]{1,100}$/.test(record.id) ||
    !Number.isSafeInteger(record.startedAt) || record.startedAt < 0 || record.expiresAt !== (Math.floor(record.startedAt / 1000) + 90) * 1000 ||
    !Array.isArray(record.spends) || record.spends.length < 1 || record.spends.length > 100 || !/^(?:[a-f0-9]{2}){1,10000}$/.test(record.destination)) throw Error('Treasure recovery terms could not be verified.');
  const built = await compileTreasureSdk(record);
  if (hex.encode(built.script.encode()) !== record.script) throw Error('Treasure recovery script changed.');
  const ids = new Set<string>();
  for (const [index, spend] of record.spends.entries()) {
    if (!spend || ids.has(spend.id) || !/^[a-zA-Z0-9-]{1,100}$/.test(spend.id) || !['fund', 'claim', 'reject', 'refund'].includes(spend.kind) ||
      (index === 0) !== (spend.kind === 'fund') || !['prepared', 'submitting', 'unknown', 'confirmed', 'not-submitted'].includes(spend.state) ||
      !Array.isArray(spend.inputs) || spend.inputs.length > 100 || !spend.inputs.every(c => validHex(c.txid, 64) && Number.isSafeInteger(c.vout) && c.vout >= 0 && c.vout <= 0xffffffff && Number.isSafeInteger(c.value) && c.value > 0 && /^(?:[a-f0-9]{2}){1,10000}$/.test(c.script)) ||
      new Set(spend.inputs.map(c => `${c.txid}:${c.vout}`)).size !== spend.inputs.length ||
      spend.destination !== hex.encode(index === 0 ? built.script.pkScript : hex.decode(record.destination)) || spend.change !== record.destination) throw Error('Treasure operation recovery is invalid.');
    ids.add(spend.id);
    if (spend.state === 'prepared' && (spend.transactionId || spend.arkTx || spend.checkpoints || spend.finalization || spend.resumes)) throw Error('Prepared Treasure operation has unexpected submission data.');
    if (spend.state !== 'prepared' && spend.state !== 'not-submitted' && (!spend.inputs.length || !validHex(spend.transactionId, 64) || !spend.arkTx || !spend.checkpoints?.length)) throw Error('Original Treasure transaction is missing.');
    if (spend.arkTx) verifyTreasureSdkSpend(spend, spend.arkTx, spend.checkpoints ?? []);
    if (spend.finalization) verifyTreasureSdkSpend(spend, spend.arkTx!, spend.finalization);
    if (index > 0 && spend.inputs.length && (spend.inputs.length !== 1 || spend.inputs[0].txid !== record.spends[0].transactionId || spend.inputs[0].vout !== 0 || spend.inputs[0].value !== 1000 || spend.inputs[0].script !== hex.encode(built.script.pkScript))) throw Error('Treasure spend does not target its original funding.');
  }
  return built;
}

export function verifyTreasureSdkSpend(spend: Spend, arkTx: string, checkpoints: string[]) {
  const coins = asCoins(spend.inputs), total = coins.reduce((sum, c) => sum + c.value, 0);
  const transactionId = inspectSendTransaction(arkTx, checkpoints, { id: spend.id, profileId: '', recipient: '', amountSats: 1000,
    feeSats: 0, totalSats: 1000, maxSats: total, expiresAt: 0, fingerprint: '' }, coins, spend.destination, spend.change);
  if (spend.transactionId && transactionId !== spend.transactionId) throw Error('Original Treasure transaction changed.');
  return transactionId;
}

/** Public reservation only. Recovery secrets and signed requests remain in the
 * encrypted store. Other Sandbox demos honor this existing wallet guard. */
export function treasureSdkReservation(record: TreasureSdkRecord, spend: Spend): MaintenanceRecord | undefined {
  if (!spend.inputs.length) return;
  const total = spend.inputs.reduce((sum, input) => sum + input.value, 0);
  return { id: `treasure-${spend.id}`, createdAt: record.startedAt,
    state: spend.state === 'confirmed' ? 'settled' : spend.state === 'not-submitted' ? 'not-submitted' : 'pending',
    attempted: ['submitting', 'unknown', 'confirmed'].includes(spend.state),
    inputs: spend.inputs.map(({ script: _script, ...input }) => ({ ...input, virtual: true, assets: input.assets ?? [] })),
    outputs: [{ script: spend.destination, amount: '1000', offchain: true },
      ...(total > 1000 ? [{ script: spend.change, amount: String(total - 1000), offchain: true }] : [])] };
}

/** Receipts must include the exact consumed sources and expected outputs. */
export async function treasureSdkReceipt(wallet: Pick<Wallet, 'indexerProvider'>, spend: Spend) {
  if (!spend.transactionId || !spend.inputs.length) return false;
  const total = spend.inputs.reduce((sum, c) => sum + c.value, 0), change = total - 1000;
  const { vtxos } = await wallet.indexerProvider.getVtxos({ outpoints: [...spend.inputs.map(({ txid, vout }) => ({ txid, vout })),
    { txid: spend.transactionId, vout: 0 }, ...(change ? [{ txid: spend.transactionId, vout: 1 }] : [])] });
  if (!spend.inputs.every(input => vtxos.some(c => c.txid === input.txid && c.vout === input.vout && c.value === input.value && c.script === input.script && c.isSpent && c.arkTxId === spend.transactionId))) return false;
  const exact = (vout: number, value: number, script: string) => vtxos.find(c => c.txid === spend.transactionId && c.vout === vout && c.value === value && c.script === script);
  const output = exact(0, 1000, spend.destination), retained = assetTotals(asCoins(spend.inputs));
  if (!output || output.assets?.length) return false;
  const changeOutput = change ? exact(1, change, spend.change) : undefined;
  if (change && !changeOutput) return false;
  return JSON.stringify(assetTotals(changeOutput ? [changeOutput] : [])) === JSON.stringify(retained);
}

function summary(record: TreasureSdkRecord): TreasureSdkResult {
  const first = record.spends[0], last = record.spends.at(-1)!;
  const status = last.state === 'not-submitted' ? (last.kind === 'fund' ? 'not-submitted' : Date.now() >= record.expiresAt ? 'expired' : 'claimable')
    : last.state !== 'confirmed' ? (last.state === 'prepared' ? 'pending' : 'unknown')
      : last.kind === 'claim' ? 'claimed' : last.kind === 'reject' || last.kind === 'refund' ? 'refunded' : Date.now() >= record.expiresAt ? 'expired' : 'claimable';
  const messages = { 'not-submitted': 'The offer was not submitted.', pending: 'Preparation is retained; check the original operation.',
    unknown: 'The original transaction remains unresolved. No replacement was submitted.', claimable: 'The real contract is funded. Claim or Reject before the original deadline.',
    expired: 'The original deadline passed. Execute Reject to return the contract funds.', claimed: 'The exact contract claim is verified.', refunded: 'The exact contract refund is verified.' };
  return { status, message: messages[status], contractId: record.id, expiresAt: record.expiresAt,
    contractAddress: VtxoScript.decode(hex.decode(record.script)).address('tark', hex.decode(record.operator)).encode(),
    ...(last.state === 'confirmed' && last.transactionId ? { transactionId: last.transactionId } : {}),
    verified: last.state === 'confirmed' || last.state === 'not-submitted' && first.state === 'confirmed' };
}

/** The caller owns the shared wallet lock. All writes are journaled before
 * dispatch; Check never submits or finalizes a transaction. */
export async function executeTreasureSdk(wallet: Wallet, network: TestNetwork, action: 'start' | 'check' | 'claim' | 'reject',
  storage: TreasureStorage<TreasureSdkRecord>, reserve?: ReservationWriter) : Promise<TreasureSdkResult> {
  const owner = hex.encode(await wallet.identity.xOnlyPublicKey()), info = await wallet.arkProvider.getInfo();
  if (info.network !== network || !/^0[23][a-f0-9]{64}$/.test(info.signerPubkey)) throw Error('Treasure operator identity or network is invalid.');
  let writePolicyAvailable = true;
  try { inspectTreasureDirectPolicy(network, info); } catch { writePolicyAvailable = false; }
  const operator = hex.encode(hex.decode(info.signerPubkey).slice(-32));
  const saved = await storage.load(); let revision = saved.revision; const records = saved.records;
  const persist = async () => {
    revision = await storage.save(records, revision);
    const record = records.at(-1); if (record) await reserve?.(record, record.spends.at(-1)!);
  };
  for (const record of records) await validateTreasureSdkRecord(record, network, owner);
  if (records.slice(0, -1).some(record => {
    const last = record.spends.at(-1)!;
    return last.kind === 'fund' ? last.state !== 'not-submitted' : last.state !== 'confirmed';
  })) throw Error('An earlier Treasure contract remains unresolved. Preserve its recovery.');
  for (const record of records) for (const spend of record.spends) await reserve?.(record, spend);
  let current = records.at(-1);
  let recoveredPreparation = false;
  if (current) {
    const last = current.spends.at(-1)!;
    // Submission is always journaled before the provider is called. Under the
    // wallet lock, an intact prepared record therefore cannot have been sent.
    if (last.state === 'prepared') { last.state = 'not-submitted'; await persist(); recoveredPreparation = true; }
    const observed = last.state === 'not-submitted' && current.spends[0].state === 'confirmed' ? current.spends[0] : last;
    if (observed.transactionId && observed.state !== 'not-submitted') {
      if (await treasureSdkReceipt(wallet, observed)) { if (observed.state !== 'confirmed') { observed.state = 'confirmed'; await persist(); } }
      else if (observed.state === 'confirmed') return { ...summary(current), status: 'unknown', verified: false, transactionId: undefined, message: 'Current operator evidence does not verify the original receipt. No financial action was submitted.' };
    }
    if (current.spends[0].state === 'confirmed' && (last.kind === 'fund' || last.state === 'not-submitted')) {
      const fund = current.spends[0], built = await compileTreasureSdk(current);
      const { vtxos } = await wallet.indexerProvider.getVtxos({ outpoints: [{ txid: fund.transactionId!, vout: 0 }] });
      if (!vtxos.some(c => c.txid === fund.transactionId && c.vout === 0 && c.value === 1000 && c.script === hex.encode(built.script.pkScript) && !c.isSpent && !c.spentBy && !c.isSwept && !c.isUnrolled && !c.assets?.length))
        return { ...summary(current), status: 'unknown', verified: false, transactionId: undefined, message: 'The original contract output is no longer verified as spendable. Preserve its recovery.' };
    }
  }
  if (action === 'check') {
    const result: TreasureSdkResult = current ? summary(current) : { status: 'unknown', message: 'No Treasure recovery record exists for this wallet and network. Contract state cannot be determined without the original record.', verified: false };
    if (!writePolicyAvailable && ['claimable', 'expired'].includes(result.status)) return { ...result, status: 'unavailable', message: 'The original funding is verified, but current transaction policy does not permit this zero-fee Treasure spend. Recovery is retained.' };
    return result;
  }
  // Recovering preparation is not permission to start a new operation in the
  // same click. The user can inspect the result before explicitly trying again.
  if (recoveredPreparation && current) return summary(current);
  if (current && !['confirmed', 'not-submitted'].includes(current.spends.at(-1)!.state)) {
    const last = current.spends.at(-1)!;
    const sameAction = action === 'start' ? last.kind === 'fund' : action === 'claim' ? last.kind === 'claim' : ['reject', 'refund'].includes(last.kind);
    if (sameAction && last.finalization && !last.resumes) {
      if (current.operator !== operator) return { ...summary(current), status: 'unknown', verified: false, message: 'The original operator changed. Preserve the exact signed recovery.' };
      last.resumes = 1; await persist();
      // Only exact already-signed finalization, once after fresh receipt lookup.
      try { await wallet.arkProvider.finalizeTx(last.transactionId!, [...last.finalization]); } catch { /* Preserve uncertainty. */ }
      if (await treasureSdkReceipt(wallet, last)) { last.state = 'confirmed'; await persist(); }
    }
    return summary(current);
  }
  if (!writePolicyAvailable) return { ...(current ? summary(current) : {}), status: 'unavailable', message: 'Current transaction policy does not support the required zero-fee 1000-sat Treasure flow. No new transaction was submitted.', verified: false };
  if (action === 'start') {
    if (current && (current.spends.at(-1)!.kind === 'fund' && current.spends[0].state !== 'not-submitted' ||
      current.spends.at(-1)!.state === 'not-submitted' && current.spends[0].state === 'confirmed')) return summary(current);
    const startedAt = Date.now(), destination = hex.encode(ArkAddress.decode(await wallet.getAddress()).pkScript);
    current = { version: 1, id: crypto.randomUUID(), network, owner, operator, exitDelay: String(info.unilateralExitDelay),
      startedAt, expiresAt: (Math.floor(startedAt / 1000) + 90) * 1000, secret: hex.encode(crypto.getRandomValues(new Uint8Array(32))), script: '', destination, spends: [] };
    const built = await compileTreasureSdk(current); current.script = hex.encode(built.script.encode());
    current.spends.push({ id: crypto.randomUUID(), kind: 'fund', state: 'prepared', inputs: [], destination: hex.encode(built.script.pkScript), change: destination });
    records.push(current); await persist();
  } else {
    if (!current || current.spends[0].state !== 'confirmed' || ['claim', 'reject', 'refund'].includes(current.spends.at(-1)!.kind) && current.spends.at(-1)!.state === 'confirmed')
      return current ? summary(current) : { status: 'unknown', message: 'No Treasure recovery record exists for this wallet and network. Contract state cannot be determined without the original record.', verified: false };
    if (action === 'claim' && Date.now() >= current.expiresAt) return summary(current);
    if (current.operator !== operator) throw Error('The original Treasure operator changed. Preserve recovery.');
    current.spends.push({ id: crypto.randomUUID(), kind: action === 'claim' ? 'claim' : Date.now() >= current.expiresAt ? 'refund' : 'reject', state: 'prepared',
      inputs: [], destination: current.destination, change: current.destination }); await persist();
  }
  const record = current!, spend = record.spends.at(-1)!, compiled = await validateTreasureSdkRecord(record, network, owner);
  let attempted = false;
  const submit = wallet.arkProvider.submitTx.bind(wallet.arkProvider), finalize = wallet.arkProvider.finalizeTx.bind(wallet.arkProvider);
  try {
    const minimum = Math.max(330, Number(info.vtxoMinAmount));
    let inputs: VirtualCoin[], fundingInputs: ExtendedVirtualCoin[] | undefined;
    if (spend.kind === 'fund') {
      const available = (await wallet.getSpendableVtxos({ withRecoverable: false, withUnrolled: false }))
        .filter(c => !c.isSpent && !c.spentBy && !c.isSwept && !c.isUnrolled).sort((a, b) => Number(!!a.assets?.length) - Number(!!b.assets?.length) || a.value - b.value);
      fundingInputs = []; let total = 0;
      for (const coin of available) { fundingInputs.push(coin); total += coin.value; if (fundingInputs.length >= 100 || total === 1000 && !assetTotals(fundingInputs).length || total >= 1000 + minimum) break; }
      inputs = fundingInputs;
      if (total < 1000 || total !== 1000 && total < 1000 + minimum || assetTotals(inputs).length && total === 1000) throw Error('Treasure needs 1000 eligible sats and sufficient asset-preserving change.');
    } else {
      const fund = record.spends[0];
      const { vtxos } = await wallet.indexerProvider.getVtxos({ outpoints: [{ txid: fund.transactionId!, vout: 0 }] });
      inputs = vtxos.filter(c => c.txid === fund.transactionId && c.vout === 0 && c.value === 1000 && c.script === hex.encode(compiled.script.pkScript) && !c.assets?.length && !c.isSpent && !c.spentBy && !c.isSwept && !c.isUnrolled);
      if (inputs.length !== 1) throw Error('The original Treasure output needs reconciliation.');
    }
    spend.inputs = inputs.map(point); await persist();
    const total = inputs.reduce((sum, c) => sum + c.value, 0), change = total - 1000, retained = assetTotals(inputs);
    const outputs = [{ script: hex.decode(spend.destination), amount: 1000n }, ...(change ? [{ script: hex.decode(record.destination), amount: BigInt(change) }] : []),
      ...(retained.length ? [Extension.create([createAssetPacket(new Map(inputs.flatMap((c, i) => c.assets?.length ? [[i, c.assets] as const] : [])),
        [{ address: '', amount: 1000 }], { address: '', amount: change, assets: retained.map(a => ({ assetId: a.assetId, amount: BigInt(a.amount) })) })]).txOut()] : [])];
    wallet.arkProvider.submitTx = async (encoded, checkpoints) => {
      if (attempted) throw Error('Duplicate Treasure submission refused.');
      if (spend.kind === 'claim' && Date.now() >= record.expiresAt) throw Error('The original Treasure deadline passed.');
      spend.transactionId = verifyTreasureSdkSpend(spend, encoded, checkpoints);
      spend.arkTx = encoded; spend.checkpoints = [...checkpoints]; spend.state = 'submitting'; await persist();
      attempted = true; return submit(encoded, checkpoints);
    };
    wallet.arkProvider.finalizeTx = async (id, checkpoints) => {
      if (!attempted || id !== spend.transactionId) throw Error('Treasure finalization does not match its original transaction.');
      verifyTreasureSdkSpend(spend, spend.arkTx!, checkpoints);
      spend.finalization = [...checkpoints]; await persist(); return finalize(id, checkpoints);
    };
    if (spend.kind === 'fund') await wallet.buildAndSubmitOffchainTx(fundingInputs!, outputs);
    else await signAndSubmitOffchainTx({ identity: spend.kind === 'claim' ? claimWithPreimageIdentity(wallet.identity, hex.decode(record.secret)) : wallet.identity,
      provider: wallet.arkProvider, inputs: inputs.map(c => ({ txid: c.txid, vout: c.vout, value: c.value,
        tapLeafScript: compiled.script.findLeaf(hex.encode(spend.kind === 'claim' ? compiled.claim : compiled.refund)), tapTree: compiled.script.encode() })),
      outputs, serverUnrollScript: CSVMultisigTapscript.decode(hex.decode(info.checkpointTapscript)), verifyServerSignatures: { serverPubkey: hex.decode(record.operator) } });
    spend.state = await treasureSdkReceipt(wallet, spend) ? 'confirmed' : 'unknown'; await persist();
  } catch {
    spend.state = attempted ? 'unknown' : 'not-submitted'; await persist();
  } finally { wallet.arkProvider.submitTx = submit; wallet.arkProvider.finalizeTx = finalize; }
  return summary(record);
}

export async function demoTreasureSdkAction(wallet: Wallet, network: TestNetwork, action: 'start' | 'check' | 'claim' | 'reject') {
  const scope = managedWalletScope(wallet);
  return maintenanceLock(scope, async () => {
    const journal = maintenanceJournal(scope);
    if (action !== 'check' && journal.pending().some(row => !row.id.startsWith('treasure-'))) throw Error('A previous wallet transaction needs reconciliation. No Treasure action was submitted.');
    return executeTreasureSdk(wallet, network, action, treasureSdkStorage<TreasureSdkRecord>(scope), (record, spend) => {
      const reservation = treasureSdkReservation(record, spend);
      if (reservation) journal.save(reservation);
    });
  });
}
