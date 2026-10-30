import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { observeWalletEvents, type MonitorStatus, type WalletActivity } from './wallet-events.ts';
import { presentActivity } from './events-presentation.ts';
import { NETWORKS, isNetwork } from '../../../prototype-faucet/src/shared/network-config.ts';
import './events-monitor.css';

function EventsMonitor() {
  const [network] = useState(() => new URLSearchParams(location.search).get('network') ?? '');
  const [status, setStatus] = useState<MonitorStatus>('Connecting ...');
  const [activity, setActivity] = useState<WalletActivity | undefined>();
  const [flipped, setFlipped] = useState(false);
  const [dots, setDots] = useState(1);
  const [history, setHistory] = useState(() => [{ id: 0, at: Date.now(), message: 'Connecting' }]);
  const sequence = useRef(1);
  const lastStatus = useRef<MonitorStatus>('Connecting ...');
  const log = useRef<HTMLOListElement>(null);
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    let stop = () => {};
    function append(message: string) {
      const entry = { id: sequence.current++, at: Date.now(), message };
      setHistory(current => [...current, entry]);
    }
    function updateStatus(next: MonitorStatus) {
      setStatus(next);
      if (lastStatus.current === next) return;
      lastStatus.current = next;
      append(next === "I'm listening ..." ? 'Connected' : next.replace(/\s*(\.\s*)+$/, ''));
    }
    function demoResultLog(foo: WalletActivity) {
      append(foo.message);
      setActivity(foo);
    }
    try {
      stop = observeWalletEvents({ network: query.get('network') ?? '', address: query.get('address') ?? '', onStatus: updateStatus, onActivity(foo) { demoResultLog(foo); } });
    } catch { updateStatus('Listener unavailable'); }
    window.addEventListener('pagehide', stop, { once: true });
    return () => { window.removeEventListener('pagehide', stop); stop(); };
  }, []);
  useEffect(() => {
    if (!activity || !card.current) return;
    return presentActivity(card.current, () => setActivity(undefined), matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [activity]);
  useEffect(() => {
    if (flipped || activity) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      clearInterval(timer);
      if (!document.hidden) timer = setInterval(() => setDots(value => value % 3 + 1), 1000);
    };
    setDots(1); sync();
    document.addEventListener('visibilitychange', sync);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', sync); };
  }, [flipped, activity, status]);
  useEffect(() => {
    if (flipped && log.current) log.current.scrollTop = 0;
  }, [flipped]);
  const networkLabel = isNetwork(network) ? NETWORKS[network].label : 'Unknown network';
  const waiting = status.endsWith('...');
  return <section ref={card} className={`wallet-events-card${flipped ? ' is-flipped' : ''}`} role="button" tabIndex={0}
    aria-label={flipped ? 'Return to Wallet 1 monitor' : 'Show Wallet 1 event log'} aria-pressed={flipped}
    onClick={() => setFlipped(value => !value)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setFlipped(value => !value); } }}
    data-status={status} data-event={activity?.id ?? ''}>
    <div className="wallet-events-turn">
      <div className="wallet-events-face wallet-events-front" aria-hidden={flipped} inert={flipped}>
        <h1>Wallet 1</h1>
        <p className="wallet-events-network">({networkLabel})</p>
        <p role="status" aria-live="polite" aria-label={activity?.message ?? status}>
          {activity?.message ?? <>{waiting ? status.replace(/\s*(\.\s*)+$/, '') : status}{waiting && <span className="wallet-events-dots" aria-hidden="true">{' ' + '.'.repeat(dots)}</span>}</>}
        </p>
      </div>
      <div className="wallet-events-face wallet-events-back" aria-hidden={!flipped} inert={!flipped}>
        <h2>Wallet 1</h2>
        <p className="wallet-events-network">({networkLabel})</p>
        <ol ref={log} className="wallet-events-log" aria-label="Connection and event history" tabIndex={flipped ? 0 : -1}>
          {history.map(entry => <li key={entry.id}><time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}</time><span>{entry.message}</span></li>)}
        </ol>
      </div>
    </div>
  </section>;
}

createRoot(document.getElementById('root')!).render(<EventsMonitor />);
