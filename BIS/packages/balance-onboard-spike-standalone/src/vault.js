import {withDeadline} from './coordinator.js';
export const storageError=()=>Object.assign(new Error('Browser storage is unavailable. Recheck storage; saved account data is retained.'),{name:'StorageError'});
export function createVault({indexedDB,name,clock=globalThis,ms=10000}={}){
 let connection,opening,quarantined;
 async function open(){
  if(quarantined)throw storageError();if(connection)return connection;if(opening)return opening;
  opening=new Promise((resolve,reject)=>{
   let done=false,request;
   const timeout=clock.setTimeout(()=>{done=true;reject(storageError());},ms);
   try{request=indexedDB.open(name,1);}catch{clock.clearTimeout(timeout);reject(storageError());return;}
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('vault'))request.result.createObjectStore('vault');};
   request.onblocked=()=>{done=true;clock.clearTimeout(timeout);reject(storageError());};
   request.onerror=()=>{done=true;clock.clearTimeout(timeout);reject(storageError());};
   request.onsuccess=()=>{
    clock.clearTimeout(timeout);if(done){request.result.close();return;}
    connection=request.result;connection.onversionchange=()=>{connection?.close();connection=undefined;};connection.onclose=()=>{connection=undefined;};resolve(connection);
   };
  }).finally(()=>{opening=undefined;});return opening;
 }
 async function transact(mode,perform){
  const db=await open();
  return new Promise((resolve,reject)=>{
   let tx,result,done=false;
   const finish=error=>{if(done)return;done=true;clock.clearTimeout(timeout);if(quarantined===tx)quarantined=undefined;error?reject(error):resolve(result);};
   const timeout=clock.setTimeout(()=>{quarantined=tx;try{tx.abort();}catch{}done=true;reject(storageError());},ms);
   try{
    tx=db.transaction('vault',mode);
    const ended=error=>{if(quarantined===tx)quarantined=undefined;finish(error);};
    tx.oncomplete=()=>ended();tx.onabort=()=>ended(storageError());
    // Error bubbles before the transaction's terminal abort/complete event.
    // Keep uncertain writes quarantined until that terminal outcome arrives.
    tx.onerror=()=>{quarantined=tx;try{tx.abort();}catch{}};
    perform(tx.objectStore('vault'),value=>{result=value;},tx);
   }catch{finish(storageError());}
  });
 }
 return {open,read:key=>transact('readonly',(store,set)=>{const request=store.get(key);request.onsuccess=()=>set(request.result);}),write:(key,value)=>transact('readwrite',store=>{store.put(value,key);}),transact,close(){connection?.close();connection=undefined;}};
}
export function cryptoWork(work){return withDeadline(work,{ms:30000,name:'StorageError'});}
