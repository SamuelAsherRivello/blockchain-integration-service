import { MnemonicIdentity, Wallet, ReadonlyWallet, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository, type AssetDetails } from '@arkade-os/sdk';
import { requireSignet, SIGNET_OPERATOR, withTemporaryWallet, type AccountSecret } from './account.ts';
import { AssetError, checkMintRecord, writeAssetRecord, assetBaseUnits, type BisAsset, type BisMintAssetRequest, type BisMintAssetResult } from '../core/assets.ts';
import { BurnError, readBurnRecord, writeBurnRecord, validateBurn, assertNoPendingBurn, type BisBurnAssetRequest, type BisBurnAssetResult } from '../core/burning.ts';

type OwnedAsset = { asset: BisAsset; operationId?: string };
type AssetWallet = Pick<ReadonlyWallet, 'getBalance' | 'getProviderConnectionState' | 'assetManager'>;
export async function readFreshAssets(wallet: AssetWallet): Promise<OwnedAsset[]> {
  const balance = await wallet.getBalance();
  const connection = wallet.getProviderConnectionState();
  if (connection.mode !== 'online' || connection.source !== 'live' || !Array.isArray(balance.assets)) throw new AssetError('unavailable');
  const owned: OwnedAsset[] = [];
  for (const holding of balance.assets) {
    if (typeof holding.amount !== 'bigint' || holding.amount < 0n) throw new AssetError('unavailable');
    if (holding.amount === 0n) continue;
    const details: AssetDetails = await wallet.assetManager.getAssetDetails(holding.assetId);
    if (details.assetId !== holding.assetId) throw new AssetError('unavailable');
    const m = details.metadata;
    const asset: BisAsset = { assetId: holding.assetId, quantity: holding.amount.toString(),
      ...(typeof m?.name === 'string' ? { name: m.name } : {}),
      ...(typeof m?.ticker === 'string' ? { ticker: m.ticker } : {}),
      ...(typeof m?.icon === 'string' ? { iconUrl: m.icon } : {}),
      ...(Number.isInteger(m?.decimals) && Number(m?.decimals) >= 0 ? { decimals: m!.decimals } : {}) };
    owned.push({ asset, ...(m?.bisKind === 'asset' && m.bisSchemaVersion === '1' && typeof m.bisOperationId === 'string' ? { operationId: m.bisOperationId } : {}) });
  }
  return owned.sort((a, b) => a.asset.assetId.localeCompare(b.asset.assetId));
}

