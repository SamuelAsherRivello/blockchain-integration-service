import { useEffect, useMemo, useRef, useState } from 'react';
import { isValidArkAddress } from '@arkade-os/sdk';
import { ALLOWED_AMOUNTS } from '../shared/faucet-core.mjs';
import { NETWORKS, NETWORK_IDS } from '../shared/network-config.mjs';

function apiUrl(path) {
  return `${import.meta.env.BASE_URL ?? '/'}api/faucet/${path}`.replace(/([^:]\/)\/+/, '$1');
}

export function App({ request = defaultRequest } = {}) {
  const [network, setNetwork] = useState('signet');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState(ALLOWED_AMOUNTS[0]);
  const [state, setState] = useState({ status: 'idle', message: 'Enter a fresh Arkade address to begin.' });
  const requestController = useRef();
  const validFormat = useMemo(() => isValidArkAddress(address.trim()), [address]);
  const busy = state.status === 'submitting';
  useEffect(() => () => requestController.current?.abort(), []);
  async function submit(event) {
    event.preventDefault();
    if (!validFormat || busy) return;
    setState({ status: 'submitting', message: 'Submitting a funding request…' });
    const controller = new AbortController();
    requestController.current = controller;
    try {
      const result = await request({ network, address: address.trim(), amount, idempotencyKey: crypto.randomUUID(), signal: controller.signal });
      setState({ ...result, message: result.status === 'success' ? 'Delivery verified.' : 'Request accepted; delivery is still pending verification.' });
    } catch (error) { if (error?.name !== 'AbortError') setState({ status: 'error', message: error?.message ?? 'The faucet is unavailable.' }); }
    finally { if (requestController.current === controller) requestController.current = undefined; }
  }
  return <div className="faucet-shell">
    <header className="spike-header"><div className="spike-identity"><span className="spike-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><h1>Prototype Faucet</h1><p>Standalone Signet Spike</p></div></div><span className="spike-network">{NETWORKS[network].label}</span></header>
    <main className="faucet-main"><section className="faucet-flow" aria-labelledby="faucet-title"><h2 id="faucet-title" className="workspace-title">Request test sats</h2><p className="intro">Fund an Arkade wallet with a bounded amount of test sats without visiting a third-party faucet.</p>
      <section className="panel faucet-panel"><div className="panel-heading"><div><span className="panel-kicker">FAUCET REQUEST</span><h3>Choose destination and amount</h3></div><span className="prototype-badge">Experimental</span></div><div className="notice" role="note">Arkade only. This prototype does not fund ordinary on-chain Bitcoin and never asks for recovery material.</div>
        <form onSubmit={submit}>
          <label>Network<select value={network} onChange={event => { setNetwork(event.target.value); setState({ status: 'idle', message: 'Enter a fresh address for the selected network.' }); }} disabled={busy}>{NETWORK_IDS.map(id => <option key={id} value={id}>{NETWORKS[id].label}</option>)}</select></label>
          <label>Arkade address<input aria-describedby="address-help" value={address} onChange={event => setAddress(event.target.value)} placeholder="tark1…" spellCheck="false" autoComplete="off" disabled={busy} /></label>
          <p id="address-help" className={address && !validFormat ? 'field-error' : 'field-help'}>{address && !validFormat ? 'Enter a valid test-network Arkade address.' : 'The server verifies that this address belongs to the selected operator.'}</p>
          <fieldset><legend>Amount</legend><div className="amount-grid">{ALLOWED_AMOUNTS.map(value => <label key={value} className="amount-choice"><input type="radio" name="amount" value={value} checked={amount === value} onChange={() => setAmount(value)} disabled={busy} /><span>{value.toLocaleString()} sats</span></label>)}</div></fieldset>
          <button className="primary" type="submit" disabled={!validFormat || busy}>{busy ? 'Requesting…' : 'Request Arkade sats'}</button>
        </form>
      </section>
      <section className={`panel status status-${state.status}`} aria-live="polite"><div className="status-heading"><span className="panel-kicker">REQUEST STATUS</span><strong>{state.status === 'success' ? 'Success' : state.status === 'pending' ? 'Pending' : state.status === 'error' ? 'Unavailable' : 'Ready'}</strong></div><p>{state.message}</p>{state.network && <p>Requested {Number(state.amountSats).toLocaleString()} sats on {NETWORKS[state.network]?.label ?? state.network}.</p>}{state.address && <p className="operation-id">Destination: {state.address}</p>}{state.operationId && <p className="operation-id">Operation: {state.operationId}</p>}</section>
    </section></main><footer><span>Prototype only · Network: {NETWORKS[network].label} · No monetary value</span></footer>
  </div>;
}

async function defaultRequest({ signal, ...input }) {
  const response = await fetch(apiUrl('request'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? 'The faucet is unavailable.');
  return body;
}
