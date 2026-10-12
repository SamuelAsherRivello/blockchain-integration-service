import { useEffect, useMemo, useRef, useState } from 'react';
import { isValidArkAddress } from '@arkade-os/sdk';
import { ALLOWED_AMOUNTS } from '../shared/faucet-core.ts';
import { NETWORKS, NETWORK_IDS } from '../shared/network-config.ts';
import { addressSubmissionUrl, clearAddressUrl, selectedNetwork } from './navigation.ts';
import { PrototypeSection, PrototypeTitle } from '../../../prototype-onboarding/src/client/ui-layer-react/prototype-ui.tsx';
import '../../../prototype-onboarding/src/client/ui-layer-react/prototype-styles.css';

function apiUrl(path) {
  return `${import.meta.env.BASE_URL ?? '/'}api/faucet/${path}`.replace(/([^:]\/)\/+/, '$1');
}

function shortAddress(value) {
  const text = String(value ?? '');
  return text.length > 20 ? `${text.slice(0, 9)}…${text.slice(-8)}` : text;
}

function shortIdentifier(value) {
  const text = String(value ?? '');
  return text.length > 24 ? `${text.slice(0, 10)}…${text.slice(-10)}` : text;
}

function publicHistoryRows(history) {
  return (Array.isArray(history) ? history : []).slice(0, 4).map((entry, index) => {
    const key = entry?.key ?? {};
    return {
      id: `${entry?.type ?? 'transaction'}-${key.arkTxid ?? key.commitmentTxid ?? key.boardingTxid ?? index}`,
      type: String(entry?.type ?? 'TRANSACTION'),
      amount: Number(entry?.amount ?? 0),
      settled: entry?.settled === true,
      arkTxid: key.arkTxid,
      commitmentTxid: key.commitmentTxid,
      boardingTxid: key.boardingTxid,
    };
  });
}

