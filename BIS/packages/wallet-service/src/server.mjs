import {createServer} from 'node:http';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openVault} from './vault.mjs';
import {createWalletRuntime} from './runtime.mjs';
import {privateAdminRequest,verifyProof} from './protocol.mjs';

export function walletHttpServer(runtime,{origins=['http://127.0.0.1:5173','http://127.0.0.1:5174','http://127.0.0.1:15174','http://localhost:5173','http://localhost:5174']}={}) {
 const allowed=new Set(origins),seen=new Map();let adminBusy=false;
 return createServer(async(request,response)=>{
  response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
  const reply=(code,body)=>{if(!response.writableEnded){response.writeHead(code);response.end(JSON.stringify(body,(_,v)=>typeof v==='bigint'?String(v):v));}};
  const origin=request.headers.origin;
  if(origin&&!allowed.has(origin))return reply(403,{error:'Origin not allowed.'});
  if(origin){response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');}
  if(request.method==='OPTIONS'){response.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');response.setHeader('Access-Control-Allow-Headers','Content-Type, X-BIS-Proof');return reply(204,{});}
  try {
   const path=request.url;
   if(request.method==='GET'&&path==='/health')return reply(200,{status:'ok',network:'signet',protocol:1});
   if(request.method==='GET'&&path==='/v1/wallet')return reply(200,runtime.publicState());
   if(request.method!=='POST'||!request.headers['content-type']?.startsWith('application/json'))return reply(404,{error:'Route unavailable.'});
   let body='';for await(const chunk of request){body+=chunk;if(body.length>2000000)return reply(413,{error:'Request too large.'});}
   const args=JSON.parse(body);
   if(path==='/admin/action') {
    if(!privateAdminRequest(request))return reply(403,{error:'Use the private local Admin connection.'});
    if(adminBusy)return reply(409,{error:'Another Admin operation is running.'});
    adminBusy=true;try{return reply(200,{result:await runtime.admin(args.method,args.args),wallet:runtime.publicState()});}finally{adminBusy=false;}
   }
   if(!/^\/v1\/(start|claim|reject|end|query|sync|signature)$/.test(path))return reply(404,{error:'Route unavailable.'});
   const player=verifyProof(JSON.parse(request.headers['x-bis-proof']??'null'),request.method,path,body,seen);
   return reply(200,await runtime.call(player,path.slice(4),args));
  }catch{return reply(400,{error:'Wallet operation unavailable. Check readiness and pending recovery.'});}
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const directory=process.env.BIS_WALLET_DATA_DIR??join(homedir(),'.bis-wallet-service','signet');
 const vault=openVault(directory),runtime=createWalletRuntime(vault);
 const origins=process.env.BIS_WALLET_ORIGINS?.split(',').map(s=>s.trim()).filter(Boolean);
 const server=walletHttpServer(runtime,{...(origins?{origins}:{})});
 const port=Number(process.env.BIS_WALLET_PORT??8787);
 // Public access goes through HTTPS with a preserved Host; /admin stays private.
 server.listen(port,'127.0.0.1',()=>console.log(`BIS wallet service ready at http://127.0.0.1:${port} (Signet)`));
 let closing=false;
 const close=async()=>{if(closing)return;closing=true;server.close();await runtime.close();vault.close();process.exit(0);};
 process.on('SIGINT',close);process.on('SIGTERM',close);
}
