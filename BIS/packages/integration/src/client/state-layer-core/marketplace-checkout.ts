export type BisMarketplaceCheckoutDirection='buy'|'sell';
export type BisMarketplaceCheckoutRequest=Readonly<{id:string;direction:BisMarketplaceCheckoutDirection;player:Readonly<{profileId:string;address:string}>;game:Readonly<{profileId:string;address:string}>;assetId:string;quantity:string;priceSats:number}>;
export type BisMarketplaceCheckoutRecord=Readonly<{version:1;request:BisMarketplaceCheckoutRequest;status:'pending'|'completed';phase:'payment'|'payment-submitted'|'delivery'|'delivery-submitted'|'completed';paymentTransactionId?:string;deliveryTransactionId?:string;message?:string}>;
type PaymentResult=Readonly<{status:'succeeded'|'pending';transactionId?:string}>;
type DeliveryResult=Readonly<{status:'delivered'|'pending';transactionId?:string}>;
export type BisMarketplaceCheckoutDependencies=Readonly<{pay(input:Readonly<{recipient:string;amountSats:number}>):Promise<PaymentResult>;deliver(input:Readonly<{recipient:string;assetId:string;quantity:string}>):Promise<DeliveryResult>}>;

const prefix='bis-local-marketplace-checkout-v1:';
const key=(id:string)=>prefix+id;
function validAddress(value:unknown):value is string{return typeof value==='string'&&/^tark1[0-9a-z]{8,256}$/i.test(value);}
function validRequest(value:unknown):value is BisMarketplaceCheckoutRequest {
  if(!value||typeof value!=='object')return false;
  const request=value as BisMarketplaceCheckoutRequest;
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(request.id)
    &&(request.direction==='buy'||request.direction==='sell')&&!!request.player?.profileId&&!!request.game?.profileId&&request.player.profileId!==request.game.profileId
    &&validAddress(request.player.address)&&validAddress(request.game.address)&&request.player.address!==request.game.address
    &&/^[a-f0-9]{68}$/i.test(request.assetId)&&/^[1-9][0-9]{0,19}$/.test(request.quantity)&&BigInt(request.quantity)<=18446744073709551615n
    &&Number.isSafeInteger(request.priceSats)&&request.priceSats>0;
}
function validRecord(value:unknown,id:string):value is BisMarketplaceCheckoutRecord {
  if(!value||typeof value!=='object')return false;
  const record=value as BisMarketplaceCheckoutRecord;
  return record.version===1&&validRequest(record.request)&&record.request.id===id
    &&(record.status==='pending'||record.status==='completed')&&['payment','payment-submitted','delivery','delivery-submitted','completed'].includes(record.phase)
    &&(record.status==='completed')===(record.phase==='completed')
    &&(record.paymentTransactionId===undefined||/^[a-f0-9]{64}$/i.test(record.paymentTransactionId))
    &&(record.deliveryTransactionId===undefined||/^[a-f0-9]{64}$/i.test(record.deliveryTransactionId))
    &&(record.message===undefined||typeof record.message==='string');
}
function write(record:BisMarketplaceCheckoutRecord):BisMarketplaceCheckoutRecord {
  if(!validRecord(record,record.request.id))throw Error('Marketplace checkout record is invalid.');
  const existing=readLocalMarketplaceCheckout(record.request.id);
  if(existing&&JSON.stringify(existing.request)!==JSON.stringify(record.request))throw Error('Marketplace checkout request changed.');
  if(existing?.status==='completed'&&record.status!=='completed')throw Error('Marketplace checkout is already completed.');
  const raw=JSON.stringify(record);
  try {localStorage.setItem(key(record.request.id),raw);if(localStorage.getItem(key(record.request.id))!==raw)throw Error();}
  catch {throw Error('Marketplace checkout status could not be saved.');}
  return record;
}
export function readLocalMarketplaceCheckout(id:string|undefined):BisMarketplaceCheckoutRecord|undefined {
  if(!id)return;
  try {const raw=localStorage.getItem(key(id));if(raw===null)return;const record=JSON.parse(raw);if(!validRecord(record,id))throw Error();return record;}
  catch {throw Error('Marketplace checkout recovery data is invalid.');}
}
/** Reads every durable local checkout so an item reservation survives a page reload. */
export function readLocalMarketplaceCheckouts():BisMarketplaceCheckoutRecord[] {
  try {
    const records:BisMarketplaceCheckoutRecord[]=[];
    for(let index=0;index<localStorage.length;index++) {
      const storageKey=localStorage.key(index);
      if(!storageKey?.startsWith(prefix))continue;
      const id=storageKey.slice(prefix.length),raw=localStorage.getItem(storageKey);
      if(!raw||records.some(record=>record.request.id===id))throw Error();
      const record=JSON.parse(raw);
      if(!validRecord(record,id))throw Error();
      records.push(record);
    }
    return records.sort((left,right)=>left.request.id.localeCompare(right.request.id));
  } catch {throw Error('Marketplace checkout recovery data is invalid.');}
}
function sellerProfile(request:BisMarketplaceCheckoutRequest){return request.direction==='buy'?request.game.profileId:request.player.profileId;}
export function beginLocalMarketplaceCheckout(request:BisMarketplaceCheckoutRequest):BisMarketplaceCheckoutRecord {
  if(!validRequest(request))throw Error('Local checkout needs distinct active wallets, one exact item, and a whole-sats price.');
  const existing=readLocalMarketplaceCheckout(request.id);
  if(existing) {if(JSON.stringify(existing.request)!==JSON.stringify(request))throw Error('Marketplace checkout request changed.');return existing;}
  if(readLocalMarketplaceCheckouts().some(record=>record.status==='pending'&&record.request.assetId===request.assetId&&sellerProfile(record.request)===sellerProfile(request)))throw Error('This exact item is already reserved by a pending marketplace checkout.');
  return write({version:1,request:Object.freeze({...request,player:Object.freeze({...request.player}),game:Object.freeze({...request.game})}),status:'pending',phase:request.direction==='buy'?'payment':'delivery'});
}
function pending(record:BisMarketplaceCheckoutRecord,phase:BisMarketplaceCheckoutRecord['phase'],message:string):BisMarketplaceCheckoutRecord {return write({...record,phase,message});}
function completed(record:BisMarketplaceCheckoutRecord):BisMarketplaceCheckoutRecord {return write({...record,status:'completed',phase:'completed',message:undefined});}

