import { useEffect, useState } from 'react';
import { fallbackCatalog, type CatalogItem, type MarketplaceCatalog } from './catalog';
import { readPublicInventory } from './inventory';
import { version } from '../package.json';
import { artworkFor } from './artwork';

function availability(item: CatalogItem, readable: boolean, inventory: ReadonlyMap<string, bigint> | undefined) {
  if (!readable || !inventory) return 'Availability unreadable';
  if (!item.assetId) return 'Not issued yet';
  return (inventory.get(item.assetId) ?? 0n) > 0n ? 'Available in game wallet' : 'Not currently available';
}

function shortAddress(address: string | undefined) {
  return address ? `${address.slice(0, 4)}…${address.slice(-4)}` : 'Catalog address not published yet';
}

function gameplayMetadata(item: CatalogItem) {
  const bonus = `+${item.tier * 10}`;
  return [
    { label: 'Speed', value: item.family === 'Shoes' ? bonus : '0' },
    { label: 'Offense', value: item.family === 'Dagger' ? bonus : '0' },
    { label: 'Defense', value: item.family === 'Shield' ? bonus : '0' },
  ];
}

function Artwork({ item, large = false }: { item: CatalogItem; large?: boolean }) {
  const size = large ? 104 : 72;
  const src = artworkFor(item.artwork);
  return <span className={`art ${large ? 'large ' : ''}art-${item.family.toLowerCase()}`} style={{ width: size, height: size, overflow: 'hidden' }}>
    {src ? <img src={src} alt={`${item.name} artwork`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : item.artwork}
  </span>;
}

export function App() {
  const [catalog, setCatalog] = useState<MarketplaceCatalog>(fallbackCatalog);
  const [readable, setReadable] = useState(false);
  const [inventory, setInventory] = useState<ReadonlyMap<string, bigint>>();
  const [selected, setSelected] = useState<CatalogItem>();
  const [owner, setOwner] = useState<'all' | 'game' | 'player'>('all');
  const [game, setGame] = useState<'all' | 'stealth-and-steel'>('all');
  const [type, setType] = useState<'all' | 'speed' | 'offense' | 'defense'>('all');

  useEffect(() => {
    void fetch('/catalog.json', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw Error();
      const next = await response.json() as MarketplaceCatalog;
      if (next.version !== 1 || !Array.isArray(next.items)) throw Error();
      setCatalog(next);
      setReadable(true);
    }).catch(() => setReadable(false));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setInventory(undefined);
    if (!catalog.gameWalletAddress || !catalog.items.every(item => item.assetId)) return () => controller.abort();
    void readPublicInventory(catalog.gameWalletAddress, controller.signal).then(setInventory).catch(() => setInventory(undefined));
    return () => controller.abort();
  }, [catalog]);

  const sourceLabel = !readable ? 'Catalog data unavailable' : catalog.gameWalletAddress ? 'Read-only inventory source' : 'Wallet address not published yet';
  const visibleItems = owner === 'player' ? [] : catalog.items.filter(item =>
    (game === 'all' || catalog.gameId === game)
    && (type === 'all' || gameplayMetadata(item).some(stat => stat.label.toLowerCase() === type && stat.value !== '0')),
  );

  return <>
    <div className="network-banner" role="status"><span className="network-anchor"><span>Network: Signet</span><span className="version-label">BIS: v{version}</span></span></div>
    <main className="marketplace-shell">
      <aside className="marketplace-sidebar">
        <header><h1>Marketplace</h1><p className="lede">Shop before you play.</p></header>
        <section className="wallet-strip" aria-label="Marketplace inventory"><span>Game wallet</span><code title={catalog.gameWalletAddress}>{shortAddress(catalog.gameWalletAddress)}</code><strong>{sourceLabel}</strong></section>
      </aside>
      <section className="collection-panel">
        <div className="catalog-toolbar" aria-label="Catalog filters">
          <div className="filter-row"><span>Owner</span><div role="group" aria-label="Owner"><button aria-pressed={owner === 'all'} onClick={() => setOwner('all')}>All</button><button aria-pressed={owner === 'game'} onClick={() => setOwner('game')}>Game Wallet</button><button aria-pressed={owner === 'player'} onClick={() => setOwner('player')}>Player Wallet</button></div></div>
          <div className="filter-row"><span>Game</span><div role="group" aria-label="Game"><button aria-pressed={game === 'all'} onClick={() => setGame('all')}>All</button><button aria-pressed={game === 'stealth-and-steel'} onClick={() => setGame('stealth-and-steel')}>Stealth &amp; Steel</button></div></div>
          <div className="filter-row"><span>Type</span><div role="group" aria-label="Type"><button aria-pressed={type === 'all'} onClick={() => setType('all')}>All</button><button aria-pressed={type === 'speed'} onClick={() => setType('speed')}>Speed</button><button aria-pressed={type === 'offense'} onClick={() => setType('offense')}>Offense</button><button aria-pressed={type === 'defense'} onClick={() => setType('defense')}>Defense</button></div></div>
        </div>
        <div className="catalog-scroll">{visibleItems.length ? <div className="catalog-grid">{visibleItems.map(item => <button className="asset-card" key={item.id} onClick={() => setSelected(item)}><Artwork item={item} /><span className="family">{item.family} · Tier {item.tier}</span><strong>{item.name}</strong><small>{item.effect}</small><span className="availability">{availability(item, readable, inventory)}</span></button>)}</div> : <p className="empty-state" role="status">{owner === 'player' ? 'No player-owned assets found.' : 'No equipment matches these filters.'}</p>}</div>
      </section>
      {selected && <div className="backdrop" role="presentation" onMouseDown={() => setSelected(undefined)}>
        <article className="detail" role="dialog" aria-modal="true" aria-labelledby="item-title" onMouseDown={event => event.stopPropagation()}>
          <button className="close" onClick={() => setSelected(undefined)} aria-label="Close item detail">×</button>
          <div className="detail-identity"><Artwork item={selected} large /><div><p className="eyebrow">{selected.family} · TIER {selected.tier}</p><h2 id="item-title">{selected.name}</h2><p className="detail-effect">{selected.effect}</p></div></div>
          <section className="asset-data" aria-label="Generic asset data"><p className="data-label">Generic asset</p><dl className="generic-fields"><div className="wide"><dt>Asset ID</dt><dd><code>{selected.assetId ?? 'Awaiting verified issuance'}</code></dd></div><div><dt>Ticker</dt><dd>{selected.ticker ?? 'Not provided'}</dd></div><div><dt>Decimals</dt><dd>0</dd></div><div><dt>Quantity</dt><dd>{selected.quantity ?? 'Not published'}</dd></div></dl></section>
          <section className="asset-data" aria-label="Gameplay metadata"><p className="data-label">Gameplay metadata</p><dl className="gameplay-fields">{gameplayMetadata(selected).map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl></section>
          <footer className="detail-footer"><span className="detail-status">{availability(selected, readable, inventory)}</span><div className="actions"><button disabled>Buy</button><button disabled>Sell</button></div></footer>
        </article>
      </div>}
    </main>
  </>;
}
