// Public operator configuration snapshot and unfunded BIP39 vectors. All
// provider traffic is intercepted in the browser acceptance test.
export const operatorInfo={network:'signet',signerPubkey:'028bf56160efc769112b361de4117b3c71b88ca16f1bb9f6ac7a2781929abc5e6a',forfeitPubkey:'022697695adaf0635333d6240739de02feb3f6852e180c596b69a77536aadb7123',forfeitAddress:'tb1qydwmga055fw04qljkuahetcj50kqeuyzeux6ug',checkpointTapscript:'03a80040b275202697695adaf0635333d6240739de02feb3f6852e180c596b69a77536aadb7123ac',unilateralExitDelay:'172544',boardingExitDelay:'15552000',sessionDuration:'60',dust:'330',vtxoMinAmount:'1',vtxoMaxAmount:'-1',utxoMinAmount:'330',utxoMaxAmount:'-1',fees:{intentFee:{},txFeeRate:'0'},deprecatedSigners:[],serviceStatus:{}};
export const publicPhrases=['abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about','legal winner thank year wave sausage worth useful legal winner thank yellow'];

/** Seed only the isolated browser's encrypted BIS stores, without SDK/network. */
export async function seedWalletLabels(page,base,accounts){
  await page.route(`${base}/__wallet_label_seed__`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated wallet-label fixture</title>'}));
  await page.goto(`${base}/__wallet_label_seed__`);
  await page.evaluate(async accounts=>{
    localStorage.setItem('bis:test-network:v1','signet');
    for(const [role,account] of Object.entries(accounts)){
      const network=account.network??'signet',database=role==='player'?`bis-account-${network}-v1`:`bis-game-wallet-${network}-v1`;
      const aad=new TextEncoder().encode(role==='player'?`bis:${network}:account:v1`:database);
      const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,new TextEncoder().encode(JSON.stringify(account)));
      const storeName=role==='player'?'account':'wallets';
      const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(database,role==='player'?2:1);request.onupgradeneeded=()=>request.result.createObjectStore(storeName);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName);
        store.clear();
        if(role==='player'){store.put({version:1,network,key,iv,encrypted},`profile:${account.profileId}`);store.put([account.profileId],'profiles');store.put(account.profileId,'activeProfile');store.put(0,'generation');}
        else {store.put({key,iv,encrypted},`identity:${account.profileId}`);store.put(account.profileId,'selected');}
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });db.close();
    }
  },accounts);
}
