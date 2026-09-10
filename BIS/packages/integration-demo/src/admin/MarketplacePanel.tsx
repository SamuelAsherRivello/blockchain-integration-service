import { useState } from 'react';
import { createBisGameWallet } from '@bis/integration';
import { prepareMintDestination } from './mint-destination';
import { createVerifiedMarketplaceCatalog } from './marketplace-catalog';
import { mintAndVerifyMarketplaceCatalog } from './marketplace-mint-batch';
import { burnAllMarketplaceItems } from './marketplace-burn-batch';
import { StoryButton } from './StoryButton';
import { StorySection } from './StorySection';

export function MarketplacePanel({ controller, onLog }: {controller?: ReturnType<typeof createBisGameWallet>; onLog(value: unknown): void}) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const active = !!controller?.getState().profileId;
  async function mintCatalog() {
    if (!controller || busy) return; setBusy(true); setMessage('Preparing catalog issuance…');
    try {
      const targetProfile = controller.getState().profileId;
      if (!targetProfile) throw Error();
      const target = await prepareMintDestination('game', controller, () => controller.getState().profileId === targetProfile, result => onLog({operation:'H. Marketplace mint', result}));
      const batch = await mintAndVerifyMarketplaceCatalog({mint:target.mint,listAssets:()=>controller.listAssets()}, target.isCurrent);
      if (batch.status === 'error') { setMessage(`Catalog paused${batch.itemName ? ` at ${batch.itemName}` : ''}: ${batch.code}.`); onLog({operation:'H. Marketplace batch', result:batch}); return; }
      const address = controller.getState().addresses?.arkadeAddress;
      if (!address) { setMessage('Catalog minted, but the game-wallet address is unavailable for publication.'); return; }
      const published = createVerifiedMarketplaceCatalog(address, batch.records);
      if (!published) throw Error('The nine-item catalog could not be verified.');
      const response = await fetch('/__bis-marketplace-catalog', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(published)});
      if (!response.ok) throw Error();
      setMessage('Nine verified catalog items were published to the Marketplace static input.'); onLog({operation:'H. Marketplace published catalog', published});
    } catch { setMessage('Catalog issuance is unavailable or needs recovery. No unverified item was published.'); }
    finally { setBusy(false); }
  }
  async function burnCatalog() {
    if (!controller || busy) return; setBusy(true);setMessage('Inspecting fresh game-wallet items…');
    const targetProfile=controller.getState().profileId;
    try {
      if(!targetProfile)throw Error();
      const batch=await burnAllMarketplaceItems(controller,()=>controller.getState().profileId===targetProfile);
      onLog({operation:'H2. Burn All Items for Marketplace',result:batch});
      setMessage(batch.status==='error'?'Marketplace item burn is unavailable.':`${batch.burned} item(s) burned; ${batch.unresolved} unresolved; ${batch.skipped} skipped. Run H2 again later to continue.`);
    } catch {setMessage('Marketplace item burn is unavailable. No trophy or unrelated asset was selected.');}
    finally {setBusy(false);}
  }
  return <StorySection title="H. Marketplace" className="marketplace-panel"><p className="story-summary">Mint or burn the nine-item Stealth &amp; Steel catalog in the active game wallet.</p><StoryButton label="H1. Mint Items for Marketplace"><button disabled={!active || busy} onClick={() => void mintCatalog()}>{busy ? 'Working…' : 'Mint catalog'}</button></StoryButton><StoryButton label="H2. Burn All Items for Marketplace"><button disabled={!active || busy} onClick={() => void burnCatalog()}>{busy ? 'Working…' : 'Burn all marketplace items'}</button></StoryButton>{!active && <p role="status">Log in to F. Game Wallet first.</p>}{message && <p role="status">{message}</p>}</StorySection>;
}
