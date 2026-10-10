import { useState, type ReactNode } from 'react';
import { createBisGameWallet } from '@bis/integration';
import { prepareMintDestination } from './mint-destination';
import { mintAndVerifyMarketplaceCatalog } from './marketplace-mint-batch';
import { burnMarketplaceListing } from './marketplace-burn-batch';
import { listMarketplaceItems } from './marketplace-list';
import { StoryButton } from './StoryButton';

export function AdminMarketplaceView({ controller, onLog, children }: {controller?: ReturnType<typeof createBisGameWallet>; onLog(value: unknown): void; children?: ReactNode}) {
  const [busy, setBusy] = useState(false);
  const active = !!controller?.getState().profileId;
  async function mintCatalog() {
    if (!controller || busy) return; setBusy(true);
    onLog({operation:'C.G.2. Marketplace mint', status:'pending', message:'Preparing catalog issuance…'});
    try {
      const targetProfile = controller.getState().profileId;
      if (!targetProfile) throw Error();
      const target = await prepareMintDestination('game', controller, controller, () => controller.getState().profileId === targetProfile, result => onLog({operation:'C.G.2. Marketplace mint', result}));
      const batch = await mintAndVerifyMarketplaceCatalog({mint:target.mint,listAssets:()=>controller.listAssets()}, target.isCurrent, progress => {
        const message = progress.stage === 'minting' ? `Minting ${progress.itemName} (attempt ${progress.attempt})…`
          : progress.stage === 'retrying' ? `${progress.itemName} unavailable; retrying after ${progress.delayMs / 1000}s.`
          : progress.stage === 'minted' ? `${progress.itemName} minted; continuing catalog.`
          : 'Verifying fresh marketplace inventory…';
        onLog({operation:'C.G.2. Marketplace mint',status:'pending',message,progress});
      }, 'v3');
      if (batch.status === 'error') {
      onLog({operation:'C.G.2. Marketplace mint', status:'error', message:`Catalog paused${batch.itemName ? ` at ${batch.itemName}` : ''}: ${batch.code}.`, result:batch});
        return;
      }
      onLog({operation:'C.G.2. Marketplace mint', status:'verified', message:'Nine verified catalog items are now available from this Game Wallet’s live inventory.', result:batch});
    } catch { onLog({operation:'C.G.2. Marketplace mint', status:'error', message:'Catalog issuance is unavailable or needs recovery. No unverified item was reported.'}); }
    finally { setBusy(false); }
  }
  async function burnCatalog() {
    if (!controller || busy) return; setBusy(true);
    onLog({operation:'C.G.3. Burn Marketplace Listing', status:'pending', message:'Inspecting the exact nine-item listing…'});
    const targetProfile=controller.getState().profileId;
    try {
      if(!targetProfile)throw Error();
      const batch=await burnMarketplaceListing(controller,()=>controller.getState().profileId===targetProfile, progress => {
        const label = progress.stage === 'listing' ? '' : progress.name ?? progress.assetId.slice(0,12);
        const message = progress.stage === 'listing' ? `Refreshing marketplace inventory after ${progress.burned} burned…`
          : progress.stage === 'burning' ? `Burning ${label}…`
          : progress.stage === 'burned' ? `${label} burned; refreshing inventory.`
          : `${label} stopped with ${progress.code}.`;
      onLog({operation:'C.G.3. Burn Marketplace Listing',status:'pending',message,progress});
      });
      onLog({operation:'C.G.3. Burn Marketplace Listing', status:batch.status, message:batch.status==='error'?'Marketplace listing burn is unavailable.':`${batch.burned} item(s) burned; ${batch.unresolved} unresolved; ${batch.skipped} skipped. Run C.G.3 again later to continue.`, result:batch});
    } catch {onLog({operation:'C.G.3. Burn Marketplace Listing', status:'error', message:'Marketplace listing burn is unavailable. No trophy or unrelated asset was selected.'});}
    finally {setBusy(false);}
  }
  async function listAllItems() {
    if (!controller || busy) return; setBusy(true);
    const operation = 'C.G.4. List All Items For Marketplace';
    const log = (value: Record<string, unknown>) => onLog({operation, arkadeAddress: controller.getState().addresses?.arkadeAddress ?? 'Unavailable', ...value});
    log({status:'pending',message:'Listing fresh game-wallet marketplace items…'});
    const targetProfile=controller.getState().profileId;
    try {
      if(!targetProfile)throw Error();
      const result=await listMarketplaceItems(controller,()=>controller.getState().profileId===targetProfile, progress => log({status:'pending',message:progress.stage==='listing'?'Reading fresh game-wallet assets…':`Classifying ${progress.total} asset(s)…`,progress}));
      log({status:result.status,message:result.status==='success'?`${result.items.length} marketplace item(s) found.`:result.message,result});
    } catch {onLog({operation,status:'error',message:'Marketplace item listing is unavailable.'});}
    finally {setBusy(false);}
  }
  return <div className="marketplace-panel"><p className="story-summary">Mint or burn the nine-item Stealth &amp; Steel catalog in the active game wallet.</p>{children}<StoryButton label="C.G.2. Mint Items for Marketplace"><button disabled={!active || busy} onClick={() => void mintCatalog()}>Mint catalog</button></StoryButton><StoryButton label="C.G.3. Burn Items for Marketplace"><button disabled={!active || busy} onClick={() => void burnCatalog()}>Burn marketplace listing</button></StoryButton><StoryButton label="C.G.4. List All Items For Marketplace"><button disabled={!active || busy} onClick={() => void listAllItems()}>List all marketplace items</button></StoryButton></div>;
}