function providers(signal: AbortSignal, beforeSubmit?: () => void, afterSubmit?: (transactionId: string) => void) {
  const arkProvider = new RestArkProvider(SIGNET_OPERATOR), indexerProvider = new RestIndexerProvider(SIGNET_OPERATOR);
  const getInfo = arkProvider.getInfo.bind(arkProvider);
  arkProvider.getInfo = async () => { signal.throwIfAborted(); const info = await getInfo(); requireSignet(info.network); return info; };
  let failed = false;
  const getVtxos = indexerProvider.getVtxos.bind(indexerProvider);
  indexerProvider.getVtxos = async (...args) => { try { signal.throwIfAborted(); return await getVtxos(...args); } catch (e) { failed = true; throw e; } };
  const submit = arkProvider.submitTx.bind(arkProvider);
  arkProvider.submitTx = async (...args) => {
    signal.throwIfAborted(); if (failed) throw new AssetError('unavailable'); beforeSubmit?.();
    const result = await submit(...args);
    afterSubmit?.(result.arkTxid);
    return result;
  };
  return { arkProvider, indexerProvider, assertFresh() { signal.throwIfAborted(); if (failed) throw new AssetError('unavailable'); } };
}
const storage = () => ({ walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() });
// Caller holds the wallet mutation lock. A pending record is written before submission.
export async function burnWalletAsset(account:AccountSecret, input:BisBurnAssetRequest, signal:AbortSignal, isCurrent:()=>boolean):Promise<Extract<BisBurnAssetResult,{status:'burned'}>> {
  const request=validateBurn(input), prior=readBurnRecord(account.profileId, input.operationId);
  if(prior?.id===request.operationId) {
    if(JSON.stringify(prior.request)!==JSON.stringify(request))throw new BurnError('invalid-input','The burn request changed.');
    if(prior.status==='succeeded')return {status:'burned',assetId:request.assetId,quantity:request.quantity,transactionId:prior.transactionId!};
  }
  assertNoPendingBurn(account.profileId);
  const deadline=AbortSignal.any([signal,AbortSignal.timeout(30000)]);
  let submitted=false,open=true;
  const p=providers(deadline,()=>{
    if(!open||!isCurrent())throw new BurnError('account-changed','The account changed.');
    writeBurnRecord({version:1,id:request.operationId,profileId:account.profileId,request,status:'pending'});
    submitted=true;
  },transactionId=>{
    if(open&&!deadline.aborted&&/^[a-f0-9]{64}$/i.test(transactionId)) {
      try {writeBurnRecord({version:1,id:request.operationId,profileId:account.profileId,request,status:'pending',transactionId});} catch { /* Intent is already durable; let finalization continue. */ }
    }
  });
  try {
    return await withTemporaryWallet(Wallet.create({identity:MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false}),arkProvider:p.arkProvider,indexerProvider:p.indexerProvider,settlementConfig:false,storage:storage()}),deadline,async wallet=>{
      const owned=await readFreshAssets(wallet);p.assertFresh();
      const asset=owned.find(row=>row.asset.assetId===request.assetId)?.asset;
      if(!asset||asset.quantity!==request.quantity)throw new BurnError('invalid-input','The owned quantity changed. Refresh Assets and confirm again.');
      if(!isCurrent())throw new BurnError('account-changed','The account changed.');
      const transactionId=await wallet.assetManager.burn({assetId:request.assetId,amount:BigInt(request.quantity)});
      if(!open||deadline.aborted||!isCurrent())throw new BurnError('outcome-unknown','The burn outcome is unknown. Refresh Assets; do not retry the burn.');
      if(!/^[a-f0-9]{64}$/i.test(transactionId))throw Error('Invalid transaction ID');
      writeBurnRecord({version:1,id:request.operationId,profileId:account.profileId,request,status:'succeeded',transactionId});
      return {status:'burned',assetId:request.assetId,quantity:request.quantity,transactionId};
    },30000);
  } catch(error) {
    if(submitted)throw new BurnError('outcome-unknown','The burn may have been submitted. Refresh Assets; do not retry the burn.');
    throw error;
  } finally {open=false;}
}
export async function listWalletAssets(account: AccountSecret, signal: AbortSignal): Promise<BisAsset[]> {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
  const p = providers(deadline);
  const identity = await MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }).toReadonly();
  return withTemporaryWallet(ReadonlyWallet.create({ identity, arkProvider: p.arkProvider, indexerProvider: p.indexerProvider, storage: storage() }), deadline, async wallet => {
    const owned = await readFreshAssets(wallet); p.assertFresh(); return owned.map(o => o.asset);
  }, 30000);
}
// Caller holds the mutation lock shared with transfers and account clearing.
export async function mintWalletAsset(account: AccountSecret, request: BisMintAssetRequest, signal: AbortSignal, isCurrent: () => boolean): Promise<Exclude<BisMintAssetResult, {status:'error'}>> {
  const record = checkMintRecord(account.profileId, request);
  if (record?.status === 'succeeded') return { status: 'already-minted', profileId: account.profileId, operationId: request.operationId, asset: record.asset!, transactionId: record.transactionId };
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
  let submitted = false, open = true;
  const p = providers(deadline, () => {
    if (!open || !isCurrent()) throw new AssetError('account-changed');
    checkMintRecord(account.profileId, request);
    writeAssetRecord(account.profileId, { request, status: 'pending' });
    submitted = true;
  }, transactionId => {
    // Once the caller exits, its wallet lock is gone. Leave late evidence for
    // a fresh locked retry instead of racing another tab's journal updates.
    if (!open || deadline.aborted) return;
    if (typeof transactionId !== 'string' || !/^[0-9a-f]{64}$/i.test(transactionId)) return;
    try {
      const latest = checkMintRecord(account.profileId, request);
      // Only enrich an existing pending intent. Never downgrade confirmed
      // ownership, or recreate a journal removed by account cleanup.
      if (latest?.status === 'pending') writeAssetRecord(account.profileId, { ...latest, transactionId });
    } catch {
      // Durable intent already exists. A secondary journal write must not stop
      // SDK finalization of an accepted transaction; completion still persists.
    }
  });
  try {
    return await withTemporaryWallet(Wallet.create({ identity: MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }), arkProvider: p.arkProvider, indexerProvider: p.indexerProvider, settlementConfig: false, storage: storage() }), deadline, async wallet => {
      const owned = await readFreshAssets(wallet); p.assertFresh();
      const existing = owned.find(o => o.operationId === request.operationId && o.asset.name === request.name && o.asset.ticker === request.ticker && o.asset.decimals === request.decimals && o.asset.quantity === assetBaseUnits(request.amount, request.decimals).toString() && (o.asset.iconUrl || '') === (request.iconUrl || ''));
      if (existing) {
        const transactionId = checkMintRecord(account.profileId, request)?.transactionId;
        writeAssetRecord(account.profileId, { request, status: 'succeeded', asset: existing.asset, ...(transactionId ? { transactionId } : {}) });
        return { status: 'already-minted', profileId: account.profileId, operationId: request.operationId, asset: existing.asset, ...(transactionId ? { transactionId } : {}) };
      }
      if (record) throw new AssetError('outcome-unknown');
      const coins = await wallet.getSpendableVtxos({ withRecoverable: false }); p.assertFresh();
      if (coins.reduce((sum, c) => sum + BigInt(c.value), 0n) < BigInt(wallet.dustAmount)) throw new AssetError('insufficient-funds');
      if (!isCurrent()) throw new AssetError('account-changed');
      const quantity = assetBaseUnits(request.amount, request.decimals);
      const result = await wallet.assetManager.issue({ amount: quantity, metadata: { name: request.name, ticker: request.ticker, decimals: request.decimals, ...(request.iconUrl ? {icon: request.iconUrl} : {}), bisKind: 'asset', bisSchemaVersion: '1', bisOperationId: request.operationId } });
      const asset: BisAsset = {assetId: result.assetId, name: request.name, ticker: request.ticker, quantity: quantity.toString(), decimals: request.decimals, ...(request.iconUrl ? {iconUrl: request.iconUrl} : {})};
      // SDK finalization continues after abort, but only an open caller still
      // holds the mutation lock needed to update this operation's journal.
      if (open && !deadline.aborted && checkMintRecord(account.profileId, request)) writeAssetRecord(account.profileId, {request, status: 'succeeded', asset, transactionId: result.arkTxId});
      return { status: 'minted', profileId: account.profileId, operationId: request.operationId, asset, transactionId: result.arkTxId };
    }, 30000);
  } catch (e) {
    if (submitted) throw new AssetError('outcome-unknown');
    throw e;
  } finally { open = false; }
}
