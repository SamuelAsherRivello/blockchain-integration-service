import test from 'node:test';
import assert from 'node:assert/strict';
import {assetName,assetDecimals,formatAssetQuantity,formatAssetDetail,assetExplorerUrl} from '../src/core/asset-presentation.ts';
test('asset explorer uses the full Arkade asset ID on signet and rejects invalid IDs',()=>{
  const assetId='a'.repeat(64)+'0000';
  assert.equal(assetExplorerUrl(assetId),`https://explorer.signet.arkade.sh/asset/${assetId}`);
  for(const invalid of ['', 'a'.repeat(64), 'g'.repeat(68), '../asset', 'https://example.com']) assert.equal(assetExplorerUrl(invalid),undefined);
});
test('exact decimal placement preserves large integers and supported precision',()=>{
  for(const [quantity,decimals,expected] of [['9007199254740993',0,'9007199254740993'],['12345',2,'123.45'],['1',18,'0.000000000000000001']]) {
    assert.equal(formatAssetQuantity({assetId:'a',quantity,decimals,ticker:'AST'}),`${expected} AST`);
  }
});
test('missing and invalid metadata never imply zero decimals',()=>{
  for(const decimals of [undefined,-1,19,1.5,NaN]) {
    const asset={assetId:'asset-id',quantity:'9007199254740993',decimals};
    assert.equal(assetDecimals(asset),undefined);
    assert.equal(formatAssetQuantity(asset),'9007199254740993 base units');
    assert.match(formatAssetDetail(asset),/Decimals: Not provided/);
  }
  assert.equal(assetName({assetId:'asset-id',quantity:'1',name:' '}),'Asset asset-id');
  assert.equal(assetName({assetId:'asset-id',quantity:'1',name:'Not provided'}),'Not provided');
});
test('copy includes full identity and public facts in stable order for duplicate names',()=>{
  const a={assetId:'a'.repeat(64),quantity:'1',decimals:0,name:'Level 1',ticker:'LVL1',iconUrl:'https://unused.invalid/icon'};
  const b={...a,assetId:'b'.repeat(64)};
  assert.equal(formatAssetDetail(a),`Asset ID: ${a.assetId}\nOwned quantity: 1 LVL1\nOwned quantity (base units): 1\nName: Level 1\nTicker: LVL1\nDecimals: 0\nIcon URL: https://unused.invalid/icon\nExplorer URL: Not available`);
  assert.notEqual(formatAssetDetail(a),formatAssetDetail(b));
});
