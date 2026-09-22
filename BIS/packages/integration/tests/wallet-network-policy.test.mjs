import test from 'node:test';
import assert from 'node:assert/strict';
import { ArkAddress, CSVMultisigTapscript, ReadonlyWallet, RestArkProvider, Wallet } from '@arkade-os/sdk';
import { bech32m } from '@scure/base';
import { inspectWalletNetworkPolicy, normalizeFeeValue } from '../src/core/wallet-network-policy.ts';
import { getBoardingAvailability, quoteBoarding, submitBoarding } from '../src/arkade/boarding.ts';

const point=Uint8Array.from(Buffer.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'));
const own=new ArkAddress(point,point,'tark');
const bitcoinAddress=bech32m.encode('tb',[1,...bech32m.toWords(Uint8Array.from(Buffer.from('c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5','hex')))]);
const account={profileId:'mutiny-policy-test',phrase:'abandon '.repeat(11)+'about',network:'mutinynet'};
const operatorInfo=fees=>({network:'mutinynet',sessionDuration:60n,fees,utxoMinAmount:330n,utxoMaxAmount:0n,vtxoMinAmount:330n,vtxoMaxAmount:0n});

function storage(t) {
  const values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),get length(){return values.size;},key:index=>[...values.keys()][index]??null}});
  t.after(()=>Reflect.deleteProperty(globalThis,'localStorage'));
}

test('normalizes zero-equivalent fee encodings and keeps their policy fingerprint stable',()=>{
  for(const value of ['', '0', '0.0', '00.000', '+0.00', '-0.0'])assert.deepEqual(normalizeFeeValue(value),{kind:'zero',value:'0'});
  assert.deepEqual(normalizeFeeValue('0.001'),{kind:'nonzero',value:'0.001'});
  assert.equal(normalizeFeeValue('free').kind,'malformed');
  assert.equal(normalizeFeeValue(undefined).kind,'missing');
  const first=inspectWalletNetworkPolicy('mutinynet',operatorInfo({txFeeRate:'0',intentFee:{offchainInput:'0'}}));
  const second=inspectWalletNetworkPolicy('mutinynet',operatorInfo({txFeeRate:'0.0',intentFee:{offchainInput:'00.000'}}));
  assert.equal(first.reason,'supported');assert.equal(second.reason,'supported');assert.equal(first.fingerprint,second.fingerprint);
});

test('Mutinynet decimal-zero fees allow a transfer review without creating a wallet mutation',async t=>{
  storage(t);let signingWallets=0,fees={txFeeRate:'0.0',intentFee:{offchainInput:'0.0',offchainOutput:'0.0'}};
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>operatorInfo(fees));
  t.mock.method(CSVMultisigTapscript,'decode',()=>({params:{timelock:{type:'blocks',value:100n}}}));
  const coin={txid:'b'.repeat(64),vout:0,value:1000};
  const wallet={dustAmount:330n,boardingTapscript:{exitScript:'00'},dispose:async()=>{},getAddress:async()=>own.encode(),getBoardingAddress:async()=>bitcoinAddress,getBoardingUtxos:async()=>[],getBalance:async()=>({available:1000,total:1000,boarding:{total:0}}),onchainProvider:{getChainTip:async()=>({height:1})},getProviderConnectionState:()=>({mode:'online',source:'live'}),getSpendableVtxos:async()=>[coin]};
  t.mock.method(ReadonlyWallet,'create',async()=>wallet);
  t.mock.method(Wallet,'create',async()=>{signingWallets++;throw Error('Quote must not create a signing wallet.');});
  const availability=await getBoardingAvailability(account,new AbortController().signal,'to-bitcoin');
  const quote=await quoteBoarding(account,1000,new AbortController().signal,'to-bitcoin');
  assert.deepEqual(availability,{available:true});assert.equal(quote.amountSats,1000);assert.equal(signingWallets,0);
  fees={txFeeRate:'1',intentFee:{offchainInput:'0.0'}};
  await assert.rejects(submitBoarding(account,quote),/current operator fee terms are not supported/);
  assert.equal(signingWallets,0,'a stale policy is rejected before a signing wallet or submission can start');
});

test('a provider network mismatch is unavailable before any signing wallet is opened',async t=>{
  let signingWallets=0;
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>operatorInfo({txFeeRate:'0',intentFee:{}}));
  t.mock.method(Wallet,'create',async()=>{signingWallets++;throw Error('unexpected signing wallet');});
  const availability=await getBoardingAvailability({...account,network:'signet'},new AbortController().signal);
  assert.equal(availability.available,false);
  if(!availability.available)assert.equal(availability.reason,'network-mismatch');
  assert.equal(signingWallets,0);
});
