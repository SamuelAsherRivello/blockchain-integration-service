import {createBisAssetFormatRegistry} from '../../src/client/state-layer-core/asset-format.ts';

/** Test-only future format: production remains at 0.0.1. */
export const assetFormat002Fixture=createBisAssetFormatRegistry([
  {version:'0.0.1'},
  {version:'0.0.2',predecessors:{'0.0.1':asset=>({name:asset.name??'Upgraded asset',ticker:asset.ticker??'UPG',amount:asset.quantity,decimals:asset.decimals??0,iconUrl:asset.iconUrl,metadata:{...(asset.metadata??{}),bisAssetFormatVersion:'0.0.2'}})},autoUpgrade:true},
]);
export const assetFormat002OptOutFixture=createBisAssetFormatRegistry([{version:'0.0.1'},{version:'0.0.2',predecessors:{'0.0.1':false},autoUpgrade:false}]);
