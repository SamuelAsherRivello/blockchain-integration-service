import {readFile,mkdir,writeFile,realpath,mkdtemp,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {stopLegacyAcceptance,snapshotLegacyOriginal} from './treasure-protected-browser.ts';

export const legacyArchiveHash='1ad3cdb15b4d67d23a42addedb921999aff30bde694f0bc6a5bb546995aceace';
export const legacyArchiveBytes=680797;
export const legacyBundlePath='/BIS/scripts/fixtures/treasure-legacy-0.0.23.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const fixtureArchive=new URL('./fixtures/legacy-integration/bis-integration-0.0.23.tgz',import.meta.url);
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const layoutError=()=>Error('legacy-archive-layout-unverified');
function safeMember(path:string){
  return path.length>0&&!isAbsolute(path)&&!/[\\:\x00-\x1f\x7f]/.test(path)&&
    path.split('/').every(part=>part!==''&&part!=='.'&&part!=='..'&&!/[. ]$/.test(part)&&
      !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)&&part.toLowerCase()!=='node_modules'&&!part.toLowerCase().startsWith('.env'));
}
/** Pure bounded parser for public tar members. Parsing alone grants no trust;
 * extraction always calls verifyLegacyFixtureArchive first. No paths are read.
 */
export function inspectLegacyArchiveLayout(archive:Uint8Array){
  let tar:Buffer;
  try{tar=gunzipSync(archive,{maxOutputLength:32*1024*1024});}catch{throw layoutError();}
  if(tar.length<1024||tar.length%512!==0)throw layoutError();
  const files=new Map<string,Buffer>(),members=new Map<string,string>();
  const text=(offset:number,length:number)=>{
    const field=tar.subarray(offset,offset+length),end=field.indexOf(0);
    if(end>=0&&field.subarray(end).some(byte=>byte!==0))throw layoutError();
    try{return new TextDecoder('utf-8',{fatal:true}).decode(end<0?field:field.subarray(0,end));}catch{throw layoutError();}
  };
  const octal=(offset:number,length:number)=>{
    const bytes=tar.subarray(offset,offset+length);
    if(bytes.some(byte=>byte!==0&&byte!==32&&(byte<48||byte>55)))throw layoutError();
    const value=bytes.toString('ascii').replaceAll('\0',' ').trim();
    if(!/^[0-7]+$/.test(value))throw layoutError();
    const number=parseInt(value,8);if(!Number.isSafeInteger(number))throw layoutError();return number;
  };
  let offset=0,terminated=false;
  while(offset+512<=tar.length){
    const header=tar.subarray(offset,offset+512);
    if(header.every(byte=>byte===0)){
      if(offset+1024>tar.length||tar.subarray(offset).some(byte=>byte!==0))throw layoutError();
      terminated=true;break;
    }
    const checksum=header.reduce((sum,byte,index)=>sum+(index>=148&&index<156?32:byte),0);
    if(octal(offset+148,8)!==checksum)throw layoutError();
    const name=text(offset,100),prefix=text(offset+345,155),member=(prefix?prefix+'/':'')+name;
    const size=octal(offset+124,12),type=text(offset+156,1),start=offset+512,end=start+size;
    if(!Number.isSafeInteger(end)||end>tar.length||!member.startsWith('package/')||!['','0','5'].includes(type)||text(offset+157,100))throw layoutError();
    const path=type==='5'?member.slice('package/'.length).replace(/\/$/,''):member.slice('package/'.length);
    const canonical=path.toLowerCase();
    if(!safeMember(path)||members.has(canonical)||(type==='5'&&size!==0))throw layoutError();
    for(const [previous,previousType] of members){
      if((canonical.startsWith(previous+'/')&&previousType!=='5')||(previous.startsWith(canonical+'/')&&type!=='5'))throw layoutError();
    }
    members.set(canonical,type);
    if(type!=='5')files.set(path,Buffer.from(tar.subarray(start,end)));
    offset=start+Math.ceil(size/512)*512;
    if(offset>tar.length||tar.subarray(end,offset).some(byte=>byte!==0))throw layoutError();
  }
  if(!terminated||files.size===0)throw layoutError();
  return files;
}
export function verifyLegacyFixtureArchive(archive:Uint8Array){
  if(archive.byteLength!==legacyArchiveBytes||hash(archive)!==legacyArchiveHash)throw Error('legacy-artifact-unverified');
  const files=inspectLegacyArchiveLayout(archive);
  if(files.size!==149)throw Error('legacy-inventory-archive-mismatch');
  const pkg=JSON.parse(files.get('package.json')?.toString('utf8')??'null');
  assertLegacyArchive({artifact:'bis-integration-0.0.23.tgz',sha256:legacyArchiveHash,version:pkg?.version,defaultExport:pkg?.exports?.['.']?.default},legacyArchiveHash);
  if(pkg.name!=='@bis/integration'||!files.has('dist/integration.js'))throw Error('legacy-artifact-unverified');
  return {files,pkg};
}
/** Read only an exact public source member from the pinned fixture, never disk
 * paths supplied by the caller or a game's current installation. */
