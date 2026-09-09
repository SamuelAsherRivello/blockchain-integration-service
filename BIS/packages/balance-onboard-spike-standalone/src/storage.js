import { newRecoveryPhrase, normalizeRecoveryPhrase, restoreIdentity } from './identity-material.js';
import {databaseName,stateLocks} from './window-runtime.js';
import {createVault,cryptoWork} from './vault.js';
let vault;
const database=()=>vault??=(createVault({indexedDB,name:databaseName}));
export async function read(key) {
  return database().read(key);
}
export async function write(key,value) {
  return database().write(key,value);
}
export async function identity(create=false, recreate=false, manualPhrase) {
  return stateLocks.request('standalone-identity',async()=>{
    let saved=await read('identity');
    if (!saved && !create) return;
    if (!saved || recreate) {
      // Validate before changing or archiving the current account.
      const phrase=manualPhrase===undefined?newRecoveryPhrase():normalizeRecoveryPhrase(manualPhrase);
      const key=await cryptoWork(()=>crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']));
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const bytes=new TextEncoder().encode(phrase);
      let ciphertext;try{ciphertext=await cryptoWork(()=>crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes));}finally{bytes.fill(0);}
      const next={key,iv,ciphertext,id:crypto.randomUUID(),kind:'mnemonic'};
      if(recreate){
        await database().transact('readwrite',store=>{
          const request=store.get('operation');request.onsuccess=()=>{store.put({identity:saved,operation:request.result},`archived-account:${saved.id}`);store.put(next,'identity');store.put({phase:'idle'},'operation');};
        });
      }else await write('identity',next);
      saved=next;
    }
    if(!saved.id){saved={...saved,id:crypto.randomUUID()};await write('identity',saved);}
    const clear=new Uint8Array(await cryptoWork(()=>crypto.subtle.decrypt({name:'AES-GCM',iv:saved.iv},saved.key,saved.ciphertext)));
    try{return restoreIdentity(saved.kind,new TextDecoder().decode(clear));}finally{clear.fill(0);}
  });
}
export async function recoveryDetails(expectedAccountId){
 return stateLocks.request('standalone-identity',async()=>{
  const saved=await read('identity');
  if(!saved||saved.id!==expectedAccountId)throw Error('Account changed. Reload before revealing recovery details.');
  const clear=new Uint8Array(await cryptoWork(()=>crypto.subtle.decrypt({name:'AES-GCM',iv:saved.iv},saved.key,saved.ciphertext)));
  try{return {kind:saved.kind??'single-key',value:new TextDecoder().decode(clear)};}finally{clear.fill(0);}
 });
}
