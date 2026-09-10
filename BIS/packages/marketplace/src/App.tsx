import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { classifyBisEquipmentAsset, createBisContext, createBisEquipment, createBisGameWallet, createBisUi, getBisMarketplaceTradingAvailability, type BisEquipmentItem } from '@bis/integration';
import '@bis/integration/style.css';
import { fallbackCatalog, type MarketplaceCatalog } from './catalog';
import { readPublicInventory } from './inventory';
import { version } from '../package.json';

function shortAddress(address: string | undefined) {return address ? `${address.slice(0, 7)}…${address.slice(-6)}` : 'Not connected';}
function gameplayMetadata(item:BisEquipmentItem){return [
  {label:'Speed',value:item.family==='Shoes'?`+${item.effectPercent}`:'0'},
  {label:'Offense',value:item.family==='Dagger'?`+${item.effectPercent}`:'0'},
  {label:'Defense',value:item.family==='Shield'?`+${item.effectPercent}`:'0'},
];}
function Artwork({item,large=false}:{item:BisEquipmentItem;large?:boolean}){
  const [failed,setFailed]=useState(false),size=large?104:72;
  return <span className={`art ${large?'large ':''}art-${item.family.toLowerCase()}`} style={{width:size,height:size,overflow:'hidden'}}>
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
  const [owner,setOwner]=useState<'all'|'game'|'player'>('all'),[game,setGame]=useState<'all'|'stealth-and-steel'>('all'),[type,setType]=useState<'all'|'speed'|'offense'|'defense'>('all');
  const trading=getBisMarketplaceTradingAvailability();

  useEffect(()=>{if(walletHost.current){walletUi.mount(walletHost.current);walletUi.showAccountButton();}return()=>{walletUi.unmount();equipment.dispose();gameWallet.dispose();player.dispose();};},[walletUi,equipment,gameWallet,player]);
  useEffect(()=>{void fetch('/catalog.json',{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error();const next=await response.json() as MarketplaceCatalog;if(next.version!==1||!Array.isArray(next.items))throw Error();setCatalog(next);setReadable(true);}).catch(()=>setReadable(false));},[]);
  useEffect(()=>{if(playerState.profileId)void equipment.refresh();},[playerState.profileId,equipment]);
  const sessionGameAddress=gameState.addresses?.arkadeAddress;
  const inventoryAddress=sessionGameAddress??catalog.gameWalletAddress;
  useEffect(()=>{
    const controller=new AbortController();setGameItems(undefined);
    if(!inventoryAddress)return()=>controller.abort();
    void readPublicInventory(inventoryAddress,controller.signal).then(assets=>setGameItems(Object.freeze(assets.map(classifyBisEquipmentAsset).filter(item=>item!==null)))).catch(()=>setGameItems(undefined));
    return()=>controller.abort();
  },[inventoryAddress]);
  const playerItems=equipmentState.status==='ready'?equipmentState.ownedItems:[];
  const source=owner==='player'?playerItems:owner==='game'?gameItems??[]:[...(gameItems??[]),...playerItems].filter((item,index,all)=>all.findIndex(candidate=>candidate.assetId===item.assetId)===index);
  const visibleItems=source.filter(item=>(game==='all'||game==='stealth-and-steel')&&(type==='all'||gameplayMetadata(item).some(stat=>stat.label.toLowerCase()===type&&stat.value!=='0')));
  const gameSourceLabel=sessionGameAddress?'Session Game Wallet override':catalog.gameWalletAddress?'Registered Game Wallet':'Game Wallet address unavailable';

  return <>
    <div className="marketplace-bis-host" ref={walletHost}/>
    <div className="network-banner" role="status"><span className="network-anchor"><span>Network: Signet</span><span className="version-label">BIS: v{version}</span></span></div>
    <main className="marketplace-shell">
      <aside className="marketplace-sidebar">
        <header><h1>Marketplace</h1><p className="lede">Shop before you play.</p></header>
        <section className="wallet-strip" aria-label="Marketplace wallets">
          <span>Player Wallet</span><code title={playerState.profileId}>{shortAddress(playerState.profileId)}</code><button onClick={()=>player.openAccountDialog()}>Player Wallet Login</button>
          <span>Game Wallet</span><code title={inventoryAddress}>{shortAddress(inventoryAddress)}</code><strong>{gameSourceLabel}</strong><button onClick={()=>walletUi.openGameWalletLogin()}>Game Wallet Login</button>
        </section>
      </aside>
      <section className="collection-panel">
        <div className="catalog-toolbar" aria-label="Catalog filters">
          <div className="filter-row"><span>Owner</span><div role="group" aria-label="Owner"><button aria-pressed={owner==='all'} onClick={()=>setOwner('all')}>All</button><button aria-pressed={owner==='game'} onClick={()=>setOwner('game')}>Game Wallet</button><button aria-pressed={owner==='player'} onClick={()=>setOwner('player')}>My Items</button></div></div>
          <div className="filter-row"><span>Game</span><div role="group" aria-label="Game"><button aria-pressed={game==='all'} onClick={()=>setGame('all')}>All</button><button aria-pressed={game==='stealth-and-steel'} onClick={()=>setGame('stealth-and-steel')}>Stealth &amp; Steel</button></div></div>
          <div className="filter-row"><span>Type</span><div role="group" aria-label="Type"><button aria-pressed={type==='all'} onClick={()=>setType('all')}>All</button><button aria-pressed={type==='speed'} onClick={()=>setType('speed')}>Speed</button><button aria-pressed={type==='offense'} onClick={()=>setType('offense')}>Offense</button><button aria-pressed={type==='defense'} onClick={()=>setType('defense')}>Defense</button></div></div>
        </div>
        <div className="catalog-scroll">{visibleItems.length?<div className="catalog-grid">{visibleItems.map(item=><button className="asset-card" key={`${owner}-${item.assetId}`} onClick={()=>setSelected(item)}><Artwork item={item}/><span className="family">{item.family} · Tier {item.tier}</span><strong>{item.name}</strong><small>{item.effect}</small><b>{item.priceSats.toLocaleString()} sats</b></button>)}</div>:<p className="empty-state" role="status">{owner==='player'&&!playerState.profileId?'Log in to a Player Wallet to view My Items.':!readable&&owner!=='player'?'Catalog data unavailable.':'No freshly verified equipment matches these filters.'}</p>}</div>
      </section>
      {selected&&<div className="backdrop" role="presentation" onMouseDown={()=>setSelected(undefined)}><article className="detail" role="dialog" aria-modal="true" aria-labelledby="item-title" onMouseDown={event=>event.stopPropagation()}>
        <button className="close" onClick={()=>setSelected(undefined)} aria-label="Close item detail">×</button><div className="detail-identity"><Artwork item={selected} large/><div><p className="eyebrow">{selected.family} · TIER {selected.tier}</p><h2 id="item-title">{selected.name}</h2><p className="detail-effect">{selected.effect}</p><strong>{selected.priceSats.toLocaleString()} sats</strong></div></div>
        <section className="asset-data" aria-label="Generic asset data"><p className="data-label">Generic asset</p><dl className="generic-fields"><div className="wide"><dt>Asset ID</dt><dd><code>{selected.assetId}</code></dd></div><div><dt>Ticker</dt><dd>{selected.ticker}</dd></div><div><dt>Decimals</dt><dd>0</dd></div><div><dt>Quantity</dt><dd>{selected.quantity}</dd></div></dl></section>
        <section className="asset-data" aria-label="Gameplay metadata"><p className="data-label">Gameplay metadata</p><dl className="gameplay-fields">{gameplayMetadata(selected).map(stat=><div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl></section>
        <footer className="detail-footer"><span className="detail-status">Fresh chain metadata verified</span><div className="actions"><button disabled title={trading.message}>Buy</button><button disabled title={trading.message}>Sell</button></div><p role="status">{trading.message}</p></footer>
      </article></div>}
    </main>
  </>;
}