export async function readLegacyFixtureSource(path:string){
  if(!safeMember(path)||!path.startsWith('src/')||!/^.+\.tsx?$/.test(path))throw Error('legacy-source-unverified');
  const {files}=verifyLegacyFixtureArchive(await readFile(fixtureArchive));
  const bytes=files.get(path);if(!bytes)throw Error('legacy-source-unverified');
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
const legacyDependencyPins={'@arkade-os/sdk':'0.4.79','@scure/bip39':'2.4.0',react:'19.3.0','react-dom':'19.3.0'};
export function assertLegacyDependencyPins(versions:Record<string,string>){
  if(Object.entries(legacyDependencyPins).some(([name,version])=>versions[name]!==version))throw Error('legacy-dependency-unverified');
}
export function assertLegacyArchive(metadata:{artifact:string;sha256:string;version:string;defaultExport:string},actualHash:string){
  if(metadata.artifact!=='bis-integration-0.0.23.tgz'||metadata.sha256!==legacyArchiveHash||actualHash!==legacyArchiveHash||
    metadata.version!=='0.0.23'||metadata.defaultExport!=='./dist/integration.js')throw Error('legacy-artifact-unverified');
}

/** Bundle the verified immutable distribution export, never adjacent BIS source.
 * Generated bytes are public code. No wallet is opened by this operation.
 */
export async function prepareLegacyBundle(){
  const {files,pkg}=verifyLegacyFixtureArchive(await readFile(fixtureArchive));
  const versions:Record<string,string>={};
  for(const name of Object.keys(legacyDependencyPins))versions[name]=JSON.parse(await readFile(resolve(root,'node_modules',name,'package.json'),'utf8')).version;
  assertLegacyDependencyPins(versions);
  const output=resolve(root,'output/fixtures/legacy-integration');
  // Check each existing ancestor before descending, including Windows
  // junctions. Never create an extraction below a redirected output folder.
  for(const directory of [resolve(root,'output'),resolve(root,'output/fixtures'),output]){
    await mkdir(directory).catch(error=>{if(error.code!=='EEXIST')throw error;});
    const info=await lstat(directory);
    if(!info.isDirectory()||info.isSymbolicLink())throw Error('legacy-extraction-path-unverified');
  }
  const outputRoot=await realpath(resolve(root,'output')),outputReal=await realpath(output);
  const rootBoundary=relative(await realpath(root),outputRoot),outputBoundary=relative(outputRoot,outputReal);
  if(rootBoundary!=='output'||outputBoundary.startsWith('..')||isAbsolute(outputBoundary))throw Error('legacy-extraction-path-unverified');
  // Unique per call/process. A concurrent call can never observe or overwrite
  // this extraction, and failed calls leave no partially published cache.
  const installed=await mkdtemp(resolve(outputReal,legacyArchiveHash+'-'));
  const expectedFiles=[...files].map(([path,bytes])=>[path,hash(bytes)] as const);
  for(const [path,bytes] of files){
    const target=resolve(installed,path),inside=relative(installed,target);
    if(inside.startsWith('..')||isAbsolute(inside))throw Error('legacy-extraction-path-unverified');
    await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});
  }
  const verifyExtracted=async()=>{
    for(const [path,expected] of expectedFiles){
      const target=resolve(installed,path),info=await lstat(target),inside=relative(installed,await realpath(target));
      if(!info.isFile()||info.isSymbolicLink()||inside.startsWith('..')||isAbsolute(inside)||hash(await readFile(target))!==expected)throw Error('legacy-installed-file-unverified');
    }
  };
  await verifyExtracted();
  const {build}=await import('vite');
  const bundled=await build({configFile:false,envFile:false,root,logLevel:'silent',resolve:{dedupe:Object.keys(legacyDependencyPins)},define:{'process.env.NODE_ENV':'"production"'},build:{write:false,minify:false,
    lib:{entry:resolve(installed,pkg.exports['.'].default),formats:['es'],fileName:()=> 'legacy.js'},
    rolldownOptions:{external:[]}}});
  const outputs=(Array.isArray(bundled)?bundled:[bundled]).flatMap(result=>'output' in result?result.output:[]);
  if(outputs.length!==1||outputs[0].type!=='chunk'||outputs[0].imports.length||outputs[0].dynamicImports.length)throw Error('legacy-bundle-not-self-contained');
  // Reject any artifact change during bundling before exposing the bytes.
  await verifyExtracted();
  const code=outputs[0].code;
  const bundleHash=hash(Buffer.from(code));
  await writeFile(resolve(installed,'legacy-bundle.js'),code,{flag:'wx'});
  return {code,provenance:{version:'0.0.23',archiveHash:legacyArchiveHash,installedFiles:expectedFiles.length,bundleHash,entry:pkg.exports['.'].default,reactEnvironment:'production',dependencies:versions,extraction:relative(root,installed)}};
}

