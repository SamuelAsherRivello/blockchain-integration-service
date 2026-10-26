import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {developmentConfig} from './dev-config.ts';
import {assertLegacyArchive,legacyArchiveHash,legacyArchiveBytes,verifyLegacyFixtureArchive,inspectLegacyArchiveLayout,readLegacyFixtureSource,assertLegacyDependencyPins,prepareLegacyBundle,enterProtectedHarness,legacyBundlePath} from './treasure-protected-harness.ts';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Explicit synthetic tar data exercises the parser only. It can never pass
// the pinned fixture verifier or be extracted by prepareLegacyBundle.
function testTar(entries:{name:string;type?:string;link?:string;data?:string;prefix?:string}[]){
  return Buffer.concat([...entries.flatMap(entry=>{
    const header=Buffer.alloc(512),data=Buffer.from(entry.data??'test');
    header.write(entry.name,0,100);header.write('0000644\0',100);header.write('0000000\0',108);header.write('0000000\0',116);
    header.write(data.length.toString(8).padStart(11,'0')+'\0',124);header.write('00000000000\0',136);
    header.fill(32,148,156);header.write(entry.type??'0',156);if(entry.link)header.write(entry.link,157,100);
    if(entry.prefix)header.write(entry.prefix,345,155);
    header.write(header.reduce((sum,byte)=>sum+byte,0).toString(8).padStart(6,'0')+'\0 ',148);
    return [header,data,Buffer.alloc((512-data.length%512)%512)];
  }),Buffer.alloc(1024)]);
}

test('the permanent legacy fixture is pinned before decompression and derives its own 149-file inventory',async()=>{
  const archive=await readFile(new URL('./fixtures/legacy-integration/bis-integration-0.0.23.tgz',import.meta.url));
  assert.equal(archive.length,legacyArchiveBytes);
  const {files,pkg}=verifyLegacyFixtureArchive(archive);
  assert.equal(files.size,149);assert.equal(pkg.version,'0.0.23');assert.ok(files.has('dist/integration.js'));
  const corrupt=Buffer.from(archive);corrupt[100]^=1;
  for(const bytes of [corrupt,archive.subarray(0,-1),Buffer.from('not a gzip archive')])
    assert.throws(()=>verifyLegacyFixtureArchive(bytes),/legacy-artifact-unverified/);
  assert.throws(()=>verifyLegacyFixtureArchive(gzipSync(testTar([{name:'package/dist/integration.js'}]))),/legacy-artifact-unverified/);
  const source=await readLegacyFixtureSource('src/client/wallet-layer-arkade/lto-script.ts');
  assert.match(source,/buildLtoScript/);
  for(const path of ['../package.json','src/../../.env.local','/src/index.ts','src\\index.ts','dist/integration.js','src/missing.ts'])
    await assert.rejects(readLegacyFixtureSource(path),/legacy-source-unverified/);
});

test('legacy tar parsing rejects escaping paths, links, duplicate aliases and file/directory collisions',()=>{
  const valid=testTar([{name:'package/src/example.ts',data:'public code'}]);
  assert.equal(inspectLegacyArchiveLayout(gzipSync(valid)).get('src/example.ts')?.toString(),'public code');
  assert.equal(inspectLegacyArchiveLayout(gzipSync(testTar([{name:'package/src/',type:'5',data:''},{name:'package/src/a.ts'}]))).size,1);
  for(const name of ['../escape','/package/escape','package/../escape','package/src/../../escape','package/C:/escape',
    'package/src\\escape','package/src//escape','package/./escape','package/src/escape\n','package/.env.local','package/node_modules/escape',
    'package/NUL.txt','package/src/COM1','package/src/file.ts.','package/src/file.ts '])
    assert.throws(()=>inspectLegacyArchiveLayout(gzipSync(testTar([{name}]))),/layout-unverified/,name);
  for(const type of ['1','2','3','4','6','7','x','g','L','K'])
    assert.throws(()=>inspectLegacyArchiveLayout(gzipSync(testTar([{name:'package/link',type,link:'../../escape'}]))),/layout-unverified/,type);
  for(const entries of [
    [{name:'package/src/a.ts'},{name:'package/src/a.ts'}],
    [{name:'package/src/a.ts'},{name:'package/SRC/A.ts'}],
    [{name:'package/src'},{name:'package/src/a.ts'}],
    [{name:'package/src/a.ts'},{name:'package/src'}],
    [{name:'package/link',link:'../escape'}],
    [{name:'package/src/a.ts',prefix:'../escape'}],
  ])assert.throws(()=>inspectLegacyArchiveLayout(gzipSync(testTar(entries))),/layout-unverified/);
});

