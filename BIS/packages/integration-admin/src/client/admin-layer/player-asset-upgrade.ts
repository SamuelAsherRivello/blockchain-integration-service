import {migrationRecordId,readAssetMigrationRecord,resolveBisAssetFormat,reconcileAssetMigration,writeAssetMigrationRecord,type BisAsset,type BisAssetFormatMigrator,type BisAssetMigrationRecord,type BisBurnAssetRequest,type BisListAssetsResult,type TestNetwork} from '@bis/integration';
import {prepareMintDestination,type MintWallet} from './mint-destination.ts';

export type PlayerAssetUpgradeWallet = MintWallet & Readonly<{
  listAssets():Promise<BisListAssetsResult>;
  burnAsset(request:BisBurnAssetRequest):Promise<Readonly<{status:'burned'}|{status:'error'}>>;
}>;
export type PlayerAssetUpgradeResult=Readonly<{assetId:string;status:'completed'|'pending'|'skipped';message:string}>;

/** Explicit Admin-only batch operation. Browsing never calls this function. */
export async function upgradeAllPlayerAssets(input:Readonly<{game:MintWallet;player:PlayerAssetUpgradeWallet;targetVersion:string;migrator:BisAssetFormatMigrator;isCurrent():boolean;onProgress?(value:unknown):void}>):Promise<readonly PlayerAssetUpgradeResult[]> {
  const playerId=input.player.getState().profileId,network=input.player.getState().network as TestNetwork|undefined;
  if(!playerId||!network||!input.game.getState().profileId||!input.isCurrent())throw Error('The Game Wallet and Player Wallet must be active on the same network.');
  const listing=await input.player.listAssets();
  if(listing.status!=='success'||listing.profileId!==playerId||!input.isCurrent())throw Error('Player asset inventory is unavailable.');
  const target=await prepareMintDestination('player',input.game,input.player,input.isCurrent,input.onProgress??(()=>{}));
  const results:PlayerAssetUpgradeResult[]=[];
  for(const asset of listing.assets) {
    const source=resolveBisAssetFormat(asset);
    if(source.status!=='supported'||source.version===input.targetVersion)continue;
    const id=migrationRecordId(asset.assetId,input.targetVersion);
    const record=readAssetMigrationRecord(playerId,asset.assetId,input.targetVersion,network)??writeAssetMigrationRecord({version:1,id,ownerProfileId:playerId,network,sourceAssetId:asset.assetId,sourceVersion:source.version,targetVersion:input.targetVersion,operationId:id,status:'prepared'});
    try {
      const next=await reconcileAssetMigration(asset,record,{
        isCurrent:()=>input.isCurrent()&&target.isCurrent(),
        mintAndDeliver:async(item,current)=>{
          const plan=input.migrator(item),mint=await target.mint({...plan,operationId:current.operationId});
          return mint.status==='minted'||mint.status==='already-minted'?{status:'delivered',replacementAssetId:mint.asset.assetId}:{status:'pending'};
        },
        retire:async(item,current)=>{
          const burned=await input.player.burnAsset({operationId:`${current.operationId}-retire`,assetId:item.assetId,quantity:item.quantity});
          return burned.status==='burned'?'retired':'pending';
        },
      });
      results.push({assetId:asset.assetId,status:next.status==='completed'?'completed':'pending',message:next.status==='completed'?'Replacement delivered and old item retired.':'Replacement or retirement needs recovery.'});
    } catch {results.push({assetId:asset.assetId,status:'pending',message:'This item needs recovery; other items can continue.'});}
  }
  return Object.freeze(results.map(result=>Object.freeze(result)));
}
