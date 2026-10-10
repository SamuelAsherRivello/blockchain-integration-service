import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { advanceLocalMarketplaceCheckout, arkExplorerAssetUrl, beginLocalMarketplaceCheckout, classifyBisEquipmentAsset, confirmLocalMarketplaceCheckoutLeg, FormValue, createBisContext, createBisGameWallet, createBisUi, inspectBisEquipmentAsset, networkLabel, PendingOperations, readLocalMarketplaceCheckout, readLocalMarketplaceCheckouts, usePendingNotice, type BisEquipmentItem, type BisMarketplaceCheckoutRecord } from '@bis/integration';
import '@bis/integration/style.css';
import { fallbackCatalog, type MarketplaceCatalog } from './catalog';
import { createMarketplaceInventoryCoordinator, type MarketplaceInventorySource } from '../inventory-layer/inventory-cache';
import {createCheckoutSession, type CheckoutScope} from './checkout-session';
import { version } from '../../../package.json';
import arkadeLogo from '../../../../integration-admin/src/client/ui-layer-react/assets/arkade-logo.png';
import '../ui-layer-react/marketplace-utilities.css';
import '../ui-layer-react/marketplace-redesign.css';

const blockchainBenefitsImageUrl = 'https://github.com/SamuelAsherRivello/blockchain-integration-service/blob/main/BIS/documentation/bitcoin-ark-arkade-bis-game.png?raw=1';
let playerArkadeAddressForDisplay: string | undefined;
function shortAddress(address: string | undefined) {
  const displayAddress=address&&/^[a-f0-9]{64}$/i.test(address)?playerArkadeAddressForDisplay:address;
  return displayAddress ? `${displayAddress.slice(0, 7)}…${displayAddress.slice(-6)}` : 'Not connected';
}
function isInsufficientFundsError(error: unknown) {return error instanceof Error&&/insufficient.*(?:funds|balance)/i.test(error.message);}
function gameplayMetadata(item:BisEquipmentItem){
  const changes=new Map(item.attributeDeltas.map(change=>[change.bisAttribute,change.bisAttributeDelta]));
  const value=(attribute:string)=>{const delta=changes.get(attribute)??0;return `${delta>0?'+':''}${delta}`;};
  return [
    {label:'Speed',value:value('movementSpeed')},
    {label:'Offense',value:value('playerDamage')},
    {label:'Defense',value:value('damageTaken')},
  ];
}
const MARKETPLACE_LOADING_SETTLE_MS=1000;
// Inventory is a background read on the first page load. A slow or unavailable
// indexer must not leave the whole Marketplace behind the BIS loading modal.
const poeticQuotes:Record<string,string>={
  'Shoes I':'Dawn keeps a promise to the quiet road.',
  'Shoes II':'The horizon hums beneath a sleeping sky.',
  'Shoes III':'Even thunder arrives a moment late.',
  'Dagger I':'A small moon keeps its counsel.',
  'Dagger II':'Silence gathers where silver remembers.',
  'Dagger III':'Night folds around its brightest secret.',
  'Shield I':'Rain returns to every open window.',
  'Shield II':'The old oak listens without fear.',
  'Shield III':'One steady star outlasts the dark.',
};
function poeticQuoteFor(item:BisEquipmentItem){return poeticQuotes[item.name]??'The distant bells know another song.';}
function Artwork({item,large=false,list=false}:{item:BisEquipmentItem;large?:boolean;list?:boolean}){
  const [failed,setFailed]=useState(false),size=large?150:list?140:72;
  return <span className={`art ${large?'large ':''}${list?'list-art ':''}art-${item.family.toLowerCase()}`} style={{width:size,height:size,overflow:'hidden'}}>
    {!failed?<img src={item.iconUrl} alt={`${item.name} artwork`} referrerPolicy="no-referrer" onError={()=>setFailed(true)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<span aria-label="Image unavailable">Image unavailable</span>}
  </span>;
}

export function App(){return <MarketplaceContent/>;}

function MarketplacePendingNotice({busy,label,error,dismiss,retry}: {busy:boolean;label:string;error?:string;dismiss():void;retry?:()=>void}) {
  usePendingNotice(busy,label,error,dismiss,undefined,retry?{label:'Retry',run:retry}:undefined);
  return null;
}

function MarketplaceContent(){
  const gameWalletRef=useRef<ReturnType<typeof createBisGameWallet> | null>(null);
  const player=useMemo(()=>createBisContext({hasGameWallet:()=>!!gameWalletRef.current?.getState().profileId,resetGameWallet:async()=>await gameWalletRef.current?.reset() ?? false}),[]);
  const gameWallet=useMemo(()=>createBisGameWallet({playerProfileId:()=>player.getState().profileId,playerNetwork:()=>player.getState().network,playerSubscribe:player.subscribe,playerSessionKey:()=>JSON.stringify([player.getState().profileId,player.getState().phase,player.getState().network])}),[player]);
  gameWalletRef.current=gameWallet;
  const checkoutSession=useMemo(()=>createCheckoutSession(player,gameWallet,{begin:beginLocalMarketplaceCheckout,confirm:confirmLocalMarketplaceCheckoutLeg,read:readLocalMarketplaceCheckout}),[player,gameWallet]);
  useEffect(()=>()=>checkoutSession.dispose(),[checkoutSession]);
  const walletUi=useMemo(()=>createBisUi(player,{gameWallet}),[player,gameWallet]);
  const playerState=useSyncExternalStore(player.subscribe,player.getState,player.getState);
  const network=playerState.network;
  const [playerDisplayAddress,setPlayerDisplayAddress]=useState<string>();
  const gameState=useSyncExternalStore(gameWallet.subscribe,gameWallet.getState,gameWallet.getState);
  const inventory=useMemo(()=>createMarketplaceInventoryCoordinator(),[]);
  const inventoryState=useSyncExternalStore(inventory.subscribe,inventory.getState,inventory.getState);
  const walletHost=useRef<HTMLDivElement>(null);
  const [catalog,setCatalog]=useState<MarketplaceCatalog>(fallbackCatalog);
  const [isCatalogLoading,setIsCatalogLoading]=useState(true);
  const [selected,setSelected]=useState<BisEquipmentItem>();
  const [itemSnapshots,setItemSnapshots]=useState<Record<string,BisEquipmentItem>>({});
  const [checkout,setCheckout]=useState<BisMarketplaceCheckoutRecord>();
  const [operationLabel,setOperationLabel]=useState<string>();
  const [operationError,setOperationError]=useState<string>();
  const [isBenefitsOpen,setIsBenefitsOpen]=useState(false);
  const [owner,setOwner]=useState<'all'|'game'|'player'>('game'),[game,setGame]=useState<string>('stealth-and-steel'),[type,setType]=useState<'all'|'speed'|'offense'|'defense'>('all');
  const selectedGame=game==='all'?undefined:catalog.games.find(entry=>entry.gameId===game);
  const defaultGame=catalog.games.find(entry=>entry.gameId==='stealth-and-steel');
  useEffect(()=>{
    try {
      const pending=readLocalMarketplaceCheckouts().find(record=>record.status==='pending');
      if(pending)setCheckout(pending);
    } catch {}
  },[]);
  useEffect(()=>{
    if(playerState.profileId&&gameState.profileId)return;
    // A wallet logout removes durable recovery/cache data in the integration
    // layer; clear the remaining React snapshots so a late render cannot
    // present the old Game Wallet session.
    setCheckout(undefined);
    setItemSnapshots({});
  },[gameState.profileId,playerState.profileId]);
  useEffect(()=>{if(walletHost.current){walletUi.mount(walletHost.current);walletUi.showAccountButton();}return()=>{walletUi.unmount();gameWallet.dispose();player.dispose();};},[walletUi,gameWallet,player]);
  useEffect(()=>{void fetch(`${import.meta.env.BASE_URL}catalog.json`,{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error();const next=await response.json() as MarketplaceCatalog;const games=Array.isArray(next.games)?next.games:[];if(next.version!==2||!games.some(entry=>entry?.gameId==='stealth-and-steel'&&entry?.displayName==='Stealth & Steel'&&typeof entry.gameWalletAddress==='string')||!games.some(entry=>entry?.gameId==="Rogue's Dungeon"&&entry?.displayName==="Rogue's Dungeon"&&entry?.gameWalletAddress===undefined))throw Error();setCatalog({...next,games:Object.freeze(games)});}).catch(()=>{}).finally(()=>setIsCatalogLoading(false));},[]);
  useEffect(()=>{
    let cancelled=false;
    setPlayerDisplayAddress(undefined);
    if(playerState.profileId) void player.getPaymentRecipient?.().then(result=>{if(!cancelled)setPlayerDisplayAddress(result.address);}).catch(()=>{});
    return()=>{cancelled=true;};
  },[network,player,playerState.profileId]);
  useEffect(()=>{if(playerState.profileId&&(game==='all'||selectedGame?.gameWalletAddress))void gameWallet.refresh();},[gameWallet,network,playerState.profileId,game,selectedGame?.gameId,selectedGame?.gameWalletAddress]);
  const sessionGameAddress=gameState.addresses?.arkadeAddress;
  const playerArkadeAddress=playerState.addresses.status==='ready'?playerState.addresses.arkadeAddress:undefined;
  playerArkadeAddressForDisplay=playerArkadeAddress??playerDisplayAddress;
  const activeGameWallet=Boolean(playerState.profileId&&gameState.profileId&&gameState.addresses?.arkadeAddress);
  const inventoryAddress=!activeGameWallet||isCatalogLoading|| (game!=='all'&&!selectedGame?.gameWalletAddress)
    ?undefined
    :sessionGameAddress;
  const salesEnabled=Boolean(playerState.profileId&&gameState.profileId&&playerState.profileId!==gameState.profileId&&(game==='all'||game==='stealth-and-steel'));
  const gameListingEnabled=Boolean(playerState.profileId&&gameState.profileId&&inventoryAddress);
  const inventorySources=useMemo<readonly MarketplaceInventorySource[]>(()=>{
    if(isCatalogLoading||!network)return [];
    const sources: MarketplaceInventorySource[]=[];
    if(playerState.profileId)sources.push({role:'player',walletId:playerState.profileId,network,read:async()=>{
      // Use the same raw account asset snapshot as BIS Assets. Equipment-loadout
      // selection persistence is unrelated to inventory and must not be able to
      // hide valid marketplace items.
      // A presentation read can be invalidated while the Marketplace is being
      // opened (for example when the wallet finishes restoring). If that read
      // reports an error, retry through the authoritative public listing before
      // declaring the wallet unavailable.
      const prepared=player.prepareAssetInventory?await player.prepareAssetInventory():undefined;
      const result=prepared?.status==='success'?prepared:await player.listAssets();
      if(result.status!=='success'||result.profileId!==playerState.profileId)throw Error('Player Wallet inventory unavailable');
      const classified=result.assets.map(asset=>({asset,item:classifyBisEquipmentAsset(asset),status:inspectBisEquipmentAsset(asset)}));
      return {items:classified.map(row=>row.item).filter((item):item is BisEquipmentItem=>item!==null),invalidMetadataCount:classified.filter(row=>row.status==='invalid-metadata').length,migrationRequiredCount:classified.filter(row=>row.status==='migration-required').length};
    }});
    if(activeGameWallet&&(game==='all'||selectedGame?.gameWalletAddress)&&inventoryAddress)sources.push({role:'game',walletId:gameState.profileId!,network,read:async()=>{const result=await gameWallet.prepareAssetInventory?.();if(!result||result.status!=='success'||result.profileId!==gameState.profileId)throw Error('Game Wallet inventory unavailable');const classified=result.assets.map(asset=>({asset,item:classifyBisEquipmentAsset(asset),status:inspectBisEquipmentAsset(asset)}));return {items:classified.map(row=>row.item).filter((item):item is BisEquipmentItem=>item!==null),invalidMetadataCount:classified.filter(row=>row.status==='invalid-metadata').length,migrationRequiredCount:classified.filter(row=>row.status==='migration-required').length};}});
    return sources;
  },[activeGameWallet,game,gameState.profileId,inventoryAddress,isCatalogLoading,network,player,playerState.profileId,selectedGame?.gameWalletAddress]);
  const inventorySourcesRef=useRef<readonly MarketplaceInventorySource[]>([]);
  inventorySourcesRef.current=inventorySources;
  const invalidateInventory=()=>{
    const sources=inventorySourcesRef.current;
    if(sources.length)void inventory.refresh(sources);
  };
  useEffect(()=>{
    const unsubscribePlayerEvents=player.onEvent(event=>{
      if(event.type==='accountConnected'||event.type==='accountDisconnected'||event.type==='restartRequested')invalidateInventory();
      if(event.type==='accountDisconnected')void gameWallet.logout().catch(()=>{});
    });
    // State changes cover initiated operations and observed incoming wallet
    // activity, including balance/asset changes that do not have a public BIS
    // event type of their own.
    let playerFingerprint=`${playerState.profileId??''}:${playerState.network??''}:${playerState.balance.status}:${playerState.balance.status==='ready'?`${playerState.balance.availableSats}:${playerState.balance.totalSats}`:''}:${playerState.addresses.status}:${playerState.addresses.status==='ready'?playerState.addresses.arkadeAddress:''}:${playerState.activity.status}:${playerState.assets.status}`;
    let gameFingerprint=`${gameState.profileId??''}:${gameState.network??''}:${gameState.status}:${gameState.balance?.availableSats??''}:${gameState.balance?.totalSats??''}:${gameState.addresses?.arkadeAddress??''}`;
    const unsubscribePlayer=player.subscribe(()=>{
      const current=player.getState();
      const next=`${current.profileId??''}:${current.network??''}:${current.balance.status}:${current.balance.status==='ready'?`${current.balance.availableSats}:${current.balance.totalSats}`:''}:${current.addresses.status}:${current.addresses.status==='ready'?current.addresses.arkadeAddress:''}:${current.activity.status}:${current.assets.status}`;
      if(next!==playerFingerprint){playerFingerprint=next;invalidateInventory();}
    });
    const unsubscribeGame=gameWallet.subscribe(()=>{
      const next=`${gameWallet.getState().profileId??''}:${gameWallet.getState().network??''}:${gameWallet.getState().status}:${gameWallet.getState().balance?.totalSats??''}`;
      if(next!==gameFingerprint){gameFingerprint=next;invalidateInventory();}
    });
    return()=>{unsubscribePlayerEvents();unsubscribePlayer();unsubscribeGame();};
  },[gameWallet,inventory,player]);
  const inventorySourceKey=inventorySources.map(source=>`${source.role}:${source.walletId}:${source.network}`).join('|')||'none';
  useEffect(()=>{
    if(isCatalogLoading)return;
    void inventory.refresh(inventorySources);
  },[inventory,inventorySourceKey,inventorySources,isCatalogLoading]);
  useEffect(()=>()=>inventory.dispose(),[inventory]);
  const gameItems=inventoryState.game.items;
  const playerItems=inventoryState.player.items;
  const activeCheckout=checkout?.request.assetId===selected?.assetId?checkout:undefined;
  const pendingCheckout=checkout?.status==='pending'?checkout:undefined;
  const pendingTransferFor=(item:BisEquipmentItem)=>pendingCheckout?.request.assetId===item.assetId?pendingCheckout:undefined;
  const pendingItemIsInGameWallet=(item:BisEquipmentItem)=>pendingTransferFor(item)?.request.direction==='buy';
  const pendingItemIsInPlayerWallet=(item:BisEquipmentItem)=>pendingTransferFor(item)?.request.direction==='sell';
  const previousGameItems=[...(gameItems??[])];
  const previousPlayerItems=[...playerItems];
  useEffect(()=>{
    const currentItems=[...previousGameItems,...previousPlayerItems];
    if(!currentItems.length)return;
    setItemSnapshots(previous=>{
      let changed=false;const next={...previous};
      for(const item of currentItems)if(next[item.assetId]!==item){next[item.assetId]=item;changed=true;}
      return changed?next:previous;
    });
  },[gameItems,playerItems]);
  const pendingItem=pendingCheckout?itemSnapshots[pendingCheckout.request.assetId]??(selected?.assetId===pendingCheckout.request.assetId?selected:undefined):undefined;
  const gameItemsForSession=activeGameWallet?previousGameItems:[];
  const source=game!=='all'&&game!=='stealth-and-steel'?[]:owner==='player'
    ?[...previousPlayerItems,...(pendingItem&&pendingItemIsInPlayerWallet(pendingItem)&&!previousPlayerItems.some(item=>item.assetId===pendingItem.assetId)?[pendingItem]:[])]
    :owner==='game'
      ?[...gameItemsForSession,...(activeGameWallet&&pendingItem&&pendingItemIsInGameWallet(pendingItem)&&!gameItemsForSession.some(item=>item.assetId===pendingItem.assetId)?[pendingItem]:[])]
      :[...gameItemsForSession,...previousPlayerItems,...(activeGameWallet&&pendingItem?[pendingItem]:[])].filter((item,index,all)=>all.findIndex(candidate=>candidate.assetId===item.assetId)===index);
  const visibleItems=source.filter(item=>(game==='all'||game==='stealth-and-steel')&&(type==='all'||gameplayMetadata(item).some(stat=>stat.label.toLowerCase()===type&&stat.value!=='0')));
  const selectedGameIsEmpty=game!== 'all'&&game!== 'stealth-and-steel';
  const selectedInventory=owner==='player'?inventoryState.player:inventoryState.game;
  const emptyMessage='No items found.';
  const sourceFor=(role:'player'|'game')=>inventorySources.find(source=>source.role===role);
  const recordNeedsInitialRead=(role:'player'|'game')=>{
    const source=sourceFor(role),record=inventoryState[role];
    return Boolean(source&&(record.status==='idle'||record.status==='loading'||record.walletId!==source.walletId||record.network!==source.network));
  };
  const playerWalletStillLoading=owner==='player'&&!playerState.profileId&&playerState.phase==='loading';
  const gameWalletStillLoading=owner==='game'&&gameState.status==='loading'&&!inventoryAddress;
  const selectedInventoryLoading=owner==='all'
    ?recordNeedsInitialRead('player')||recordNeedsInitialRead('game')
    :recordNeedsInitialRead(owner)||playerWalletStillLoading||gameWalletStillLoading;
  // Loading belongs to the selected owner only. The other wallet is warmed in
  // parallel, but its slower read cannot make a completed selected wallet look
  // empty or keep the page covered.
  const isMarketplaceLoading=isCatalogLoading||selectedInventoryLoading;
  const inventoryError=owner==='all'?[inventoryState.player.error,inventoryState.game.error].find(Boolean):selectedInventory.error;
  const promptBusy=isMarketplaceLoading||!!operationLabel;
  const [loadingPromptVisible,setLoadingPromptVisible]=useState(true);
  useEffect(()=>{
    if(promptBusy){setLoadingPromptVisible(true);return;}
    const timeout=window.setTimeout(()=>setLoadingPromptVisible(false),MARKETPLACE_LOADING_SETTLE_MS);
    return()=>window.clearTimeout(timeout);
  },[promptBusy]);
  const gameOwnsSelected=Boolean(activeGameWallet&&selected&&gameItems?.some(item=>item.assetId===selected.assetId));
  const playerOwnsSelected=Boolean(selected&&playerItems.some(item=>item.assetId===selected.assetId));
  const checkoutIsPending=activeCheckout?.status==='pending';
  const checkoutHasBeenSubmitted=pendingCheckout?.phase==='payment-submitted'||pendingCheckout?.phase==='delivery-submitted';
  const retrySelectedInventory=()=>{const source=inventorySources.find(candidate=>candidate.role===(owner==='player'?'player':'game'));if(source)void inventory.retry(source);};
  const pendingTransferIsSelected=Boolean(selected&&pendingTransferFor(selected));
  const canBuy=salesEnabled&&gameOwnsSelected&&!checkoutIsPending&&!pendingTransferIsSelected;
  const canSell=salesEnabled&&playerOwnsSelected&&!checkoutIsPending&&!pendingTransferIsSelected;
  const chooseOwner=(next:'all'|'game'|'player')=>{
    setOwner(next);
  };
  const pendingTransferTitle=pendingTransferIsSelected?'Transfer from Game Wallet to Player Wallet is pending ...':undefined;
  const explorerUrl=selected&&/^[a-f0-9]{68}$/i.test(selected.assetId)?arkExplorerAssetUrl(network,selected.assetId):undefined;
  useEffect(()=>{
    if(!selected)return;
    try {
      const pending=readLocalMarketplaceCheckouts().find(record=>record.status==='pending'&&record.request.assetId===selected.assetId);
      if(pending)setCheckout(pending);
    } catch {}
  },[selected?.assetId]);
  async function advanceCheckout(record:BisMarketplaceCheckoutRecord,scope:CheckoutScope,alive:()=>boolean=()=>true) {
    const current=()=>alive()&&checkoutSession.current(scope);
    if(!current())return;
    await checkoutSession.verify(record,scope);if(!current())return;
    const next=await advanceLocalMarketplaceCheckout(record,{
      isCurrent:current,
      pay:async({recipient,amountSats})=>{
        checkoutSession.assertCurrent(scope);if(!alive())throw Error('Checkout view closed.');
        let result;
        if(record.request.direction==='buy'){
          const quote=await player.quoteAccountSend(recipient,amountSats,true);
          checkoutSession.assertCurrent(scope);if(!alive())throw Error('Checkout view closed.');
          result=await player.confirmAccountSend(quote);
        }else result=await gameWallet.payPlayer({profileId:record.request.player.profileId,address:recipient},amountSats,current);
        return {status:result.status==='succeeded'?'succeeded' as const:'pending' as const,...(result.transactionId?{transactionId:result.transactionId}:{})};
      },
      deliver:async({recipient,assetId,quantity})=>{
        checkoutSession.assertCurrent(scope);if(!alive())throw Error('Checkout view closed.');
        const result=record.request.direction==='buy'
          ?await gameWallet.deliverAsset({operationId:record.request.id,assetId,quantity,recipient})
          :await player.deliverAsset({operationId:record.request.id,assetId,quantity,recipient});
        return result.status==='delivered'||result.status==='already-delivered'
          ?{status:'delivered' as const,transactionId:result.transactionId}:{status:'pending' as const};
      },
    });
    if(!current())return;
    setCheckout(next);
    if(next.status==='completed') {await Promise.all([gameWallet.refresh(),inventory.refresh(inventorySources)]);}
  }
  async function beginCheckout(direction:'buy'|'sell') {
    if(!selected||!salesEnabled||!gameState.profileId||!sessionGameAddress) return;
    if(activeCheckout?.status==='pending') return;
    const sellerItems=direction==='buy'?gameItems:playerItems;
    if(!sellerItems?.some(item=>item.assetId===selected.assetId)) return;
    let scope:CheckoutScope;
    try{scope=checkoutSession.capture();}catch(error){setOperationError(error instanceof Error?error.message:'Wallets are unavailable.');return;}
    const intent=Object.freeze({direction,assetId:selected.assetId,quantity:String(selected.quantity),priceSats:selected.priceSats});
    setOperationError(undefined);
    invalidateInventory();
    setOperationLabel(direction==='buy'?'Buying...':'Selling...');
    const loadingTimer=window.setTimeout(()=>{if(checkoutSession.current(scope))setOperationLabel(undefined);},3000);
    try {
      const record=await checkoutSession.prepare(intent,scope);
      if(!checkoutSession.current(scope))return;
      setCheckout(record);
      await advanceCheckout(record,scope);
    } catch(error) {
      if(checkoutSession.current(scope))setOperationError(error instanceof Error?error.message:'Checkout could not be completed.');
    } finally {window.clearTimeout(loadingTimer);if(checkoutSession.current(scope))setOperationLabel(undefined);}
  }
  async function continuePendingCheckout(record:BisMarketplaceCheckoutRecord,scope:CheckoutScope,alive:()=>boolean) {
    try {
      const next=await checkoutSession.recover(record,scope,()=>record.phase==='payment-submitted'
        ?record.request.direction==='buy'?player.checkAccountSend():gameWallet.checkPlayerPayment()
        :record.request.direction==='buy'?gameWallet.checkAssetDelivery(record.request.id):player.checkAssetDelivery(record.request.id),alive);
      if(!next||!alive()||!checkoutSession.current(scope))return;
      setCheckout(next);await advanceCheckout(next,scope,alive);
    } catch { /* Keep the original journal while recovery evidence or scope is unavailable. */ }
  }
  useEffect(()=>{
    if(!pendingCheckout||!checkoutHasBeenSubmitted)return;
    let scope:CheckoutScope;try{scope=checkoutSession.capture();}catch{return;}
    let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined;
    const run=async()=>{
      if(cancelled||!checkoutSession.current(scope))return;
      await continuePendingCheckout(pendingCheckout,scope,()=>!cancelled);
      if(!cancelled&&checkoutSession.current(scope))timer=setTimeout(run,2500);
    };
    void run();
    return()=>{cancelled=true;if(timer)clearTimeout(timer);};
  },[checkoutSession,pendingCheckout?.request.id,pendingCheckout?.phase,checkoutHasBeenSubmitted,playerState.profileId,playerState.phase,network,gameState.profileId,gameState.selectionVersion]);
  useEffect(()=>{setOperationLabel(undefined);setOperationError(undefined);},[playerState.profileId,playerState.phase,network,gameState.profileId,gameState.selectionVersion]);

  return <PendingOperations className="marketplace-pending-runtime" loadingContext={player}>
    <MarketplacePendingNotice busy={loadingPromptVisible} label={operationLabel??'Loading ...'} error={inventoryError??operationError} dismiss={()=>setOperationError(undefined)} retry={inventoryError?retrySelectedInventory:undefined}/>
    <div className="marketplace-page">
    <div className="network-banner">
      <span role="status">Network: {networkLabel(network)}</span>
      <div className="marketplace-utilities" role="navigation" aria-label="Marketplace resources">
      <span className="marketplace-version">v{version}</span>
      <a className="marketplace-resource-link" href="https://github.com/SamuelAsherRivello/blockchain-integration-service" target="_blank" rel="noopener noreferrer" aria-label="View repository on GitHub">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" /></svg>
      </a>
      <a className="marketplace-resource-link marketplace-arkade-link" href="https://docs.arkadeos.com/" target="_blank" rel="noopener noreferrer" aria-label="View Arkade documentation" title="Arkade documentation"><img src={arkadeLogo} width="20" height="20" alt="" /></a>
      </div>
      <div className="marketplace-bis-host bis-account-launcher-anchor" ref={walletHost}/>
    </div>
    <main className="marketplace-shell">
      <header className="marketplace-heading"><h1>Marketplace</h1><p className="lede">Shop <button type="button" className="benefits-trigger" onClick={()=>setIsBenefitsOpen(true)}>before</button> you play.</p></header>
      <section className="catalog-toolbar" aria-label="Catalog filters">
          <div className="filter-row"><span>Owner</span><div role="group" aria-label="Owner"><button aria-pressed={owner==='all'} onClick={()=>chooseOwner('all')}>All</button><button aria-pressed={owner==='game'} onClick={()=>chooseOwner('game')}>Game Wallet</button><button aria-pressed={owner==='player'} onClick={()=>chooseOwner('player')}>Player Wallet</button></div></div>
          <div className="filter-row"><span>Game</span><div role="group" aria-label="Game"><button aria-pressed={game==='all'} onClick={()=>setGame('all')}>All</button>{catalog.games.map(entry=><button key={entry.gameId} aria-pressed={game===entry.gameId} onClick={()=>setGame(entry.gameId)}>{entry.displayName}</button>)}</div></div>
          <div className="filter-row"><span>Type</span><div role="group" aria-label="Type"><button aria-pressed={type==='all'} onClick={()=>setType('all')}>All</button><button aria-pressed={type==='speed'} onClick={()=>setType('speed')}>Speed</button><button aria-pressed={type==='offense'} onClick={()=>setType('offense')}>Offense</button><button aria-pressed={type==='defense'} onClick={()=>setType('defense')}>Defense</button></div></div>
      </section>
      <section className="wallet-strip" aria-label="Marketplace wallets and instructions"><div className="marketplace-info">{selectedGameIsEmpty?<p>{emptyMessage}</p>:<><p>This marketplace requires the player wallet for item display and items sales.</p><p>In production the game wallet will be controlled by the server. However, for this simple POC, you must also login the game wallet which has balance and has any items to display.</p><div className="marketplace-info-group"><h2>Wallets</h2><ul><li><span>Player Wallet:</span> <code title={playerState.profileId}>{shortAddress(playerState.profileId)}</code></li><li><span>Game Wallet:</span> <code title={inventoryAddress}>{shortAddress(inventoryAddress)}</code></li></ul></div><hr/><div className="marketplace-info-group"><h2>Instructions</h2><ol><li>Enable Item Listing: {gameListingEnabled?<strong title="Requirement complete: the Game Wallet is logged in and has items to display.">Enabled ℹ️</strong>:<span title="Requirement: log in to a Player Wallet before using the Game Wallet inventory.">Disabled ℹ️</span>}</li><li>Enable Item Sales: {salesEnabled?<><strong title="Requirement complete: different Player and Game Wallets are logged in.">Enabled ℹ️</strong></>:<span title="Requirement: log in to different Player and Game Wallets from Account.">Disabled ℹ️</span>}</li></ol></div></>}</div></section>
      <section className="catalog-scroll" aria-label="Marketplace equipment">{visibleItems.length?<div className="catalog-grid">{visibleItems.map(item=>{const pending=Boolean(pendingTransferFor(item));const walletLabel=pending?'Pending transfer':owner==='player'?'Player Wallet':owner==='game'?'Game Wallet':gameItems?.some(candidate=>candidate.assetId===item.assetId)?'Game Wallet':'Player Wallet';return <button className={`asset-card${pending?' asset-card-pending':''}`} key={`${owner}-${item.assetId}`} onClick={()=>setSelected(item)}><span className="asset-card-layout"><Artwork item={item} list/><span className="asset-card-title"><strong>{item.name}</strong><b>{item.priceSats.toLocaleString()} sats</b><small className="asset-card-wallet">{walletLabel}</small></span><span className="asset-card-lore"><small className="asset-card-effect">{item.description}</small><span className="poetic-quote">“{poeticQuoteFor(item)}”</span></span></span></button>})}</div>:<p className="empty-state" role="status">{emptyMessage}</p>}</section>
      {selected&&<div className="backdrop" role="presentation" onMouseDown={()=>setSelected(undefined)}><article className="detail" role="dialog" aria-modal="true" aria-labelledby="item-title" onMouseDown={event=>event.stopPropagation()}>
        <button className="close" onClick={()=>setSelected(undefined)} aria-label="Close item detail">×</button><div className="detail-identity"><Artwork item={selected} large/><div><h2 id="item-title">{selected.name}</h2><strong>{selected.priceSats.toLocaleString()} sats</strong></div><div className="detail-actions"><button className="trade-action trade-action-buy" disabled={!canBuy} title={pendingTransferTitle??(checkoutIsPending?'Pending transaction':undefined)} aria-describedby={!salesEnabled?'sales-disabled-reason':undefined} onClick={()=>void beginCheckout('buy')}>Buy</button><button className="trade-action trade-action-sell" disabled={!canSell} title={pendingTransferTitle??(checkoutIsPending?'Pending transaction':undefined)} aria-describedby={!salesEnabled?'sales-disabled-reason':undefined} onClick={()=>void beginCheckout('sell')}>Sell</button>{!salesEnabled&&<p className="sales-disabled-reason" id="sales-disabled-reason">Log in to separate Player and Game Wallets from Account to trade.</p>}</div></div>
        <section className="asset-data" aria-label="Generic asset data"><p className="data-label">Generic asset</p><div className="marketplace-detail-fields marketplace-generic-fields"><FormValue label="Asset ID" value={selected.assetId} copyable className="marketplace-detail-field marketplace-asset-id" /><FormValue label="Ticker" value={selected.ticker} copyable className="marketplace-detail-field" /><FormValue label="Quantity" value={String(selected.quantity)} copyable className="marketplace-detail-field" /></div></section>
        <section className="asset-data" aria-label="Gameplay metadata"><p className="data-label">Gameplay metadata</p><div className="marketplace-detail-fields marketplace-gameplay-fields">{gameplayMetadata(selected).map(stat=><FormValue key={stat.label} label={stat.label} value={stat.value} copyable className="marketplace-detail-field" />)}</div></section>
        <button type="button" className="detail-explorer-action" disabled={!explorerUrl} title={!explorerUrl?'Explorer unavailable: invalid asset ID.':undefined} onClick={()=>{if(explorerUrl)window.open(explorerUrl, '_blank', 'noopener,noreferrer');}}>Open On Explorer</button>
        <button type="button" className="marketplace-dialog-back" onClick={()=>setSelected(undefined)}>Back</button>
      </article></div>}
      {isBenefitsOpen&&<div className="backdrop blockchain-benefits-backdrop" role="presentation" onMouseDown={()=>setIsBenefitsOpen(false)}><article className="detail blockchain-benefits-dialog" role="dialog" aria-modal="true" aria-labelledby="blockchain-benefits-title" onMouseDown={event=>event.stopPropagation()}>
        <button type="button" className="close" onClick={()=>setIsBenefitsOpen(false)} aria-label="Close Blockchain Benefits">×</button>
        <img className="blockchain-benefits-image" src={blockchainBenefitsImageUrl} width="2161" height="728" alt="Bitcoin Ark Arkade BIS game" />
        <h2 id="blockchain-benefits-title">Blockchain Benefits</h2>
        <ul className="marketplace-benefits-list">
          <li><strong>Account / Wallet</strong><span>One account securely owns your Stealth &amp; Steel gear.</span></li>
          <li><strong>Assets</strong><span>Tokenized boots stay yours after every stealth mission.</span></li>
          <li><strong>Contracts</strong><span>Rules automatically deliver a Shield when payment clears.</span></li>
          <li><strong>Marketplace</strong><span>Players securely trade a Dagger III between wallets.</span></li>
          <li><strong>Payments</strong><span>Sats move instantly when you buy Shoes III.</span></li>
        </ul>
        <button type="button" className="marketplace-dialog-back" onClick={()=>setIsBenefitsOpen(false)}>Back</button>
      </article></div>}
    </main>
    </div>
  </PendingOperations>;
}
