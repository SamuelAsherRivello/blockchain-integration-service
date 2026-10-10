import { useEffect, useMemo, useRef, useState } from 'react';
import { isValidArkAddress } from '@arkade-os/sdk';
import { ALLOWED_AMOUNTS } from '../shared/faucet-core.mjs';
import { NETWORKS, NETWORK_IDS } from '../shared/network-config.mjs';

function apiUrl(path) {
  return `${import.meta.env.BASE_URL ?? '/'}api/faucet/${path}`.replace(/([^:]\/)\/+/, '$1');
}

function shortAddress(value) {
  const text = String(value ?? '');
  return text.length > 20 ? `${text.slice(0, 9)}…${text.slice(-8)}` : text;
}

export function App({ request = defaultRequest } = {}) {
  const [network, setNetwork] = useState('mutinynet');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState(String(ALLOWED_AMOUNTS[0]));
  const [state, setState] = useState({ status: 'checking', message: 'Checking faucet availability…' });
  const [balance, setBalance] = useState({ status: 'loading', message: 'Checking faucet balance…' });
  const [addresses, setAddresses] = useState({ status: 'loading', message: 'Loading faucet addresses…' });
  const [copiedAddress, setCopiedAddress] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const requestController = useRef();
  const validFormat = useMemo(() => isValidArkAddress(address.trim()), [address]);
  const amountValue = useMemo(() => Number(amount.trim()), [amount]);
  const validAmount = useMemo(() => /^\d+$/.test(amount.trim()) && ALLOWED_AMOUNTS.includes(amountValue), [amount, amountValue]);
  const busy = ['submitting', 'onboarding'].includes(state.status);
  const ready = validFormat && validAmount && balance.status === 'ready' && balance.available >= amountValue;
  const needsOnboarding = balance.status === 'ready' && Number(balance.total ?? 0) > Number(balance.available ?? 0);
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
    const controller = new AbortController();
    setAddresses({ status: 'loading', message: 'Loading faucet addresses…' });
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
  return <div className="faucet-shell">
    <header className="spike-header"><div className="spike-identity"><span className="spike-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><h1>BIS - Prototype Faucet</h1></div></div></header>
    <main className="faucet-main"><section className="faucet-flow">
      <section className="panel faucet-overview" aria-label="Faucet overview">
        <div className="overview-controls"><label>Network<select value={network} onChange={event => { setNetwork(event.target.value); setState({ status: 'checking', message: 'Checking faucet availability…' }); }} disabled={busy}>{NETWORK_IDS.map(id => <option key={id} value={id}>{NETWORKS[id].label}</option>)}</select></label><button type="button" onClick={refreshFaucet} disabled={busy}>Refresh</button></div>
        <section className={`overview-status status status-${statusKind}`} aria-live="polite"><div className="status-heading"><span className="panel-kicker">STATUS</span><strong>Status: {statusLabel}</strong></div><p>{statusMessage}</p>{state.network && <p>Requested {Number(state.amountSats).toLocaleString()} sats on {NETWORKS[state.network]?.label ?? state.network}.</p>}{state.address && <p className="operation-id">Destination: {state.address}</p>}{state.operationId && <p className="operation-id">Operation: {state.operationId}</p>}</section>
        <div className="overview-details"><section className="overview-addresses" aria-label="Faucet addresses"><div className="status-heading"><span className="panel-kicker">FAUCET ADDRESSES</span><span className="address-network">{NETWORKS[network].label}</span></div>{addresses.status === 'ready' ? <><div className="faucet-address-row"><span className="faucet-address-label">BTC</span><code className="faucet-address-value" title={addresses.bitcoinAddress}>{shortAddress(addresses.bitcoinAddress)}</code><button className="copy-button" type="button" onClick={() => copyAddress('bitcoin', addresses.bitcoinAddress)}>{copiedAddress === 'bitcoin' ? 'Copied' : 'Copy'}</button></div><div className="faucet-address-row"><span className="faucet-address-label">ARKADE</span><code className="faucet-address-value" title={addresses.arkadeAddress}>{shortAddress(addresses.arkadeAddress)}</code><button className="copy-button" type="button" onClick={() => copyAddress('arkade', addresses.arkadeAddress)}>{copiedAddress === 'arkade' ? 'Copied' : 'Copy'}</button></div></> : <p className="address-message">{addresses.status === 'loading' ? 'Loading…' : addresses.message}</p>}</section>
        <section className={`overview-balance faucet-balance-${balance.status}`} aria-live="polite"><div className="status-heading"><span className="panel-kicker">FAUCET BALANCE</span><strong>{balance.status === 'ready' ? `${Number(balance.available ?? 0).toLocaleString()} sats available` : balance.status === 'loading' ? 'Checking…' : 'Unavailable'}</strong></div>{balance.status === 'ready' ? <><p>Total: {Number(balance.total ?? 0).toLocaleString()} sats · Available: {Number(balance.available ?? 0).toLocaleString()} sats</p>{needsOnboarding && <button type="button" onClick={onboardFaucet} disabled={busy}>{state.status === 'onboarding' ? 'Onboarding…' : 'Onboard BTC to Arkade'}</button>}</> : <p>{balance.message}</p>}</section></div>
      </section>
      <section className="panel faucet-panel"><div className="panel-heading"><div><span className="panel-kicker">FAUCET REQUEST</span><h3>Choose destination and amount</h3></div><span className="prototype-badge">Experimental</span></div>
        <form onSubmit={submit}>
          <label>Arkade address<input aria-describedby="address-help" value={address} onChange={event => setAddress(event.target.value)} placeholder="tark1…" spellCheck="false" autoComplete="off" disabled={busy} /></label>
          <p id="address-help" className={address && !validFormat ? 'field-error' : 'field-help'}>{address && !validFormat ? 'Enter a valid test-network Arkade address.' : 'The server verifies that this address belongs to the selected operator.'}</p>
          <label>Amount in sats<input aria-describedby="amount-help" inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value)} placeholder="50000" spellCheck="false" autoComplete="off" disabled={busy} /></label>
          <p id="amount-help" className={amount && !validAmount ? 'field-error' : 'field-help'}>{amount && !validAmount ? `Choose ${ALLOWED_AMOUNTS.map(value => value.toLocaleString()).join(', ')} sats.` : 'Enter one of the available amounts or use a preset below.'}</p>
          <fieldset><legend>Presets</legend><div className="amount-grid">{ALLOWED_AMOUNTS.map(value => <button key={value} className={`amount-choice${amountValue === value ? ' selected' : ''}`} type="button" aria-pressed={amountValue === value} onClick={() => setAmount(String(value))} disabled={busy}>{value.toLocaleString()} sats</button>)}</div></fieldset>
          <button className="primary" type="submit" disabled={!ready || busy}>{busy ? 'Requesting…' : 'Request Arkade sats'}</button>
        </form>
      </section>
    </section></main><footer><span>Prototype only · No monetary value</span></footer>
  </div>;
}

async function defaultRequest({ signal, ...input }) {
  const response = await fetch(apiUrl('request'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? 'The faucet is unavailable.');
  return body;
}
