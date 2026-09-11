import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { advanceLocalMarketplaceCheckout, beginLocalMarketplaceCheckout, classifyBisEquipmentAsset, confirmLocalMarketplaceCheckoutLeg, CopyableValueField, createBisContext, createBisEquipment, createBisGameWallet, createBisUi, readLocalMarketplaceCheckouts, type BisEquipmentItem, type BisMarketplaceCheckoutRecord } from '@bis/integration';
import '@bis/integration/style.css';
import { fallbackCatalog, type MarketplaceCatalog } from './catalog';
import { readPublicInventory } from './inventory';
import { version } from '../package.json';
import arkadeLogo from '../../integration-demo/src/assets/arkade-logo.png';
import './marketplace-utilities.css';

function shortAddress(address: string | undefined) {return address ? `${address.slice(0, 7)}…${address.slice(-6)}` : 'Not connected';}
function isInsufficientFundsError(error: unknown) {return error instanceof Error&&/insufficient.*(?:funds|balance)/i.test(error.message);}
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
  const [isCatalogLoading,setIsCatalogLoading]=useState(true);
  const [gameItems,setGameItems]=useState<readonly BisEquipmentItem[]>(),[selected,setSelected]=useState<BisEquipmentItem>();
  const [isGameInventoryLoading,setIsGameInventoryLoading]=useState(true);
  const [inventoryRevision,setInventoryRevision]=useState(0);
  const [checkout,setCheckout]=useState<BisMarketplaceCheckoutRecord>(),[fundsError,setFundsError]=useState<string>();
  const [isBenefitsOpen,setIsBenefitsOpen]=useState(false);
  const [owner,setOwner]=useState<'all'|'game'|'player'>('game'),[game,setGame]=useState<'all'|'stealth-and-steel'>('stealth-and-steel'),[type,setType]=useState<'all'|'speed'|'offense'|'defense'>('all');
  useEffect(()=>{if(walletHost.current){walletUi.mount(walletHost.current);walletUi.showAccountButton();}return()=>{walletUi.unmount();equipment.dispose();gameWallet.dispose();player.dispose();};},[walletUi,equipment,gameWallet,player]);
  useEffect(()=>{void fetch(`${import.meta.env.BASE_URL}catalog.json`,{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error();const next=await response.json() as MarketplaceCatalog;if(next.version!==2||next.gameId!=='stealth-and-steel'||typeof next.gameWalletAddress!=='string')throw Error();setCatalog(next);setReadable(true);}).catch(()=>setReadable(false)).finally(()=>setIsCatalogLoading(false));},[]);
  useEffect(()=>{if(playerState.profileId)void equipment.refresh();},[playerState.profileId,equipment]);
  const sessionGameAddress=gameState.addresses?.arkadeAddress;
  const inventoryAddress=sessionGameAddress??catalog.gameWalletAddress;
  const salesEnabled=Boolean(playerState.profileId&&gameState.profileId&&playerState.profileId!==gameState.profileId);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    setGameItems(undefined);setIsGameInventoryLoading(true);
    if(!inventoryAddress) {setIsGameInventoryLoading(false);return()=>{active=false;controller.abort();};}
    void readPublicInventory(inventoryAddress,controller.signal)
      .then(assets=>{if(active)setGameItems(Object.freeze(assets.map(classifyBisEquipmentAsset).filter(item=>item!==null)));})
      .catch(()=>{if(active)setGameItems([]);})
      .finally(()=>{if(active)setIsGameInventoryLoading(false);});
    return()=>{active=false;controller.abort();};
  },[inventoryAddress,inventoryRevision]);
  const playerItems=equipmentState.status==='ready'?equipmentState.ownedItems:[];
  const source=owner==='player'?playerItems:owner==='game'?gameItems??[]:[...(gameItems??[]),...playerItems].filter((item,index,all)=>all.findIndex(candidate=>candidate.assetId===item.assetId)===index);
  const visibleItems=source.filter(item=>(game==='all'||game==='stealth-and-steel')&&(type==='all'||gameplayMetadata(item).some(stat=>stat.label.toLowerCase()===type&&stat.value!=='0')));
  const isMarketplaceLoading=isCatalogLoading||isGameInventoryLoading;
  const activeCheckout=checkout?.request.assetId===selected?.assetId?checkout:undefined;
  const gameOwnsSelected=Boolean(selected&&gameItems?.some(item=>item.assetId===selected.assetId));
  const playerOwnsSelected=Boolean(selected&&playerItems.some(item=>item.assetId===selected.assetId));
  const checkoutIsPending=activeCheckout?.status==='pending';
  const canBuy=salesEnabled&&gameOwnsSelected&&!checkoutIsPending;
  const canSell=salesEnabled&&playerOwnsSelected&&!checkoutIsPending;
  const explorerUrl=selected&&/^[a-f0-9]{68}$/i.test(selected.assetId)?`https://explorer.signet.arkade.sh/asset/${selected.assetId}`:undefined;
  useEffect(()=>{
    if(!selected)return;
    try {
      const pending=readLocalMarketplaceCheckouts().find(record=>record.status==='pending'&&record.request.assetId===selected.assetId);
      if(pending)setCheckout(pending);
    } catch {}
  },[selected?.assetId]);
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
    if(!selected||!salesEnabled||!gameState.profileId||!sessionGameAddress) return;
    const paymentRecipient=player.getPaymentRecipient;
    if(!paymentRecipient) return;
    if(activeCheckout?.status==='pending') return;
    const sellerItems=direction==='buy'?gameItems:playerItems;
    if(!sellerItems?.some(item=>item.assetId===selected.assetId)) return;
    try {
      setFundsError(undefined);
      const payerBalance=direction==='buy'?await player.getSendSpendable():gameWallet.getPlayerPaymentBalance();
      if(payerBalance!==undefined&&payerBalance<selected.priceSats) {
        const walletName=direction==='buy'?'Player Wallet':'Game Wallet';
        setFundsError(`Insufficient ${walletName} balance. ${payerBalance.toLocaleString()} sats available; ${selected.priceSats.toLocaleString()} sats required.`);
        return;
      }
      const playerRecipient=await paymentRecipient();
      const record=beginLocalMarketplaceCheckout({id:crypto.randomUUID(),direction,player:playerRecipient,game:{profileId:gameState.profileId,address:sessionGameAddress},assetId:selected.assetId,quantity:String(selected.quantity),priceSats:selected.priceSats});
      setCheckout(record);
      await advanceCheckout(record);
    } catch(error) {
      if(isInsufficientFundsError(error)) {
        const walletName=direction==='buy'?'Player Wallet':'Game Wallet';
        setFundsError(`Insufficient ${walletName} balance. This sale needs ${selected.priceSats.toLocaleString()} sats.`);
      }
    }
  }
  async function continuePendingCheckout(record:BisMarketplaceCheckoutRecord) {
    try {
      if(record.phase==='payment-submitted') {
        const result=record.request.direction==='buy'?await player.checkAccountSend():await gameWallet.checkPlayerPayment();
        if(result.status!=='succeeded'||!result.transactionId) return;
        const next=confirmLocalMarketplaceCheckoutLeg(record,'payment',result.transactionId);setCheckout(next);await advanceCheckout(next);return;
      }
      if(record.phase==='delivery-submitted') {
        const result=record.request.direction==='buy'?await gameWallet.checkAssetDelivery(record.request.id):await player.checkAssetDelivery(record.request.id);
        if((result.status!=='delivered'&&result.status!=='already-delivered')||!result.transactionId) return;
        const next=confirmLocalMarketplaceCheckoutLeg(record,'delivery',result.transactionId);setCheckout(next);await advanceCheckout(next);
      }
    } catch {}
  }
  useEffect(()=>{
    if(!activeCheckout||!checkoutIsPending||(activeCheckout.phase!=='payment-submitted'&&activeCheckout.phase!=='delivery-submitted'))return;
    let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined;
    const run=async()=>{
      await continuePendingCheckout(activeCheckout);
      if(!cancelled)timer=setTimeout(run,2500);
    };
    void run();
    return()=>{cancelled=true;if(timer)clearTimeout(timer);};
  },[activeCheckout?.request.id,activeCheckout?.phase,checkoutIsPending]);

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
        <header><h1>Marketplace</h1><p className="lede">Shop <button type="button" className="benefits-trigger" onClick={()=>setIsBenefitsOpen(true)}>before</button> you play.</p></header>
        <section className="wallet-strip" aria-label="Marketplace wallets and instructions"><div className="marketplace-info"><p>This marketplace requires the player wallet for item display and items sales.</p><p>In production the game wallet will be controlled by the server. However, for this simple POC, you must also login the game wallet which has balance and has any items to display.</p><div className="marketplace-info-group"><h2>Wallets</h2><ul><li><span>Player Wallet:</span> <code title={playerState.profileId}>{shortAddress(playerState.profileId)}</code></li><li><span>Game Wallet:</span> <code title={inventoryAddress}>{shortAddress(inventoryAddress)}</code></li></ul></div><hr/><div className="marketplace-info-group"><h2>Instructions</h2><ol><li>Enable Item Listing: <strong title="Requirement complete: the Game Wallet is logged in and has items to display.">Enabled ℹ️</strong></li><li>Enable Item Sales: {salesEnabled?<><strong title="Requirement complete: different Player and Game Wallets are logged in.">Enabled ℹ️</strong></>:<span title="Requirement: log in to different Player and Game Wallets from Account.">Disabled ℹ️</span>}</li></ol></div></div></section>
      </aside>
      <section className="collection-panel">
        <div className="catalog-toolbar" aria-label="Catalog filters">
          <div className="filter-row"><span>Owner</span><div role="group" aria-label="Owner"><button aria-pressed={owner==='all'} onClick={()=>setOwner('all')}>All</button><button aria-pressed={owner==='game'} onClick={()=>setOwner('game')}>Game Wallet</button><button aria-pressed={owner==='player'} onClick={()=>setOwner('player')}>Player Wallet</button></div></div>
          <div className="filter-row"><span>Game</span><div role="group" aria-label="Game"><button aria-pressed={game==='all'} onClick={()=>setGame('all')}>All</button><button aria-pressed={game==='stealth-and-steel'} onClick={()=>setGame('stealth-and-steel')}>Stealth &amp; Steel</button></div></div>
          <div className="filter-row"><span>Type</span><div role="group" aria-label="Type"><button aria-pressed={type==='all'} onClick={()=>setType('all')}>All</button><button aria-pressed={type==='speed'} onClick={()=>setType('speed')}>Speed</button><button aria-pressed={type==='offense'} onClick={()=>setType('offense')}>Offense</button><button aria-pressed={type==='defense'} onClick={()=>setType('defense')}>Defense</button></div></div>
        </div>
          <div className="catalog-scroll">{visibleItems.length?<div className="catalog-grid">{visibleItems.map(item=><button className="asset-card" key={`${owner}-${item.assetId}`} onClick={()=>{setFundsError(undefined);setSelected(item);}}><span className="asset-card-identity"><Artwork item={item} list/><span className="asset-card-title"><strong>{item.name}</strong><b>{item.priceSats.toLocaleString()} sats</b></span></span><small className="asset-card-effect">{item.effect}</small><span className="poetic-quote">“{poeticQuoteFor(item)}”</span></button>)}</div>:<p className="empty-state" role="status">{isMarketplaceLoading&&owner!=='player'?'Loading...':owner==='player'&&!playerState.profileId?'Log in to your Player Wallet to view its items.':!readable&&owner!=='player'?'Catalog data unavailable.':'No freshly verified equipment matches these filters.'}</p>}</div>
      </section>
      {selected&&<div className="backdrop" role="presentation" onMouseDown={()=>{setSelected(undefined);setFundsError(undefined);}}><article className="detail" role="dialog" aria-modal="true" aria-labelledby="item-title" onMouseDown={event=>event.stopPropagation()}>
        <button className="close" onClick={()=>{setSelected(undefined);setFundsError(undefined);}} aria-label="Close item detail">×</button><div className="detail-identity"><Artwork item={selected} large/><div><h2 id="item-title">{selected.name}</h2><strong>{selected.priceSats.toLocaleString()} sats</strong></div><div className="detail-actions"><button className="trade-action trade-action-buy" disabled={!canBuy} title={checkoutIsPending?'Pending transaction':undefined} aria-describedby={!salesEnabled?'sales-disabled-reason':undefined} onClick={()=>void beginCheckout('buy')}>Buy</button><button className="trade-action trade-action-sell" disabled={!canSell} title={checkoutIsPending?'Pending transaction':undefined} aria-describedby={!salesEnabled?'sales-disabled-reason':undefined} onClick={()=>void beginCheckout('sell')}>Sell</button>{!salesEnabled&&<p className="sales-disabled-reason" id="sales-disabled-reason">Log in to separate Player and Game Wallets from Account to trade.</p>}</div></div>
        <section className="asset-data" aria-label="Generic asset data"><p className="data-label">Generic asset</p><div className="marketplace-detail-fields marketplace-generic-fields"><CopyableValueField label="Asset ID" value={selected.assetId} className="marketplace-detail-field marketplace-asset-id" /><CopyableValueField label="Ticker" value={selected.ticker} className="marketplace-detail-field" /><CopyableValueField label="Quantity" value={String(selected.quantity)} className="marketplace-detail-field" /></div></section>
        <section className="asset-data" aria-label="Gameplay metadata"><p className="data-label">Gameplay metadata</p><div className="marketplace-detail-fields marketplace-gameplay-fields">{gameplayMetadata(selected).map(stat=><CopyableValueField key={stat.label} label={stat.label} value={stat.value} className="marketplace-detail-field" />)}</div></section>
        <button type="button" className="detail-explorer-action" disabled={!explorerUrl} title={!explorerUrl?'Explorer unavailable: invalid asset ID.':undefined} onClick={()=>{if(explorerUrl)window.open(explorerUrl, '_blank', 'noopener,noreferrer');}}>Open On Explorer</button>
      </article></div>}
      {isBenefitsOpen&&<div className="backdrop blockchain-benefits-backdrop" role="presentation" onMouseDown={()=>setIsBenefitsOpen(false)}><article className="detail blockchain-benefits-dialog" role="dialog" aria-modal="true" aria-labelledby="blockchain-benefits-title" onMouseDown={event=>event.stopPropagation()}>
        <button type="button" className="close" onClick={()=>setIsBenefitsOpen(false)} aria-label="Close Blockchain Benefits">×</button>
        <p className="blockchain-benefits-category">Marketplace</p>
        <h2 id="blockchain-benefits-title">Blockchain Benefits</h2>
        <ul className="marketplace-benefits-list">
          <li><strong>Marketplace</strong><span>Players securely trade a Dagger III between wallets.</span></li>
          <li><strong>Account / Wallet</strong><span>One account securely owns your Stealth &amp; Steel gear.</span></li>
          <li><strong>Assets</strong><span>Tokenized boots stay yours after every stealth mission.</span></li>
          <li><strong>Contracts</strong><span>Rules automatically deliver a Shield when payment clears.</span></li>
          <li><strong>Payments</strong><span>Sats move instantly when you buy Shoes III.</span></li>
        </ul>
      </article></div>}
      {fundsError&&<div className="funds-backdrop" role="presentation" onMouseDown={()=>setFundsError(undefined)}><article className="funds-dialog" role="alertdialog" aria-modal="true" aria-labelledby="funds-title" onMouseDown={event=>event.stopPropagation()}><h2 id="funds-title">Payment unavailable</h2><p>{fundsError}</p><button type="button" onClick={()=>setFundsError(undefined)}>OK</button></article></div>}
    </main>
  </>;
}
