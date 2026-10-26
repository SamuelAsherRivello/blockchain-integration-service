import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicFixtures} from './authorized-vm-fixtures.ts';

// Explicit acceptance command. It never loads a wallet or contacts an Arkade
// provider. Go may download its pinned compiler and checksum-verified modules.
const root=fileURLToPath(new URL('../../../',import.meta.url));
const pins=JSON.parse(await readFile(new URL('./native/upstream-package.json',import.meta.url),'utf8')) as {
  repository:string;commit:string;files:{name:string;sha:string;path:string}[];
};
if(pins.repository!=='arkade-os/emulator'||pins.commit!=='7b830f6d7bd3998e1790f3d3e7737f34f40588f1'||pins.files.length!==42)throw Error('Unexpected VM source manifest.');
const source=resolve(process.env.BIS_TREASURE_VM_SOURCE??join(root,'output/tools/conditional-vault/emulator/pkg/arkade'));
const category=join(root,'output/reports/treasure-contract/authorized-vm');
await mkdir(category,{recursive:true});
const output=await mkdtemp(join(category,'run-')),buildSource=join(output,'source');
await mkdir(buildSource);
const sha=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const projectPaths=['BIS/tools/treasure-contract/authorized-vm-proof.ts','BIS/tools/treasure-contract/authorized-vm-fixtures.ts',
  'BIS/tools/treasure-contract/native/upstream-package.json',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-authorized-script.ts',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-staged-script.ts',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-script.ts','package-lock.json','node_modules/@arkade-os/sdk/package.json'];
const projectSources=await Promise.all(projectPaths.map(async path=>({path,sha256:sha(await readFile(join(root,path)))})));
await writeFile(join(output,'project-source-start.json'),JSON.stringify(projectSources,null,2));
const inputs=[];
for(const pin of pins.files){
  if(!/^[a-zA-Z0-9_.-]+$/.test(pin.name)||pin.path!==`pkg/arkade/${pin.name}`||!/^[a-f0-9]{40}$/.test(pin.sha))throw Error('Invalid pinned source filename.');
  const raw=await readFile(join(source,pin.name));
  const canonical=Buffer.from(new TextDecoder('utf8',{fatal:true}).decode(raw).replaceAll('\r\n','\n'));
  const blob=createHash('sha1').update(`blob ${canonical.length}\0`).update(canonical).digest('hex');
  if(blob!==pin.sha)throw Error(`Pinned upstream source differs: ${pin.name}`);
  await writeFile(join(buildSource,pin.name),canonical);
  inputs.push({name:pin.name,gitBlob:blob,rawSha256:sha(raw),buildSha256:sha(canonical)});
}
const helper=await readFile(new URL('./native/actor-authorization_test.go',import.meta.url));
await writeFile(join(buildSource,'bis_treasure_authorization_fixture_test.go'),helper);
await writeFile(join(output,'source.json'),JSON.stringify({commit:pins.commit,files:inputs,helperSha256:sha(helper)},null,2));
const cache=join(root,'output/tool-cache');
const env={...process.env,GOPATH:join(cache,'go-path'),GOMODCACHE:join(cache,'go-module-cache'),GOCACHE:join(cache,'go-build'),
  GOTOOLCHAIN:'auto',GOWORK:'off',GOFLAGS:'-mod=readonly',CGO_ENABLED:'0',GOSUMDB:'sum.golang.org'};
await Promise.all([env.GOPATH,env.GOMODCACHE,env.GOCACHE].map(path=>mkdir(path,{recursive:true})));
async function run(command:string,args:string[],log:string,input?:string,timeout=180_000){
  let captured='';
  const child=spawn(command,args,{cwd:buildSource,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
  const timer=setTimeout(()=>child.kill(),timeout);
  const capture=(chunk:Buffer)=>{captured+=chunk.toString('utf8');if(captured.length>2_000_000)child.kill();};
  child.stdout.on('data',capture);child.stderr.on('data',capture);
  child.stdin.on('error',()=>{});child.stdin.end(input);
  try{
    const code=await new Promise<number|null>((accept,reject)=>{child.once('error',reject);child.once('close',accept);});
    await writeFile(join(output,log),captured);
    if(code!==0)throw Error(`Native command failed (${code}); see ${join(output,log)}`);
    return captured;
  }finally{clearTimeout(timer);}
}
const go=process.env.BIS_GO_BINARY??'go',binary=join(output,process.platform==='win32'?'treasure-v4-vm.exe':'treasure-v4-vm');
await run(go,['test','-c','-o',binary,'.'],'build.log');
await run(go,['version','-m',binary],'build-info.log');
for(const pin of inputs)if(sha(await readFile(join(buildSource,pin.name)))!==pin.buildSha256)throw Error('Build changed pinned production source.');
const fixtures=await publicFixtures();
await writeFile(join(output,'public-fixtures.json'),JSON.stringify(fixtures,null,2));
const native=await run(binary,['-test.run=^TestBISTreasureActorAuthorizationFixtures$','-test.v'],'native.log',JSON.stringify(fixtures.cases),30_000);
const encoded=/BIS_ACTOR_RESULTS=(\[[^\r\n]+\])/.exec(native)?.[1];
const actual:unknown[]=encoded?JSON.parse(encoded):[];
const mismatches=fixtures.cases.flatMap((fixture,index)=>actual[index]===fixture.expected?[]:[{name:fixture.name,expected:fixture.expected,actual:actual[index]}]);
const changedProjectSources=[];
for(const file of projectSources)if(sha(await readFile(join(root,file.path)))!==file.sha256)changedProjectSources.push(file.path);
const passed=actual.length===fixtures.cases.length&&mismatches.length===0&&changedProjectSources.length===0;
const report={checkedAt:new Date().toISOString(),passed,artifactVersion:4,upstreamCommit:pins.commit,binarySha256:sha(await readFile(binary)),
  fixturesSha256:sha(JSON.stringify(fixtures)),cases:fixtures.cases.length,accepted:actual.filter(v=>v===true).length,mismatches,
  projectSources,changedProjectSources,
  qualification:'Local native VM with public synthetic SDK signatures and supplied clock/expiry context. No wallet, funding, remote admission, or settlement evidence.'};
await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed,cases:report.cases,accepted:report.accepted,output}));
if(!passed)process.exitCode=1;
