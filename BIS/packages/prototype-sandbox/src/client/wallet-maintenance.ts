import { ArkAddress, Estimator, Transaction, getNetwork, type Wallet, type SettleParams } from '@arkade-os/sdk';
import { Address, OutScript } from '@scure/btc-signer';
import { hex } from '@scure/base';
import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import { maintenanceAssets, maintenanceJournal, maintenanceLock, maintenanceTxid, type MaintenanceRecord, type MaintenanceOutput } from './wallet-maintenance-state.ts';

const controls = new WeakMap<object, { scope: string; exclusive: <T>(work: () => Promise<T>) => Promise<T> }>();
const incomplete = () => new Error('A pending transaction is not resolved yet. Try Clean Wallet 2 again later.');
const status = async (wallet: Wallet) => (await wallet.walletRepository.getWalletState())?.settings?.hasPendingTx === true;

export async function walletMaintenanceScope(network: TestNetwork, descriptor: string) {
  if (!['signet', 'mutinynet'].includes(network) || !descriptor) throw new Error('Wallet identity could not be verified.');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${network}\0${descriptor}`));
  return hex.encode(new Uint8Array(bytes));
}

function output(address: string, amount: number | bigint, network: TestNetwork): MaintenanceOutput {
  try { return { script: hex.encode(ArkAddress.decode(address).pkScript), amount: String(amount), offchain: true }; }
  catch { return { script: hex.encode(OutScript.encode(Address(getNetwork(network)).decode(address))), amount: String(amount), offchain: false }; }
}

/** Verify a particular settlement, never infer completion from a balance delta. */
export async function reconcileMaintenanceRecord(wallet: Wallet, record: MaintenanceRecord): Promise<boolean> {
  if (record.state !== 'pending') return true;
  const virtual = record.inputs.filter(c => c.virtual);
  const rows = virtual.length ? (await wallet.indexerProvider.getVtxos({ outpoints: virtual.map(({ txid, vout }) => ({ txid, vout })) })).vtxos : [];
  const exact = virtual.map(c => rows.find(v => v.txid === c.txid && v.vout === c.vout));
  const candidates = new Set(exact.map(c => c?.settledBy).filter(maintenanceTxid));
  const txid = record.commitmentTxid ?? (exact.length === record.inputs.length && exact.every(c => c?.isSpent) && candidates.size === 1 ? [...candidates][0] : undefined);
  if (!txid || exact.some(c => !c?.isSpent || c.settledBy !== txid)) return false;
  const commitment = Transaction.fromRaw(await wallet.onchainProvider.getRawTransaction(txid), { allowUnknownInputs: true, allowUnknownOutputs: true });
  if (commitment.id !== txid) return false;
  for (const input of record.inputs.filter(c => !c.virtual)) {
    if (!Array.from({ length: commitment.inputsLength }, (_, i) => commitment.getInput(i)).some(c => c.txid && hex.encode(c.txid) === input.txid && c.index === input.vout)) return false;
  }
  const onchain = record.outputs.filter(o => !o.offchain);
  const used = new Set<number>();
  for (const expected of onchain) {
    const index = Array.from({ length: commitment.outputsLength }, (_, i) => i).find(i => !used.has(i) && hex.encode(commitment.getOutput(i).script!) === expected.script && String(commitment.getOutput(i).amount) === expected.amount);
    if (index === undefined) return false;
    used.add(index);
  }
  const offchain = record.outputs.filter(o => o.offchain);
  const receipts = offchain.length ? (await wallet.indexerProvider.getVtxos({ scripts: [...new Set(offchain.map(o => o.script))] })).vtxos.filter(c => c.commitmentTxIds?.includes(txid)) : [];
  const selected: typeof receipts = [];
  for (const expected of offchain) {
    const receipt = receipts.find(c => !selected.includes(c) && c.script === expected.script && String(c.value) === expected.amount);
    if (!receipt) return false;
    selected.push(receipt);
  }
  if (JSON.stringify(maintenanceAssets(selected as any)) !== JSON.stringify(maintenanceAssets(record.inputs))) return false;
  record.commitmentTxid = txid;
  record.state = 'settled';
  return true;
}

/** Adds evidence and serialization; normal demo operations still call the SDK directly. */
export async function installWalletMaintenance(wallet: Wallet, network: TestNetwork, descriptor: string) {
  if (controls.has(wallet)) return;
  const scope = await walletMaintenanceScope(network, descriptor);
  let owned = false;
  let active: MaintenanceRecord | undefined;
  let matchingFailure = false;
  let registrationReady: Promise<void> = Promise.resolve();
  let releaseRegistration = () => {};
  let recovering = false;
  const journal = () => maintenanceJournal(scope);
  const exclusive = async <T>(work: () => Promise<T>) => {
    return maintenanceLock(scope, async () => {
      owned = true;
      try { return await work(); } finally { owned = false; }
    });
  };
  controls.set(wallet, { scope, exclusive });
  const provider = wallet.arkProvider;
  if (provider?.registerIntent) {
    const register = provider.registerIntent.bind(provider);
    provider.registerIntent = async intent => {
      if (active) { active.attempted = true; journal().save(active); }
      const id = await register(intent);
      if (active) {
        active.intentHash = hex.encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id))));
        journal().save(active);
        releaseRegistration();
      }
      return id;
    };
  }
  if (provider?.getEventStream) {
    const open = provider.getEventStream.bind(provider);
    provider.getEventStream = (signal, topics) => {
      const record = active;
      const ready = registrationReady;
      return (async function* () {
        for await (const event of open(signal, topics)) {
          if (!record) { yield event; continue; }
          await ready;
          if (signal?.aborted) return;
          if (event.type === 'batch_started' && record.intentHash && event.intentIdHashes.includes(record.intentHash)) {
            record.batchId = event.id;
            journal().save(record);
          }
          // SDK Batch.join does not correlate failures/finalization by batch ID.
          if (!record.batchId || event.id !== record.batchId) continue;
          if (event.type === 'batch_failed') matchingFailure = true;
          yield event;
        }
      })();
    };
  }
  if (provider?.deleteIntent) {
    const remove = provider.deleteIntent.bind(provider);
    provider.deleteIntent = async intent => {
      try {
        const result = await remove(intent);
        if (active && matchingFailure) { active.state = 'failed'; journal().save(active); }
        return result;
      } catch (error) {
        // Failed batches can already have removed their selected intent. Only
        // that exact terminal batch plus this specific operator response closes
        // the record; generic errors and missing acknowledgements stay pending.
        if (active && matchingFailure && error instanceof Error && error.name === 'INVALID_INTENT_PROOF' && /no matching intents found for intent proof/.test(error.message)) {
          active.state = 'failed'; journal().save(active);
        }
        throw error;
      }
    };
  }
  const wrap = (object: any, method: string) => {
    if (typeof object?.[method] !== 'function') return;
    const original = object[method].bind(object);
    object[method] = (...args: any[]) => {
      // SDK sendBitcoin delegates this case directly to send, which owns its lock.
      if (method === 'sendBitcoin' && !args[0]?.selectedVtxos) return wallet.send({ address: args[0]?.address, amount: args[0]?.amount });
      const operation = async () => {
      if (journal().pending().length) throw incomplete();
      if (method !== 'settle') return original(...args);
      const params: SettleParams = args[0];
      if (!params?.inputs?.length || !params.outputs?.length) throw new Error('Explicit settlement inputs and outputs are required.');
      const record: MaintenanceRecord = {
        id: crypto.randomUUID(), createdAt: Date.now(), state: 'pending', attempted: false,
        inputs: params.inputs.map(c => ({ txid: c.txid, vout: c.vout, value: c.value, virtual: 'script' in c && typeof c.script === 'string', assets: ((c as { assets?: { assetId: string; amount: bigint }[] }).assets ?? []).map(a => ({ assetId: a.assetId, amount: String(a.amount) })) })),
        outputs: params.outputs.map(o => output(o.address, o.amount, network)),
      };
      // The SDK computed recovery fees. Recheck exact terms before signing/registering.
      if (recovering) await verifyRecoveryTerms(wallet, params);
      journal().save(record);
      active = record;
      matchingFailure = false;
      registrationReady = new Promise(resolve => { releaseRegistration = resolve; });
      try {
        const txid = await original(...args);
        if (maintenanceTxid(txid)) record.commitmentTxid = txid;
        journal().save(record);
        if (await reconcileMaintenanceRecord(wallet, record)) journal().save(record);
        return txid;
      } catch (error) {
        if (!record.attempted) record.state = 'not-submitted';
        journal().save(record);
        throw error;
      } finally { releaseRegistration(); active = undefined; }
      };
      // Only the private cleanup instance may reuse its lock for SDK recovery.
      return method === 'settle' && recovering && owned ? operation() : exclusive(operation);
    };
  };
  for (const method of ['send', 'sendBitcoin', 'settle']) wrap(wallet, method);
  if (wallet.assetManager) for (const method of ['issue', 'reissue', 'burn']) wrap(wallet.assetManager, method);
  // The closure scopes fee validation to maintenance; other demo behavior is unchanged.
  recoveryModes.set(wallet, value => { recovering = value; });
}

const recoveryModes = new WeakMap<object, (value: boolean) => void>();

async function verifyRecoveryTerms(wallet: Wallet, params: SettleParams) {
  const contracts = await (await wallet.getContractManager()).getContracts();
  const ordinaryScripts = new Set(contracts.filter(c => c.type === 'default').map(c => c.script));
  const info = await wallet.arkProvider.getInfo();
  const estimator = new Estimator(info.fees.intentFee);
  let net = 0n;
  for (const input of params.inputs) {
    if (!('script' in input) || typeof input.script !== 'string') throw new Error('Unexpected recovery input.');
    if (!ordinaryScripts.has(input.script)) throw new Error('Recovery excludes contract outputs.');
    const coin: any = input;
    const expiry = coin.expiresAt instanceof Date ? coin.expiresAt : undefined;
    const fee = estimator.evalOffchainInput({ amount: BigInt(coin.value), type: coin.isSwept ? 'recoverable' : 'vtxo', weight: 0, birth: coin.createdAt, expiry }).satoshis;
    net += BigInt(coin.value) - BigInt(fee);
  }
  const address = await wallet.getAddress();
  if (params.outputs.length !== 1 || params.outputs[0].address !== address) throw new Error('Recovery must return funds to this wallet.');
  const script = hex.encode(ArkAddress.decode(address).pkScript);
  const fee = estimator.evalOffchainOutput({ amount: net, script }).satoshis;
  if (net - BigInt(fee) !== BigInt(params.outputs[0].amount)) throw new Error('Recovery fees changed. Try again.');
}

/** Core routine is injectable for deterministic policy tests; production uses real SDK wallets. */
export async function cleanManagedWallet(wallet: Wallet, scope: string, progress: (message: string) => void = () => {}) {
  const journal = maintenanceJournal(scope);
  progress('Refreshing wallet...');
  await wallet.restore({ gapLimit: 20 });
  const manager = await wallet.getContractManager();
  await manager.refreshVtxos();
  progress('Finishing pending transactions...');
  const resumed = await wallet.finalizePendingTxs();
  if (resumed.pending.some(id => !resumed.finalized.includes(id)) || await status(wallet)) throw incomplete();
  let changed = resumed.finalized.length > 0;
  for (const record of journal.pending()) {
    if (!await reconcileMaintenanceRecord(wallet, record)) throw incomplete();
    journal.save(record);
    changed = true;
  }
  await manager.refreshVtxos();
  const recovery = await wallet.getVtxoManager();
  const available = await recovery.getRecoverableBalance();
  if (available.recoverable > 0 || available.subdust > 0) {
    progress('Recovering funds...');
    recoveryModes.get(wallet)?.(true);
    try { await recovery.recoverVtxos(); }
    finally { recoveryModes.get(wallet)?.(false); }
    changed = true;
  }
  progress('Verifying wallet...');
  await manager.refreshVtxos();
  for (const record of journal.pending()) {
    if (!await reconcileMaintenanceRecord(wallet, record)) throw incomplete();
    journal.save(record);
  }
  if (await status(wallet)) throw incomplete();
  return changed ? 'Wallet cleaned.' : 'Nothing to clean.';
}

export async function cleanWallet2(network: TestNetwork, mnemonic: string, progress: (message: string) => void = () => {}) {
  if (!mnemonic.trim()) throw new Error('Submit Wallet 2 Mnemonic first.');
  // Imported only on activation: avoid a factory/support-module initialization cycle.
  const { demoCreateWallet } = await import('./demo-wallet.ts');
  let wallet: Wallet | undefined;
  try {
    progress('Opening wallet...');
    wallet = await demoCreateWallet(network, { mnemonic, refresh: false });
    const control = controls.get(wallet);
    if (!control) throw new Error('Wallet cleanup could not start.');
    return await control.exclusive(() => cleanManagedWallet(wallet!, control.scope, progress));
  } catch (error) {
    // SDK exceptions may contain request data. Only fixed maintenance messages reach Setup.
    if (error instanceof Error && /^(A pending transaction|Wallet is busy|This browser cannot|Wallet cleanup|Recovery fees|Submit Wallet 2)/.test(error.message)) throw error;
    throw new Error('Wallet cleanup could not finish. Check the mnemonic and connection, then try again.');
  } finally { await wallet?.dispose().catch(() => {}); }
}
