export type BoardingAsset = {assetId:string;amount:string};
export type BoardingAssetChange = {script:string;sats:number;assets:BoardingAsset[]};

// Exact public quantities for fingerprints and recovery; never round through Number.
export function boardingAssets(coins: {value?:number;assets?:{assetId:string;amount:bigint}[]}[]):BoardingAsset[] {
 const totals=new Map<string,bigint>();
 for(const coin of coins)for(const asset of coin.assets??[]) {
  if(!/^[a-f0-9]{68}$/.test(asset.assetId)||typeof asset.amount!=='bigint'||asset.amount<=0n)throw Error('Live asset data is unavailable.');
  totals.set(asset.assetId,(totals.get(asset.assetId)??0n)+asset.amount);
 }
 return [...totals].sort(([a],[b])=>a.localeCompare(b)).map(([assetId,amount])=>({assetId,amount:String(amount)}));
}

export function validBoardingAssetChange(change:BoardingAssetChange,inputSats:number,amountSats:number) {
 return !!change && /^5120[a-f0-9]{64}$/.test(change.script) && Number.isSafeInteger(change.sats) && change.sats>0 &&
  change.sats===inputSats-amountSats && Array.isArray(change.assets) && change.assets.length>0 &&
  change.assets.every(a=>a && /^[a-f0-9]{68}$/.test(a.assetId) && typeof a.amount==='string' && /^[1-9][0-9]*$/.test(a.amount)) &&
  new Set(change.assets.map(a=>a.assetId)).size===change.assets.length;
}
