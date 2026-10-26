import { isDeepStrictEqual } from 'node:util';
import { Extension, type Transaction, type DefaultVtxo } from '@arkade-os/sdk';
import { buildLtoScript } from '../../../integration/src/client/wallet-layer-arkade/lto-script.ts';
import { validateOffchainPayment, type TrustedPaymentContext } from './offchain-policy.ts';
import { validateAssetDelivery } from './asset-policy.ts';
import { validateOwnerOffchain } from './owner-offchain-policy.ts';
import {treasureContractScripts,validateTreasureContractTransaction,type TreasureContractIntent} from './treasure-contract-policy.ts';

export type GameContractIntent = Readonly<{ kind: 'fund' | 'refund'; secretHash: string }> | TreasureContractIntent;
const deny = () => Error('Offchain payment contract is outside the signing policy.');

/** Only a public hash is accepted. Never send the browser's recovery preimage.
 * Keys, operator and exit delay are independently derived from verified scope.
 */
export function parseGameContractIntent(value: unknown): GameContractIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw deny();
  const input = value as Record<string, unknown>;
  if(input.artifactVersion===3){
    const text=(v:unknown)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v);
    if(Object.keys(input).length!==6||!['artifactVersion','kind','branch','offerSessionId','hostReference','startedAtMs'].every(key=>Object.hasOwn(input,key))||
      !['fund','refund'].includes(String(input.kind))||!['fund','reject','cancel','refund'].includes(String(input.branch))||(input.kind==='fund')!==(input.branch==='fund')||
      !text(input.offerSessionId)||!text(input.hostReference)||!Number.isSafeInteger(input.startedAtMs)||(input.startedAtMs as number)<500_000_000_000||(input.startedAtMs as number)>Number.MAX_SAFE_INTEGER-90_000)throw deny();
    return Object.freeze({...input}) as TreasureContractIntent;
  }
  if(input.artifactVersion===4){
    const text=(v:unknown)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v);
    if(Object.keys(input).length!==6||!['artifactVersion','kind','branch','offerSessionId','hostReference','startedAtMs'].every(key=>Object.hasOwn(input,key))||
      !['fund','refund'].includes(String(input.kind))||!['fund','reject','cancel','refund'].includes(String(input.branch))||
      (input.kind==='fund')!==(input.branch==='fund')||!text(input.offerSessionId)||!text(input.hostReference)||
      !Number.isSafeInteger(input.startedAtMs)||(input.startedAtMs as number)<500_000_000_000||(input.startedAtMs as number)>Number.MAX_SAFE_INTEGER-90_000)throw deny();
    return Object.freeze({...input}) as TreasureContractIntent;
  }
  if (Object.keys(input).length !== 2 || !['fund', 'refund'].includes(String(input.kind)) || typeof input.secretHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.secretHash)) throw deny();
  return Object.freeze({ kind: input.kind as GameContractIntent['kind'], secretHash: input.secretHash });
}

export function gameContractScripts(intent: GameContractIntent, game: DefaultVtxo.Script, keys: {
  gameKey: Uint8Array; playerKey: Uint8Array; operatorKey: Uint8Array; exitDelay: bigint;
}, observation?:{network:string;observedAtMs:number}) {
  if('artifactVersion' in intent){if(!observation)throw deny();return treasureContractScripts(intent,game,keys,observation);}
  const contract = buildLtoScript({ ...keys, secretHash: Buffer.from(intent.secretHash, 'hex') });
  return intent.kind === 'fund'
    ? { source: game, leaf: game.forfeit(), recipientScript: contract.script.pkScript }
    : { source: contract.script, leaf: contract.script.findLeaf(Buffer.from(contract.refund).toString('hex')), recipientScript: game.pkScript };
}

/** Fund only the exact verified Player/Game hashlock contract. Refunds may
 * return funds only to the Game. This neither proves gameplay completion nor
 * submits a transaction or stores the browser's contract recovery material.
 */
export function validateGameContractTransaction(tx: Transaction, context: TrustedPaymentContext, intent: GameContractIntent) {
  if('artifactVersion' in intent){try{return validateTreasureContractTransaction(tx,context,intent);}catch{throw deny();}}
  if (intent.kind === 'fund') {
    const hasAssets = Array.from({ length: tx.outputsLength }, (_, i) => tx.getOutput(i).script).some(script => script && Extension.isExtension(script));
    const plan = hasAssets ? validateAssetDelivery(tx, context, new Set()) : validateOffchainPayment(tx, context);
    return { ...plan, contractPolicy: true as const };
  }
  if (context.inputs.some(input => input.assets.length) || !isDeepStrictEqual(context.recipientScript, context.changeScript)) throw deny();
  for (let i = 0; i < tx.outputsLength - 1; i++) if (!isDeepStrictEqual(tx.getOutput(i).script, context.changeScript)) throw deny();
  return { ...validateOwnerOffchain(tx, context), contractPolicy: true as const };
}
