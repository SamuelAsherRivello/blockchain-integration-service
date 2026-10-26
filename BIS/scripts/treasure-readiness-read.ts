// Protected read comparison only. The SDK-only branch uses a readonly identity;
// the retained BIS branch uses its normal ephemeral wallet with automatic
// settlement disabled and invokes balance reads only. Never call signing methods.
// Output contains fixed diagnostics and public amounts.
import {ReadonlyWallet,MnemonicIdentity,RestArkProvider,RestIndexerProvider,InMemoryWalletRepository,InMemoryContractRepository} from '@arkade-os/sdk';
import {Vault} from './test-wallets/vault.ts';
import {loadBalance} from '../packages/integration/src/client/wallet-layer-arkade/balance.ts';
import {withTemporaryWallet} from '../packages/integration/src/client/wallet-layer-arkade/account.ts';
import {createAppWalletSession} from '../packages/integration/src/client/wallet-layer-arkade/app-wallet-session.ts';
import {bindRoleWallet} from '../packages/integration/src/client/wallet-layer-arkade/adapter-session.ts';
import {observeAcceptance} from './treasure-acceptance-policy.ts';
for(const method of ['log','info','warn','error','debug','trace','dir'])console[method]=()=>{};
const requests:any[]=[];let phase='authorization';
const emit=value=>process.stdout.write(JSON.stringify({phase,...value})+'\n');
const originalFetch=globalThis.fetch;
try{
  if(process.argv.length!==2&&!(process.argv.length===3&&process.argv[2]==='--browser'))throw Error('arguments');
  const account=await new Vault().transaction(state=>{
    const pair=state.pairs.find(row=>row.label==='treasure-signet-pair');
    const account=state.accounts.find(row=>row.label===pair?.game);
    if(pair?.network!=='signet'||!account?.grant?.active||!account.grant.networks.includes('signet'))throw Error('test-grant-unavailable');
    return {...account,network:'signet' as const};
  });
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
    const row:any={phase,service:url.hostname==='signet.arkade.sh'?'operator':url.hostname.includes('mempool')?'bitcoin-explorer':'other',
      path:url.pathname.split('/').map(part=>/^[A-Za-z-]{0,40}$/.test(part)?part:':value').slice(0,5).join('/')};requests.push(row);
    try{
      const response=await originalFetch(input,{...init,signal:AbortSignal.any([...(init.signal?[init.signal]:[]),AbortSignal.timeout(15000)])});
      row.status=response.status;return response;
    }catch(error){row.failed=true;row.timeout=error?.name==='TimeoutError'||error?.name==='AbortError';throw error;}
  };
  for(const selected of ['sdk-readonly','bis-standalone','bis-retained'] as const){
    phase=selected;const start=Date.now();
    try{
      let result;
      if(selected==='sdk-readonly'){
        const operator='https://signet.arkade.sh';
        const provider=new RestArkProvider(operator),getInfo=provider.getInfo.bind(provider);
        provider.getInfo=async()=>{const info=await getInfo();if(info.network!=='signet')throw Error('network-mismatch');return info;};
        const pending=ReadonlyWallet.create({identity:await MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false}).toReadonly(),
          arkProvider:provider,indexerProvider:new RestIndexerProvider(operator),
          storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()},
          watcherConfig:{failsafePollIntervalMs:60000,reconnectDelayMs:60000,maxReconnectAttempts:1}});
        result=await withTemporaryWallet(pending,AbortSignal.timeout(30000),async wallet=>{
          const balance=await wallet.getBalance(),connection=wallet.getProviderConnectionState();
          return {available:balance.available,total:balance.total,boarding:balance.boarding,
            online:connection.mode==='online',live:connection.source==='live'};
        });
      }else if(selected==='bis-standalone')result=await loadBalance(account,AbortSignal.timeout(30000));
      else{
        const owner=createAppWalletSession();
        try{result=await loadBalance(account,AbortSignal.timeout(30000),bindRoleWallet(owner,'game'));}
        finally{await owner.dispose();}
      }
      emit({completed:true,milliseconds:Date.now()-start,result});
    }catch(error){emit({completed:false,milliseconds:Date.now()-start,
      flags:['Balance unavailable','connection interrupted','timed out','network-mismatch','fetch failed'].filter(flag=>String(error?.message).includes(flag))});}
  }
  if(process.argv[2]==='--browser'){
    phase='sdk-fresh-browser';
    const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
    const failures=[];
    try{
      const page=await browser.newPage();
      page.on('requestfailed',request=>{
        const url=new URL(request.url());
        failures.push({service:url.hostname.includes('mempool')?'bitcoin-explorer':url.hostname==='signet.arkade.sh'?'operator':'other',
          code:/^net::ERR_[A-Z_]+$/.test(request.failure()?.errorText??'')?request.failure().errorText:'other'});
      });
      await page.goto('http://127.0.0.1:5174/integration/',{waitUntil:'domcontentloaded'});
      const publicKey=Array.from(await(await MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false}).toReadonly()).compressedPublicKey());
      const result=await observeAcceptance(page.evaluate(async key=>{
        const {readPublicTreasureWallet}=await import('/BIS/scripts/treasure-readonly-browser.ts');return readPublicTreasureWallet(key);
      },publicKey),45000);
      emit({completed:true,result,failures});
    }catch(error){emit({completed:false,timeout:String(error?.message).includes('observation-timeout'),failures,
      flags:['unsafe-eval','Content Security Policy','network-mismatch','Failed to fetch','dynamically imported module','invalid-public-key','is not a function'].filter(flag=>String(error?.message).includes(flag))});}
    finally{await browser.close();}
  }
  phase='complete';emit({requests,financialActions:0});
}catch{emit({completed:false,reason:'protected-read-comparison-unavailable'});process.exitCode=1;}
finally{globalThis.fetch=originalFetch;}
