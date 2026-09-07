import { verifiedBoardingCommitment } from '../core/boarding-reconciliation.ts';
import { settlementTimeoutMs } from '../core/boarding-status.ts';
import { readFreshBalance } from './balance.ts';
import { MnemonicIdentity, ReadonlyWallet, Wallet, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository, CSVMultisigTapscript, hasBoardingTxExpired, Ramps, type IWallet, type SettleParams } from '@arkade-os/sdk';
import { SIGNET_OPERATOR, requireSignet, withTemporaryWallet, type AccountSecret } from './account.ts';
import { boardingAmounts, assertQuoteUnchanged, type BoardingQuote } from '../core/boarding-quote.ts';
import { readBoardingRecord, writeBoardingRecord, createBoardingAttempt, recoverPreparedBoarding, type BoardingRecord } from '../core/boarding-record.ts';

function config() {
  const arkProvider=new RestArkProvider(SIGNET_OPERATOR);
  const getInfo=arkProvider.getInfo.bind(arkProvider);
  arkProvider.getInfo=async()=>{const info=await getInfo();requireSignet(info.network);return info;};
  const indexerProvider=new RestIndexerProvider(SIGNET_OPERATOR);
  let failed=false;
  const getVtxos=indexerProvider.getVtxos.bind(indexerProvider);
  indexerProvider.getVtxos=async(...args)=>{try{return await getVtxos(...args);}catch(error){failed=true;throw error;}};
  return {options:{arkProvider,indexerProvider,settlementConfig:false as const,storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}},healthy:()=>!failed};
}
async function readonly<T>(account:AccountSecret,signal:AbortSignal,read:(wallet:ReadonlyWallet)=>Promise<T>):Promise<T> {
  const c=config();
  const identity=await MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false}).toReadonly();
  return withTemporaryWallet(ReadonlyWallet.create({...c.options,identity}),signal,async wallet=>{
    const result=await read(wallet);
    const state=wallet.getProviderConnectionState();
    if(!c.healthy()||state.mode!=='online'||state.source!=='live')throw Error('Live transfer data is unavailable.');
    return result;
  });
}
async function plan(wallet:ReadonlyWallet,profileId:string,requested?:number,direction:BoardingQuote['direction']='to-arkade') {
  if(!['to-arkade','to-bitcoin'].includes(direction))throw Error('Unsupported transfer direction.');
  const info=await new RestArkProvider(SIGNET_OPERATOR).getInfo();requireSignet(info.network);
  // The configured Signet operator currently quotes zero fees. Do not guess
  // arbitrary fee formulas or omit a future onchain-change output charge.
  if(info.fees.txFeeRate!=='0'||Object.values(info.fees.intentFee).some(value=>value!==''&&value!=='0'))throw Error('The operator fee schedule changed. Transfers need a new fee verification.');
  const [coins,balance,tip,bitcoinAddress]=await Promise.all([wallet.getBoardingUtxos(),wallet.getBalance(),wallet.onchainProvider.getChainTip(),wallet.getBoardingAddress()]);
  await readFreshBalance({getBalance:async()=>balance,getProviderConnectionState:()=>wallet.getProviderConnectionState()});
  const exit=CSVMultisigTapscript.decode(Uint8Array.from(wallet.boardingTapscript.exitScript.match(/.{2}/g)!.map(v=>parseInt(v,16))));
  const boardingInputs=coins.filter(c=>c.status.confirmed&&!hasBoardingTxExpired(c,exit.params.timelock,tip.height)).sort((a,b)=>a.txid.localeCompare(b.txid)||a.vout-b.vout);
  const inputs=direction==='to-arkade' ? boardingInputs : (await wallet.getSpendableVtxos({withRecoverable:false,withUnrolled:false})).filter(c=>!c.assets?.length).sort((a,b)=>a.txid.localeCompare(b.txid)||a.vout-b.vout);
  const totalInput=inputs.reduce((sum,c)=>sum+c.value,0);
  if(totalInput===0)throw Error(direction==='to-arkade'?'No confirmed eligible Bitcoin funds. Funds already in Arkade do not need boarding.':'No eligible Arkade funds. Asset-bearing or unavailable funds cannot be transferred.');
  const amounts=boardingAmounts(totalInput,requested,direction==='to-arkade'?Math.max(Number(info.vtxoMinAmount),1):Number(info.utxoMinAmount),direction==='to-arkade'?Number(info.utxoMinAmount):Math.max(Number(wallet.dustAmount),Number(info.vtxoMinAmount)));
  if(!Number.isSafeInteger(balance.total)||!Number.isSafeInteger(balance.boarding.total)||balance.boarding.total<0||balance.total<balance.boarding.total)throw Error('Invalid balance response.');
  if(totalInput>(direction==='to-arkade'?balance.boarding.total:balance.available))throw Error('Invalid eligible balance response.');
  if(!bitcoinAddress.startsWith('tb1p'))throw Error('Unsupported account Bitcoin destination.');
  let params: SettleParams | undefined;
  // Capture the SDK's output construction using a facade with no signing or
  // submission capability. Only the later explicitly confirmed path can settle.
  const facade={dustAmount:wallet.dustAmount,getSpendableVtxos:async()=>inputs,getAddress:()=>wallet.getAddress(),getBoardingAddress:async()=>bitcoinAddress,settle:async(p:SettleParams)=>{params=p;return 'quote-only';}} as unknown as IWallet;
  if(direction==='to-arkade')await new Ramps(facade).onboard(info.fees,inputs,BigInt(amounts.amountSats));
  else await new Ramps(facade).offboard(bitcoinAddress,info.fees,BigInt(amounts.amountSats));
  if(!params||params.outputs.reduce((sum,o)=>sum+Number(o.amount),0)!==totalInput)throw Error('Quote does not conserve funds.');
  if(direction==='to-arkade'&&info.vtxoMaxAmount>0n&&BigInt(amounts.amountSats)>info.vtxoMaxAmount)throw Error('Amount exceeds the operator limit.');
  if(direction==='to-bitcoin'&&info.utxoMaxAmount>0n&&BigInt(amounts.amountSats)>info.utxoMaxAmount)throw Error('Amount exceeds the operator limit.');
  if(direction==='to-bitcoin'&&info.vtxoMaxAmount>0n&&BigInt(amounts.changeSats)>info.vtxoMaxAmount)throw Error('Change exceeds the operator limit.');
  if(direction==='to-arkade'&&info.utxoMaxAmount>0n&&BigInt(amounts.changeSats)>info.utxoMaxAmount)throw Error('Change exceeds the operator limit.');
  const raw=JSON.stringify({profileId,direction,inputs:inputs.map(i=>({txid:i.txid,vout:i.vout,value:i.value})),outputs:params.outputs.map(o=>({address:o.address,amount:o.amount.toString()})),fees:info.fees});
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  const quote:BoardingQuote=Object.freeze({profileId,direction,amountSats:amounts.amountSats,feeSats:0,netSats:amounts.amountSats,maxSats:totalInput,bitcoinAfterSats:balance.boarding.total+(direction==='to-arkade'?-amounts.amountSats:amounts.amountSats),arkadeAfterSats:balance.total-balance.boarding.total+(direction==='to-arkade'?amounts.amountSats:-amounts.amountSats),totalAfterSats:balance.total,expiresAt:Date.now()+60000,fingerprint:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')});
  return {quote,params,bitcoinAddress};
}
export async function quoteBoarding(account:AccountSecret,requested:number|undefined,signal:AbortSignal,direction:BoardingQuote['direction']='to-arkade') {
  return readonly(account,signal,async wallet=>(await plan(wallet,account.profileId,requested,direction)).quote);
}
export async function submitBoarding(account:AccountSecret,quote:BoardingQuote,isCurrent:()=>boolean=()=>true):Promise<BoardingRecord> {
  if(quote.profileId!==account.profileId||!['to-arkade','to-bitcoin'].includes(quote.direction)||quote.expiresAt<=Date.now())throw Error('Review a fresh transfer quote.');
  const c=config();
  let active=true;
  let attempt:ReturnType<typeof createBoardingAttempt>|undefined;
  const schedule=await c.options.arkProvider.getInfo();
  const timeout=settlementTimeoutMs(schedule);
  const deadline=Date.now()+timeout;
  const register=c.options.arkProvider.registerIntent.bind(c.options.arkProvider);
  c.options.arkProvider.registerIntent=async intent=>{
    if(!attempt)throw Error('Transfer preparation is incomplete.');
    attempt.beforeRegister();
    try {
      const id=await register(intent);
      attempt.registered(id);
      return id;
    } catch { attempt.interrupted('registration-unconfirmed');throw Error('Submission was not confirmed.'); }
  };
  // Do not allow SDK error recovery to cancel/re-register an ambiguous intent.
  c.options.arkProvider.deleteIntent=async()=>{throw Error('Automatic cancellation is disabled; reconcile the transfer.');};
  try {
    return await withTemporaryWallet(Wallet.create({...c.options,identity:MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false})}),new AbortController().signal,async wallet=>{
      const fresh=await plan(wallet,account.profileId,quote.amountSats,quote.direction);
      const connection=wallet.getProviderConnectionState();
      if(!active || !isCurrent() || Date.now()>=deadline)throw Error('Transfer details changed. Review again.');
      if(!c.healthy() || connection.mode!=='online' || connection.source!=='live')throw Error('Live transfer data is unavailable.');
      assertQuoteUnchanged(quote,fresh.quote);
      const record:BoardingRecord={version:1,id:crypto.randomUUID(),profileId:account.profileId,status:'pending',phase:'prepared',quote:fresh.quote,inputs:fresh.params.inputs.map(i=>{if(typeof i==='string')throw Error('Unexpected input.');return {txid:i.txid,vout:i.vout};}),bitcoinAddress:fresh.bitcoinAddress};
      writeBoardingRecord(record);
      attempt=createBoardingAttempt(record.id,()=>active&&isCurrent(),Math.min(deadline,quote.expiresAt),account.profileId);
      try { attempt.committed(await wallet.settle(fresh.params)); }
      catch { attempt.interrupted(readBoardingRecord(account.profileId)?.phase==='submitting'?'registration-unconfirmed':'settlement-interrupted'); }
      attempt.close();
      return readBoardingRecord(account.profileId)!;
    },timeout);
  } catch(error) {
    attempt?.interrupted(Date.now()>=deadline?'deadline-exceeded':'settlement-interrupted');
    throw error;
  } finally {
    active=false; // Closes late preparation/registration after timeout or disposal.
    attempt?.close();
  }
}
export async function reconcileBoarding(account:AccountSecret,signal:AbortSignal):Promise<BoardingRecord|undefined> {
  const record=readBoardingRecord(account.profileId);
  if(!record||record.profileId!==account.profileId)return;
  if(record.status!=='pending')return record;
  if(record.phase==='prepared')return recoverPreparedBoarding(record);
  const result = await readonly(account,signal,async wallet=>{
    const transactions=await wallet.onchainProvider.getTransactions(record.bitcoinAddress);
    const vtxos=await wallet.getVtxos();
    const consumed=record.quote.direction==='to-bitcoin' ? (await new RestIndexerProvider(SIGNET_OPERATOR).getVtxos({outpoints:record.inputs})).vtxos : [];
    const commitmentTxid=verifiedBoardingCommitment(record,transactions,vtxos,consumed);
    if(commitmentTxid) {
      const current=readBoardingRecord(account.profileId);
      if(current?.id!==record.id)return current;
      return {...record,status:'succeeded' as const,commitmentTxid};
    }
    return record; // Unspent inputs or absent history do not prove failure.
  });
  if(result?.status==='succeeded' && readBoardingRecord(account.profileId)?.id===result.id)writeBoardingRecord(result);
  return result;
}

