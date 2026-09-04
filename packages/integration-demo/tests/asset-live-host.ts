import { createBisContext } from '@bis/integration';
import { readAssetRecords } from '../../integration/src/core/assets';

// Development-only acceptance host, excluded from the production build inputs.
// It never reads or displays recovery material and never starts a new issuance.
const context = createBisContext();
const output = document.querySelector<HTMLPreElement>('#result')!;
const read = document.querySelector<HTMLButtonElement>('#read')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
const operation = document.querySelector<HTMLInputElement>('#operation')!;
const show = (value: unknown) => { output.textContent = JSON.stringify(value, null, 2); };
let busy = false;
async function run(work: () => Promise<unknown>) {
  if (busy) return;
  busy = true;
  read.disabled = retry.disabled = true;
  show({ status: 'pending' });
  try { await context.ready(); show(await work()); }
  catch { show({ status: 'error', message: 'Verification unavailable. No new mint was requested.' }); }
  finally { busy = false; read.disabled = retry.disabled = false; }
}
read.onclick = () => void run(async () => {
  const assets = await context.listAssets();
  const profileId = context.getState().profileId;
  return {
    assets,
    pending: await context.getPendingAssetMint(),
    receipts: profileId ? readAssetRecords(profileId).map(record => ({
      operationId: record.request.operationId, status: record.status,
      assetId: record.asset?.assetId, transactionId: record.transactionId,
    })) : [],
  };
});
retry.onclick = () => void run(async () => {
  const profileId = context.getState().profileId;
  if (!profileId) return { status: 'error', message: 'An active account is required.' };
  const receipt = readAssetRecords(profileId).find(record => record.request.operationId === operation.value.trim());
  if (receipt?.status !== 'succeeded' || !receipt.asset) return { status: 'error', message: 'Enter an existing completed operation ID. No new mint was requested.' };
  const before = await context.listAssets();
  if (before.status !== 'success') return before;
  const result = await context.mintAsset(receipt.request);
  const after = await context.listAssets();
  return { result, before, after, unchangedHoldings: after.status === 'success' && JSON.stringify(before.assets) === JSON.stringify(after.assets) };
});
window.addEventListener('pagehide', () => context.dispose());
