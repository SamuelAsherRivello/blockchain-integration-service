import type { BisEquipmentItem, BisMarketplaceCheckoutRecord } from '@bis/integration';

type ToastOptions=Readonly<{messageType:'info'|'success';imageUrl?:string}>;
type StorageLike=Pick<Storage,'getItem'|'setItem'>;
export type MarketplaceDeliveryToast=Readonly<{message:string;options:ToastOptions}>;
export type MarketplaceDeliveryToastInput=Readonly<{
  record:BisMarketplaceCheckoutRecord; item:BisEquipmentItem; playerProfileId:string; network:string;
  show(message:string,options:ToastOptions):void; storage?:StorageLike;
}>;

const prefix='bis-marketplace-item-transfer-toast-v1:';
const transactionId=(value:string|undefined)=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const storage=()=>typeof localStorage==='undefined'?undefined:localStorage;

function milestone(record:BisMarketplaceCheckoutRecord):'pending'|'confirmed'|undefined {
  if(!transactionId(record.deliveryTransactionId))return;
  if(record.status==='pending'&&record.phase==='delivery-submitted')return 'pending';
  if(record.status==='completed'&&record.phase==='completed')return 'confirmed';
}

function key(record:BisMarketplaceCheckoutRecord,playerProfileId:string,network:string,event:'pending'|'confirmed') {
  return `${prefix}${encodeURIComponent(JSON.stringify([record.request.id,playerProfileId,network,record.request.direction,event]))}`;
}

/** Emits only evidence-backed Player Wallet delivery milestones. */
export function publishMarketplaceDeliveryToast(input:MarketplaceDeliveryToastInput):boolean {
  const event=milestone(input.record), store=input.storage??storage();
  if(!event||!store||input.record.request.player.profileId!==input.playerProfileId||!input.network)return false;
  const marker=key(input.record,input.playerProfileId,input.network,event);
  try { if(store.getItem(marker)!==null)return false; }
  catch { return false; }
  const received=input.record.request.direction==='buy';
  const subject=received?`Game Wallet sent you ${input.item.name} item.`:`You sent ${input.item.name} item.`;
  const notification:MarketplaceDeliveryToast={message:`${subject} (${event==='pending'?'Pending':'Confirmed'})`,options:{messageType:event==='pending'?'info':'success',...(input.item.iconUrl?{imageUrl:input.item.iconUrl}:{})}};
  input.show(notification.message,notification.options);
  try {store.setItem(marker,'1');return store.getItem(marker)==='1';}
  catch { return false; }
}
