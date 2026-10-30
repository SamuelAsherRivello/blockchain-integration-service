import {createHash,randomUUID} from 'node:crypto';
import {lstat,mkdir,open,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const {validatePrivatePath}=await import(new URL('../../../scripts/test-wallets/vault.ts',import.meta.url).href);
type Protector={protect:(bytes:Buffer)=>Promise<Buffer>;unprotect:(bytes:Buffer)=>Promise<Buffer>;check:(path:string)=>Promise<unknown>;secure:(path:string)=>Promise<unknown>};
export type ProtectedResponseReference=Readonly<{file:string;sha256:string}>;
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex');

/** Separate immutable, DPAPI-protected files keep signed material out of the
 * bounded wallet Vault. Chunking respects the protector's frame size limit.
 */
export function createProtectedLifecycleResponseStore({root,protector,runId}:{root:string;protector:Protector;runId:string}){
 if(!/^[a-z][a-z0-9-]{0,27}$/.test(runId))throw Error('Exact lifecycle response scope required.');
 const directory=join(root,'lifecycle-responses',runId);
 let prepared:Promise<void>|undefined;
 async function prepareDirectories(){
  await validatePrivatePath(root);await protector.check(root);
  for(const path of [join(root,'lifecycle-responses'),directory]){
   await validatePrivatePath(path);
   const exists=await lstat(path).catch(error=>{if(error.code!=='ENOENT')throw error;});
   if(exists){if(!exists.isDirectory())throw Error('Protected response directory unavailable.');await protector.check(path);}
   else{await mkdir(path,{mode:0o700});await protector.secure(path);}
  }
 }
 return {
  async retain(record:unknown):Promise<ProtectedResponseReference>{
   await (prepared??=prepareDirectories());const bytes=Buffer.from(JSON.stringify({version:1,runId,record})),chunks:string[]=[];
   try{for(let offset=0;offset<bytes.length;offset+=1024*1024){const encrypted=await protector.protect(bytes.subarray(offset,offset+1024*1024));try{chunks.push(encrypted.toString('base64'));}finally{encrypted.fill(0);}}}finally{bytes.fill(0);}
   const file=randomUUID()+'.dpapi.json',path=join(directory,file),encoded=Buffer.from(JSON.stringify({version:1,chunks}));
   await validatePrivatePath(path);const handle=await open(path,'wx',0o600);
   // Preserve an incomplete file on any failure for explicit recovery review.
   try{await handle.writeFile(encoded);await handle.sync();}finally{await handle.close();}
   await protector.check(path);return {file,sha256:hash(encoded)};
  },
  async read(reference:ProtectedResponseReference){
   if(!/^[a-f0-9-]{36}\.dpapi\.json$/.test(reference.file)||!/^[a-f0-9]{64}$/.test(reference.sha256))throw Error('Protected response reference invalid.');
   const path=join(directory,reference.file);await validatePrivatePath(path);await protector.check(path);
   const encoded=await readFile(path);if(hash(encoded)!==reference.sha256)throw Error('Protected response hash changed.');
   const envelope=JSON.parse(encoded.toString('utf8'));if(envelope.version!==1||!Array.isArray(envelope.chunks)||!envelope.chunks.length)throw Error('Protected response unavailable.');
   const parts:Buffer[]=[];let bytes:Buffer|undefined;
   try{
    for(const chunk of envelope.chunks){if(typeof chunk!=='string'||chunk.length>2*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(chunk))throw Error('Protected response chunk invalid.');parts.push(await protector.unprotect(Buffer.from(chunk,'base64')));}
    bytes=Buffer.concat(parts);const value=JSON.parse(bytes.toString('utf8'));if(value.version!==1||value.runId!==runId)throw Error('Protected response scope changed.');return value.record;
   }finally{bytes?.fill(0);for(const part of parts)part.fill(0);}
  },
 };
}
