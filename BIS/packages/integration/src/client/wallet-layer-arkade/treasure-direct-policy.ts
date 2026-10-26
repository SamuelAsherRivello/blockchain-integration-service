import type {TestNetwork} from '../state-layer-core/test-network.ts';

/** Direct SubmitTx/FinalizeTx only. This does not qualify settlement, renewal or exits.
 * Intent fee expressions must never be evaluated or treated as zero here. The
 * caller must prohibit intent submission and bind exact principal/change outputs.
 */
export function inspectTreasureDirectPolicy(network:TestNetwork,info:unknown) {
  const value=info as {network?:string;signerPubkey?:string;fees?:{txFeeRate?:string;intentFee?:unknown};
    dust?:string|number|bigint;vtxoMinAmount?:string|number|bigint;vtxoMaxAmount?:string|number|bigint};
  if(!value||value.network!==network||!['signet','mutinynet'].includes(network)||
    !/^(02|03)[a-f0-9]{64}$/.test(value.signerPubkey??'')||
    typeof value.fees?.txFeeRate!=='string'||!/^\s*\+?0+(?:\.0*)?\s*$/.test(value.fees.txFeeRate))
    throw Error('Treasure direct transaction policy is unsupported.');
  try{
    const integers=[value.dust,value.vtxoMinAmount,value.vtxoMaxAmount].map(v=>{
      if(v===undefined||!/^[-]?\d+$/.test(String(v)))throw Error();
      return BigInt(v);
    });
    const [dust,min,max]=integers;
    if(dust<0n||dust>1000n||min<0n||min>1000n||(max!==-1n&&max<1000n))throw Error();
  }catch{throw Error('Treasure direct transaction limits are unsupported.');}
  return Object.freeze({route:'direct-only' as const,amountSats:1000 as const,
    fingerprint:JSON.stringify({network,signer:value.signerPubkey,fees:value.fees,
      dust:String(value.dust),min:String(value.vtxoMinAmount),max:String(value.vtxoMaxAmount)})});
}