export function App({ request = defaultRequest } = {}) {
  const [network, setNetwork] = useState(() => selectedNetwork(window.location.search));
  const [address, setAddress] = useState(() => new URLSearchParams(window.location.search).get('address') ?? '');
  const [amount, setAmount] = useState(String(ALLOWED_AMOUNTS[0]));
  const [state, setState] = useState({ status: 'checking', message: 'Checking faucet availability…' });
  const [balance, setBalance] = useState({ status: 'loading', message: 'Checking faucet balance…' });
  const [addresses, setAddresses] = useState({ status: 'loading', message: 'Loading ...' });
  const [copiedAddress, setCopiedAddress] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const requestController = useRef();
  const validFormat = useMemo(() => isValidArkAddress(address.trim()), [address]);
  const amountValue = useMemo(() => Number(amount.trim()), [amount]);
  const validAmount = useMemo(() => /^\d+$/.test(amount.trim()) && ALLOWED_AMOUNTS.includes(amountValue), [amount, amountValue]);
  const busy = ['submitting', 'onboarding'].includes(state.status);
  const ready = validFormat && validAmount && balance.status === 'ready' && balance.available >= amountValue;
  const needsOnboarding = balance.status === 'ready' && Number(balance.total ?? 0) > Number(balance.available ?? 0);
  const historyRows = publicHistoryRows(balance.history);
  function changeNetwork(nextNetwork) {
    if (nextNetwork === network) return;
    if (!window.confirm('This will reset all data on the page')) return;
    setNetwork(nextNetwork);
    setAddress('');
    setAmount(String(ALLOWED_AMOUNTS[0]));
    setState({ status: 'checking', message: 'Checking faucet availability…' });
    setCopiedAddress('');
    setRefreshKey(value => value + 1);
  }
  useEffect(() => {
    const controller = new AbortController();
    setBalance({ status: 'loading', message: 'Checking faucet balance…' });
    fetch(apiUrl(`balance?network=${encodeURIComponent(network)}`), { signal: controller.signal })
      .then(async response => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? 'The faucet balance is unavailable.'); return body; })
      .then(result => {
        setBalance({ status: 'ready', ...result });
        const onboarding = result.onboarding;
        if (onboarding?.status === 'pending') setState({ status: 'pending', message: 'Onboarding is still being reconciled.', operationId: onboarding.id });
        else if (onboarding?.status === 'failed' && onboarding.failureMessage) setState({ status: 'error', message: onboarding.failureMessage, operationId: onboarding.id });
      })
      .catch(error => { if (error?.name !== 'AbortError') setBalance({ status: 'error', message: error?.message ?? 'The faucet balance is unavailable.' }); });
    return () => controller.abort();
  }, [network, refreshKey]);
  useEffect(() => {
    // Keep the overview control concise: the selected network is enough context for this readout.
    const readout = document.querySelector('.network-readout');
    if (readout) readout.textContent = NETWORKS[network].label;
  }, [network]);
  useEffect(() => {
    const controller = new AbortController();
    setAddresses({ status: 'loading', message: 'Loading ...' });
    setCopiedAddress('');
    fetch(apiUrl(`addresses?network=${encodeURIComponent(network)}`), { signal: controller.signal })
      .then(async response => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? 'The faucet addresses are unavailable.'); return body; })
      .then(result => setAddresses({ status: 'ready', ...result }))
      .catch(error => { if (error?.name !== 'AbortError') setAddresses({ status: 'error', message: error?.message ?? 'The faucet addresses are unavailable.' }); });
    return () => controller.abort();
  }, [network, refreshKey]);
  useEffect(() => () => requestController.current?.abort(), []);
  async function submit(event) {
    event.preventDefault();
    if (!ready || busy) return;
    setState({ status: 'submitting', message: 'Submitting a funding request…' });
    const controller = new AbortController();
    requestController.current = controller;
    try {
      const result = await request({ network, address: address.trim(), amount: amountValue, idempotencyKey: crypto.randomUUID(), signal: controller.signal });
      setState({ ...result, message: result.status === 'success' ? 'Delivery verified.' : 'Request accepted; delivery is still pending verification.' });
    } catch (error) { if (error?.name !== 'AbortError') setState({ status: 'error', message: error?.message ?? 'The faucet is unavailable.' }); }
    finally { if (requestController.current === controller) requestController.current = undefined; }
  }
  const statusKind = ['submitting', 'onboarding', 'success', 'pending', 'error'].includes(state.status) ? state.status : ready ? 'ready' : balance.status === 'loading' ? 'checking' : 'not-ready';
  const statusLabel = statusKind === 'success' ? 'Success' : statusKind === 'pending' ? 'Pending' : statusKind === 'error' ? 'Unavailable' : statusKind === 'submitting' ? 'Submitting' : statusKind === 'onboarding' ? 'Onboarding' : statusKind === 'checking' ? 'Checking' : statusKind === 'ready' ? 'Ready' : 'Not ready';
  const statusMessage = ['submitting', 'onboarding', 'success', 'pending', 'error'].includes(state.status) ? state.message : balance.status === 'error' ? balance.message : ready ? 'The faucet is configured and has enough balance for this request.' : !validFormat ? 'Enter a valid Arkade destination address.' : !validAmount ? 'Choose one of the available amounts.' : balance.status === 'loading' ? 'Checking faucet availability…' : 'The faucet does not have enough available balance for this request.';
  async function copyAddress(kind, value) {
    try { await navigator.clipboard.writeText(value); setCopiedAddress(kind); window.setTimeout(() => setCopiedAddress(current => current === kind ? '' : current), 1400); }
    catch { setCopiedAddress(''); }
  }
  function refreshFaucet() {
    setState({ status: 'checking', message: 'Checking faucet availability…' });
    setRefreshKey(value => value + 1);
  }
  function submitAddress() {
    if (!validFormat) return;
    window.location.href = addressSubmissionUrl(window.location.href, address, network);
  }
  function clearAddress() {
    window.location.href = clearAddressUrl(window.location.href, network);
  }
  async function onboardFaucet() {
    if (busy || !needsOnboarding) return;
    setState({ status: 'onboarding', message: 'Onboarding Bitcoin funds into Arkade…' });
    try {
      const response = await fetch(apiUrl('onboard'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ network }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'Arkade onboarding is unavailable.');
      setState({ status: 'success', message: 'Bitcoin funds were onboarded into Arkade.' });
      setRefreshKey(value => value + 1);
    } catch (error) {
      setState({ status: 'error', message: error?.message ?? 'Arkade onboarding is unavailable.' });
    }
  }
  return <div className="prototype-page faucet-shell">
    <header className="spike-header"><div className="spike-identity"><span className="spike-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span><h1>BIS - Prototype Faucet</h1></div><label className="network-picker" htmlFor="network"><span>Network</span><select id="network" value={network} onChange={event => changeNetwork(event.target.value)} disabled={busy}>{NETWORK_IDS.map(id => <option key={id} value={id}>{NETWORKS[id].label}</option>)}</select></label></header>
    <PrototypeSection number="F1" title="Input" className="address-entry" aria-label="Arkade address entry">
      <div className="address-entry-row"><label htmlFor="address-entry-input">Arkade address</label><input id="address-entry-input" value={address} onChange={event => setAddress(event.target.value)} placeholder="tark1…" spellCheck="false" autoComplete="off" disabled={busy} /><button type="button" onClick={submitAddress} disabled={busy || !validFormat}>Submit</button><button className="clear-address" type="button" onClick={clearAddress} disabled={busy || !address}>Clear</button></div>
    </PrototypeSection>
    <main className="faucet-main"><section className="runbook-intro"><div><h2>Faucet runbook</h2><p>Check the selected test-network operator, submit one allowed request, then inspect public delivery evidence.</p></div><div className="runbook-state"><span>Workflow</span><strong>Health → request → evidence</strong><small>Developer tool · no monetary value</small></div></section><section className="faucet-flow">
      <section className="panel faucet-overview prototype-section" aria-label="Faucet overview">
        <PrototypeTitle number="F2" title="Faucet overview" />
        <div className="overview-controls"><section className={`overview-status status status-${statusKind}`} aria-live="polite"><div className="status-heading"><span className="panel-kicker">STATUS</span><strong>Status: {statusLabel}</strong></div><p>{statusMessage}</p>{state.network && <p>Requested {Number(state.amountSats).toLocaleString()} sats on {NETWORKS[state.network]?.label ?? state.network}.</p>}{state.address && <p className="operation-id">Destination: {state.address}</p>}{state.operationId && <p className="operation-id">Operation: {state.operationId}</p>}{state.transactionId && <p className="operation-id">Transaction: {state.transactionId}</p>}</section><button type="button" onClick={refreshFaucet} disabled={busy}>Refresh</button></div>
        <details className="overview-details-foldout"><summary aria-label="Show faucet details"></summary><div className="overview-details"><section className="overview-addresses" aria-label="Faucet addresses"><div className="status-heading"><span className="panel-kicker">FAUCET ADDRESSES</span><span className="address-network">{NETWORKS[network].label}</span></div>{addresses.status === 'ready' ? <><div className="faucet-address-row"><span className="faucet-address-label">BTC</span><code className="faucet-address-value" title={addresses.bitcoinAddress}>{shortAddress(addresses.bitcoinAddress)}</code><button className="copy-button" type="button" onClick={() => copyAddress('bitcoin', addresses.bitcoinAddress)}>{copiedAddress === 'bitcoin' ? 'Copied' : 'Copy'}</button></div><div className="faucet-address-row"><span className="faucet-address-label">ARKADE</span><code className="faucet-address-value" title={addresses.arkadeAddress}>{shortAddress(addresses.arkadeAddress)}</code><button className="copy-button" type="button" onClick={() => copyAddress('arkade', addresses.arkadeAddress)}>{copiedAddress === 'arkade' ? 'Copied' : 'Copy'}</button></div></> : <p className="address-message">{addresses.status === 'loading' ? 'Loading ...' : addresses.message}</p>}</section>
        <section className={`overview-balance faucet-balance-${balance.status}`} aria-live="polite"><div className="status-heading"><span className="panel-kicker">FAUCET BALANCE</span><strong>{balance.status === 'ready' ? `${Number(balance.available ?? 0).toLocaleString()} sats available` : balance.status === 'loading' ? 'Checking…' : 'Unavailable'}</strong></div>{balance.status === 'ready' ? <><p>Total: {Number(balance.total ?? 0).toLocaleString()} sats · Available: {Number(balance.available ?? 0).toLocaleString()} sats</p>{needsOnboarding && <button type="button" onClick={onboardFaucet} disabled={busy}>{state.status === 'onboarding' ? 'Onboarding…' : 'Onboard BTC to Arkade'}</button>}<section className="faucet-history" aria-label="Recent transaction evidence"><div className="panel-kicker">RECENT TRANSACTION EVIDENCE</div>{historyRows.length ? historyRows.map(row => <div className="faucet-history-row" key={row.id}><div><strong>{row.type}</strong><span>{row.amount.toLocaleString()} sats{row.settled ? ' · settled' : ' · pending'}</span></div><div className="faucet-history-identifiers">{row.arkTxid && <span>Arkade <code title={row.arkTxid}>{shortIdentifier(row.arkTxid)}</code></span>}{row.commitmentTxid && <span>Commitment <code title={row.commitmentTxid}>{shortIdentifier(row.commitmentTxid)}</code></span>}{row.boardingTxid && <span>Boarding <code title={row.boardingTxid}>{shortIdentifier(row.boardingTxid)}</code></span>}</div></div>) : <p>No public transaction evidence yet.</p>}</section></> : <p>{balance.message}</p>}</section></div>
        </details>
      </section>
      <PrototypeSection number="F3" title="Choose destination and amount" className="faucet-panel">
        <form onSubmit={submit}>
          <label>Amount in sats<input aria-describedby="amount-help" inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value)} placeholder="50000" spellCheck="false" autoComplete="off" disabled={busy} /></label>
          <p id="amount-help" className={amount && !validAmount ? 'field-error' : 'field-help'}>{amount && !validAmount ? `Choose ${ALLOWED_AMOUNTS.map(value => value.toLocaleString()).join(', ')} sats.` : 'Enter one of the available amounts or use a preset below.'}</p>
          <fieldset><legend>Presets</legend><div className="amount-grid">{ALLOWED_AMOUNTS.map(value => <button key={value} className={`amount-choice${amountValue === value ? ' selected' : ''}`} type="button" aria-pressed={amountValue === value} onClick={() => setAmount(String(value))} disabled={busy}>{value.toLocaleString()} sats</button>)}</div></fieldset>
          <button className="primary" type="submit" disabled={!ready || busy}>{busy ? 'Requesting…' : 'Request Arkade sats'}</button>
        </form>
      </PrototypeSection>
    </section></main>
    <PrototypeSection title="Style Guide" className="style-guide" aria-label="Style Guide">
      <div className="style-guide-grid">
        <div><span className="style-guide-label">Font 1 · 23px</span><strong>Runbook heading</strong></div>
        <div><span className="style-guide-label">Font 1 · 17px</span><strong>Panel heading</strong></div>
        <div><span className="style-guide-label">Font 1 · 13px</span><span>Supporting copy</span></div>
        <div><span className="style-guide-label">Font 1 · 12px</span><span>Labels and controls</span></div>
        <div><span className="style-guide-label">Font 1 · 11px</span><span>Metadata and help</span></div>
        <div><span className="style-guide-label">Font 2 · 9px</span><span className="panel-kicker">KICKER / CAPS</span></div>
        <div><span className="style-guide-label">Color 1 · #10151b</span><span className="swatch swatch-page">Page background</span></div>
        <div><span className="style-guide-label">Color 2 · #171e28</span><span className="swatch swatch-panel">Panel background</span></div>
        <div><span className="style-guide-label">Color 3 · #eef1f6</span><span className="swatch swatch-primary">Primary text</span></div>
        <div><span className="style-guide-label">Color 4 · #a9d9c3</span><span className="swatch swatch-accent">Accent / action</span></div>
        <div><span className="style-guide-label">Color 5 · #303c4c</span><span className="swatch swatch-border">Panel border</span></div>
        <div><span className="style-guide-label">Shape · 12px</span><span>Rounded panels</span></div>
      </div>
    </PrototypeSection>
  </div>;
}

async function defaultRequest({ signal, ...input }) {
  const response = await fetch(apiUrl('request'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? 'The faucet is unavailable.');
  return body;
}

