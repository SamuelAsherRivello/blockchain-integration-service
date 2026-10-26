import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, CSVMultisigTapscript, buildOffchainTx, Extension, asset, createAssetPacket, type ArkInfo, type AssetDetails, type VirtualCoin } from '@arkade-os/sdk';
import { bisMarketplaceItems, marketplaceItemMetadata } from '../../integration/src/client/state-layer-core/equipment.ts';
import { readMarketplacePaymentReceipt, type MarketplaceReceiptReader } from '../src/server/marketplace-payment-receipt.ts';

// Cryptographic transaction construction with deterministic indexer facts. No
// real purchase, payment, issuance or server signing grant occurs in this suite.
const game=MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',{isMainnet:false});
const player=MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow',{isMainnet:false});
const hex=(value:Uint8Array)=>Buffer.from(value).toString('hex');
const gamePublicKey=hex(await game.compressedPublicKey()),playerPublicKey=hex(await player.compressedPublicKey()),operator=await player.xOnlyPublicKey();
const script=(pubKey:Uint8Array)=>new DefaultVtxo.Script({pubKey,serverPubKey:operator,csvTimelock:{type:'seconds',value:1024n}});
const sender=script(await player.xOnlyPublicKey()),recipient=script(await game.xOnlyPublicKey());
const unroll=CSVMultisigTapscript.encode({pubkeys:[operator],timelock:{type:'seconds',value:86016n}});
const assetId='ab'.repeat(34);
function fixture(withAssets=false,itemIndex=0,issuer=recipient) {
  const item=bisMarketplaceItems[itemIndex],held=withAssets?[{assetId:'cd'.repeat(34),amount:9007199254740993n}]:[];
  const input={txid:'11'.repeat(32),vout:0,value:10000,tapTree:sender.encode(),tapLeafScript:sender.forfeit(),assets:held};
  const outputs=[{amount:BigInt(item.priceSats),script:recipient.pkScript},{amount:10000n-BigInt(item.priceSats),script:sender.pkScript}];
  if(withAssets)outputs.push(Extension.create([createAssetPacket(new Map([[0,held]]),[{address:'',amount:item.priceSats}],{address:'',amount:10000-item.priceSats,assets:held})]).txOut());
  const built=buildOffchainTx([input],outputs,unroll),root=built.arkTx;
  const info={network:'signet',signerPubkey:playerPublicKey,forfeitPubkey:playerPublicKey,unilateralExitDelay:1024n,checkpointTapscript:hex(unroll.script),dust:546n} as ArkInfo;
  const custom={...marketplaceItemMetadata(item),bisKind:'asset',bisSchemaVersion:'1',bisOperationId:'catalog-issuance-1'};
  const rawMetadata = { ...custom, name: item.name, ticker: item.ticker, decimals: '0', icon: item.iconUrl };
  const encodedMetadata = Object.entries(rawMetadata).map(([key, value]) => asset.Metadata.create(Buffer.from(key), Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))));
  const issued = asset.AssetGroup.create(null, null, [], [asset.AssetOutput.create(0, 1n)], encodedMetadata);
  const genesisInput = { txid: '22'.repeat(32), vout: 0, value: 10000, tapTree: issuer.encode(), tapLeafScript: issuer.forfeit(), assets: [] };
  const genesis = buildOffchainTx([genesisInput], [{ amount: 10000n, script: issuer.pkScript }, Extension.create([asset.Packet.create([issued])]).txOut()], unroll);
  const assetId = asset.AssetId.create(genesis.arkTx.id, 0).toString();
  const details={assetId,supply:1n,metadata:{...Object.fromEntries(Object.entries(custom).map(([key,value])=>[key,Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('hex')])),name:item.name,ticker:item.ticker,decimals:0,icon:item.iconUrl}} as AssetDetails;
  const coins=[{txid:input.txid,vout:0,value:input.value,script:hex(sender.pkScript),isSpent:true,spentBy:built.checkpoints[0].id,arkTxId:root.id,isUnrolled:false,isSwept:false,assets:held},
    {txid:root.id,vout:0,value:item.priceSats,script:hex(recipient.pkScript),isSpent:false,isUnrolled:false,assets:[]}] as VirtualCoin[];
  const genesisCoins = [{ txid: genesisInput.txid, vout: 0, value: genesisInput.value, script: hex(issuer.pkScript), isSpent: true, spentBy: genesis.checkpoints[0].id, arkTxId: genesis.arkTx.id, isUnrolled: false, isSwept: false, assets: [] }] as VirtualCoin[];
  const transactions=new Map([root,...built.checkpoints,genesis.arkTx,...genesis.checkpoints].map(tx=>[tx.id,tx]));
  const reads:string[]=[];
  const reader:MarketplaceReceiptReader={info:async()=>info,asset:async()=>details,transactions:async ids=>{reads.push(...ids);return {txs:ids.map(id=>Buffer.from(transactions.get(id)!.toPSBT()).toString('base64'))};},coins:async outpoints=>({vtxos:[...coins,...genesisCoins].filter(coin=>outpoints.some(point=>point.txid===coin.txid&&point.vout===coin.vout))})};
  const options={network:'signet' as const,gamePublicKey,playerPublicKey,assetId,transactionId:root.id,signal:new AbortController().signal};
  return {reader,options,root,coins,info,details,reads,transactions,item,genesisCoins,genesis};
}