test('legacy bundling succeeds with filesystem reads restricted to the BIS checkout',()=>{
  const repository=fileURLToPath(new URL('../../',import.meta.url));
  const code=`const {prepareLegacyBundle}=await import(${JSON.stringify(new URL('./treasure-protected-harness.ts',import.meta.url).href)});
    const bundle=await prepareLegacyBundle();
    process.stdout.write(JSON.stringify({files:bundle.provenance.installedFiles,archiveHash:bundle.provenance.archiveHash,
      siblingReadable:process.permission.has('fs.read',${JSON.stringify(resolve(repository,'../blockchain-stealth-and-steel-game'))})}));`;
  const result=spawnSync(process.execPath,['--permission',`--allow-fs-read=${repository}`,`--allow-fs-write=${resolve(repository,'output')}`,
    '--allow-worker','--allow-addons','--input-type=module','--eval',code],{cwd:repository,encoding:'utf8',timeout:30000});
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{files:149,archiveHash:legacyArchiveHash,siblingReadable:false});
});

test('legacy tar parsing rejects corrupt checksums, truncation, padding, trailing data and decompression overflow',()=>{
  const valid=testTar([{name:'package/a.ts'}]);
  const checksum=Buffer.from(valid);checksum[1]^=1;
  const padding=Buffer.from(valid);padding[520]=1;
  const trailing=Buffer.from(valid);trailing[trailing.length-1]=1;
  for(const tar of [checksum,padding,trailing,valid.subarray(0,valid.length-512),valid.subarray(0,700)])
    assert.throws(()=>inspectLegacyArchiveLayout(gzipSync(tar)),/layout-unverified/);
  assert.throws(()=>inspectLegacyArchiveLayout(Buffer.from('not gzip')),/layout-unverified/);
  assert.throws(()=>inspectLegacyArchiveLayout(gzipSync(Buffer.alloc(33*1024*1024))),/layout-unverified/);
});

test('legacy bundling refuses dependency drift instead of resolving through a game installation',()=>{
  const pins={'@arkade-os/sdk':'0.4.79','@scure/bip39':'2.4.0',react:'19.3.0','react-dom':'19.3.0'};
  assert.doesNotThrow(()=>assertLegacyDependencyPins(pins));
  for(const name of Object.keys(pins))assert.throws(()=>assertLegacyDependencyPins({...pins,[name]:'0.0.0'}),/dependency-unverified/);
  assert.throws(()=>assertLegacyDependencyPins({}),/dependency-unverified/);
});

