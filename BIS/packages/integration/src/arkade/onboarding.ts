import {Wallet,ReadonlyWallet,MnemonicIdentity,RestArkProvider,RestIndexerProvider,InMemoryWalletRepository,InMemoryContractRepository,ArkAddress,CSVMultisigTapscript,hasBoardingTxExpired,Transaction,sdkVersion,type SettleParams} from '@arkade-os/sdk';
import {SIGNET_OPERATOR,requireSignet,type AccountSecret} from './account.ts';
import {walletReservations,eligibleUnreservedCoins} from '../core/wallet-reservations.ts';
import {readOnboardingRecord,type OnboardingRecord,type OnboardingCoin,type OnboardingScope} from '../core/onboarding-record.ts';
import {onboardingFailure,type OnboardingAdapter,type OnboardingFacts,type OnboardingTransaction} from '../core/onboarding-service.ts';
import {onboardingStream} from '../core/onboarding-stream.ts';
import {settlementTimeoutMs} from '../core/boarding-status.ts';
import {withBrowserMutation} from '../core/logout-cleanup.ts';
const hex=(value:Uint8Array)=>Array.from(value,b=>b.toString(16).padStart(2,'0')).join('');
const plain=({txid,vout,value}:OnboardingCoin)=>({txid,vout,value});
const point=(c:{txid:string;vout:number})=>`${c.txid}:${c.vout}`;
const sum=(items:{value:number}[])=>items.reduce((s,c)=>s+c.value,0);
export const onboardingScope=(profileId:string):OnboardingScope=>({profileId,network:'signet',operator:SIGNET_OPERATOR});
function options(provider:RestArkProvider){return {arkProvider:provider,indexerProvider:new RestIndexerProvider(SIGNET_OPERATOR),settlementConfig:false as const,storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}};}
async function bounded<T>(work:Promise<T>,signal:AbortSignal,ms=30000):Promise<T>{
  const stop=AbortSignal.any([signal,AbortSignal.timeout(ms)]);stop.throwIfAborted();let abort:()=>void=()=>{};
  try{return await Promise.race([work,new Promise<never>((_,reject)=>{abort=()=>reject(Error('Onboarding connection deadline exceeded.'));stop.addEventListener('abort',abort,{once:true});})]);}
  finally{stop.removeEventListener('abort',abort);}
}
export async function readOnboardingFacts(wallet:ReadonlyWallet,provider:RestArkProvider,scope:OnboardingScope,r:OnboardingRecord|undefined,signal:AbortSignal):Promise<OnboardingFacts>{
  const [info,coins,receipts,tip,address,own]=await bounded(Promise.all([provider.getInfo(),wallet.getBoardingUtxos(),wallet.getSpendableVtxos({withRecoverable:false,withUnrolled:false}),wallet.onchainProvider.getChainTip(),wallet.getBoardingAddress(),wallet.getAddress()]),signal);
  requireSignet(info.network);const live=wallet.getProviderConnectionState();if(live.mode!=='online'||live.source!=='live')throw Error('Live connection unavailable.');
  const txs=await bounded(wallet.onchainProvider.getTransactions(address),signal);
  const bitcoinScript=hex(wallet.boardingTapscript.pkScript),arkadeScript=hex(ArkAddress.decode(own).pkScript);
  const allReservations=walletReservations(scope.profileId),other=allReservations.filter(v=>v.id!==`onboarding:${r?.id}`);
  const allowed=new Set(eligibleUnreservedCoins([...coins,...receipts],other).map(point));
  const exit=CSVMultisigTapscript.decode(Uint8Array.from(wallet.boardingTapscript.exitScript.match(/.{2}/g)!,v=>parseInt(v,16)));
  const snapshot={...scope,complete:true,unresolvedOnboarding:false,bitcoinScript,arkadeScript,
    boarding:coins.map(c=>({...plain(c),confirmed:c.status.confirmed,expired:hasBoardingTxExpired(c,exit.params.timelock,tip.height),reserved:!allowed.has(point(c))})),
    spendable:receipts.map(c=>({...plain(c),confirmed:true,expired:false,reserved:!allowed.has(point(c))})),
    policy:{zeroFees:info.fees.txFeeRate==='0'&&Object.values(info.fees.intentFee).every(v=>v===''||v==='0'),arkadeMinimum:Math.max(1,Number(info.vtxoMinAmount),Number(wallet.dustAmount)),bitcoinMinimum:Math.max(1,Number(info.utxoMinAmount)),arkadeMaximum:Math.max(0,Number(info.vtxoMaxAmount)),bitcoinMaximum:Math.max(0,Number(info.utxoMaxAmount))}};
  const transactions:OnboardingTransaction[]=txs.filter(tx=>tx.vout.some(o=>o.scriptpubkey_address===address)).map(tx=>({txid:tx.txid,confirmed:tx.status.confirmed,value:tx.vout.filter(o=>o.scriptpubkey_address===address).reduce((s,o)=>s+Number(o.value),0),kind:tx.txid===r?.returning?.commitmentTxid?'return':'incoming'}));
  let next=r;const independent:OnboardingCoin[]=[];
  if(r?.plan&&r.status==='pending'){
    // First-leg evidence binds Bitcoin inputs and the owned output script, not a balance delta.
    if(r.boarding.phase!=='receipt-verified')for(const tx of txs){
      if(r.boarding.commitmentTxid&&r.boarding.commitmentTxid!==tx.txid)continue;
      if(!r.plan.inputs.every(i=>tx.vin?.some(v=>v.txid===i.txid&&v.vout===i.vout)))continue;
      const owned=receipts.filter(c=>c.commitmentTxIds?.includes(tx.txid)&&c.script===r.plan!.arkadeScript);
      if(sum(owned)!==r.plan.totalSats||owned.some(c=>c.assets?.length))continue;
      next={...r,boarding:{...r.boarding,phase:'receipt-verified',commitmentTxid:tx.txid,receipts:owned.map(plain),verifiedAt:Date.now()}};break;
    }
    if(next?.plan&&next.boarding.phase==='receipt-verified'&&next.returning.inputs.length){
      const consumed=(await bounded(wallet.indexerProvider.getVtxos({outpoints:next.returning.inputs.map(({txid,vout})=>({txid,vout}))}),signal)).vtxos;
      const commitment=consumed[0]?.settledBy;
      if(commitment&&next.returning.inputs.every(i=>consumed.some(c=>point(c)===point(i)&&c.value===i.value&&c.isSpent&&c.settledBy===commitment))){
        const tx=txs.find(t=>t.txid===commitment),owned=receipts.filter(c=>c.commitmentTxIds?.includes(commitment)&&c.script===next!.plan!.arkadeScript);
        if(tx&&sum(owned)===next.plan.targetSats&&!owned.some(c=>c.assets?.length)&&tx.vout.filter(o=>o.scriptpubkey_address===address).reduce((s,o)=>s+Number(o.value),0)===next.plan.returnSats)
          next={...next,status:'complete',completedAt:Date.now(),returning:{...next.returning,phase:'receipt-verified',commitmentTxid:commitment,receipts:owned.map(plain),verifiedAt:Date.now()},progress:{stage:'complete',at:Date.now()}};
      }
    }
    const frozen=new Set(r.plan.inputs.map(point));
    independent.push(...coins.filter(c=>!frozen.has(point(c))).map(plain));
    // A receipt from another commitment is independent only when its funding
    // ancestry can be inspected and excludes every frozen boarding input.
    for(const c of receipts){
      if((r.independent??[]).some(i=>point(i)===point(c))){independent.push(plain(c));continue;}
      // After the first leg, a new commitment may be the return leg whose
      // acknowledgement was lost. Keep new Arkade receipts held until that
      // ancestry is resolved; existing independent receipts remain usable.
      if(next?.boarding?.phase==='receipt-verified')continue;
      if(next?.boarding?.receipts?.some(i=>point(i)===point(c)))continue;
      if(!c.commitmentTxIds?.length||c.commitmentTxIds.some(id=>id===next?.boarding?.commitmentTxid||id===next?.returning?.commitmentTxid))continue;
      let independentProof=true;
      for(const id of c.commitmentTxIds){
        try{const raw=await bounded(wallet.onchainProvider.getRawTransaction(id),signal);const tx=Transaction.fromRaw(raw);
          for(let i=0;i<tx.inputsLength;i++){const input=tx.getInput(i);if(input.txid&&frozen.has(`${hex(input.txid)}:${input.index}`))independentProof=false;}}
        catch{independentProof=false;}
      }
      if(independentProof)independent.push(plain(c));
    }
  }else independent.push(...coins.map(plain),...receipts.map(plain));
  for(const [kind,leg] of [['boarding',next?.boarding],['return',next?.returning]] as const){if(!leg?.commitmentTxid)continue;const tx=txs.find(t=>t.txid===leg.commitmentTxid);const existing=transactions.find(t=>t.txid===leg.commitmentTxid);if(existing)existing.kind=kind;else if(tx)transactions.push({txid:tx.txid,kind,confirmed:tx.status.confirmed,value:kind==='boarding'?next!.plan!.totalSats:next!.plan!.returnSats});}
  for(const which of ['boarding','returning'] as const)if(next?.plan){const leg=next[which];if(leg.commitmentTxid&&!leg.bitcoinConfirmedAt&&txs.some(tx=>tx.txid===leg.commitmentTxid&&tx.status.confirmed))next={...next,[which]:{...leg,bitcoinConfirmedAt:Date.now()}};}
  return {snapshot,address,transactions,independent:[...new Map(independent.map(c=>[point(c),c])).values()],...(next&&next!==r?{reconciled:next}:{})};
}
const runtime={provider:()=>new RestArkProvider(SIGNET_OPERATOR),readonly:async(provider:RestArkProvider,account:AccountSecret)=>ReadonlyWallet.create({...options(provider),identity:await MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false}).toReadonly()}),signing:(provider:RestArkProvider,account:AccountSecret)=>Wallet.create({...options(provider),identity:MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false})})};
export function createOnboardingAdapter(account:AccountSecret,isCurrent:()=>boolean,dependencies=runtime):OnboardingAdapter{
  const scope=onboardingScope(account.profileId);
  let cleanup:Promise<void>=Promise.resolve();
  const current=(signal:AbortSignal)=>{signal.throwIfAborted();if(!isCurrent())throw Error('Onboarding account changed.');};
  return {
    async inspect(record,signal){
      await bounded(cleanup,signal);current(signal);
      const provider=dependencies.provider();let wallet:ReadonlyWallet|undefined;
      const acquiring=dependencies.readonly(provider,account);
      try{wallet=await bounded(acquiring,signal);current(signal);return await readOnboardingFacts(wallet,provider,scope,record,signal);}
      finally{cleanup=wallet?wallet.dispose():acquiring.then(w=>w.dispose());void cleanup.catch(()=>{});await bounded(cleanup,signal);}
    },
    async submit(original,which,signal,checkpoint){
      if(!navigator.locks)throw Error('Onboarding lock unavailable.');
      await navigator.locks.request(`bis-onboarding-signer:${account.profileId}`,{ifAvailable:true},async lease=>{
        if(!lease)return;
        await withBrowserMutation(async()=>{
          let wallet:Wallet|undefined,settling:Promise<string>|undefined,attemptTimer:ReturnType<typeof setTimeout>|undefined;const stop=new AbortController(),active=AbortSignal.any([signal,stop.signal]);const provider=dependencies.provider();let hash:string|undefined,open=true,progressWindow=300000,deadline=Date.now()+300000;
          const assert=()=>{current(active);if(!open||Date.now()>=deadline)throw Error('Onboarding signing deadline exceeded.');};
          const progress=async(stage:NonNullable<OnboardingRecord['progress']>['stage'])=>{assert();await checkpoint(r=>{
            if(r.status!=='pending'||r.id!==original.id)return r;
            const order=['preparing','registered','participating','signing','broadcast','checking','complete'];
            if(r.progress&&order.indexOf(stage)<order.indexOf(r.progress.stage))return r;
            return {...r,...(stage==='participating'?{[which]:{...r[which],participatedAt:r[which].participatedAt??Date.now()}}:{}),progress:{stage,at:Date.now(),...(r.progress?.failure?{failure:r.progress.failure}:{})}};
          });};
          const register=provider.registerIntent.bind(provider);
          let registrationFailure:'duplicate-input'|'operator-policy'|'registration-unknown'|undefined;
          provider.registerIntent=async intent=>{
            assert();await checkpoint(r=>{if(!r.plan||r.id!==original.id||r[which].phase!=='prepared')throw Error('Onboarding registration already attempted.');return {...r,[which]:{...r[which],phase:'submitting',startedAt:Date.now(),sdkVersion:sdkVersion.replace('ts-sdk/','')}};});
            assert();let id:string;
            try{id=await register(intent);}catch(error){
              const message=error instanceof Error?error.message:'';
              registrationFailure=/duplicat.*input/i.test(message)?'duplicate-input':/fee|dust|amount.*limit|invalid.*output/i.test(message)?'operator-policy':'registration-unknown';
              throw Error('Onboarding registration outcome unknown.');
            }
            await checkpoint(r=>{if(!r.plan||r.id!==original.id)throw Error('Onboarding account changed.');return {...r,[which]:{...r[which],phase:'registered',intentId:id,registeredAt:Date.now()},progress:{stage:'registered',at:Date.now()}};});
            hash=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id))));return id;
          };
          provider.deleteIntent=async()=>{throw Error('Automatic intent deletion is disabled; reconcile registration.');};
          const stream=provider.getEventStream.bind(provider);
          provider.getEventStream=(s,topics)=>onboardingStream(a=>stream(a,topics),AbortSignal.any([s,active]),()=>hash,progressWindow,Math.max(1,deadline-Date.now()),event=>{if(event.type==='batch_failed')throw Error('Selected onboarding batch failed.');});
          const confirm=provider.confirmRegistration.bind(provider);provider.confirmRegistration=async id=>{assert();if(readOnboardingRecord(scope)?.[which]?.intentId!==id)throw Error('Onboarding registration changed.');await confirm(id);await progress('participating');};
          const nonces=provider.submitTreeNonces.bind(provider);provider.submitTreeNonces=async(...args)=>{assert();await nonces(...args);await progress('signing');};
          const signatures=provider.submitTreeSignatures.bind(provider);provider.submitTreeSignatures=async(...args)=>{assert();await signatures(...args);await progress('signing');};
          const forfeits=provider.submitSignedForfeitTxs.bind(provider);provider.submitSignedForfeitTxs=async(...args)=>{assert();await forfeits(...args);await progress('signing');};
          let acquisition:Promise<Wallet>|undefined;
          try{
            const info=await bounded(provider.getInfo(),active);requireSignet(info.network);progressWindow=settlementTimeoutMs(info);deadline=Date.now()+progressWindow;
            attemptTimer=setTimeout(()=>{open=false;stop.abort();},Math.max(1,deadline-Date.now()));
            acquisition=dependencies.signing(provider,account);wallet=await bounded(acquisition,active);assert();
            const r=readOnboardingRecord(scope);if(!r?.plan||r.id!==original.id||r[which].phase!=='prepared')return;
            const facts=await readOnboardingFacts(wallet,provider,scope,r,active),p=r.plan,policy=facts.snapshot.policy;
            if(!policy.zeroFees||p.targetSats<policy.arkadeMinimum||p.returnSats<policy.bitcoinMinimum||policy.arkadeMaximum>0&&p.totalSats>policy.arkadeMaximum||policy.bitcoinMaximum>0&&p.returnSats>policy.bitcoinMaximum||p.bitcoinScript!==facts.snapshot.bitcoinScript||p.arkadeScript!==facts.snapshot.arkadeScript){
              if(which==='boarding')await checkpoint(v=>v.plan&&v.id===r.id&&v.boarding.phase==='prepared'?{...v,status:'not-submitted'}:v);
              throw Error('Onboarding terms changed.');
            }
            const candidates=which==='boarding'?await bounded(wallet.getBoardingUtxos(),active):await bounded(wallet.getSpendableVtxos({withRecoverable:false,withUnrolled:false}),active);
            const eligible=new Set(eligibleUnreservedCoins(candidates,walletReservations(account.profileId).filter(o=>o.id!==`onboarding:${r.id}`)).map(point));
            const selected=r[which].inputs.map(i=>candidates.find(c=>point(c)===point(i)&&c.value===i.value&&eligible.has(point(c))));
            if(selected.some(c=>!c)||which==='boarding'&&r.plan.inputs.some(i=>!facts.snapshot.boarding.some(c=>point(c)===point(i)&&c.confirmed&&!c.expired&&!c.reserved))){
              if(which==='boarding')await checkpoint(v=>v.plan&&v.boarding.phase==='prepared'?{...v,status:'not-submitted'}:v);
              throw Error('Onboarding inputs changed.');
            }
            const own=await wallet.getAddress(),address=await wallet.getBoardingAddress();
            if(selected.some(c=>c&&'assets' in c&&Array.isArray(c.assets)&&c.assets.length))throw Error('Onboarding inputs contain assets.');
            const params:SettleParams={inputs:selected as SettleParams['inputs'],outputs:which==='boarding'?[{address:own,amount:BigInt(p.totalSats)}]:[{address,amount:BigInt(p.returnSats)},{address:own,amount:BigInt(p.targetSats)}]};
            // The SDK builds/signs the exact constrained input/output intent.
            settling=wallet.settle(params);
            const commitment=await bounded(settling,active,Math.max(1,deadline-Date.now()));
            await checkpoint(v=>v.plan&&v.id===r.id&&v.status==='pending'?{...v,[which]:{...v[which],commitmentTxid:commitment,finalizedAt:v[which].finalizedAt??Date.now()},progress:{stage:'broadcast',at:Date.now()}}:v);
          }catch(error){
            if(!signal.aborted&&isCurrent())await checkpoint(r=>r.status==='pending'?{...r,[which]:{...r[which],failureCode:registrationFailure??onboardingFailure(error)},interrupted:true,progress:{stage:r.progress?.stage??'checking',at:Date.now(),failure:onboardingFailure(error),failures:(r.progress?.failures??0)+1,retryAt:Date.now()+Math.min(60000,5000*2**Math.min(r.progress?.failures??0,4))}}:r);
          }finally{
            open=false;stop.abort();clearTimeout(attemptTimer);
            // Keep signer ownership until actual SDK cleanup ends, including a late acquisition.
            if(wallet)await Promise.allSettled([wallet.dispose(),...(settling?[settling]:[])]);else if(acquisition)await acquisition.then(w=>w.dispose()).catch(()=>{});
          }
        });
      });
    }
  };
}
