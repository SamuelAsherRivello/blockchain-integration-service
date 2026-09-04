import {ReadonlyWallet,MnemonicIdentity,RestArkProvider,RestIndexerProvider,InMemoryWalletRepository,InMemoryContractRepository} from '@arkade-os/sdk';
import {createAccountStorage} from '../../integration/src/core/account-storage';
import {SIGNET_OPERATOR,requireSignet,withTemporaryWallet} from '../../integration/src/arkade/account';
const button=document.getElementById('inspect') as HTMLButtonElement;
button.onclick=async()=>{
 button.disabled=true;document.getElementById('result')!.textContent='Reading live wallet...';
 try {
  const {account}=await createAccountStorage().load();if(!account)throw Error('No saved player account.');
  const signal=AbortSignal.timeout(45000),provider=new RestArkProvider(SIGNET_OPERATOR);
  const info=await provider.getInfo();requireSignet(info.network);
  const result=await withTemporaryWallet(ReadonlyWallet.create({identity:await MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false}).toReadonly(),arkProvider:provider,indexerProvider:new RestIndexerProvider(SIGNET_OPERATOR),storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}}),signal,async wallet=>{
   const balance=await wallet.getBalance();
   const raw=await wallet.getVtxos({withRecoverable:true,withUnrolled:true});
   const strict=await wallet.getSpendableVtxos({withRecoverable:false,withUnrolled:false});
   const recovery=await wallet.getSpendableVtxos({withRecoverable:true,withUnrolled:false});
   const free=strict.filter(c=>!c.assets?.length);
   const history=await wallet.getTransactionHistory();
   const summarize=(coins:typeof raw)=>({count:coins.length,sats:coins.reduce((n,c)=>n+c.value,0)});
   return {history:history.map(tx=>({key:tx.key,type:tx.type,amount:tx.amount,settled:tx.settled,assets:tx.assets?.map(a=>({assetId:a.assetId,amount:String(a.amount)}))})),profileId:account.profileId,connection:wallet.getProviderConnectionState(),operator:{network:info.network,minimumSats:String(info.vtxoMinAmount),fees:info.fees},balance:{available:balance.available,total:balance.total,settled:balance.settled,preconfirmed:balance.preconfirmed,recoverable:balance.recoverable},raw:summarize(raw),strictSdkSpendable:summarize(strict),withRecoverable:summarize(recovery),afterFormerAssetFreeFilter:summarize(free),outputs:raw.map(c=>({txid:c.txid,vout:c.vout,sats:c.value,assetCount:c.assets?.length??0,assets:c.assets?.map(a=>({assetId:a.assetId,amount:String(a.amount)})),sdkSpendable:strict.some(s=>s.txid===c.txid&&s.vout===c.vout),state:c.virtualStatus?.state}))};
  },45000);
  document.getElementById('result')!.textContent=JSON.stringify(result,null,2);
 }catch{document.getElementById('result')!.textContent='Live diagnostic unavailable. No wallet changes performed.';}
 finally{button.disabled=false;}
};
