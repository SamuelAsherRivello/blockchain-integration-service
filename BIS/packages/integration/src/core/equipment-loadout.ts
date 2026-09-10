import type { BisContext } from './context';
import { classifyBisEquipmentAsset, type BisEquipmentFamily, type BisEquipmentItem } from './equipment.ts';

export type BisEquipmentSlots = Readonly<{Shoes?:BisEquipmentItem;Dagger?:BisEquipmentItem;Shield?:BisEquipmentItem}>;
export type BisEquipmentState =
  | Readonly<{status:'idle'|'loading'|'unavailable';profileId?:string;ownedItems:readonly BisEquipmentItem[];effective:BisEquipmentSlots}>
  | Readonly<{status:'ready';profileId?:string;ownedItems:readonly BisEquipmentItem[];effective:BisEquipmentSlots}>;
type SelectionRecord={version:1;profileId:string;selections:Partial<Record<BisEquipmentFamily,string>>};
const families:readonly BisEquipmentFamily[]=['Shoes','Dagger','Shield'];
const emptyItems=Object.freeze([]) as readonly BisEquipmentItem[];
const emptySlots=Object.freeze({}) as BisEquipmentSlots;
const storageKey=(profileId:string)=>`bis-signet-equipment-v1:${encodeURIComponent(profileId)}`;

function readSelections(profileId:string):SelectionRecord {
  const raw=localStorage.getItem(storageKey(profileId));
  if(raw===null)return {version:1,profileId,selections:{}};
  try{
    const record:SelectionRecord=JSON.parse(raw);
    if(record.version!==1||record.profileId!==profileId||!record.selections||typeof record.selections!=='object'||Array.isArray(record.selections)||Object.keys(record.selections).some(key=>!families.includes(key as BisEquipmentFamily))||Object.values(record.selections).some(value=>typeof value!=='string'||!value))throw Error();
    return {version:1,profileId,selections:{...record.selections}};
  }catch{throw Error('Equipment selections could not be read.');}
}
function writeSelections(record:SelectionRecord){
  const raw=JSON.stringify(record),key=storageKey(record.profileId);
  localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw Error('Equipment selections could not be saved.');
}
function effective(items:readonly BisEquipmentItem[],selections:SelectionRecord['selections']):BisEquipmentSlots {
  const slots:Partial<Record<BisEquipmentFamily,BisEquipmentItem>>={};
  for(const family of families){const id=selections[family],item=id?items.find(candidate=>candidate.assetId===id&&candidate.family===family):undefined;if(item)slots[family]=item;}
  return Object.freeze(slots);
}

export function createBisEquipment(context:Pick<BisContext,'getState'|'listAssets'|'subscribe'>) {
  let state:BisEquipmentState=Object.freeze({status:'idle',ownedItems:emptyItems,effective:emptySlots});
  let revision=0,disposed=false;const listeners=new Set<()=>void>();
  const publish=(next:BisEquipmentState)=>{if(!disposed){state=Object.freeze(next);listeners.forEach(listener=>listener());}};
  async function refresh():Promise<BisEquipmentState>{
    const request=++revision,profileId=context.getState().profileId;
    publish({status:'loading',...(profileId?{profileId}:{}),ownedItems:emptyItems,effective:emptySlots});
    if(!profileId){const next={status:'ready' as const,ownedItems:emptyItems,effective:emptySlots};publish(next);return next;}
    try{
      const result=await context.listAssets();
      if(disposed||request!==revision||context.getState().profileId!==profileId)throw Error('changed');
      if(result.status==='error'||result.profileId!==profileId)throw Error('unavailable');
      const ownedItems=Object.freeze(result.assets.map(classifyBisEquipmentAsset).filter(item=>item!==null).sort((a,b)=>a.family.localeCompare(b.family)||a.tier-b.tier||a.assetId.localeCompare(b.assetId)));
      const record=readSelections(profileId),slots=effective(ownedItems,record.selections);
      const cleaned=Object.fromEntries(families.flatMap(family=>slots[family]?[[family,slots[family].assetId]]:[]));
      if(JSON.stringify(cleaned)!==JSON.stringify(record.selections))writeSelections({version:1,profileId,selections:cleaned});
      const next:BisEquipmentState={status:'ready',profileId,ownedItems,effective:slots};publish(next);return next;
    }catch{
      const next:BisEquipmentState={status:'unavailable',profileId,ownedItems:emptyItems,effective:emptySlots};publish(next);return next;
    }
  }
  async function mutate(family:BisEquipmentFamily,assetId?:string){
    const profileId=context.getState().profileId;if(!profileId)throw Error('An active account is required.');
    const current=await refresh();if(current.status!=='ready'||current.profileId!==profileId)throw Error('Fresh equipment ownership is unavailable.');
    if(assetId&&!current.ownedItems.some(item=>item.assetId===assetId&&item.family===family))throw Error('The active wallet does not own that item.');
    const record=readSelections(profileId),selections={...record.selections};
    if(assetId)selections[family]=assetId;else delete selections[family];
    writeSelections({version:1,profileId,selections});
    const next:BisEquipmentState={...current,effective:effective(current.ownedItems,selections)};publish(next);return next;
  }
  const unsubscribe=context.subscribe(()=>{if(context.getState().profileId!==state.profileId)void refresh();});
  return {
    getState:()=>state,
    subscribe(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);},
    refresh,
    select(assetId:string){const item=state.status==='ready'?state.ownedItems.find(candidate=>candidate.assetId===assetId):undefined;if(!item)return Promise.reject(Error('Select a freshly owned item.'));return mutate(item.family,assetId);},
    clear(family:BisEquipmentFamily){if(!families.includes(family))return Promise.reject(Error('Unknown equipment family.'));return mutate(family);},
    dispose(){disposed=true;revision++;unsubscribe();listeners.clear();},
  };
}
