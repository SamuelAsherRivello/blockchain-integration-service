import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { BisAsset, BisListAssetsResult, BisMintAssetRequest, BisMintAssetResult } from '@bis/integration';
import { assetBaseUnits } from '../../integration/src/core/assets';
import { AdminPanel } from '../src/admin/AdminPanel';
import { MintAssetDialog } from '../src/admin/MintAssetDialog';
import { achievementPresets } from '../src/admin/achievement-presets';
import '../src/style.css';

// Isolated component fixtures only. This host never creates a BIS context, account,
// SDK wallet, repository, network request, or localStorage write. Console retention
// and scenario transitions below belong to the fixture, not production App.tsx.
const profileId = 'fixture-public-profile';
type MintScenario = 'success' | 'held-pending' | 'outcome-unknown' | 'error' | 'no-account';
type ListScenario = 'holdings' | 'empty' | 'held-pending' | 'error' | 'no-account';
const baseline: BisAsset = {
  assetId: 'a'.repeat(64) + '0000', quantity: '1', ...achievementPresets[0],
};
const pendingRequest: BisMintAssetRequest = {
  operationId: 'fixture-reopened-operation', ...achievementPresets[1],
};
const safeError = (code: 'account-required' | 'unavailable' | 'outcome-unknown') => ({
  status: 'error' as const, code,
  message: code === 'account-required' ? 'An active account is required.'
    : code === 'outcome-unknown' ? 'The mint is unresolved. Retry the same request to reconcile it; no new mint will be submitted.'
    : 'Assets are unavailable. Try again.',
});

