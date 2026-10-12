import { useState, type ReactNode } from 'react';
import { bisAssetFormats, createBisGameWallet, prepareAssetMintBatch, BIS_LATEST_ASSET_FORMAT_VERSION } from '@bis/integration';
import { marketplaceCatalogItems, marketplaceMintRequest } from './marketplace-catalog';
import { prepareMintDestination } from './mint-destination';
import { mintAndVerifyMarketplaceCatalog } from './marketplace-mint-batch';
import { burnMarketplaceListing } from './marketplace-burn-batch';
import { listMarketplaceItems } from './marketplace-list';
import { StoryButton } from './StoryButton';
import {upgradeAllPlayerAssets,type PlayerAssetUpgradeWallet} from './player-asset-upgrade.ts';

/** C.G.2–C.G.4 currently own only the registered 0.0.1 catalog handler. */
export const canUseMarketplaceCatalogFormat=(version:string)=>version===BIS_LATEST_ASSET_FORMAT_VERSION;

export function AdminMarketplaceView({ controller, player, onLog, children }: {controller?: ReturnType<typeof createBisGameWallet>;player?:PlayerAssetUpgradeWallet; onLog(value: unknown): void; children?: ReactNode}) {
  const [busy, setBusy] = useState(false);
  const [formatVersion,setFormatVersion]=useState<string>(BIS_LATEST_ASSET_FORMAT_VERSION);
  const active = !!controller?.getState().profileId;
  // Upgrades are recovery work for a known predecessor, not a setting for the
  // format selected for new catalog actions.  The panel opens on the latest
  // format, so deriving this from formatVersion hid the only repair action.
  const upgrade=bisAssetFormats.flatMap(source=>bisAssetFormats
    .filter(target=>target.autoUpgrade&&target.predecessorMigrations[source.version])
    .map(target=>({source,target,migrator:target.predecessorMigrations[source.version]!})))[0];
  async function upgradeAll() {
    if(!controller||!player||!upgrade||busy)return;setBusy(true);
    onLog({operation:'Upgrade all player items',sourceVersion:upgrade.source.version,targetVersion:upgrade.target.version,status:'pending',message:'Reading Player Wallet holdings…'});
    const gameProfile=controller.getState().profileId,playerProfile=player.getState().profileId;
    try {
      const results=await upgradeAllPlayerAssets({game:controller,player,targetVersion:upgrade.target.version,migrator:upgrade.migrator,isCurrent:()=>controller.getState().profileId===gameProfile&&player.getState().profileId===playerProfile,onProgress:value=>onLog({operation:'Upgrade all player items',value})});
      onLog({operation:'Upgrade all player items',sourceVersion:upgrade.source.version,targetVersion:upgrade.target.version,status:'completed',results});
    } catch {onLog({operation:'Upgrade all player items',status:'error',message:'Upgrade did not start. Confirm both wallets and recover any pending item before retrying.'});}
    finally{setBusy(false);}
  }
  async function mintCatalog() {
    if (!controller || busy || !canUseMarketplaceCatalogFormat(formatVersion)) return; setBusy(true);
    onLog({operation:'C.G.2. Marketplace mint', formatVersion, status:'pending', message:'Preparing catalog issuance…'});
    try {
      const targetProfile = controller.getState().profileId;
      if (!targetProfile) throw Error();
      const target = await prepareMintDestination('game', controller, controller, () => controller.getState().profileId === targetProfile, result => onLog({operation:'C.G.2. Marketplace mint', result}));
      const requests = await prepareAssetMintBatch(targetProfile, controller.getState().network ?? 'signet', marketplaceCatalogItems.map(item => marketplaceMintRequest(item, 'v3')));
      if (!target.isCurrent()) throw Error('The selected wallet changed.');
      const operationVersion = requests[0].operationId.slice(`marketplace-${marketplaceCatalogItems[0].id}-`.length);
      const batch = await mintAndVerifyMarketplaceCatalog({mint:target.mint,listAssets:()=>controller.listAssets(),pendingMintRequest:target.request}, target.isCurrent, progress => {
        const message = progress.stage === 'minting' ? `Minting ${progress.itemName} (attempt ${progress.attempt})…`
          : progress.stage === 'retrying' ? `${progress.itemName} unavailable; retrying after ${progress.delayMs / 1000}s.`
          : progress.stage === 'minted' ? `${progress.itemName} ${progress.status === 'already-minted' ? 'previously minted' : 'minted'}; continuing catalog.`
          : 'Verifying fresh marketplace inventory…';
        onLog({operation:'C.G.2. Marketplace mint',status:'pending',message,progress,operationId:'operationId' in progress ? progress.operationId : undefined,submissionBoundary:'submissionBoundary' in progress ? progress.submissionBoundary : undefined});
      }, operationVersion);
      if (batch.status === 'error') {
      onLog({operation:'C.G.2. Marketplace mint', status:'error', message:`Catalog paused${batch.itemName ? ` at ${batch.itemName}` : ''}: ${batch.code}.`, result:batch,operationId:batch.operationId,submissionBoundary:batch.submissionBoundary});
        return;
      }
      onLog({operation:'C.G.2. Marketplace mint', status:'verified', message:'Nine verified catalog items are now available from this Game Wallet’s live inventory.', result:batch});
    } catch { onLog({operation:'C.G.2. Marketplace mint', status:'error', message:'Catalog issuance is unavailable or needs recovery. No unverified item was reported.'}); }
    finally { setBusy(false); }
  }
  async function burnCatalog() {
    if (!controller || busy || !canUseMarketplaceCatalogFormat(formatVersion)) return; setBusy(true);
    onLog({operation:'C.G.3. Burn Marketplace Listing', formatVersion, status:'pending', message:'Inspecting the exact nine-item listing…'});
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
    if (!controller || busy || !canUseMarketplaceCatalogFormat(formatVersion)) return; setBusy(true);
    const operation = 'C.G.4. List All Items For Marketplace';
    const log = (value: Record<string, unknown>) => onLog({operation, formatVersion, arkadeAddress: controller.getState().addresses?.arkadeAddress ?? 'Unavailable', ...value});
    log({status:'pending',message:'Listing fresh game-wallet marketplace items…'});
    const targetProfile=controller.getState().profileId;
    try {
      if(!targetProfile)throw Error();
      const result=await listMarketplaceItems(controller,()=>controller.getState().profileId===targetProfile, progress => log({status:'pending',message:progress.stage==='listing'?'Reading fresh game-wallet assets…':`Classifying ${progress.total} asset(s)…`,progress}));
      log({status:result.status,message:result.status==='success'?`${result.items.length} marketplace item(s) found.`:result.message,result});
    } catch {onLog({operation,status:'error',message:'Marketplace item listing is unavailable.'});}
    finally {setBusy(false);}
  }
  const catalogEnabled=canUseMarketplaceCatalogFormat(formatVersion);
  return <div className="marketplace-panel"><p className="story-summary">Mint or burn the nine-item Stealth &amp; Steel catalog in the active game wallet.</p><label className="marketplace-format">Asset format<select aria-label="Asset format" value={formatVersion} disabled={busy} onChange={event=>setFormatVersion(event.target.value)}>{bisAssetFormats.map(format=><option key={format.version} value={format.version}>{format.version}{format.version===BIS_LATEST_ASSET_FORMAT_VERSION?' (latest)':''}</option>)}</select></label>{children}<StoryButton label="Upgrade all player items"><button disabled={!active||!player||!upgrade||busy} title={!upgrade?'No automatic legacy item upgrade is registered.':undefined} onClick={()=>void upgradeAll()}>{upgrade?`Upgrade ${upgrade.source.version} to ${upgrade.target.version} ${upgrade.target.autoUpgrade?'(automatic)':''}`:'No upgrade available'}</button></StoryButton><StoryButton label="C.G.2. Mint Items for Marketplace"><button disabled={!active || busy || !catalogEnabled} title={!catalogEnabled?'No marketplace catalog handler is registered for this format.':undefined} onClick={() => void mintCatalog()}>Mint catalog</button></StoryButton><StoryButton label="C.G.3. Burn Items for Marketplace"><button disabled={!active || busy || !catalogEnabled} title={!catalogEnabled?'No marketplace catalog handler is registered for this format.':undefined} onClick={() => void burnCatalog()}>Burn marketplace listing</button></StoryButton><StoryButton label="C.G.4. List All Items For Marketplace"><button disabled={!active || busy || !catalogEnabled} title={!catalogEnabled?'No marketplace catalog handler is registered for this format.':undefined} onClick={() => void listAllItems()}>List all marketplace items</button></StoryButton></div>;
}
