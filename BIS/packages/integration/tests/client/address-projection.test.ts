import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MnemonicIdentity, ReadonlyWallet, RestArkProvider, InMemoryWalletRepository, InMemoryContractRepository} from '@arkade-os/sdk';
import {projectConfiguredAddresses} from '../../src/client/wallet-layer-arkade/address-projection.ts';
import {createAppWalletSession} from '../../src/client/wallet-layer-arkade/app-wallet-session.ts';
import {probeGameSigner,remoteReadonlyIdentity} from '../../src/client/wallet-layer-arkade/server-wallet.ts';

// Public BIP39 vector only. Provider calls are mocked; no transactions exist.
const phrase='abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const identity=MnemonicIdentity.fromMnemonic(phrase,{isMainnet:false});
const key='79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const account={phrase,profileId:'projection-player',network:'signet'};
const info=(network='signet',delay=512n)=>({network,signerPubkey:key,unilateralExitDelay:delay,boardingExitDelay:delay,dust:330n,deprecatedSigners:[],fees:{intentFee:{},txFeeRate:'0'},sessionDuration:0n,vtxoMinAmount:1n,vtxoMaxAmount:0n,utxoMinAmount:1n,utxoMaxAmount:0n});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const signal=()=>new AbortController().signal;

for(const network of ['signet','mutinynet'])for(const delay of [0n,144n,511n,512n,513n,1024n,65536n*512n])test(`primary projection matches loaded SDK addresses or rejection: ${network}/${delay}`,async()=>{
  const config=info(network,delay);
  let wallet;
  try {wallet=await ReadonlyWallet.create({identity,arkProvider:{serverUrl:'https://fixture.invalid',getInfo:async()=>config},storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}});}
  catch {await assert.rejects(projectConfiguredAddresses(identity,config,network));return;}
  try {assert.deepEqual(await projectConfiguredAddresses(identity,config,network),{arkadeAddress:await wallet.getAddress(),bitcoinAddress:await wallet.getBoardingAddress()});}
  finally {await wallet.dispose();}
});

test('address-only consumers share the role slot and finish before ownership initialization',async t=>{
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>info());
  const gate=deferred();let creations=0;
  const owner=createAppWalletSession({createWallet:async config=>{
    creations++;await config.arkProvider.getInfo();await gate.promise;
    const addresses=await projectConfiguredAddresses(config.identity,info(),'signet');
    return {getAddress:async()=>addresses.arkadeAddress,getBoardingAddress:async()=>addresses.bitcoinAddress,dispose:async()=>{}};
  }});
  let fullReady=false;
  const full=owner.read('player',account,signal(),async()=>{fullReady=true;});
  const [first,second]=await Promise.all([owner.addresses('player',account,signal()),owner.addresses('player',account,signal())]);
  assert.deepEqual(first,second);assert.equal(creations,1);assert.equal(fullReady,false);
  gate.resolve();await full;assert.deepEqual(await owner.addresses('player',account,signal()),first);
  await owner.dispose();
});

test('server Game address remains available from the read-only projection after wallet initialization',async t=>{
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>info());
  const compressedPublicKey=`02${key}`;
  const profileId=createHash('sha256').update(Buffer.from(compressedPublicKey,'hex')).digest('hex');
  const endpoint='https://signer.fixture/api/bis/';
  const identity={protocol:1,network:'signet',gameId:'stealth-and-steel',profileId,publicKey:compressedPublicKey,token:'fixture-token',capabilities:['sign','signMessage','signerSession']};
  const probe=await probeGameSigner('signet',{endpoint,fetcher:async()=>new Response(JSON.stringify(identity),{status:200})});
  assert.equal(probe.status,'connected');
  if(probe.status!=='connected')throw Error('Fixture signer was not connected.');
  const owner=createAppWalletSession({createWallet:async config=>{
    await config.arkProvider.getInfo();
    return {getAddress:async()=>{throw Error('Signing-backed address getter must not run.');},getBoardingAddress:async()=>{throw Error('Signing-backed address getter must not run.');},dispose:async()=>{}};
  }});
  await owner.read('game',probe.account,signal(),async()=>undefined);
  const addresses=await owner.addresses('game',probe.account,signal());
  assert.deepEqual(addresses,await projectConfiguredAddresses(remoteReadonlyIdentity(probe.account),info(),'signet'));
  await owner.dispose();
});

