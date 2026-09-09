const sessionKey='standalone-spike-window-v1';
const legacyOwnerKey='standalone-spike-legacy-owner-v1';
const legacyDatabase='standalone-arkade-boarding-v1';

// Session storage survives reload but is copied when a tab is duplicated.
// A lifetime lease detects that copy before any wallet database is opened.
export async function claimWindowState({session,local,locks,randomUUID,onPageHide,requestedId}){
 let id=requestedId??session.getItem(sessionKey);
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(id??''))id=randomUUID();
 let release;
 for(;;){
  const claimed=await new Promise((resolve,reject)=>{
   locks.request(`standalone-window-owner:${id}`,{ifAvailable:true},lock=>{
    if(!lock){resolve(false);return;}
    const held=new Promise(done=>{release=done;});resolve(true);return held;
   }).catch(reject);
  });
  if(claimed)break;
  id=randomUUID();
 }
 onPageHide(release);
 try{
  session.setItem(sessionKey,id);
  const legacy=await locks.request('standalone-window-migration',()=>{
   let owner=local.getItem(legacyOwnerKey);
   if(!owner){owner=id;local.setItem(legacyOwnerKey,id);}
   return owner===id;
  });
  const prefix=`standalone-window:${id}:`;
  return {
   id,release,databaseName:legacy?legacyDatabase:`${legacyDatabase}:${id}`,
   lockName:name=>`${prefix}${name}`,
   storage:{
    getItem(key){const value=local.getItem(prefix+key);return value===null&&legacy?local.getItem(key):value;},
    setItem(key,value){local.setItem(prefix+key,String(value));},
    ownsKey:key=>typeof key==='string'&&key.startsWith(prefix),
   },
  };
 }catch(error){release();throw error;}
}
