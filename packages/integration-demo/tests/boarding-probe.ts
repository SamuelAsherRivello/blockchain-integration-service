import { ReadonlyWallet, MnemonicIdentity, RestArkProvider, InMemoryWalletRepository, InMemoryContractRepository, Ramps, CSVMultisigTapscript, hasBoardingTxExpired, type IWallet, type SettleParams } from '@arkade-os/sdk';
import { createAccountStorage } from '../../integration/src/core/account-storage';
import { SIGNET_OPERATOR, requireSignet, withTemporaryWallet } from '../../integration/src/arkade/account';
import { readBoardingRecord } from '../../integration/src/core/boarding-record';
import { RestIndexerProvider } from '@arkade-os/sdk';

const result=document.getElementById('result')!;
document.getElementById('run')!.onclick=async()=>{
  result.textContent='Checking without signing or submitting...';
  try {
    const {account}=await createAccountStorage().load();
    if(!account){result.textContent='No saved account.';return;}
    const provider=new RestArkProvider(SIGNET_OPERATOR);
    const info=await provider.getInfo();requireSignet(info.network);
    const identity=await MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false}).toReadonly();
    const output=await withTemporaryWallet(ReadonlyWallet.create({identity,arkProvider:provider,storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}}),new AbortController().signal,async wallet=>{
      const coins=await wallet.getBoardingUtxos();
      const script=wallet.boardingTapscript;
      const exit=CSVMultisigTapscript.decode(Uint8Array.from(script.exitScript.match(/.{2}/g)!.map(v=>parseInt(v,16))));
      const tip=await wallet.onchainProvider.getChainTip();
      const eligible=coins.filter(c=>c.status.confirmed && !hasBoardingTxExpired(c,exit.params.timelock,tip.height));
      const plans=[];
      for(const amount of eligible.length ? [1000n,undefined] : []) {
        let captured: SettleParams | undefined;
        const dryWallet={getBoardingUtxos:async()=>eligible,getAddress:()=>wallet.getAddress(),getBoardingAddress:()=>wallet.getBoardingAddress(),settle:async(params:SettleParams)=>{captured=params;return 'not-submitted';}} as unknown as IWallet;
        await new Ramps(dryWallet).onboard(info.fees,eligible,amount);
        plans.push({requested:amount?.toString()??'max',inputs:captured!.inputs.length,outputs:captured!.outputs.map(o=>({amount:o.amount.toString(),type:o.address.startsWith('tark')?'arkade':'bitcoin'}))});
      }
      const operation=readBoardingRecord();
      const consumed=operation ? (await new RestIndexerProvider(SIGNET_OPERATOR).getVtxos({outpoints:operation.inputs})).vtxos.map(v=>({txid:v.txid,vout:v.vout,value:v.value,isSpent:v.isSpent,settledBy:v.settledBy})) : [];
      const transactions=operation ? (await wallet.onchainProvider.getTransactions(operation.bitcoinAddress)).map(t=>({txid:t.txid,confirmed:t.status.confirmed,received:t.vout.filter(o=>o.scriptpubkey_address===operation.bitcoinAddress).map(o=>o.value)})) : [];
      return {network:info.network,balance:await wallet.getBalance(),connection:wallet.getProviderConnectionState(),consumed,transactions,sessionDuration:info.sessionDuration,scheduledSession:info.scheduledSession,coins:coins.map(c=>({value:c.value,confirmed:c.status.confirmed,expired:hasBoardingTxExpired(c,exit.params.timelock,tip.height)})),exitDelay:exit.params.timelock,fees:info.fees,plans};
    });
    const transfer=readBoardingRecord();
    result.textContent=JSON.stringify({...output,transfer:transfer?{id:transfer.id,status:transfer.status,phase:transfer.phase,direction:transfer.quote.direction,amountSats:transfer.quote.amountSats,intentId:transfer.intentId,commitmentTxid:transfer.commitmentTxid}:undefined},(_,v)=>typeof v==='bigint'?v.toString():v,2);
  }catch{result.textContent='Read-only boarding probe failed. No transaction submitted.';}
};