test('cancelled borrower cannot cancel another early-address consumer',async t=>{
  const infoGate=deferred(),walletGate=deferred();
  t.mock.method(RestArkProvider.prototype,'getInfo',()=>infoGate.promise);
  const owner=createAppWalletSession({createWallet:async config=>{await config.arkProvider.getInfo();await walletGate.promise;return {dispose:async()=>{}};}});
  const abort=new AbortController();
  const first=owner.addresses('player',account,abort.signal),second=owner.addresses('player',account,signal());
  const rejected=assert.rejects(first);abort.abort();infoGate.resolve(info());
  await rejected;assert.ok((await second).arkadeAddress.startsWith('tark1'));
  walletGate.resolve();await owner.dispose();
});

test('bootstrap configuration starts before SDK key work, is consumed once, and later reads stay fresh',async t=>{
  let requests=0,config,creations=0;
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({...info(),version:String(++requests)}));
  const fromMnemonic=MnemonicIdentity.fromMnemonic.bind(MnemonicIdentity);
  t.mock.method(MnemonicIdentity,'fromMnemonic',(...args)=>{assert.equal(requests,1,'configuration starts before synchronous seed/HD derivation');return fromMnemonic(...args);});
  const gate=deferred();
  const owner=createAppWalletSession({createWallet:async value=>{
    creations++;config=value;await gate.promise;
    assert.equal((await config.arkProvider.getInfo()).version,'1','SDK consumes the original bootstrap response even when already resolved');
    return {dispose:async()=>{}};
  }});
  const address=await owner.addresses('player',account,signal());
  assert.ok(address.arkadeAddress.startsWith('tark1'));assert.equal(requests,1);assert.equal(creations,1);
  gate.resolve();await owner.read('player',account,signal(),async()=>{});
  assert.equal((await config.arkProvider.getInfo()).version,'2');assert.equal(requests,2);
  await owner.dispose();
});

test('A-B-A address acquisition rejects first-generation completion even for the same final identity',async t=>{
  const gate=deferred();let requests=0,disposals=0;
  t.mock.method(RestArkProvider.prototype,'getInfo',()=>++requests===1?gate.promise:Promise.resolve(info()));
  const owner=createAppWalletSession({createWallet:async config=>{await config.arkProvider.getInfo();return {dispose:async()=>{disposals++;}};}});
  const old=owner.addresses('player',account,signal()),obsolete=assert.rejects(old);
  await new Promise(r=>setImmediate(r));
  owner.select('player','b','signet');
  const fresh=owner.addresses('player',account,signal());
  gate.resolve(info());await obsolete;
  assert.deepEqual(await fresh,await projectConfiguredAddresses(identity,info(),'signet'));
  assert.equal(requests,2);assert.equal(disposals,1);await owner.dispose();
});

for(const transition of ['retire','replace','network','dispose'])test(`late projection is rejected after ${transition}`,async t=>{
  const infoGate=deferred();let creations=0;
  t.mock.method(RestArkProvider.prototype,'getInfo',()=>infoGate.promise);
  const owner=createAppWalletSession({createWallet:async config=>{creations++;await config.arkProvider.getInfo();return {dispose:async()=>{}};}});
  const pending=owner.addresses('player',account,signal()),rejected=assert.rejects(pending);
  await new Promise(r=>setImmediate(r));
  let done;
  if(transition==='dispose')done=owner.dispose();
  else if(transition==='replace')owner.select('player','replacement','signet');
  else if(transition==='network')owner.select('player',account.profileId,'mutinynet');
  else done=owner.retire('player');
  infoGate.resolve(info());await rejected;await done;
  assert.equal(creations,1);await owner.dispose();
});

for(const failure of ['offline','network'])test(`configuration ${failure} fails closed`,async t=>{
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>{if(failure==='offline')throw Error('offline');return info('mutinynet');});
  const owner=createAppWalletSession({createWallet:async config=>{await config.arkProvider.getInfo();return {dispose:async()=>{}};}});
  await assert.rejects(owner.addresses('player',account,signal()));await owner.dispose();
});

test('invalid full-wallet configuration cannot become a usable role wallet',async t=>{
  // Valid address inputs, invalid forfeit/checkpoint setup: address derivation
  // alone must never imply that SDK acquisition or a signing lease succeeded.
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({...info(),forfeitPubkey:'invalid',forfeitAddress:'invalid',checkpointTapscript:'invalid'}));
  const owner=createAppWalletSession();let signed=false;
  const address=owner.addresses('player',account,signal()).then(value=>({value}),()=>({unavailable:true}));
  await assert.rejects(owner.sign('player',account,signal(),async()=>{signed=true;}));
  const result=await address;
  if(result.value)assert.deepEqual(result.value,await projectConfiguredAddresses(identity,info(),'signet'));
  else assert.equal(result.unavailable,true);
  assert.equal(signed,false);await owner.dispose();
});
