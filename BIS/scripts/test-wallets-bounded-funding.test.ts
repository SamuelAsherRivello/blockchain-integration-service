import test from 'node:test';
import assert from 'node:assert/strict';
import {entropyToMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english.js';
import {Wallet,SingleKey,DefaultVtxo,CSVMultisigTapscript,getNetwork} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {register} from './test-wallets/inventory.ts';
import {fund,boundedFaucetCost} from './test-wallets/funding.ts';
import {argumentsFor} from './test-wallets/arguments.ts';

// Offline public fixtures only. No provider, real Vault or registered wallet.
const info={network:'mutinynet',signerPubkey:'03'+'11'.repeat(32),fees:{txFeeRate:'0'},dust:'330',vtxoMinAmount:'330',vtxoMaxAmount:'-1'};
const options={account:'recipient',network:'mutinynet',source:'faucet',amount:'1000',operation:'bounded-funding-original',api:'http://127.0.0.1:5190'};
async function fixture(){
  const state:{accounts:any[];pairs:any[];operations?:any[];boundedFaucetFunding?:Record<string,any>}={accounts:[],pairs:[]};
  const vault={transaction:async<T>(use:(snapshot:typeof state)=>T|Promise<T>)=>use(state)};
  await register(vault,[{label:'recipient',phrase:entropyToMnemonic(new Uint8Array(16),wordlist)}],'supplied');
  return {state,vault};
}
test('CLI accepts only the new exact bounded amount and preserves legacy funding choices',()=>{
  for(const amount of ['1000','50000','100000','200000']){
    assert.equal(argumentsFor(['fund','--account','recipient','--network','mutinynet','--source','faucet','--amount',amount,'--operation','fund-a']).values.amount,amount);
    assert.equal(argumentsFor(['prepare','--account','recipient','--network','mutinynet','--expect','funded','--source','faucet','--amount',amount,'--operation','fund-a']).values.amount,amount);
  }
  for(const amount of ['999','1001','5000','1e3','1000.1'])assert.throws(()=>argumentsFor(['fund','--account','recipient','--network','mutinynet','--source','faucet','--amount',amount,'--operation','fund-a']));
});
test('bounded quote refuses nonzero/unknown fees, mismatched networks, unavailable funds and unresolved onboarding',()=>{
  assert.equal(boundedFaucetCost('mutinynet',info,{network:'mutinynet',available:100000}).feeSats,0);
  for(const changed of [{...info,fees:{txFeeRate:'1'}},{...info,fees:{}},{...info,network:'signet'}])
    assert.throws(()=>boundedFaucetCost('mutinynet',changed,{network:'mutinynet',available:100000}));
  for(const balance of [{network:'mutinynet',available:999},{network:'signet',available:100000},{network:'mutinynet',available:100000,onboarding:{status:'pending'}},
    {network:'mutinynet',available:100000,onboarding:{status:'failed'}}])assert.throws(()=>boundedFaucetCost('mutinynet',info,balance));
});
test('new bounded funding saves known cost before POST, never starts a server, and requires exact receipt evidence',async()=>{
  const f=await fixture();let requests=0,quotes=0;
  const adapters={api:options.api,addresses:async()=>({arkadeAddress:'tark1'+'a'.repeat(40)}),
    cost:async()=>{quotes++;return {info,balance:{network:'mutinynet',available:100000}};},ensure:async()=>assert.fail('Bounded funding must reuse the existing API'),
    request:async(request:any)=>{
      requests++;assert.equal(request.amount,1000);assert.equal(request.idempotencyKey,options.operation);
      assert.equal(f.state.operations?.[0].state,'submitting');assert.equal(f.state.operations?.[0].intent.feeSats,0);
      assert.equal(f.state.boundedFaucetFunding?.[options.operation].submitCost.feeSats,0);
      return {network:'mutinynet',address:request.address,amountSats:1000,operationId:'a'.repeat(64),transactionId:'a'.repeat(64)};
    },receipt:async()=>undefined};
  const first=await fund(f.vault,options,adapters);assert.equal(first.operation.state,'pending');assert.equal(first.readiness,'pending');
  await fund(f.vault,options,adapters);assert.equal(requests,1);assert.equal(quotes,3);
});
test('lost bounded acknowledgement retains the same known-cost reservation and never posts replacement funding',async()=>{
  const f=await fixture();let requests=0;
  const adapters={api:options.api,addresses:async()=>({arkadeAddress:'tark1'+'a'.repeat(40)}),
    cost:async()=>({info,balance:{network:'mutinynet',available:100000}}),request:async()=>{requests++;throw Error('Lost original acknowledgement');},receipt:async()=>undefined};
  assert.equal((await fund(f.vault,options,adapters)).operation.state,'unknown');
  assert.equal((await fund(f.vault,options,adapters)).operation.state,'unknown');assert.equal(requests,1);
  assert.equal(f.state.operations?.[0].intent.feeSats,0);
});
test('unavailable cost and changed policy prevent POST without reporting a fabricated financial failure',async()=>{
  const missing=await fixture();
  const base={api:options.api,addresses:async()=>({arkadeAddress:'tark1'+'a'.repeat(40)}),
    request:async()=>assert.fail('Unverified policy must not POST'),receipt:async()=>undefined};
  await assert.rejects(fund(missing.vault,options,{...base,cost:async()=>({info,balance:{network:'mutinynet',available:0}})}));
  assert.equal(missing.state.operations?.length??0,0);
  const changed=await fixture();let quotes=0;
  const result=await fund(changed.vault,options,{...base,cost:async()=>({info:++quotes===1?info:{...info,fees:{txFeeRate:'1'}},balance:{network:'mutinynet',available:100000}})});
  assert.equal(result.operation.state,'unknown');assert.equal(result.operation.intent.feeSats,0);
});
test('legacy faucet intents retain unknown fee accounting and canonical identity',async()=>{
  const f=await fixture(),legacy={...options,amount:'50000'};
  const result=await fund(f.vault,legacy,{api:options.api,addresses:async()=>({arkadeAddress:'tark1'+'a'.repeat(40)}),ensure:async()=>{},
    cost:async()=>assert.fail('No new quote on legacy intent'),request:async(request:any)=>({network:'mutinynet',address:request.address,amountSats:50000,operationId:'a'.repeat(64)}),receipt:async()=>undefined});
  assert.equal(result.operation.intent.feeSats,null);assert.equal(f.state.boundedFaucetFunding,undefined);
});
test('actual installed SDK offchain send constructs zero fee with exact and change-bearing inputs before any submission',async()=>{
  const [participant,server]=await Promise.all([1,3].map(async n=>(await SingleKey.fromHex(n.toString(16).padStart(64,'0')).xOnlyPublicKey())));
  const script=new DefaultVtxo.Script({pubKey:participant,serverPubKey:server,csvTimelock:{type:'seconds',value:2048n}});
  const address=script.address('tark',server).encode();
  const send=Reflect.get(Wallet.prototype,'_sendImpl');assert.equal(typeof send,'function');
  for(const value of [1000,100000]){
    let submissions=0;
    const fake={offchainTapscript:script,arkServerPublicKey:server,serverUnrollScript:CSVMultisigTapscript.encode({pubkeys:[server],timelock:{type:'seconds',value:4096n}}),
      network:getNetwork('mutinynet'),dustAmount:330n,recipientAddressContext:()=>({hrp:'tark',signerSet:{active:hex.encode(server),deprecated:[]}}),
      arkProvider:{getInfo:async()=>({vtxoMinAmount:330n})},getSpendableVtxos:async()=>[{txid:'a'.repeat(64),vout:0,value,assets:[],script:hex.encode(script.pkScript),
        status:{confirmed:true},virtualStatus:{state:'settled'},isSpent:false,isSwept:false,isUnrolled:false,isPreconfirmed:false,expiresAt:new Date(Date.now()+86400000)}],
      _submitOffchainSpend:async(inputs:any[],outputs:any[])=>{
        submissions++;assert.equal(outputs[0].amount,1000n);assert.equal(outputs.length,value===1000?1:2);
        assert.equal(inputs.reduce((sum,c)=>sum+BigInt(c.value),0n)-outputs.reduce((sum,o)=>sum+o.amount,0n),0n);
        return 'b'.repeat(64);
      }};
    assert.equal(await send.call(fake,{recipients:[{address,amount:1000}]}),'b'.repeat(64));assert.equal(submissions,1);
  }
});
