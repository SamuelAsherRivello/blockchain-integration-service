import { useState } from 'react';
import { createBisGameWallet } from '@bis/integration';
import { prepareMintDestination } from './mint-destination';
import { mintAndVerifyMarketplaceCatalog } from './marketplace-mint-batch';
import { burnAllMarketplaceItems } from './marketplace-burn-batch';
import { listMarketplaceItems } from './marketplace-list';
import { StoryButton } from './StoryButton';
import { StorySection } from './StorySection';

export function MarketplacePanel({ controller, onLog }: {controller?: ReturnType<typeof createBisGameWallet>; onLog(value: unknown): void}) {
  const [busy, setBusy] = useState(false);
  const active = !!controller?.getState().profileId;
  async function mintCatalog() {
    if (!controller || busy) return; setBusy(true);
    onLog({operation:'H1. Marketplace mint', status:'pending', message:'Preparing catalog issuance…'});
    try {
      const targetProfile = controller.getState().profileId;
      if (!targetProfile) throw Error();
      const target = await prepareMintDestination('game', controller, () => controller.getState().profileId === targetProfile, result => onLog({operation:'H1. Marketplace mint', result}));
      const batch = await mintAndVerifyMarketplaceCatalog({mint:target.mint,listAssets:()=>controller.listAssets()}, target.isCurrent);
      if (batch.status === 'error') {
        onLog({operation:'H1. Marketplace mint', status:'error', message:`Catalog paused${batch.itemName ? ` at ${batch.itemName}` : ''}: ${batch.code}.`, result:batch});
        return;
      }
      onLog({operation:'H1. Marketplace mint', status:'verified', message:'Nine verified catalog items are now available from this Game Wallet’s live inventory.', result:batch});
    } catch { onLog({operation:'H1. Marketplace mint', status:'error', message:'Catalog issuance is unavailable or needs recovery. No unverified item was reported.'}); }
    finally { setBusy(false); }
  }
  async function burnCatalog() {
    if (!controller || busy) return; setBusy(true);
    onLog({operation:'H2. Burn All Items for Marketplace', status:'pending', message:'Inspecting fresh game-wallet items…'});
    const targetProfile=controller.getState().profileId;
    try {
      if(!targetProfile)throw Error();
      const batch=await burnAllMarketplaceItems(controller,()=>controller.getState().profileId===targetProfile);
      onLog({operation:'H2. Burn All Items for Marketplace', status:batch.status, message:batch.status==='error'?'Marketplace item burn is unavailable.':`${batch.burned} item(s) burned; ${batch.unresolved} unresolved; ${batch.skipped} skipped. Run H2 again later to continue.`, result:batch});
    } catch {onLog({operation:'H2. Burn All Items for Marketplace', status:'error', message:'Marketplace item burn is unavailable. No trophy or unrelated asset was selected.'});}
    finally {setBusy(false);}
  }
  async function listAllItems() {
    if (!controller || busy) return; setBusy(true);
    const operation = 'H3. List All Items For Markeplace';
    onLog({operation,status:'pending',message:'Listing fresh game-wallet marketplace items…'});
    const targetProfile=controller.getState().profileId;
    try {
      if(!targetProfile)throw Error();
      const result=await listMarketplaceItems(controller,()=>controller.getState().profileId===targetProfile);
      onLog({operation,status:result.status,message:result.status==='success'?`${result.items.length} marketplace item(s) found.`:result.message,result});
    } catch {onLog({operation,status:'error',message:'Marketplace item listing is unavailable.'});}
    finally {setBusy(false);}
  }
  return <StorySection title="H. Marketplace" className="marketplace-panel"><p className="story-summary">Mint or burn the nine-item Stealth &amp; Steel catalog in the active game wallet.</p><StoryButton label="H1. Mint Items for Marketplace"><button disabled={!active || busy} onClick={() => void mintCatalog()}>Mint catalog</button></StoryButton><StoryButton label="H2. Burn All Items for Marketplace"><button disabled={!active || busy} onClick={() => void burnCatalog()}>Burn all marketplace items</button></StoryButton><StoryButton label="H3. List All Items For Markeplace"><button disabled={!active || busy} onClick={() => void listAllItems()}>List all marketplace items</button></StoryButton></StorySection>;
}