/** Replace only the owned page's document, preserving the host CSP headers.
 * Reload unloads the Admin and its timers. No financial response is mocked.
 * Factories are imported explicitly afterward inside this blank harness.
 */
export async function enterProtectedHarness(page,legacy?:Awaited<ReturnType<typeof prepareLegacyBundle>>,ownedOrigin='http://127.0.0.1:5174'){
  const url=page.url();const expected=new URL(url);
  const owned=new URL(ownedOrigin);
  // An explicit isolated wallet-free test may supply its ephemeral loopback
  // origin. The protected runner always uses the fixed ownership-verified one.
  if(owned.protocol!=='http:'||owned.hostname!=='127.0.0.1'||owned.username||owned.password||owned.pathname!=='/'||owned.search||owned.hash||
    expected.origin!==owned.origin||expected.pathname!=='/admin/')throw Error('protected-harness-origin-unverified');
  if(legacy)await page.route(new URL(legacyBundlePath,url).href,route=>route.fulfill({status:200,contentType:'text/javascript',body:legacy.code}));
  const documentUrl=request=>request.href===url;
  const documentRoute=async route=>{
    if(!route.request().isNavigationRequest())return route.continue();
    const response=await route.fetch();
    await route.fulfill({response,body:'<!doctype html><html><head><title>Protected BIS acceptance</title></head><body>Protected acceptance harness. Real factories and original network transactions only.</body></html>'});
  };
  await page.route(documentUrl,documentRoute);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  return async()=>{
    await page.unroute(documentUrl,documentRoute);
    await page.goto(url,{waitUntil:'domcontentloaded'});
  };
}

/** Private return for the protected vault only. The legacy blank document has
 * no Admin controls: prove original stored terms and compiled bytes instead.
 */
export async function verifyFundedAcceptanceMode(input:{scenario:string;page:any;select:any;original:any;provenance?:any}){
  if(input.scenario!=='legacy-rollback'){
    if(!await input.select.isDisabled())throw Error('active-mode-was-editable');
    return;
  }
  const p=input.provenance;
  assertLegacyArchive({artifact:'bis-integration-0.0.23.tgz',sha256:p?.archiveHash,version:p?.version,defaultExport:p?.entry},p?.archiveHash);
  if(p.installedFiles!==149||!/^[a-f0-9]{64}$/.test(p.bundleHash??''))throw Error('legacy-artifact-unverified');
  await input.page.evaluate(stopLegacyAcceptance);
  return input.page.evaluate(snapshotLegacyOriginal,input.original);
}
