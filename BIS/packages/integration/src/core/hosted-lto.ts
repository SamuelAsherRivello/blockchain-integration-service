import {MnemonicIdentity} from '@arkade-os/sdk';
import type {BisContext} from './context.ts';
import type {createBisLto,BisContractsResult,BisContractFilter,BisContractActionResult,BisLtoRequest} from './lto-service.ts';
import {createAccountStorage} from './account-storage.ts';
import {makeProof} from './hosted-protocol.ts';
import {signHostedClaim,type ClaimChallenge} from '../arkade/hosted-claim.ts';
import {hostedWalletTransport,type GameWalletController} from './hosted-wallet.ts';

export function createHostedLto(options:{context:BisContext;gameWallet:GameWalletController;creationEnabled?:boolean}):ReturnType<typeof createBisLto> {
 const {context,gameWallet}=options,transport=hostedWalletTransport(gameWallet)!;
 const storage=createAccountStorage(),signing=new Set<string>(),claims=new Set<string>(),sessions=new Set<string>();
 let cursor=0,epoch:string|undefined,disposed=false,polling=false,profile=context.getState().profileId;
 async function account(){const current=(await storage.load()).account;if(!current||current.profileId!==context.getState().profileId||context.getState().phase!=='active')throw Error('Player unavailable.');return current;}
 async function rpc<T>(method:string,args:Record<string,unknown>={}):Promise<T> {
  const player=await account(),identity=MnemonicIdentity.fromMnemonic(player.phrase,{isMainnet:false});
  if(profile!==player.profileId){cursor=0;claims.clear();profile=player.profileId;}
  const path=`/v1/${method}`,body=JSON.stringify({...args,after:cursor,epoch});
  const proof=await makeProof(identity,'POST',path,body);
  const response=await fetch(`${transport.url}${path}`,{method:'POST',headers:{'Content-Type':'application/json','X-BIS-Proof':JSON.stringify(proof)},body,cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Game wallet service unavailable.');
  const data=await response.json();
  if(context.getState().profileId!==player.profileId)throw Error('Player changed.');
  if(epoch!==data.epoch){epoch=data.epoch;cursor=0;}
  for(const event of data.events??[])if(event.id>cursor&&!disposed)context.showToast(event.message,event.options);
  cursor=Math.max(cursor,data.cursor??0);return data.result;
 }
 async function poll() {
  if(polling||disposed&&!claims.size||!context.getState().profileId)return;polling=true;
  try {
   const result=await rpc<{signatures:ClaimChallenge[];contracts:BisContractsResult;wallet:Parameters<typeof transport.update>[0]}>('sync',{filter:{includeResolved:true}});
   transport.update(result.wallet);
   for(const c of result.contracts.contracts)if(c.financial==='claimed'||c.financial==='refunded'||c.financial==='failed')claims.delete(c.id);
   for(const challenge of result.signatures) {
    if(challenge.stage==='checkpoint'&&challenge.recovery.spend)claims.add(challenge.contractId);
    if(!claims.has(challenge.contractId)||signing.has(challenge.id))continue;
    signing.add(challenge.id);
    try {
     const player=await account(),transaction=await signHostedClaim(challenge,player,gameWallet.getState().profileId??'');
     if(context.getState().profileId!==player.profileId)throw Error('Player changed.');
     await rpc('signature',{id:challenge.id,transaction});
    }catch{await rpc('signature',{id:challenge.id,cancel:true}).catch(()=>{});}
    finally{signing.delete(challenge.id);}
   }
  }catch{/* Polling failure is unavailable, never an empty or successful outcome. */}
  finally{polling=false;if(disposed&&!claims.size)clearInterval(timer);}
 }
 const controller={
  async checkContracts(filter:BisContractFilter={}):Promise<BisContractsResult>{try{return await rpc('query',{filter});}catch{return{status:'unavailable',contracts:[]};}},
  async start(request:BisLtoRequest):Promise<BisContractActionResult>{if(disposed||options.creationEnabled===false)return{status:'unavailable'};sessions.add(request.sessionId);try{return await rpc('start',{request});}catch{return{status:'unavailable'};}},
  async claim(id:string):Promise<BisContractActionResult>{if(disposed)return{status:'unavailable'};claims.add(id);try{const result=await rpc<BisContractActionResult>('claim',{id});if(result.status!=='pending')claims.delete(id);void poll();return result;}catch{claims.delete(id);return{status:'unavailable'};}},
  async reject(id:string):Promise<BisContractActionResult>{try{return await rpc('reject',{id});}catch{return{status:'unavailable'};}},
  async refund(id:string):Promise<BisContractActionResult>{try{const response=await fetch(`${transport.url}/admin/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'refundContract',args:[id]}),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error();return(await response.json()).result;}catch{return{status:'unavailable'};}},
  async endSession(sessionId:string){sessions.delete(sessionId);await rpc('end',{sessionId}).catch(()=>{});},
  reconcile:poll,
  dispose({endSessions=true}={}){disposed=true;if(endSessions)for(const id of sessions)void controller.endSession(id);if(!claims.size)clearInterval(timer);},
 };
 const timer=setInterval(()=>{void poll();},1000);void poll();return controller;
}
