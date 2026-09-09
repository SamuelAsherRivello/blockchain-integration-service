import {createBisGameWallet} from '../../integration/src/core/game-wallet.ts';
import {restoreAccount} from '../../integration/src/arkade/account.ts';
import {loadAddresses} from '../../integration/src/arkade/addresses.ts';
import {loadBalance} from '../../integration/src/arkade/balance.ts';
import {createLtoService,inspectContractDocument} from '../../integration/src/core/lto-service.ts';
import {advanceContractDocument} from '../../integration/src/core/contract-storage.ts';
import {emptyContractLedger,contractResolved,contractFailureMessages} from '../../integration/src/core/contracts.ts';
import {prepareLtoRecovery,submitLtoSpend,reconcileLtoSpend,resumeLtoFinalization} from '../../integration/src/arkade/lto-contract.ts';
import {journalStorage} from './vault.mjs';
import {mergeClaimSignature} from './protocol.mjs';
import {Transaction,claimWithPreimageIdentity} from '@arkade-os/sdk';
import {withWalletMutation} from '../../integration/src/core/boarding-record.ts';
import {publishContractReservations} from '../../integration/src/core/contract-reservations.ts';
import {locks} from 'node:worker_threads';

export function createWalletRuntime(vault,{adapter={},walletDependencies={}}={}) {
 Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:locks});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:journalStorage(vault)});
 const eventLists=new Map(),notified=new Set(),epoch=crypto.randomUUID();let eventId=0;
 const eventsFor=id=>{if(!eventLists.has(id))eventLists.set(id,[]);return eventLists.get(id);};
 function notify(previous,next) {
  for(const record of next.ledger.contracts) {
   const old=previous.ledger.contracts.find(r=>r.id===record.id);
   if(old&&JSON.stringify(old.operation)===JSON.stringify(record.operation))continue;
   const phase=record.operation.submission,key=`${record.operation.id}:${['confirmed','not-submitted'].includes(phase)?phase:'pending'}`;
   if(notified.has(key))continue;notified.add(key);
   const label=record.operation.kind==='fund'?'Offer funding':record.operation.kind==='claim'?'Contract claim':'Contract refund';
   const message=phase==='confirmed'?record.operation.kind==='fund'&&(record.ended||Date.now()>=record.expiresAt)?'Offer funded; return pending':`${label} confirmed: ${record.amountSats.toLocaleString('en-US')} sats`
    :phase==='not-submitted'?`${label} was not submitted${record.operation.failure?`: ${contractFailureMessages[record.operation.failure]}`:''}`:`${label} pending`;
   const events=eventsFor(record.scope.playerId);events.push({id:++eventId,message,options:{messageType:phase==='confirmed'?'success':phase==='not-submitted'?'warning':'info',icon:'lightning'}});if(events.length>200)events.shift();
  }
 }
 const empty=()=>({version:1,revision:0,ledger:emptyContractLedger(),recovery:{}});
 const storage={load:async()=>vault.get('contracts')??empty(),save:async doc=>{const previous=vault.get('contracts')??empty(),next=advanceContractDocument(previous,doc);vault.set('contracts',next);notify(previous,next);return next;}};
 const listeners=new Set();
 const gameStorage={load:async()=>{const id=vault.get('selected');return id?vault.get(`wallet:${id}`):null;},
  select:async account=>{const old=vault.get('selected');if(old&&old!==account.profileId&&(await storage.load()).ledger.contracts.some(r=>r.scope.gameId===old&&!contractResolved(r)))throw Error('Resolve the current wallet contracts first.');vault.set(`wallet:${account.profileId}`,account);vault.set('selected',account.profileId);listeners.forEach(fn=>fn());},
  logout:async()=>{if((await storage.load()).ledger.contracts.some(r=>!contractResolved(r)))throw Error('Resolve contracts first.');vault.set('selected',null);listeners.forEach(fn=>fn());},
  subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},dispose(){}};
 let adminPlayer;
 const wallet=createBisGameWallet({playerProfileId:()=>adminPlayer},{storage:gameStorage,restore:restoreAccount,addresses:loadAddresses,balance:loadBalance,watch:undefined,...walletDependencies});
 const sessions=new Map(),challenges=new Map(),answered=new Set();
 const saveChallenge=(id,value)=>vault.set('claim-signing',{...(vault.get('claim-signing')??{}),[id]:value});
 const pendingChallenges=async playerId=>{const doc=await storage.load();return Object.values(vault.get('claim-signing')??{}).filter(c=>c&&!answered.has(c.id)&&!(c.stage==='ark'&&c.signedTransaction)&&!doc.recovery[c.contractId]?.finalization&&c.record.scope.playerId===playerId&&doc.ledger.contracts.some(r=>r.id===c.contractId&&r.operation.id===c.record.operation.id&&['prepared','submitted','unknown'].includes(r.operation.submission)));};
 const challengeIdentity=(player,record,recovery)=>({
  xOnlyPublicKey:async()=>Buffer.from(player.publicKey.slice(2),'hex'),compressedPublicKey:async()=>Buffer.from(player.publicKey,'hex'),
  signMessage:async()=>{throw Error('Claim transaction signing only.');},signerSession:()=>{throw Error('Claim transaction signing only.');},
  sign:async(transaction)=>{const current=(await storage.load()).recovery[record.id]??recovery;return new Promise((resolve,reject)=>{
   const id=crypto.randomUUID(),timeout=setTimeout(()=>{challenges.delete(id);reject(Error('Claim signing interrupted.'));},30000);
   const request={id,contractId:record.id,stage:current.spend?'checkpoint':'ark',transaction:Buffer.from(transaction.toPSBT()).toString('base64'),record,recovery:current};
   try{saveChallenge(id,request);}catch{clearTimeout(timeout);reject(Error('Claim recovery unavailable.'));return;}
   challenges.set(id,{playerId:player.profileId,contractId:record.id,operationId:record.operation.id,request,
    complete(encoded){try{const result=mergeClaimSignature(transaction,encoded);saveChallenge(id,{...request,signedTransaction:encoded});answered.add(id);clearTimeout(timeout);challenges.delete(id);resolve(result);}catch{clearTimeout(timeout);challenges.delete(id);reject(Error('Claim transaction changed.'));}},
    cancel(){clearTimeout(timeout);challenges.delete(id);reject(Error('Claim signing interrupted.'));}});
  });}});
 function session(player) {
  const previous=sessions.get(player.profileId);if(previous)return previous;
  const events=eventsFor(player.profileId);
  const context={getState:()=>({profileId:player.profileId,phase:'active'}),refreshBalance:async()=>{},showToast(){}};
  const service=createLtoService({context,gameWallet:wallet},{storage,gameStorage,playerStorage:{load:async()=>({account:{profileId:player.profileId,phrase:''}})},poll:false,
   prepare:(game,p)=>prepareLtoRecovery(game,p,Buffer.from(player.publicKey.slice(2),'hex')),
   submit:(record,recovery,account,commit,current)=>submitLtoSpend(record,recovery,account,commit,current,record.operation.kind==='claim'?challengeIdentity(player,record,recovery):undefined),
   reconcile:reconcileLtoSpend,resume:resumeLtoFinalization,...adapter});
  const result={service,events};sessions.set(player.profileId,result);return result;
 }
 // A game-owned recovery worker continues after every browser closes.
 const recoveryContext={getState:()=>({profileId:wallet.getState().profileId,phase:'active'}),refreshBalance:async()=>{},showToast(){}};
 const recovery=createLtoService({context:recoveryContext,gameWallet:wallet},{storage,gameStorage,playerStorage:{load:async()=>({account:null})},poll:false,prepare:prepareLtoRecovery,submit:submitLtoSpend,reconcile:reconcileLtoSpend,resume:resumeLtoFinalization,...adapter});
 let sweep=false,adminActive=false,reads=0;
 const timer=setInterval(async()=>{if(sweep)return;sweep=true;try{if(!adminActive&&!challenges.size&&(wallet.getState().status!=='ready'||++reads%3===0))await wallet.refresh();await recovery.reconcile();}finally{sweep=false;}},5000);timer.unref();
 return {
  wallet,storage,
  publicState:()=>({state:wallet.getState(),paymentBalance:wallet.getPlayerPaymentBalance(),paymentReason:wallet.getPlayerPaymentBlockReason(),pendingPayment:wallet.hasPendingPlayerPayment()}),
  async admin(method,args=[]) {
   if(method==='refundContract')return recovery.refund(args[0]);
   const allowed=['importWallet','logout','refresh','getMintAvailability','getPendingAssetMint','mintAsset','payPlayer','checkPlayerPayment','quoteBoarding','board','checkBoarding','checkLiveBoardingState','checkLiveBoardingWait'];
   if(!allowed.includes(method))throw Error('Unsupported administrative action.');
   // The wallet's existing mutation locks and journals also serialize Admin spending with LTO funding.
   adminActive=true;adminPlayer=method==='payPlayer'?args[0]?.profileId:undefined;
   try{return await wallet[method](...args);}finally{adminPlayer=undefined;adminActive=false;}
  },
  async call(player,method,args={}) {
   const {service,events}=session(player);let result;
   switch(method) {
    case 'start': {
     const r=args.request,now=Date.now();
     if(!r||r.amountSats!==1000||r.purpose!=='treasureLTO'||!Number.isSafeInteger(r.startedAt)||!Number.isSafeInteger(r.expiresAt)||r.expiresAt-r.startedAt!==90000||r.startedAt>now+5000||r.expiresAt<=now)throw Error('Invalid treasure offer.');
     result=await service.start({...r,exclusivityKey:'treasure'});break;
    }
    case 'claim':result=await service.claim(args.id);break;
    case 'reject':result=await service.reject(args.id);break;
    case 'end':await service.endSession(args.sessionId);result={status:'pending'};break;
    case 'query':result=await service.checkContracts(args.filter);break;
    case 'sync':result={contracts:await service.checkContracts(args.filter),signatures:await pendingChallenges(player.profileId),wallet:this.publicState()};break;
    case 'signature': {
     const challenge=challenges.get(args.id);
     if(challenge) {
      if(challenge.playerId!==player.profileId)throw Error('Claim signing request unavailable.');
      if(args.cancel)challenge.cancel();else challenge.complete(args.transaction);
     }else {
      const saved=(await pendingChallenges(player.profileId)).find(c=>c.id===args.id);
      if(!saved||saved.stage!=='checkpoint'||args.cancel)throw Error('Claim recovery signing unavailable.');
      await withWalletMutation(()=>navigator.locks.request('bis-signet-contracts-v1',{ifAvailable:true},async lock=>{
       if(!lock)throw Error('Contract recovery is busy.');
       const doc=await storage.load(),record=doc.ledger.contracts.find(r=>r.id===saved.contractId),material=doc.recovery[saved.contractId];
       if(!record||record.operation.id!==saved.record.operation.id||!material.spend||!['submitted','unknown'].includes(record.operation.submission))throw Error('Claim recovery changed.');
       const signed=mergeClaimSignature(Transaction.fromPSBT(Buffer.from(saved.transaction,'base64')),args.transaction);
       const completed=await claimWithPreimageIdentity({sign:async()=>signed},Buffer.from(material.secretHex,'hex')).sign(signed);
       const nextMaterial={...material,finalization:{transactionId:material.spend.transactionId,checkpoints:[Buffer.from(completed.toPSBT()).toString('base64')]}};
       let next=await storage.save({...doc,recovery:{...doc.recovery,[record.id]:nextMaterial}});
       const reconciled=await resumeLtoFinalization(record,nextMaterial);
       next=await storage.save({...next,ledger:{...next.ledger,contracts:next.ledger.contracts.map(r=>r.id===record.id?reconciled.record:r)},recovery:{...next.recovery,[record.id]:reconciled.recovery}});publishContractReservations(next);
      }),wallet.getState().profileId);
     }
     result={status:'pending'};break;
    }
    default:throw Error('Unsupported player operation.');
   }
   return {result,events:events.filter(e=>e.id>(args.epoch===epoch?args.after??0:0)),cursor:eventId,epoch};
  },
  async close(){clearInterval(timer);for(const challenge of challenges.values())challenge.cancel();await navigator.locks.request('bis-signet-contracts-v1',()=>{});wallet.dispose();},
 };
}
