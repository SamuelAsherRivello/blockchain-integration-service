import { newRecoveryPhrase, restoreIdentity } from './identity-material.js';
const database = new Promise((resolve,reject)=>{
  const request=indexedDB.open('standalone-arkade-boarding-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('vault');
  request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(Error('Browser storage unavailable.'));
});
export async function read(key) {
  const db=await database;
  return new Promise((resolve,reject)=>{const r=db.transaction('vault').objectStore('vault').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Browser storage read failed.'));});
}
export async function write(key,value) {
  const db=await database;
  return new Promise((resolve,reject)=>{const tx=db.transaction('vault','readwrite');tx.objectStore('vault').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('Browser storage write failed.'));tx.onabort=()=>reject(Error('Browser storage write interrupted.'));});
}
export async function identity(create=false, recreate=false) {
  return navigator.locks.request('standalone-identity',async()=>{
    let saved=await read('identity');
    if (!saved && !create) return;
    if (!saved || recreate) {
      const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const bytes=new TextEncoder().encode(newRecoveryPhrase());
      const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes);bytes.fill(0);
      const next={key,iv,ciphertext,id:crypto.randomUUID(),kind:'mnemonic'};
      if(recreate){
        const db=await database,operation=await read('operation');
        if(operation && !['idle','waiting','success'].includes(operation.phase))throw Error('An unresolved transfer must stay with its account.');
        await new Promise((resolve,reject)=>{const tx=db.transaction('vault','readwrite'),store=tx.objectStore('vault');store.put({identity:saved,operation},`archived-account:${saved.id}`);store.put(next,'identity');store.put({phase:'idle'},'operation');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('Account recreation failed.'));tx.onabort=()=>reject(Error('Account recreation interrupted.'));});
      }else await write('identity',next);
      saved=next;
    }
    if(!saved.id){saved={...saved,id:crypto.randomUUID()};await write('identity',saved);}
    const clear=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:saved.iv},saved.key,saved.ciphertext));
    try{return restoreIdentity(saved.kind,new TextDecoder().decode(clear));}finally{clear.fill(0);}
  });
}
export async function recoveryDetails(expectedAccountId){
 return navigator.locks.request('standalone-identity',async()=>{
  const saved=await read('identity');
  if(!saved||saved.id!==expectedAccountId)throw Error('Account changed. Reload before revealing recovery details.');
  const clear=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:saved.iv},saved.key,saved.ciphertext));
  try{return {kind:saved.kind??'single-key',value:new TextDecoder().decode(clear)};}finally{clear.fill(0);}
 });
}
