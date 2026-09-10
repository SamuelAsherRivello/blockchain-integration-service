import { useState } from 'react';
import { type BisMintAssetRequest, type BisMintAssetResult, createBisGameWallet } from '@bis/integration';
import { prepareMintDestination } from './mint-destination';
import { StoryButton } from './StoryButton';
import { StorySection } from './StorySection';

const items = [
  ['shoes', 'Shoes', 'increase movement speed'], ['dagger', 'Dagger', 'increase player damage'], ['shield', 'Shield', 'reduce damage taken'],
] as const;
const catalog = items.flatMap(([slug, family, effect]) => [1, 2, 3].map(tier => ({ id:`stealth-steel-${slug}-${tier}`, name:`${family} ${['I','II','III'][tier - 1]}`, ticker:`${slug.slice(0,3).toUpperCase()}${tier}`, family, tier, effect:`Tier ${tier}: ${effect}.`, artwork:`${slug}-${tier}` })));

export function MarketplacePanel({ controller, onLog }: {controller?: ReturnType<typeof createBisGameWallet>; onLog(value: unknown): void}) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const active = !!controller?.getState().profileId;
  async function mintCatalog() {
    if (!controller || busy) return; setBusy(true); setMessage('Preparing catalog issuance…');
    try {
      const targetProfile = controller.getState().profileId;
      if (!targetProfile) throw Error();
      const target = await prepareMintDestination('game', controller, () => controller.getState().profileId === targetProfile, result => onLog({operation:'H. Marketplace mint', result}));
      const records: unknown[] = [];
      for (const item of catalog) {
        const request: BisMintAssetRequest = {operationId:`marketplace-${item.id}-v1`, name:item.name, ticker:item.ticker, amount:'1', decimals:0};
        const result: BisMintAssetResult = await target.mint(request);
        if (result.status === 'error') { setMessage(`Catalog paused: ${item.name} is ${result.code}.`); onLog({operation:'H. Marketplace batch', records, result}); return; }
        records.push({ ...item, assetId:result.asset.assetId, quantity:result.asset.quantity });
      }
      const address = controller.getState().addresses?.arkadeAddress;
      if (!address) { setMessage('Catalog minted, but the game-wallet address is unavailable for publication.'); return; }
      const published = {version:1, gameId:'stealth-and-steel', gameWalletAddress:address, items:records};
      const response = await fetch('/__bis-marketplace-catalog', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(published)});
      if (!response.ok) throw Error();
      setMessage('Nine verified catalog items were published to the Marketplace static input.'); onLog({operation:'H. Marketplace published catalog', published});
    } catch { setMessage('Catalog issuance is unavailable or needs recovery. No unverified item was published.'); }
    finally { setBusy(false); }
  }
  return <StorySection title="H. Marketplace" className="marketplace-panel"><p className="story-summary">Mint the nine-item Stealth &amp; Steel catalog to the active game wallet.</p><StoryButton label="H1. Mint Items for Marketplace"><button disabled={!active || busy} onClick={() => void mintCatalog()}>{busy ? 'Minting…' : 'Mint catalog'}</button></StoryButton>{!active && <p role="status">Log in to F. Game Wallet first.</p>}{message && <p role="status">{message}</p>}</StorySection>;
}
