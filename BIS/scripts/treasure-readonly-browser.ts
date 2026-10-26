import {ReadonlyWallet,ReadonlySingleKey,RestArkProvider,RestIndexerProvider,InMemoryWalletRepository,InMemoryContractRepository,EsploraProvider} from '@arkade-os/sdk';
/** Official SDK read in a fresh browser with a public key only. No saved
 * profile, recovery phrase, signing identity or BIS wallet controller exists.
 */
export async function readPublicTreasureWallet(publicKey:number[]){
  if(!Array.isArray(publicKey)||![32,33].includes(publicKey.length)||publicKey.some(byte=>!Number.isInteger(byte)||byte<0||byte>255))throw Error('invalid-public-key');
  const operator='https://signet.arkade.sh',provider=new RestArkProvider(operator),getInfo=provider.getInfo.bind(provider);
  provider.getInfo=async()=>{const info=await getInfo();if(info.network!=='signet')throw Error('network-mismatch');return info;};
  const wallet=await ReadonlyWallet.create({identity:ReadonlySingleKey.fromPublicKey(new Uint8Array(publicKey)),
    arkProvider:provider,indexerProvider:new RestIndexerProvider(operator),
    onchainProvider:new EsploraProvider('https://mempool.space/signet/api',{forcePolling:true,pollingInterval:15000}),
    storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()},
    watcherConfig:{failsafePollIntervalMs:60000,reconnectDelayMs:60000,maxReconnectAttempts:1}});
  try{
    const balance=await wallet.getBalance(),connection=wallet.getProviderConnectionState();
    return {available:balance.available,total:balance.total,boarding:balance.boarding,online:connection.mode==='online',live:connection.source==='live'};
  }finally{await wallet.dispose();}
}
