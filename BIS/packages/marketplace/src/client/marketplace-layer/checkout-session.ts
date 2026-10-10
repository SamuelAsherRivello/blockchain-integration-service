import type {BisMarketplaceCheckoutRecord,BisContext,createBisGameWallet,beginLocalMarketplaceCheckout,confirmLocalMarketplaceCheckoutLeg,readLocalMarketplaceCheckout} from '@bis/integration';
type Player=Pick<BisContext,'getState'|'subscribe'|'getPaymentRecipient'|'getSendSpendable'>;
type Game=Pick<ReturnType<typeof createBisGameWallet>,'getState'|'subscribe'|'getPlayerPaymentBalance'>;
export type CheckoutIntent=Readonly<{direction:'buy'|'sell';assetId:string;quantity:string;priceSats:number}>;
export type CheckoutScope=Readonly<{key:string;generation:number;playerId:string;gameId:string;gameAddress:string;network:string}>;
type Evidence=Readonly<{status:string;transactionId?:string;recipient?:string;amountSats?:number;operationId?:string;profileId?:string}>;

/** Owns preparation only. Submitted operations stay in the integration journal. */
type Journal={begin:typeof beginLocalMarketplaceCheckout;confirm:typeof confirmLocalMarketplaceCheckoutLeg;read:typeof readLocalMarketplaceCheckout};
export function createCheckoutSession(player:Player,game:Game,journal:Journal){
 const key=()=>{const p=player.getState(),g=game.getState();return JSON.stringify([p.profileId,p.phase,p.network,g.profileId,g.selectionVersion,g.addresses?.arkadeAddress]);};
 let generation=0,last=key(),disposed=false;
 const changed=()=>{const next=key();if(next!==last){last=next;generation++;}};
 const offPlayer=player.subscribe(changed),offGame=game.subscribe(changed);
 const preparing=new Set<string>();
 function capture():CheckoutScope{
  changed();const p=player.getState(),g=game.getState();
  if(disposed||p.phase!=='active'||!p.profileId||!p.network||!g.profileId||g.profileId===p.profileId||!g.addresses?.arkadeAddress||g.network!==p.network)throw Error('Connect distinct wallets on the same network before trading.');
  return Object.freeze({key:last,generation,playerId:p.profileId,gameId:g.profileId,gameAddress:g.addresses.arkadeAddress,network:p.network});
 }
 const current=(scope:CheckoutScope)=>{changed();return !disposed&&scope.generation===generation&&scope.key===last;};
 const assertCurrent=(scope:CheckoutScope)=>{if(!current(scope))throw Error('The wallet session changed. Start this checkout again.');};
 async function verify(record:BisMarketplaceCheckoutRecord,scope:CheckoutScope){
  assertCurrent(scope);
  if(record.request.player.profileId!==scope.playerId||record.request.game.profileId!==scope.gameId||record.request.game.address!==scope.gameAddress)throw Error('This checkout belongs to another wallet session.');
  // Current address discovery validates the active operator/network, including
  // legacy journals that predate an explicit network field.
  const recipient=await player.getPaymentRecipient?.();assertCurrent(scope);
  if(!recipient||recipient.profileId!==scope.playerId||recipient.address!==record.request.player.address)throw Error('Checkout recipient or network could not be verified.');
 }
 async function prepare(input:CheckoutIntent,scope:CheckoutScope){
  assertCurrent(scope);const intent=Object.freeze({...input});
  const itemKey=`${intent.direction}:${intent.assetId}`;
  if(preparing.has(itemKey))throw Error('This item checkout is already preparing.');
  preparing.add(itemKey);
  try{
   const funds=intent.direction==='buy'?await player.getSendSpendable(true):game.getPlayerPaymentBalance();assertCurrent(scope);
   if(funds===undefined)throw Error('Checkout spendable balance could not be verified.');
   if(funds<intent.priceSats)throw Error(`Insufficient ${intent.direction==='buy'?'Player Wallet':'Game Wallet'} balance. ${funds} sats available; ${intent.priceSats} sats required.`);
   const recipient=await player.getPaymentRecipient?.();assertCurrent(scope);
   if(!recipient||recipient.profileId!==scope.playerId)throw Error('The player recipient could not be verified.');
   return journal.begin({id:crypto.randomUUID(),...intent,player:recipient,game:{profileId:scope.gameId,address:scope.gameAddress}});
  }finally{preparing.delete(itemKey);}
 }
 async function recover(record:BisMarketplaceCheckoutRecord,scope:CheckoutScope,check:()=>Promise<Evidence>,alive:()=>boolean=()=>true){
  const applicable=()=>alive()&&current(scope);
  if(!applicable())return;
  await verify(record,scope);if(!applicable())return;
  const result=await check();if(!applicable())return;
  const saved=journal.read(record.request.id);
  if(!saved||saved.phase!==record.phase||JSON.stringify(saved.request)!==JSON.stringify(record.request))return;
  if(record.phase==='payment-submitted'){
   const recipient=record.request.direction==='buy'?record.request.game.address:record.request.player.address;
   if(result.status!=='succeeded'||!result.transactionId||result.transactionId!==saved.paymentTransactionId||result.recipient!==recipient||result.amountSats!==record.request.priceSats)return;
   return journal.confirm(record,'payment',result.transactionId);
  }
  if(record.phase==='delivery-submitted'){
   const sender=record.request.direction==='buy'?record.request.game.profileId:record.request.player.profileId;
   if(!['delivered','already-delivered'].includes(result.status)||!result.transactionId||result.operationId!==record.request.id||result.profileId!==sender)return;
   return journal.confirm(record,'delivery',result.transactionId);
  }
 }
 return {capture,current,assertCurrent,prepare,verify,recover,dispose(){disposed=true;generation++;offPlayer();offGame();preparing.clear();}};
}