function AssetUiHost() {
  const [scenario, setScenario] = useState<MintScenario>('success');
  const [listScenario, setListScenario] = useState<ListScenario>('holdings');
  const [accountOpen, setAccountOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<BisMintAssetRequest>();
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<BisMintAssetRequest[]>([]);
  const [results, setResults] = useState<unknown[]>([]);
  const [listCalls, setListCalls] = useState(0);
  const [lines, setLines] = useState<string[]>([]);
  const [portalTarget, setPortalTarget] = useState<HTMLDialogElement | null>(null);
  const [held, setHeld] = useState(false);
  const release = useRef<(() => void) | undefined>(undefined);
  const unresolved = useRef<BisMintAssetRequest | undefined>(undefined);
  const minted = useRef(new Map<string, BisAsset>());
  const attempts = useRef(new Map<string, number>());
  const log = (label: string, result: unknown) => {
    setResults(previous => [...previous, result]);
    setLines(previous => [...previous, `${label}\n${JSON.stringify(result, null, 2)}`].slice(-100));
  };
  useEffect(() => {
    setPortalTarget(open ? document.querySelector<HTMLDialogElement>('.mint-dialog') : null);
  }, [open]);
  function waitForRelease() {
    setHeld(true);
    return new Promise<void>(resolve => {
      release.current = () => { release.current = undefined; setHeld(false); resolve(); };
    });
  }
  function openMint() { setInitial(unresolved.current); setOpen(true); }
  async function mint(request: BisMintAssetRequest): Promise<BisMintAssetResult> {
    const captured = structuredClone(request);
    setRequests(previous => [...previous, captured]);
    setBusy(true);
    log('Mint Asset', { status: 'pending', profileId, operationId: request.operationId });
    const count = (attempts.current.get(request.operationId) ?? 0) + 1;
    attempts.current.set(request.operationId, count);
    try {
      if (scenario === 'held-pending') await waitForRelease();
      let result: BisMintAssetResult;
      if (scenario === 'no-account') result = safeError('account-required');
      else if (scenario === 'error') result = safeError('unavailable');
      else if (scenario === 'outcome-unknown' && count === 1) {
        unresolved.current = captured;
        result = { ...safeError('outcome-unknown'), profileId, operationId: request.operationId };
      } else {
        const existing = minted.current.get(request.operationId);
        const asset: BisAsset = existing ?? {
          assetId: (minted.current.size + 11).toString(16).padStart(64, '0') + '0000',
          name: request.name, ticker: request.ticker,
          quantity: assetBaseUnits(request.amount, request.decimals).toString(),
          decimals: request.decimals, ...(request.iconUrl ? { iconUrl: request.iconUrl } : {}),
        };
        minted.current.set(request.operationId, asset);
        unresolved.current = undefined;
        result = { status: existing || count > 1 ? 'already-minted' : 'minted', profileId,
          operationId: request.operationId, asset, transactionId: 'b'.repeat(64) };
      }
      log('Mint Asset', result);
      return result;
    } finally { setBusy(false); }
  }
  async function listAssets() {
    setListCalls(previous => previous + 1);
    setBusy(true);
    log('List Assets', { status: 'pending', profileId });
    try {
      if (listScenario === 'held-pending') await waitForRelease();
      const result: BisListAssetsResult = listScenario === 'no-account' ? safeError('account-required')
        : listScenario === 'error' ? safeError('unavailable')
        : { status: 'success', profileId, assets: listScenario === 'empty' ? [] : [baseline, ...minted.current.values()] };
      log('List Assets', result);
    } finally { setBusy(false); }
  }
  function resetFixture() {
    setOpen(false); setInitial(undefined); setLines([]); setResults([]); setRequests([]); setListCalls(0);
    unresolved.current = undefined; minted.current.clear(); attempts.current.clear();
  }
  const releaseButton = <button id="release-pending" type="button" disabled={!held} onClick={() => release.current?.()}>
    Fixture: release held result
  </button>;

  return <div className="demo-app">
    <style>{`
      .fixture-toolbar { padding: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; border-bottom: 1px solid #394657; }
      .fixture-toolbar p { width: 100%; margin: 0; font-size: 13px; }
      .fixture-toolbar label { display: inline-flex; gap: 8px; align-items: center; font-size: 13px; }
      .fixture-toolbar select, .fixture-toolbar button, .fixture-dialog-controls button { font: inherit; color: #eef1f6; background: #222b39; border: 1px solid #637186; padding: 8px; border-radius: 5px; }
      .fixture-toolbar button:disabled, .fixture-dialog-controls button:disabled { opacity: .45; }
      .fixture-workspace { display: grid; grid-template-columns: minmax(300px, 420px) minmax(0, 1fr); }
      .fixture-inspection { padding: 18px; min-width: 0; }
      .fixture-inspection pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
      .fixture-dialog-controls { border-top: 1px dashed #637186; margin-top: 16px; padding-top: 12px; font-size: 12px; }
      @media (max-width: 700px) { .fixture-workspace { grid-template-columns: 1fr; } }
    `}</style>
    <header className="fixture-toolbar" aria-label="Fixture controls">
      <p><strong>Isolated component verification — synthetic public results. No live wallet operations.</strong></p>
      <p>Actual AdminPanel and MintAssetDialog. The fixture owns callbacks and history; this does not verify production App orchestration or a real mint.</p>
      <label>Mint scenario<select id="mint-scenario" value={scenario} disabled={busy || open} onChange={event => setScenario(event.target.value as MintScenario)}>
        <option value="success">Success</option><option value="held-pending">Held pending, release to success</option>
        <option value="outcome-unknown">Outcome unknown, same-request retry succeeds</option>
        <option value="error">Safe error</option><option value="no-account">No account</option>
      </select></label>
      <label>List scenario<select id="list-scenario" value={listScenario} disabled={busy || open} onChange={event => setListScenario(event.target.value as ListScenario)}>
        <option value="holdings">Holdings</option><option value="empty">Empty list</option>
        <option value="held-pending">Held pending, release to holdings</option><option value="error">Safe error</option>
        <option value="no-account">No account</option>
      </select></label>
      <label><input id="account-flow-open" type="checkbox" checked={accountOpen} disabled={busy || open} onChange={event => setAccountOpen(event.target.checked)} />Account flow open</label>
      <button id="open-mint" type="button" disabled={busy || open || accountOpen} onClick={openMint}>Fixture: open mint</button>
      <button id="reopen-pending" type="button" disabled={busy || open || accountOpen} onClick={() => {
        unresolved.current = { ...pendingRequest }; setInitial(unresolved.current); setOpen(true);
      }}>Fixture: reopen saved unresolved mint</button>
      <button id="reset-fixture" type="button" disabled={busy || open} onClick={resetFixture}>Reset fixture</button>
      {!open && releaseButton}
    </header>
    <main className="fixture-workspace">
      <AdminPanel selected={null} accountOpen={accountOpen} canReset={!busy} onSelect={() => setAccountOpen(true)}
        onReset={resetFixture} canFund={false} funding={false} onFund={() => {}} onExplorer={() => {}}
        onMint={openMint} onListAssets={() => void listAssets()} assetBusy={busy} consoleOutput={lines.join('\n\n')} />
      <section className="fixture-inspection" aria-label="Fixture observations">
        <h2>Public callback observations</h2>
        <p id="fixture-counts" role="status">Mint calls: {requests.length}; list calls: {listCalls}; held: {String(held)}; synthetic issuances: {minted.current.size}</p>
        <p>Close an unresolved dialog and use C1 Mint Asset again to reopen its exact request. Use Escape and Tab directly to inspect native focus behavior.</p>
        <h3>Mint requests</h3><pre id="mint-requests">{JSON.stringify(requests, null, 2)}</pre>
        <h3>Public results</h3><pre id="public-results">{JSON.stringify(results, null, 2)}</pre>
      </section>
    </main>
    {open && <MintAssetDialog initial={initial} onMint={mint} onClose={() => setOpen(false)} />}
    {open && portalTarget && createPortal(<div className="fixture-dialog-controls" aria-label="Fixture-only pending controls">
      <p>Fixture only: this control resolves the fake callback without changing production dialog behavior.</p>{releaseButton}
    </div>, portalTarget)}
  </div>;
}

createRoot(document.getElementById('root')!).render(<AssetUiHost />);
