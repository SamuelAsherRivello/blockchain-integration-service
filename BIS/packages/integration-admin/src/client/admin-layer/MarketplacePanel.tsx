import { useState, type ReactNode } from 'react';
import { bisAssetFormats, createBisGameWallet, prepareAssetMintBatch, BIS_LATEST_ASSET_FORMAT_VERSION } from '@bis/integration';
import { marketplaceCatalogItems, marketplaceMintRequest } from './marketplace-catalog';
import { prepareMintDestination } from './mint-destination';
import { mintAndVerifyMarketplaceCatalog } from './marketplace-mint-batch';
import { burnAllMarketplaceItems } from './marketplace-burn-batch';
import { listMarketplaceItems } from './marketplace-list';
import { StoryButton } from './StoryButton';
import {upgradeAllPlayerAssets,type PlayerAssetUpgradeWallet} from './player-asset-upgrade.ts';

export function AdminMarketplaceView({ controller, player, onLog, children }: {controller?: ReturnType<typeof createBisGameWallet>;player?:PlayerAssetUpgradeWallet; onLog(value: unknown): void; children?: ReactNode}) {
  const [busy, setBusy] = useState(false);
  const [upgradeTargetVersion,setUpgradeTargetVersion]=useState<string>(BIS_LATEST_ASSET_FORMAT_VERSION);
  const [listFormatVersion,setListFormatVersion]=useState<string>(BIS_LATEST_ASSET_FORMAT_VERSION);
  const active = !!controller?.getState().profileId;
  // Upgrades are recovery work for a known predecessor, not a setting for the
  // format selected for new catalog actions.  The panel opens on the latest
  // format, so deriving this from formatVersion hid the only repair action.
  const upgrade=bisAssetFormats.flatMap(source=>bisAssetFormats
    .filter(target=>target.version===upgradeTargetVersion&&target.autoUpgrade&&target.predecessorMigrations[source.version])
    .map(target=>({source,target,migrator:target.predecessorMigrations[source.version]!})))[0];
  const upgradeTargets=bisAssetFormats.filter(target=>target.autoUpgrade&&bisAssetFormats.some(source=>target.predecessorMigrations[source.version]));
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
    if (!controller || busy) return; setBusy(true);
    onLog({operation:'C.G.2. Marketplace mint', formatVersion:BIS_LATEST_ASSET_FORMAT_VERSION, status:'pending', message:'Preparing latest-format catalog issuance…'});
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
    if (!controller || busy) return; setBusy(true);
    onLog({operation:'C.G.3. Burn Marketplace Listing', status:'pending', message:'Inspecting all recognized marketplace items…'});
    const targetProfile=controller.getState().profileId;
    try {
      if(!targetProfile)throw Error();
      const batch=await burnAllMarketplaceItems(controller,()=>controller.getState().profileId===targetProfile, progress => {
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
    const log = (value: Record<string, unknown>) => onLog({operation, formatVersion:listFormatVersion, arkadeAddress: controller.getState().addresses?.arkadeAddress ?? 'Unavailable', ...value});
    log({status:'pending',message:'Listing fresh game-wallet marketplace items…'});
    const targetProfile=controller.getState().profileId;
    try {
      if(!targetProfile)throw Error();
      const result=await listMarketplaceItems(controller,()=>controller.getState().profileId===targetProfile, progress => log({status:'pending',message:progress.stage==='listing'?'Reading fresh game-wallet assets…':`Classifying ${progress.total} asset(s)…`,progress}),listFormatVersion);
      log({status:result.status,message:result.status==='success'?`${result.items.length} marketplace item(s) found.`:result.message,result});
    } catch {onLog({operation,status:'error',message:'Marketplace item listing is unavailable.'});}
    finally {setBusy(false);}
  }
  const formatSelector=(label:string,value:string,onChange:(value:string)=>void,formats=bisAssetFormats)=><label className="marketplace-format-select">Asset format<select aria-label={label} value={value} disabled={busy} onChange={event=>onChange(event.target.value)}>{formats.map(format=><option key={format.version} value={format.version}>{format.version}{format.version===BIS_LATEST_ASSET_FORMAT_VERSION?' (latest)':''}</option>)}</select></label>;
  return <div className="marketplace-panel"><p className="story-summary">Mint or burn the nine-item Stealth &amp; Steel catalog in the active game wallet.</p>{children}<StoryButton label="Upgrade all player items">{formatSelector('Upgrade target asset format',upgradeTargetVersion,setUpgradeTargetVersion,upgradeTargets)}<button disabled={!active||!player||!upgrade||busy} title={!upgrade?'No automatic legacy item upgrade is registered.':undefined} onClick={()=>void upgradeAll()}>{upgrade?`Upgrade legacy items to ${upgrade.target.version}`:'No upgrade available'}</button></StoryButton><StoryButton label={`C.G.2. Mint Items for Marketplace (${BIS_LATEST_ASSET_FORMAT_VERSION})`}><button disabled={!active || busy} onClick={() => void mintCatalog()}>Mint latest catalog</button></StoryButton><StoryButton label="C.G.3. Burn Items for Marketplace"><button disabled={!active || busy} onClick={() => void burnCatalog()}>Burn all marketplace items</button></StoryButton><StoryButton label="C.G.4. List All Items For Marketplace">{formatSelector('C.G.4 asset format',listFormatVersion,setListFormatVersion)}<button disabled={!active || busy} onClick={() => void listAllItems()}>List marketplace items</button></StoryButton></div>;
}
