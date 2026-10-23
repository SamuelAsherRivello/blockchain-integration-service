import {createHash,randomBytes} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Plugin} from 'vite';

const networkOrigins=[
  'https://signet.arkade.sh','https://mutinynet.arkade.sh',
  'https://emulator.mutinynet.arkade.sh','https://faucet.signet.arkade.sh',
  'https://mempool.space','https://mempool.signet.arkade.sh','https://mempool.mutinynet.arkade.sh',
  'https://samuelasherrivello.github.io','https://raw.githubusercontent.com',
  'http://127.0.0.1:7074','http://127.0.0.1:7075',
];

/** Public deployment origins only. Never accepts CSP tokens, credentials or paths. */
export function cspConnectOrigins(input=''):string[]{
  return [...new Set(input.split(/[\s,]+/).filter(Boolean).map(value=>{
    const url=new URL(value);
    if(/[;'"<>]/.test(value)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||
      !(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))
      throw Error('BIS_CSP_CONNECT_ORIGINS requires HTTPS or loopback HTTP origins.');
    return url.origin;
  }))];
}

export function contentSecurityPolicy({development=false,nonce,hashes=[],connectOrigins=[]}:{development?:boolean;nonce?:string;hashes?:string[];connectOrigins?:string[]}={}):string{
  if(nonce&&!/^[A-Za-z0-9+/=_-]+$/.test(nonce))throw Error('Invalid CSP nonce.');
  if(hashes.some(hash=>!/^'sha256-[A-Za-z0-9+/]+='$/.test(hash)))throw Error('Invalid CSP script hash.');
  const extra=cspConnectOrigins(connectOrigins.join(' '));
  return [
    "default-src 'none'",
    `script-src 'self' 'wasm-unsafe-eval'${nonce?` 'nonce-${nonce}'`:''}${hashes.length?' '+[...new Set(hashes)].join(' '):''}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    `connect-src 'self' ${[...new Set([...networkOrigins,...extra,...(development?['ws://127.0.0.1:*','ws://localhost:*']:[])])].join(' ')}`,
    "object-src 'none'","base-uri 'self'","form-action 'self'",
  ].join('; ');
}

/** Hash only authored/build-generated inline scripts, never runtime user markup. */
export function protectHtml(html:string,options:{development?:boolean;nonce?:string;connectOrigins?:string[]}={}):string{
  const withoutOwned=html.replace(/\s*<meta\b(?=[^>]*\bname=["']bis-content-security-policy["'])[^>]*>\s*/gi,'');
  if(/<meta\b[^>]*http-equiv\s*=\s*["']content-security-policy["']/i.test(withoutOwned))throw Error('Existing CSP requires explicit reconciliation.');
  const hashes=[...withoutOwned.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(match=>!/(?:^|\s)src\s*=/i.test(match[1])&&match[2].trim())
    .map(match=>`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
  const policy=contentSecurityPolicy({...options,hashes}).replaceAll('&','&amp;').replaceAll('"','&quot;');
  if(!/<head\b[^>]*>/i.test(withoutOwned))throw Error('HTML entry requires a head for CSP.');
  return withoutOwned.replace(/<head\b[^>]*>/i,head=>`${head}\n<meta name="bis-content-security-policy" http-equiv="Content-Security-Policy" content="${policy}">`);
}

/** Shared by root dev, workspace dev/preview and every production HTML build. */
export function bisContentSecurityPolicy():Plugin{
  let development=false,nonce:string|undefined;
  const placeholder='BIS_DEV_NONCE_PLACEHOLDER'.padEnd(32,'_');
  const connectOrigins=cspConnectOrigins(process.env.BIS_CSP_CONNECT_ORIGINS??'');
  return {
    name:'bis-content-security-policy',enforce:'pre',
    config(_config,env){
      development=env.command==='serve'&&!env.isPreview;
      if(development){nonce=placeholder;return {html:{cspNonce:placeholder}};}
    },
    configureServer(server){server.middlewares.use((_request,response,next)=>{
      const requestNonce=randomBytes(24).toString('base64');
      response.setHeader('Content-Security-Policy',contentSecurityPolicy({development:true,nonce:requestNonce,connectOrigins})+"; frame-ancestors 'self'");
      const end=response.end;
      response.end=function(chunk?:any,...args:any[]){
        if(String(response.getHeader('Content-Type')??'').includes('text/html')&&(typeof chunk==='string'||Buffer.isBuffer(chunk))){
          // Vite uses the placeholder on injected scripts/styles. Substitute at
          // the response boundary, not in cached transforms. Equal byte length
          // preserves Vite's Content-Length while every request gets fresh entropy.
          const updated=chunk.toString().replaceAll(placeholder,requestNonce);
          chunk=Buffer.isBuffer(chunk)?Buffer.from(updated):updated;
        }
        return end.call(this,chunk,...args);
      } as typeof response.end;
      response.setHeader('X-Content-Type-Options','nosniff');next();
    });},
    configurePreviewServer(server){server.middlewares.use((_request,response,next)=>{
      // Built HTML carries exact inline hashes. A generic script header would
      // intersect with that policy and incorrectly block authored redirect code.
      response.setHeader('Content-Security-Policy',"frame-ancestors 'self'");
      response.setHeader('X-Content-Type-Options','nosniff');next();
    });},
    transformIndexHtml:{order:'post',handler:html=>protectHtml(html,{development,nonce,connectOrigins})},
  };
}

/** Includes copied root HTML and generated legacy redirects, not only Vite entries. */
export async function protectStaticHtml(directory:string):Promise<number>{
  let count=0;
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isSymbolicLink())throw Error('Static artifact cannot contain symlinks.');
    if(entry.isDirectory())count+=await protectStaticHtml(path);
    else if(entry.isFile()&&entry.name.endsWith('.html')){
      await writeFile(path,protectHtml(await readFile(path,'utf8'),{connectOrigins:cspConnectOrigins(process.env.BIS_CSP_CONNECT_ORIGINS??'')}));count++;
    }
  }
  return count;
}