test('purchase receipt binds fixed catalog price, real SDK root/checkpoint and Player-owned sources',async()=>{
  for(const index of [0,8]) {
    const f=fixture(false,index),receipt=await readMarketplacePaymentReceipt(f.options,f.reader);
    assert.equal(receipt.priceSats,f.item.priceSats);
    assert.equal(receipt.transactionId,f.root.id);
    assert.equal(receipt.receiptKey,`marketplace-payment:${f.root.id}:0`);
    assert.equal(receipt.playerPublicKey,playerPublicKey);
    assert.equal(receipt.catalogId,f.item.catalogId);
    assert.equal(f.reads.length,4);
  }
});

test('purchase receipt accepts raw indexed transactions and exact preservation of Player assets above 2^53',async()=>{
  const f=fixture(true);
  f.reader.transactions=async ids=>({txs:ids.map(id=>hex(f.transactions.get(id)!.unsignedTx))});
  assert.equal((await readMarketplacePaymentReceipt(f.options,f.reader)).transactionId,f.root.id);
});

test('catalog labels cannot substitute for Game-owned issuance or immutable genesis metadata', async () => {
  const counterfeit = fixture(false, 0, sender);
  await assert.rejects(readMarketplacePaymentReceipt(counterfeit.options, counterfeit.reader), /receipt/);
  for (const patch of [{ script: hex(sender.pkScript) }, { spentBy: '99'.repeat(32) }, { arkTxId: '99'.repeat(32) }, { isSpent: false }, { value: 9999 }, { isUnrolled: true }]) {
    const f = fixture(); Object.assign(f.genesisCoins[0], patch);
    await assert.rejects(readMarketplacePaymentReceipt(f.options, f.reader), /receipt/);
  }
  const changed = fixture();
  changed.details.metadata!.bisDescription = Buffer.from('Forged description with otherwise valid catalog labels').toString('hex');
  await assert.rejects(readMarketplacePaymentReceipt(changed.options, changed.reader), /receipt/);
  const reissued = fixture(); reissued.details.supply = 2n;
  await assert.rejects(readMarketplacePaymentReceipt(reissued.options, reissued.reader), /receipt/);
});

test('same-value receipt cannot authorize another payer, destination, source or checkpoint',async()=>{
  for(const patch of [{script:hex(recipient.pkScript)},{isSpent:false},{spentBy:'33'.repeat(32)},{arkTxId:'33'.repeat(32)},{isUnrolled:true},{isSwept:true},{value:9999}]) {
    const f=fixture();Object.assign(f.coins[0],patch);
    await assert.rejects(readMarketplacePaymentReceipt(f.options,f.reader),/receipt could not be verified/);
  }
  for(const patch of [{script:hex(sender.pkScript)},{value:999},{assets:[{assetId,amount:1n}]}]) {
    const f=fixture();Object.assign(f.coins[1],patch);
    await assert.rejects(readMarketplacePaymentReceipt(f.options,f.reader),/receipt/);
  }
});

test('forged price/format, reissuable metadata, wrong network and incomplete index answers fail closed',async()=>{
  for(const patch of [{bisPriceSats:'1'},{bisAssetFormatVersion:'99.0.0'},{decimals:1}]) {
    const f=fixture();Object.assign(f.details.metadata!,patch);
    await assert.rejects(readMarketplacePaymentReceipt(f.options,f.reader),/receipt/);
  }
  const controlled=fixture();controlled.details.controlAssetId=assetId;
  await assert.rejects(readMarketplacePaymentReceipt(controlled.options,controlled.reader),/receipt/);
  const wrong=fixture();wrong.info.network='mutinynet';
  await assert.rejects(readMarketplacePaymentReceipt(wrong.options,wrong.reader),/receipt/);
  for(const response of [{vtxos:[]},{vtxos:[fixture().coins[0],fixture().coins[0]]},{vtxos:fixture().coins,page:{next:'more'}}]) {
    const f=fixture();f.reader.coins=async()=>response;
    await assert.rejects(readMarketplacePaymentReceipt(f.options,f.reader),/receipt/);
  }
});

test('cancellation stops authority even when the SDK metadata reader never responds',async()=>{
  const f=fixture(),controller=new AbortController();
  f.reader.asset=()=>new Promise(()=>{});
  const pending=readMarketplacePaymentReceipt({...f.options,signal:controller.signal},f.reader);
  controller.abort();await assert.rejects(pending,/receipt/);assert.deepEqual(f.reads,[]);
});
