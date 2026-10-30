export type ClientSettlementFailure=Readonly<{
 stage:'sdk-settle';name:string;messageSha256:string;messageTruncated:boolean;sourceFrames:readonly string[];
}>;

/** Acceptance-only capture. Never retain exception messages, causes or payloads. */
export async function safeSettlementFailure(error:unknown):Promise<ClientSettlementFailure>{
 let name='other',message='',stack='';
 try{if(error&&typeof error==='object'){
  const value=error as {name?:unknown;message?:unknown;stack?:unknown};
  if(typeof value.name==='string'&&['Error','TypeError','AbortError','TimeoutError','ServerResponseMismatchError'].includes(value.name))name=value.name;
  if(typeof value.message==='string')message=value.message;
  if(typeof value.stack==='string')stack=value.stack;
 }}catch{/* Accessors cannot replace the original sender failure. */}
 const bytes=new TextEncoder().encode(message.slice(0,8192));
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 // Extract only repository/package paths and line numbers. URL query strings,
 // credentials, arbitrary error text and absolute private paths never survive.
 const sourceFrames=stack.slice(0,16384).split('\n').slice(1).flatMap(line=>{
  const found=line.match(/\/(?:BIS\/packages\/[A-Za-z0-9_/-]+|node_modules\/[A-Za-z0-9_@./-]+)\.(?:ts|tsx|js|mjs)(?::\d+:\d+)?/);
  return found?[found[0]]:[];
 }).slice(0,8);
 return Object.freeze({stage:'sdk-settle',name,messageSha256:Array.from(digest,value=>value.toString(16).padStart(2,'0')).join(''),messageTruncated:message.length>8192,sourceFrames:Object.freeze(sourceFrames)});
}

/** Install before the exact controlled attempt; restore after it. The SDK and
 * role owner retain their original lease, arguments, signals and exceptions.
 */
export function captureSdkSettlementFailures(owner:{sign:Function},scope:{profileId:string;network:'signet'|'mutinynet'},capture:(failure:ClientSettlementFailure)=>unknown){
 const descriptor=Object.getOwnPropertyDescriptor(owner,'sign'),original=owner.sign;
 const wrapped=function(this:unknown,...args:any[]){
  const [role,account,signal,use]=args;
  if(role!=='game'||account?.profileId!==scope.profileId||(account.network??'signet')!==scope.network)return original.apply(owner,args);
  return original.call(owner,role,account,signal,async(wallet:any,active:AbortSignal)=>{
   if(typeof wallet?.settle!=='function')return use(wallet,active);
   const previous=Object.getOwnPropertyDescriptor(wallet,'settle'),settle=wallet.settle;
   wallet.settle=async function(...params:any[]){
    try{return await settle.apply(this,params);}
    catch(error){try{await capture(await safeSettlementFailure(error));}catch{/* Diagnostics never mask the original exception. */}throw error;}
   };
   try{return await use(wallet,active);}
   finally{if(previous)Object.defineProperty(wallet,'settle',previous);else Reflect.deleteProperty(wallet,'settle');}
  });
 };
 if(!Reflect.set(owner,'sign',wrapped))throw Error('Acceptance SDK diagnostics unavailable.');
 return ()=>{if(owner.sign!==wrapped)throw Error('Acceptance SDK diagnostics ownership changed.');if(descriptor)Object.defineProperty(owner,'sign',descriptor);else Reflect.deleteProperty(owner,'sign');};
}