/** Advances exactly one safe local leg. Submission phases deliberately never resubmit after a lost acknowledgement. */
export async function advanceLocalMarketplaceCheckout(record:BisMarketplaceCheckoutRecord,deps:BisMarketplaceCheckoutDependencies):Promise<BisMarketplaceCheckoutRecord> {
  let current=readLocalMarketplaceCheckout(record.request.id);
  if(!current||JSON.stringify(current.request)!==JSON.stringify(record.request))throw Error('Marketplace checkout changed.');
  if(current.status==='completed'||current.phase==='payment-submitted'||current.phase==='delivery-submitted')return current;
  if(current.phase==='payment') {
    current=pending(current,'payment-submitted','Payment submitted; awaiting confirmation.');
    const result=await deps.pay({recipient:current.request.direction==='buy'?current.request.game.address:current.request.player.address,amountSats:current.request.priceSats});
    if(result.status!=='succeeded'||!result.transactionId||!/^[a-f0-9]{64}$/i.test(result.transactionId))return current;
    current=current.request.direction==='buy'
      ?write({...current,phase:'delivery',...(result.transactionId?{paymentTransactionId:result.transactionId}:{}),message:'Payment confirmed; preparing item delivery.'})
      :completed({...current,...(result.transactionId?{paymentTransactionId:result.transactionId}:{})});
    if(current.status==='completed')return current;
  }
  if(current.phase==='delivery') {
    current=pending(current,'delivery-submitted','Completing checkout.');
    const result=await deps.deliver({recipient:current.request.direction==='buy'?current.request.player.address:current.request.game.address,assetId:current.request.assetId,quantity:current.request.quantity});
    if(result.status!=='delivered'||!result.transactionId||!/^[a-f0-9]{64}$/i.test(result.transactionId))return current;
    current=current.request.direction==='buy'
      ?completed({...current,...(result.transactionId?{deliveryTransactionId:result.transactionId}:{})})
      :write({...current,phase:'payment',...(result.transactionId?{deliveryTransactionId:result.transactionId}:{}),message:'Item delivery confirmed; preparing payment.'});
    if(current.status==='completed')return current;
  }
  // Sell-back starts with delivery, so a confirmed delivery must continue to
  // its payment leg in this same deliberate advancement call.
  if(current.phase==='payment') {
    current=pending(current,'payment-submitted','Payment submitted; awaiting confirmation.');
    const result=await deps.pay({recipient:current.request.player.address,amountSats:current.request.priceSats});
    if(result.status!=='succeeded'||!result.transactionId||!/^[a-f0-9]{64}$/i.test(result.transactionId))return current;
    return completed({...current,paymentTransactionId:result.transactionId});
  }
  return current;
}

/** Applies fresh evidence for a leg that was already submitted. It never submits a replacement. */
export function confirmLocalMarketplaceCheckoutLeg(record:BisMarketplaceCheckoutRecord,leg:'payment'|'delivery',transactionId:string):BisMarketplaceCheckoutRecord {
  if(!/^[a-f0-9]{64}$/i.test(transactionId))throw Error('Marketplace checkout transaction evidence is invalid.');
  const current=readLocalMarketplaceCheckout(record.request.id);
  if(!current||JSON.stringify(current.request)!==JSON.stringify(record.request))throw Error('Marketplace checkout changed.');
  if(current.status==='completed')return current;
  if(leg==='payment') {
    if(current.phase!=='payment-submitted')throw Error('Marketplace payment is not awaiting confirmation.');
    return current.request.direction==='buy'
      ?write({...current,phase:'delivery',paymentTransactionId:transactionId,message:'Payment confirmed; preparing item delivery.'})
      :completed({...current,paymentTransactionId:transactionId});
  }
  if(current.phase!=='delivery-submitted')throw Error('Marketplace item delivery is not awaiting confirmation.');
  return current.request.direction==='buy'
    ?completed({...current,deliveryTransactionId:transactionId})
    :write({...current,phase:'payment',deliveryTransactionId:transactionId,message:'Item delivery confirmed; preparing payment.'});
}
