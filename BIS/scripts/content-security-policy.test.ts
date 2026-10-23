import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {contentSecurityPolicy,cspConnectOrigins,protectHtml,protectStaticHtml} from './content-security-policy.ts';
import {developmentConfig} from './dev-config.ts';

test('CSP restricts script execution without breaking documented resource origins',()=>{
  const policy=contentSecurityPolicy();
  assert.match(policy,/default-src 'none'/);assert.match(policy,/script-src 'self' 'wasm-unsafe-eval';/);
  assert.match(policy,/script-src-attr 'none'/);assert.match(policy,/object-src 'none'/);
  assert.doesNotMatch(policy,/'unsafe-eval'|script-src[^;]*'unsafe-inline'|script-src[^;]*https:/);
  for(const origin of ['https://signet.arkade.sh','https://mutinynet.arkade.sh','https://emulator.mutinynet.arkade.sh','https://mempool.signet.arkade.sh'])assert.ok(policy.includes(origin));
  assert.doesNotMatch(policy,/ws:\/\//);assert.match(contentSecurityPolicy({development:true}),/ws:\/\/127\.0\.0\.1:\*/);
});

test('custom CSP connections accept explicit origins, never paths or directive injection',()=>{
  assert.deepEqual(cspConnectOrigins('https://signer.example http://localhost:8080 https://signer.example'),['https://signer.example','http://localhost:8080']);
  for(const value of ['http://untrusted.example','https://user:secret@signer.example','https://signer.example/path','https://signer.example?query',"https://x.example;script-src",'data:text/plain,code'])
    assert.throws(()=>cspConnectOrigins(value));
});

test('static HTML hashes authored code and protects head before any base or resource',()=>{
  const code='location.replace("/new/")';
  const original=`<!doctype html><html><head><base href="/old/"><script>${code}</script></head></html>`;
  const secured=protectHtml(original),hash=createHash('sha256').update(code).digest('base64');
  assert.ok(secured.includes(`'sha256-${hash}'`));assert.ok(secured.indexOf('Content-Security-Policy')<secured.indexOf('<base'));
  assert.equal(protectHtml(secured),secured);assert.doesNotMatch(secured,/nonce-/);
  assert.throws(()=>protectHtml('<head><meta http-equiv="Content-Security-Policy" content="default-src none"></head>'));
});

test('copied launcher and nested generated redirects receive static policy',async()=>{
  await mkdir('output/reports/treasure-contract/hardening',{recursive:true});
  const directory=await mkdtemp('output/reports/treasure-contract/hardening/csp-static-');
  await mkdir(join(directory,'redirect'));await writeFile(join(directory,'index.html'),'<head></head><body>launcher</body>');
  await writeFile(join(directory,'redirect/index.html'),'<head><script>location.replace("/new/")</script></head>');
  assert.equal(await protectStaticHtml(directory),2);
  for(const path of ['index.html','redirect/index.html'])assert.match(await readFile(join(directory,path),'utf8'),/http-equiv="Content-Security-Policy"/);
});

test('real browser blocks inline/eval/foreign script but renders Admin, safe Mermaid and aliases',async()=>{
  const config=developmentConfig({port:0});
  config.cacheDir='output/vite-cache/csp-test';config.server.hmr=false;
  config.plugins.unshift({name:'bis-security-test-control',configureServer(server){
    server.middlewares.use('/__bis-security-control.js',(_request,response)=>{
      response.setHeader('Content-Type','text/javascript');
      response.end('window.__cspControl=true;try{eval("window.__cspEval=true")}catch{window.__cspEvalBlocked=true}');
    });
  }});
  const server=await createServer(config);let browser;
  try{
    await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');
    const origin=`http://127.0.0.1:${address.port}`;
    const nonces=[];
    for(const path of ['/admin/','/BIS/packages/integration-admin/index.html','/integration-marketplace/','/integration/']){
      const response=await fetch(origin+path),html=await response.text();
      assert.match(response.headers.get('content-security-policy')??'',/script-src 'self'/);
      assert.match(html,/name="bis-content-security-policy"/);
      const nonce=response.headers.get('content-security-policy')!.match(/'nonce-([^']+)'/)?.[1];
      assert.ok(nonce);assert.ok(html.includes(`nonce-${nonce}`));assert.doesNotMatch(html,/BIS_DEV_NONCE_PLACEHOLDER/);nonces.push(nonce);
    }
    assert.equal(new Set(nonces).size,nonces.length,'every HTML response needs a fresh nonce');
    browser=await chromium.launch({headless:true});const page=await browser.newPage();
    await page.goto(origin+'/admin/');await page.getByRole('button',{name:'Start LTO',exact:true}).waitFor();
    await page.evaluate(()=>{
      const script=document.createElement('script');script.src='/__bis-security-control.js';document.head.append(script);
      const inline=document.createElement('script');inline.textContent='window.__cspInline=true';document.head.append(inline);
      const button=document.createElement('button');button.setAttribute('onclick','window.__cspHandler=true');document.body.append(button);button.click();
      const foreign=document.createElement('script');foreign.src='https://not-approved.example/attack.js';document.head.append(foreign);
    });
    await page.waitForFunction(()=>window.__cspControl===true);
    await page.evaluate(oldNonce=>{const script=document.createElement('script');script.nonce=oldNonce;script.textContent='window.__reusedNonce=true';document.head.append(script);},nonces[0]);
    assert.equal(await page.evaluate(()=>!!window.__reusedNonce),false);
    assert.deepEqual(await page.evaluate(()=>({control:window.__cspControl,evalBlocked:window.__cspEvalBlocked,inline:!!window.__cspInline,handler:!!window.__cspHandler})),{control:true,evalBlocked:true,inline:false,handler:false});
    const sanitized=await page.evaluate(async()=>{
      const {default:mermaid}=await import('/node_modules/mermaid/dist/mermaid.esm.min.mjs');
      mermaid.initialize({startOnLoad:false,securityLevel:'strict'});
      const safe=await mermaid.render('csp-safe','flowchart TD\n A[Start] --> B[End]');
      const hostile=await mermaid.render('csp-hostile','flowchart TD\n A["<img src=x onerror=alert(1)>"]');
      const container=document.createElement('div');container.innerHTML=hostile.svg;
      return {valid:safe.svg.includes('<svg'),eventAttributes:container.querySelectorAll('[onerror],[onclick],script').length};
    });
    assert.deepEqual(sanitized,{valid:true,eventAttributes:0});
  }finally{await browser?.close();await server.close();}
});
