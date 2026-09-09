import test from 'node:test';
import assert from 'node:assert/strict';
import {walletHttpServer} from '../src/server.mjs';
import {MnemonicIdentity} from '@arkade-os/sdk';
import {generateMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english.js';
import {makeProof} from '../../integration/src/core/hosted-protocol.ts';
import {request as httpRequest} from 'node:http';

test('HTTP service exposes only public state, requires player proof and keeps Admin on the private connection',async()=>{
 let imports=0,queries=0;
 const runtime={publicState:()=>({state:{status:'empty'}}),admin:async()=>{imports++;return true;},call:async()=>{queries++;return{result:{status:'ready',contracts:[]}};}};
 const server=walletHttpServer(runtime);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 try {
  assert.equal((await fetch(`${url}/health`)).status,200);
  assert.equal((await fetch(`${url}/vault.key`)).status,404);
  const post=(path,body,headers={})=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
  assert.equal((await post('/admin/action','{}')).status,403);
  assert.equal((await post('/admin/action','{}',{Origin:'https://untrusted.example'})).status,403);
  const publicHostStatus=await new Promise(resolve=>{const req=httpRequest(url+'/admin/action',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:5174',Host:'wallet.example'}},res=>{res.resume();resolve(res.statusCode);});req.end('{}');});
  assert.equal(publicHostStatus,403);
  assert.equal((await post('/admin/action','{}',{Origin:'http://127.0.0.1:5174'})).status,200);assert.equal(imports,1);
  assert.equal((await post('/v1/query','{}')).status,400);assert.equal(queries,0);
  const identity=MnemonicIdentity.fromMnemonic(generateMnemonic(wordlist),{isMainnet:false}),proof=await makeProof(identity,'POST','/v1/query','{}');
  assert.equal((await post('/v1/query','{}',{'X-BIS-Proof':JSON.stringify(proof)})).status,200);assert.equal(queries,1);
  assert.equal((await post('/v1/query','{}',{'X-BIS-Proof':JSON.stringify(proof)})).status,400);assert.equal(queries,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
