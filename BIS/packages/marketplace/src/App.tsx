import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { advanceLocalMarketplaceCheckout, beginLocalMarketplaceCheckout, classifyBisEquipmentAsset, confirmLocalMarketplaceCheckoutLeg, CopyableValueField, createBisContext, createBisEquipment, createBisGameWallet, createBisUi, type BisEquipmentItem, type BisMarketplaceCheckoutRecord } from '@bis/integration';
import '@bis/integration/style.css';
import { fallbackCatalog, type MarketplaceCatalog } from './catalog';
import { readPublicInventory } from './inventory';
import { version } from '../package.json';
import arkadeLogo from '../../integration-demo/src/assets/arkade-logo.png';
import './marketplace-utilities.css';

function shortAddress(address: string | undefined) {return address ? `${address.slice(0, 7)}…${address.slice(-6)}` : 'Not connected';}
function gameplayMetadata(item:BisEquipmentItem){return [
  {label:'Speed',value:item.family==='Shoes'?`+${item.effectPercent}`:'0'},
  {label:'Offense',value:item.family==='Dagger'?`+${item.effectPercent}`:'0'},
  {label:'Defense',value:item.family==='Shield'?`+${item.effectPercent}`:'0'},
];}
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

export function App(){
  const player=useMemo(()=>createBisContext(),[]);
  const gameWallet=useMemo(()=>createBisGameWallet({playerProfileId:()=>player.getState().profileId}),[player]);
  const walletUi=useMemo(()=>createBisUi(player,{gameWallet}),[player,gameWallet]);
  const equipment=useMemo(()=>createBisEquipment(player),[player]);
  const playerState=useSyncExternalStore(player.subscribe,player.getState,player.getState);
  const gameState=useSyncExternalStore(gameWallet.subscribe,gameWallet.getState,gameWallet.getState);
  const equipmentState=useSyncExternalStore(equipment.subscribe,equipment.getState,equipment.getState);
  const walletHost=useRef<HTMLDivElement>(null);
  const [catalog,setCatalog]=useState<MarketplaceCatalog>(fallbackCatalog),[readable,setReadable]=useState(false);
  const [gameItems,setGameItems]=useState<readonly BisEquipmentItem[]>(),[selected,setSelected]=useState<BisEquipmentItem>();
  const [inventoryRevision,setInventoryRevision]=useState(0);
  const [checkout,setCheckout]=useState<BisMarketplaceCheckoutRecord>(),[checkoutError,setCheckoutError]=useState<string>();
  const [owner,setOwner]=useState<'all'|'game'|'player'>('all'),[game,setGame]=useState<'all'|'stealth-and-steel'>('all'),[type,setType]=useState<'all'|'speed'|'offense'|'defense'>('all');
  useEffect(()=>{if(walletHost.current){walletUi.mount(walletHost.current);walletUi.showAccountButton();}return()=>{walletUi.unmount();equipment.dispose();gameWallet.dispose();player.dispose();};},[walletUi,equipment,gameWallet,player]);
  useEffect(()=>{void fetch(`${import.meta.env.BASE_URL}catalog.json`,{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error();const next=await response.json() as MarketplaceCatalog;if(next.version!==2||next.gameId!=='stealth-and-steel'||typeof next.gameWalletAddress!=='string')throw Error();setCatalog(next);setReadable(true);}).catch(()=>setReadable(false));},[]);
  useEffect(()=>{if(playerState.profileId)void equipment.refresh();},[playerState.profileId,equipment]);
  const sessionGameAddress=gameState.addresses?.arkadeAddress;
  const inventoryAddress=sessionGameAddress??catalog.gameWalletAddress;
  const salesEnabled=Boolean(playerState.profileId&&gameState.profileId&&playerState.profileId!==gameState.profileId);
  useEffect(()=>{
    const controller=new AbortController();setGameItems(undefined);
    if(!inventoryAddress)return()=>controller.abort();
    void readPublicInventory(inventoryAddress,controller.signal).then(assets=>setGameItems(Object.freeze(assets.map(classifyBisEquipmentAsset).filter(item=>item!==null)))).catch(()=>setGameItems(undefined));
    return()=>controller.abort();
  },[inventoryAddress,inventoryRevision]);
  const playerItems=equipmentState.status==='ready'?equipmentState.ownedItems:[];
  const source=owner==='player'?playerItems:owner==='game'?gameItems??[]:[...(gameItems??[]),...playerItems].filter((item,index,all)=>all.findIndex(candidate=>candidate.assetId===item.assetId)===index);
  const visibleItems=source.filter(item=>(game==='all'||game==='stealth-and-steel')&&(type==='all'||gameplayMetadata(item).some(stat=>stat.label.toLowerCase()===type&&stat.value!=='0')));
  const activeCheckout=checkout?.request.assetId===selected?.assetId?checkout:undefined;
  async function advanceCheckout(record:BisMarketplaceCheckoutRecord) {
    const next=await advanceLocalMarketplaceCheckout(record,{
      pay:async({recipient,amountSats})=>{
        const result=record.request.direction==='buy'
          ?await player.confirmAccountSend(await player.quoteAccountSend(recipient,amountSats))
          :await gameWallet.payPlayer({profileId:record.request.player.profileId,address:recipient},amountSats);
        return result.status==='succeeded'?{status:'succeeded' as const,...(result.transactionId?{transactionId:result.transactionId}:{})}:{status:'pending' as const};
      },
      deliver:async({recipient,assetId,quantity})=>{
        const result=record.request.direction==='buy'
          ?await gameWallet.deliverAsset({operationId:record.request.id,assetId,quantity,recipient})
          :await player.deliverAsset({operationId:record.request.id,assetId,quantity,recipient});
        return result.status==='delivered'||result.status==='already-delivered'
          ?{status:'delivered' as const,transactionId:result.transactionId}:{status:'pending' as const};
      },
    });
    setCheckout(next);
    if(next.status==='completed') {void equipment.refresh();void gameWallet.refresh();setInventoryRevision(value=>value+1);}
  }
  async function beginCheckout(direction:'buy'|'sell') {
    if(!selected||!salesEnabled||!gameState.profileId||!sessionGameAddress) {setCheckoutError('Log in to separate Player and Game Wallets from the Account button before trading.');return;}
    const paymentRecipient=player.getPaymentRecipient;
    if(!paymentRecipient) {setCheckoutError('The active Player Wallet cannot provide a payment address. Reopen the Account button and try again.');return;}
    if(activeCheckout?.status==='pending') {setCheckoutError('This item already has a pending checkout. Reconcile it before trying again.');return;}
    const sellerItems=direction==='buy'?gameItems:playerItems;
    if(!sellerItems?.some(item=>item.assetId===selected.assetId)) {setCheckoutError(direction==='buy'?'This item is no longer listed by the Game Wallet. Refresh listings.':'Select an item from My Items before selling it.');return;}
    try {
      setCheckoutError(undefined);
      const playerRecipient=await paymentRecipient();
      const record=beginLocalMarketplaceCheckout({id:crypto.randomUUID(),direction,player:playerRecipient,game:{profileId:gameState.profileId,address:sessionGameAddress},assetId:selected.assetId,quantity:String(selected.quantity),priceSats:selected.priceSats});
      setCheckout(record);
      await advanceCheckout(record);
    } catch(error) {setCheckoutError(error instanceof Error?error.message:'Checkout could not start.');}
  }
  async function reconcileCheckout(record:BisMarketplaceCheckoutRecord) {
    try {
      setCheckoutError(undefined);
      if(record.phase==='payment-submitted') {
        const result=record.request.direction==='buy'?await player.checkAccountSend():await gameWallet.checkPlayerPayment();
        if(result.status!=='succeeded'||!result.transactionId) {setCheckoutError('Payment is still awaiting fresh confirmation. You can continue browsing while it settles.');return;}
        const next=confirmLocalMarketplaceCheckoutLeg(record,'payment',result.transactionId);setCheckout(next);await advanceCheckout(next);return;
      }
      if(record.phase==='delivery-submitted') {
        const result=record.request.direction==='buy'?await gameWallet.checkAssetDelivery(record.request.id):await player.checkAssetDelivery(record.request.id);
        if((result.status!=='delivered'&&result.status!=='already-delivered')||!result.transactionId) {setCheckoutError(result.status==='error'?result.message:'Item delivery is still awaiting fresh ownership confirmation. You can continue browsing while it settles.');return;}
        const next=confirmLocalMarketplaceCheckoutLeg(record,'delivery',result.transactionId);setCheckout(next);await advanceCheckout(next);
      }
    } catch(error) {setCheckoutError(error instanceof Error?error.message:'Checkout status could not be reconciled.');}
  }

  return <>
    <div className="marketplace-bis-host" ref={walletHost}/>
    <div className="network-banner" role="status"><span>Network: Signet</span></div>
    <nav className="marketplace-utilities" aria-label="Marketplace resources">
      <span className="marketplace-version">v{version}</span>
      <a className="marketplace-resource-link" href="https://github.com/SamuelAsherRivello/blockchain-integration-service" target="_blank" rel="noopener noreferrer" aria-label="View repository on GitHub">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" /></svg>
      </a>
      <a className="marketplace-resource-link marketplace-arkade-link" href="https://docs.arkadeos.com/" target="_blank" rel="noopener noreferrer" aria-label="View Arkade documentation" title="Arkade documentation"><img src={arkadeLogo} width="20" height="20" alt="" /></a>
    </nav>
    <main className="marketplace-shell">
      <aside className="marketplace-sidebar">
        <header><h1>Marketplace</h1><p className="lede">Shop before you play.</p></header>
        <section className="wallet-strip" aria-label="Marketplace wallets and instructions"><div className="marketplace-info"><p>This marketplace requires the player wallet for item display and items sales.</p><div className="marketplace-info-group"><h2>Wallets</h2><ul><li><span>Player Wallet:</span> <code title={playerState.profileId}>{shortAddress(playerState.profileId)}</code></li><li><span>Game Wallet:</span> <code title={inventoryAddress}>{shortAddress(inventoryAddress)}</code></li></ul></div><hr/><div className="marketplace-info-group"><h2>Instructions</h2><ol><li>Enable Item Listing: <strong>Enabled</strong></li><li>Enable Item Sales: {salesEnabled?<><strong>Enabled</strong></>:'Disabled'}</li></ol></div></div></section>
      </aside>
      <section className="collection-panel">
        <div className="catalog-toolbar" aria-label="Catalog filters">
          <button type="button" onClick={()=>setInventoryRevision(value=>value+1)}>Refresh listings</button>
          <div className="filter-row"><span>Owner</span><div role="group" aria-label="Owner"><button aria-pressed={owner==='all'} onClick={()=>setOwner('all')}>All</button><button aria-pressed={owner==='game'} onClick={()=>setOwner('game')}>Game Wallet</button><button aria-pressed={owner==='player'} onClick={()=>setOwner('player')}>My Items</button></div></div>
          <div className="filter-row"><span>Game</span><div role="group" aria-label="Game"><button aria-pressed={game==='all'} onClick={()=>setGame('all')}>All</button><button aria-pressed={game==='stealth-and-steel'} onClick={()=>setGame('stealth-and-steel')}>Stealth &amp; Steel</button></div></div>
          <div className="filter-row"><span>Type</span><div role="group" aria-label="Type"><button aria-pressed={type==='all'} onClick={()=>setType('all')}>All</button><button aria-pressed={type==='speed'} onClick={()=>setType('speed')}>Speed</button><button aria-pressed={type==='offense'} onClick={()=>setType('offense')}>Offense</button><button aria-pressed={type==='defense'} onClick={()=>setType('defense')}>Defense</button></div></div>
        </div>
        <div className="catalog-scroll">{visibleItems.length?<div className="catalog-grid">{visibleItems.map(item=><button className="asset-card" key={`${owner}-${item.assetId}`} onClick={()=>setSelected(item)}><span className="asset-card-identity"><Artwork item={item} list/><span className="asset-card-title"><strong>{item.name}</strong><b>{item.priceSats.toLocaleString()} sats</b></span></span><small className="asset-card-effect">{item.effect}</small><span className="poetic-quote">“{poeticQuoteFor(item)}”</span></button>)}</div>:<p className="empty-state" role="status">{owner==='player'&&!playerState.profileId?'Log in to a Player Wallet to view My Items.':!readable&&owner!=='player'?'Catalog data unavailable.':'No freshly verified equipment matches these filters.'}</p>}</div>
      </section>
      {selected&&<div className="backdrop" role="presentation" onMouseDown={()=>setSelected(undefined)}><article className="detail" role="dialog" aria-modal="true" aria-labelledby="item-title" onMouseDown={event=>event.stopPropagation()}>
        <button className="close" onClick={()=>setSelected(undefined)} aria-label="Close item detail">×</button><div className="detail-identity"><Artwork item={selected} large/><div><p className="eyebrow">{selected.family} · TIER {selected.tier}</p><h2 id="item-title">{selected.name}</h2><p className="detail-effect">{selected.effect}</p><strong>{selected.priceSats.toLocaleString()} sats</strong></div><div className="detail-actions"><button className="trade-action trade-action-buy" disabled={!salesEnabled} aria-describedby={!salesEnabled?'sales-disabled-reason':undefined} onClick={()=>void beginCheckout('buy')}>Buy</button><button className="trade-action trade-action-sell" disabled={!salesEnabled} aria-describedby={!salesEnabled?'sales-disabled-reason':undefined} onClick={()=>void beginCheckout('sell')}>Sell</button>{!salesEnabled&&<p className="sales-disabled-reason" id="sales-disabled-reason">Log in to separate Player and Game Wallets from Account to trade.</p>}</div></div>
        {(activeCheckout||checkoutError)&&<section className="checkout-status" role="status">{activeCheckout&&<p>{activeCheckout.status==='completed'?'Checkout complete.':activeCheckout.message??'Checkout is pending.'}</p>}{activeCheckout?.status==='pending'&&(activeCheckout.phase==='payment-submitted'||activeCheckout.phase==='delivery-submitted')&&<button type="button" onClick={()=>void reconcileCheckout(activeCheckout)}>Reconcile checkout</button>}{checkoutError&&<p role="alert">{checkoutError}</p>}</section>}
        <section className="asset-data" aria-label="Generic asset data"><p className="data-label">Generic asset</p><div className="marketplace-detail-fields marketplace-generic-fields"><CopyableValueField label="Asset ID" value={selected.assetId} className="marketplace-detail-field marketplace-asset-id" /><CopyableValueField label="Ticker" value={selected.ticker} className="marketplace-detail-field" /><CopyableValueField label="Quantity" value={String(selected.quantity)} className="marketplace-detail-field" /></div></section>
        <section className="asset-data" aria-label="Gameplay metadata"><p className="data-label">Gameplay metadata</p><div className="marketplace-detail-fields marketplace-gameplay-fields">{gameplayMetadata(selected).map(stat=><CopyableValueField key={stat.label} label={stat.label} value={stat.value} className="marketplace-detail-field" />)}</div></section>
      </article></div>}
    </main>
  </>;
}