test('parallel legacy bundle calls use independent complete extractions with verified public bytes',async()=>{
  const bundles=await Promise.all([prepareLegacyBundle(),prepareLegacyBundle()]);
  assert.notEqual(bundles[0].provenance.extraction,bundles[1].provenance.extraction);
  const {files}=verifyLegacyFixtureArchive(await readFile(new URL('./fixtures/legacy-integration/bis-integration-0.0.23.tgz',import.meta.url)));
  for(const bundle of bundles){
    assert.match(bundle.provenance.extraction.replaceAll('\\','/'),/^output\/fixtures\/legacy-integration\//);
    assert.equal(createHash('sha256').update(bundle.code).digest('hex'),bundle.provenance.bundleHash);
    for(const [path,bytes] of files)assert.deepEqual(await readFile(new URL(`${bundle.provenance.extraction.replaceAll('\\','/')}/${path}`,new URL('../../',import.meta.url))),bytes);
    assert.equal(await readFile(new URL(`${bundle.provenance.extraction.replaceAll('\\','/')}/legacy-bundle.js`,new URL('../../',import.meta.url)),'utf8'),bundle.code);
  }
});

test('the executable runner refuses either new financial scenario before opening a wallet without its exact slot',()=>{
  for(const scenario of ['network-replacement','legacy-rollback']){
    const result=spawnSync(process.execPath,['BIS/scripts/treasure-admin-live.ts','browser',scenario,'slot-denied-test','signet'],
      {encoding:'utf8',env:{...process.env,BIS_TREASURE_FINANCIAL_SLOT:''},timeout:15000});
    assert.equal(result.status,1);assert.equal(result.error,undefined);
    const rows=result.stdout.trim().split(/\r?\n/).map(line=>JSON.parse(line));
    assert.equal(rows.length,1);assert.equal(rows[0].stage,'arguments');assert.equal(rows[0].reason,'coordinator-financial-slot-required');
  }
});

test('legacy harness refuses another archive, version, export or protected origin before navigation',async()=>{
  const verified={artifact:'bis-integration-0.0.23.tgz',sha256:legacyArchiveHash,version:'0.0.23',defaultExport:'./dist/integration.js'};
  assert.doesNotThrow(()=>assertLegacyArchive(verified,legacyArchiveHash));
  for(const patch of [{artifact:'replacement.tgz'},{sha256:'a'.repeat(64)},{version:'0.0.26'},{defaultExport:'./src/index.ts'}])
    assert.throws(()=>assertLegacyArchive({...verified,...patch},legacyArchiveHash),/artifact-unverified/);
  assert.throws(()=>assertLegacyArchive(verified,'b'.repeat(64)),/artifact-unverified/);
  for(const url of ['https://example.com/admin/','http://127.0.0.1:5176/admin/','http://127.0.0.1:5174/marketplace/']){
    let navigation=0;
    await assert.rejects(enterProtectedHarness({url:()=>url,goto:()=>{navigation++;}}),/origin-unverified/);
    assert.equal(navigation,0);
  }
});

test('verified old distribution bundles and exposes actual public factories without opening a wallet',async t=>{
  const legacy=await prepareLegacyBundle();
  assert.equal(legacy.provenance.archiveHash,legacyArchiveHash);assert.equal(legacy.provenance.installedFiles,149);
  const config=developmentConfig({port:0});config.cacheDir='output/vite-cache/treasure-legacy-harness';config.server.hmr=false;
  const server=await createServer(config);let browser;
  try{
    await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();
    await page.goto(new URL('/integration/',server.resolvedUrls!.local[0]).href,{waitUntil:'domcontentloaded'});
    const calls=[];
    await page.route('https://**',route=>{calls.push(route.request().url());return route.abort();});
    const bundleUrl=new URL(legacyBundlePath,page.url()).href;
    await page.route(bundleUrl,route=>route.fulfill({status:200,contentType:'text/javascript',body:legacy.code}));
    const exports=await page.evaluate(async url=>{
      const api=await import(/* @vite-ignore */url);
      return ['createBisContext','createBisGameWallet','createBisLto'].map(name=>({name,type:typeof api[name]}));
    },bundleUrl);
    assert.ok(exports.every(entry=>entry.type==='function'));assert.deepEqual(calls,[]);
    const actualFactories=await page.evaluate(async url=>{
      const api=await import(/* @vite-ignore */url);
      const context=api.createBisContext();let game,offers;
      try{
        await context.readyAsync();
        game=api.createBisGameWallet({playerProfileId:()=>context.getState().profileId,playerNetwork:()=>context.getState().network,
          playerSubscribe:context.subscribe,playerSessionKey:()=>JSON.stringify([context.getState().profileId,context.getState().network])});
        offers=api.createBisLto({context,gameWallet:game,creationEnabled:false});
        const now=Date.now();
        const result=await offers.start({purpose:'treasureLTO',sessionId:'unfunded-old-factory',hostReference:'public-fixture',
          exclusivityKey:'treasure',amountSats:1000,startedAt:now,expiresAt:now+90000});
        const visible=await offers.checkContractsAsync({purpose:'treasureLTO',includeResolved:true});
        return {phase:context.getState().phase,selected:!!context.getState().profileId,status:result.status,contracts:visible.contracts.length};
      }finally{offers?.dispose({endSessions:false});game?.dispose();context.dispose();}
    },bundleUrl);
    assert.deepEqual(actualFactories,{phase:'idle',selected:false,status:'unavailable',contracts:0});
    assert.deepEqual(calls,[],'actual old public factory construction must remain unfunded and offline');
    const safeguards=await page.evaluate(async()=>{
      const helpers=await import('/BIS/scripts/treasure-protected-browser.ts');
      let commands=0;
      globalThis.__bisLegacyAcceptance={offers:{start:async()=>{commands++;throw Error('controlled-unknown');}}};
      const input={sessionId:'fixture',startedAt:Date.now(),expiresAt:Date.now()+90000};
      let first,second;
      try{await helpers.startLegacyAcceptance(input);}catch(error){first=error.message;}
      try{await helpers.startLegacyAcceptance(input);}catch(error){second=error.message;}
      delete globalThis.__bisLegacyAcceptance;
      globalThis.__bisOriginalAcceptance={started:true};
      let duplicateOriginal;
      try{await helpers.actOnOriginalAcceptance({kind:'claim'});}catch(error){duplicateOriginal=error.message;}
      await helpers.stopOriginalAcceptance();
      return {commands,first,second,duplicateOriginal};
    });
    assert.deepEqual(safeguards,{commands:1,first:'controlled-unknown',second:'legacy-original-only',duplicateOriginal:'original-action-already-started'});
    t.diagnostic(JSON.stringify({provenance:legacy.provenance,exports,qualification:'wallet-free distribution import only; no lifecycle or live recovery proof'}));
  }finally{await browser?.close();await server.close();}
});
