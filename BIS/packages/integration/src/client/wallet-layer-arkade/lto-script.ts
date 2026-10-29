import { ConditionMultisigTapscript, ConditionCSVMultisigTapscript, MultisigTapscript, CSVMultisigTapscript, VtxoScript } from '@arkade-os/sdk';
import { Script } from '@scure/btc-signer';

/** Funded LTO script used by the Signet contract adapter.
 * The deadline is a client eligibility rule; the cooperative refund has no timelock.
 * Claim and refund compete for the same output, so callers must reconcile uncertain spends.
 */
export function buildLtoScript(params: {playerKey:Uint8Array;gameKey:Uint8Array;operatorKey:Uint8Array;secretHash:Uint8Array;exitDelay:bigint;prototypeSameWallet?:boolean}) {
  const {playerKey,gameKey,operatorKey,secretHash,exitDelay}=params;
  const keys=[playerKey,gameKey,operatorKey];
  const same=(a:Uint8Array,b:Uint8Array)=>a.every((value,index)=>value===b[index]);
  if(keys.some(k=>k.length!==32)||secretHash.length!==32||exitDelay<=0n||
    params.prototypeSameWallet!==undefined&&typeof params.prototypeSameWallet!=='boolean'||
    same(playerKey,operatorKey)||same(gameKey,operatorKey)||same(playerKey,gameKey)&&params.prototypeSameWallet!==true)throw Error('Invalid LTO script parameters.');
  const conditionScript=Script.encode(['SHA256',secretHash,'EQUAL']);
  const claim=ConditionMultisigTapscript.encode({conditionScript,pubkeys:[playerKey,operatorKey]}).script;
  const refund=MultisigTapscript.encode({pubkeys:[gameKey,operatorKey]}).script;
  const timelock={type:'seconds' as const,value:exitDelay};
  const claimExit=ConditionCSVMultisigTapscript.encode({conditionScript,pubkeys:[playerKey],timelock}).script;
  const refundExit=CSVMultisigTapscript.encode({pubkeys:[gameKey],timelock}).script;
  return {script:new VtxoScript([claim,refund,claimExit,refundExit]),claim,refund};
}
