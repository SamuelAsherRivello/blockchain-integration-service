import {MnemonicIdentity,Transaction,RestArkProvider,RestIndexerProvider,DefaultVtxo,VtxoScript,CSVMultisigTapscript,buildOffchainTx} from '@arkade-os/sdk';
import {SIGNET_OPERATOR,requireSignet,type AccountSecret} from './account.ts';
import {buildLtoScript} from './lto-script.ts';
import {bytesHex,fromHex} from '../core/hosted-protocol.ts';
import type {ContractRecord} from '../core/contracts.ts';
import type {ContractRecovery} from '../core/contract-storage.ts';
export type ClaimChallenge={id:string;contractId:string;stage?:'ark'|'checkpoint';transaction:string;record:ContractRecord;recovery:ContractRecovery};
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function signHostedClaim(challenge:ClaimChallenge,account:AccountSecret,gameId:string):Promise<string> {
 const {record,recovery}=challenge;
 if(record.id!==challenge.contractId||record.scope.playerId!==account.profileId||record.scope.gameId!==gameId||record.scope.operator!==SIGNET_OPERATOR||record.scope.network!=='signet'||record.operation.kind!=='claim'||!recovery.fundingOutput)throw Error('Claim does not belong to this account.');
 const identity=MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false}),playerKey=await identity.xOnlyPublicKey();
 const info=await new RestArkProvider(SIGNET_OPERATOR).getInfo();requireSignet(info.network);
 const operatorKey=fromHex(info.signerPubkey).slice(-32);
 if(bytesHex(playerKey)!==recovery.playerKey||bytesHex(operatorKey)!==recovery.operatorKey)throw Error('Claim identity changed.');
 const secretHash=new Uint8Array(await crypto.subtle.digest('SHA-256',fromHex(recovery.secretHex)));
 const contract=buildLtoScript({playerKey,gameKey:fromHex(recovery.gameKey),operatorKey,secretHash,exitDelay:BigInt(recovery.exitDelay)});
 const playerScript=new DefaultVtxo.Script({pubKey:playerKey,serverPubKey:operatorKey,csvTimelock:{type:'seconds',value:BigInt(recovery.exitDelay)}});
 if(bytesHex(contract.script.encode())!==recovery.contractScript||bytesHex(playerScript.encode())!==recovery.playerScript)throw Error('Claim script changed.');
 const source=VtxoScript.decode(fromHex(recovery.contractScript));
 const expected=buildOffchainTx([{...recovery.fundingOutput,tapLeafScript:source.findLeaf(bytesHex(contract.claim)),tapTree:source.encode()}],[{script:playerScript.pkScript,amount:BigInt(record.amountSats)}],CSVMultisigTapscript.decode(fromHex(info.checkpointTapscript)));
 const incoming=Transaction.fromPSBT(decode(challenge.transaction));
 const target=[expected.arkTx,...expected.checkpoints].find(tx=>bytesHex(tx.unsignedTx)===bytesHex(incoming.unsignedTx));
 if(!target)throw Error('Claim transaction changed.');
 if(challenge.stage==='checkpoint'&&target===expected.arkTx)throw Error('Recovery must only finalize the original claim.');
 if(target===expected.arkTx) {
  if(Date.now()>=record.expiresAt)throw Error('The offer expired.');
  const {vtxos}=await new RestIndexerProvider(SIGNET_OPERATOR).getVtxos({outpoints:[recovery.fundingOutput]});
  if(!vtxos.some(c=>c.txid===recovery.fundingOutput!.txid&&c.vout===recovery.fundingOutput!.vout&&c.value===record.amountSats&&c.script===bytesHex(source.pkScript)&&!c.isSpent&&!c.spentBy&&!c.assets?.length))throw Error('Claim funding could not be verified.');
 }
 const signed=await identity.sign(target.clone().combine(incoming));
 return btoa(String.fromCharCode(...signed.toPSBT()));
}
