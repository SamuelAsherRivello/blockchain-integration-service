import { demoVaultErrorMessage as vaultErrorMessage } from './vault-demo-runtime.ts';
import { demoDefinition } from './demo-registry.ts';
import { useExecutableDemo } from './use-executable-demo.ts';
import { OPTIONAL_ASSET_PAYMENTS, optionalAssetPayment } from './asset-payment.ts';
import { getWallet2BitcoinAddress } from './demo-bitcoin-address.ts';
import { Children, Fragment, createContext, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react';
import { MnemonicIdentity } from '@arkade-os/sdk';
// The self-contained ESM distribution also bundles Mermaid's CommonJS helpers.
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs';
import { NETWORKS, NETWORK_IDS } from '../../../prototype-faucet/src/shared/network-config.ts';
import { DEMOS, HOME_PATH, LANDING_VISITED_STORAGE_KEY, NETWORK_STORAGE_KEY, SETUP_PATH, faucetUrl, getActiveDemo, isHomePath, isSetupPath, demoGetInput, demoSetInput, setupNetworkValue, setupWalletProfileValues as demoGetWalletProfile, walletUrl } from './navigation.ts';
import { conditionalVaultArtifact, readStoredConditionalVault as demoReadConditionalVaultDescriptor } from './conditional-vault.ts';
import { demoSourceUrl } from './source-links.ts';
import CONDITIONAL_VAULT_LANGUAGE_SOURCE from '../../../integration/src/client/wallet-layer-arkade/conditional-vault-program.ts?raw';
import { DemoOutputScope, useDemoOutput } from './demo-output.ts';
import { demoExplorerUrl, demoSupportsExplorer } from './demo-explorer.ts';
import './style.css';
import '../../../prototype-onboarding/src/client/ui-layer-react/prototype-styles.css';

const DemoNetworkContext = createContext('signet');

function DemoActionButton({ label = 'Execute', onClick, disabled }) {
  const network = useContext(DemoNetworkContext);
  const networkId = useId();
  return <button className="sandbox-action-button sandbox-execute-button" type="button" onClick={onClick} disabled={disabled} aria-label={label} aria-describedby={networkId}>
    <span className="sandbox-execute-label">{label}</span>
    <span id={networkId} className="sandbox-execute-network">({NETWORKS[network].label})</span>
  </button>;
}

function PrototypeMark() {
  return <span className="spike-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
}

function maskMnemonic(value) {
  if (!value || value.length < 3) return value;
  return `${value[0]}${'*'.repeat(value.length - 2)}${value[value.length - 1]}`;
}

const DOCS_URLS = Object.freeze({
  main: 'https://docs.arkadeos.com/',
  wallet: 'https://docs.arkadeos.com/wallets/getting-started/create-your-wallet',
  balance: 'https://docs.arkadeos.com/wallets/operations/checking-balances',
  sendPayment: 'https://docs.arkadeos.com/wallets/operations/sending-payments',
  receivePayment: 'https://docs.arkadeos.com/wallets/operations/receiving-payments',
  paymentHistory: 'https://docs.arkadeos.com/wallets/operations/payment-history',
  ramps: 'https://docs.arkadeos.com/wallets/advanced/ramps',
  mintAsset: 'https://docs.arkadeos.com/wallets/operations/assets/issue-assets',
  sendAsset: 'https://docs.arkadeos.com/wallets/operations/assets/send-assets',
  receiveAsset: 'https://docs.arkadeos.com/wallets/operations/assets/check-balance',
  assetHistory: 'https://docs.arkadeos.com/wallets/operations/assets/check-balance',
  contracts: 'https://docs.arkadeos.com/contracts/deep-dive',
  externalWallet: 'https://docs.arkadeos.com/wallets/getting-started/introduction',
});

function sourceFileUrl(sourceId) {
  return demoSourceUrl(sourceId, import.meta.env.DEV);
}

const STANDARD_PARTICIPANTS = `  participant L1 as Bitcoin<br/>(On-Chain L1)
  participant Arkade as Arkade Operator<br/>(Off-Chain L2)
  participant SDK as Arkade Wallet<br/>(SDK L3)
  participant Client as Client<br/>(L3)`;

const EXTERNAL_PARTICIPANT = `  participant External as External Wallet<br/>(L3)`;

function sequenceDiagram(messages, { external = false } = {}) {
  return `sequenceDiagram
${STANDARD_PARTICIPANTS}${external ? `\n${EXTERNAL_PARTICIPANT}` : ''}

${messages}`;
}

const DIAGRAMS = Object.freeze({
  events: sequenceDiagram(`  Client->>Client: Open Wallet 1 monitor popup
  Client->>Arkade: Subscribe to Wallet 1 public script
  Arkade-->>Client: Live received, spent, or swept outputs
  Client->>Client: Describe event and pulse card`),
  createWallet: sequenceDiagram(`  Client->>SDK: Request wallet
  SDK-->>Client: Wallet response`),
  privateBalance: sequenceDiagram(`  Client->>SDK: Request balance
  SDK->>Arkade: Read wallet state
  Arkade-->>SDK: Balance response
  SDK-->>Client: Balance response`),
  publicBalance: sequenceDiagram(`  Client->>Arkade: Request public balance
  Arkade-->>Client: Balance response`),
  onboard: sequenceDiagram(`  Client->>SDK: Start onboarding
  SDK->>Arkade: Request boarding
  Arkade->>L1: Bitcoin funding sent to Arkade
  L1-->>Arkade: Funding transaction detected
  Arkade-->>SDK: Onboarding result
  SDK-->>Client: Onboarding result`),
  offboard: sequenceDiagram(`  Client->>SDK: Start offboarding
  SDK->>Arkade: Request offboarding
  Arkade->>L1: Send Bitcoin withdrawal to destination
  L1-->>Arkade: Withdrawal transaction confirmed
  Arkade-->>SDK: Offboarding result
  SDK-->>Client: Offboarding result`),
  sendPayment: sequenceDiagram(`  Client->>SDK: Send payment
  SDK->>Arkade: Submit payment
  Arkade-->>SDK: Transaction result
  SDK-->>Client: Transaction result`),
  receivePayment: sequenceDiagram(`  Client->>Arkade: Request received payments
  Arkade-->>Client: Payment state`),
  paymentHistory: sequenceDiagram(`  Client->>SDK: Request payment history
  SDK->>Arkade: Read activity
  Arkade-->>SDK: Activity response
  SDK-->>Client: Activity response`),
  mintAsset: sequenceDiagram(`  Client->>SDK: Mint asset
  SDK->>Arkade: Submit asset issuance
  Arkade-->>SDK: Asset result
  SDK-->>Client: Asset result`),
  sendAsset: sequenceDiagram(`  Client->>SDK: Send asset
  SDK->>Arkade: Submit asset payment
  Arkade-->>SDK: Transaction result
  SDK-->>Client: Transaction result`),
  receiveAsset: sequenceDiagram(`  Client->>Arkade: Request received assets
  Arkade-->>Client: Asset state`),
  privateAssetHistory: sequenceDiagram(`  Client->>SDK: Request asset history
  SDK->>Arkade: Read activity
  Arkade-->>SDK: Activity response
  SDK-->>Client: Activity response`),
  publicAssetHistory: sequenceDiagram(`  Client->>Arkade: Request public asset history
  Arkade-->>Client: Asset activity`),
  assetUpgrade: sequenceDiagram(`  Client->>SDK: Upgrade level-one item
  SDK->>Arkade: Issue level-two replacement
  Arkade-->>SDK: Replacement verified
  SDK->>Arkade: Burn level-one source
  Arkade-->>SDK: Source retirement verified
  SDK-->>Client: Upgrade result`),
  vaultCreate: sequenceDiagram(`  Client->>SDK: Create vault
  SDK->>Arkade: Submit contract transaction
  Arkade->>L1: Fund contract output
  L1-->>Arkade: Contract transaction
  Arkade-->>SDK: Vault result
  SDK-->>Client: Vault result`),
  vaultIncrement: sequenceDiagram(`  Client->>Arkade: Request state increment
  Arkade->>L1: Commit next vault state
  L1-->>Arkade: State transaction
  Arkade-->>Client: Increment result`),
  vaultCheck: sequenceDiagram(`  Client->>Arkade: Inspect vault state
  Arkade-->>Client: Verified vault state`),
  vaultClaim: sequenceDiagram(`  Client->>SDK: Claim vault
  SDK->>Arkade: Submit creator claim
  Arkade->>L1: Settle claim
  L1-->>Arkade: Claim transaction
  Arkade-->>SDK: Claim result
  SDK-->>Client: Claim result`),
  externalSend: sequenceDiagram(`  Client->>External: Open payment link
  External->>Arkade: Approve payment
  Arkade-->>External: Payment result
  External-->>Client: Callback result`, { external: true }),
  externalReceive: sequenceDiagram(`  Client->>External: Open connect link
  External-->>Client: Address callback
  Client->>SDK: Send payment to address
  SDK->>Arkade: Submit payment
  Arkade-->>SDK: Transaction result
  SDK-->>Client: Transaction result`, { external: true }),
});

let mermaidDiagramId = 0;

function DiagramContent({ code }) {
  const container = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setError(false);
    void (async () => {
      try {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' });
        const { svg } = await mermaid.render(`prototype-diagram-${++mermaidDiagramId}`, code);
        if (active && container.current) {
          container.current.innerHTML = svg;
          const renderedSvg = container.current.querySelector('svg');
          if (renderedSvg && code.trimStart().startsWith('sequenceDiagram')) {
            renderedSvg.querySelectorAll('[class*="actor-bottom"]').forEach(element => (element.parentElement ?? element).remove());
            const viewBoxHeight = Number(renderedSvg.getAttribute('viewBox')?.split(/\s+/)[3]);
            if (Number.isFinite(viewBoxHeight)) {
              renderedSvg.querySelectorAll('.actor-line').forEach(line => line.setAttribute('y2', String(viewBoxHeight - 4)));
            }
          }
        }
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  return <div className="sandbox-diagram-body">
    {error ? <>
      <p className="sandbox-diagram-error">Unable to render this diagram.</p>
      <pre className="sandbox-diagram-source">{code}</pre>
    </> : <div className="sandbox-diagram-canvas" ref={container} />}
  </div>;
}

function DocsContent({ href, topic, description, subheading, details, mainLink = false, linkLabel }) {
  return <div className="sandbox-docs-body">
    {description && <h2 className="sandbox-docs-description">{description}</h2>}
    {subheading && <h3 className="sandbox-docs-subheading">{subheading}</h3>}
    {details}
    {linkLabel
      ? <ul className="sandbox-docs-list"><li><a href={href} target="_blank" rel="noreferrer">{linkLabel}</a></li></ul>
      : <ul className="sandbox-docs-list"><li>{mainLink ? <a href={href} target="_blank" rel="noreferrer">See Arkadeos Docs</a> : <>See Arkadeos Docs - <a href={href} target="_blank" rel="noreferrer">{topic}</a></>}</li></ul>}
  </div>;
}

function DocsSection({ href, topic, description, subheading, details, mainLink = false, linkLabel }) {
  return <section className="sandbox-docs prototype-section" aria-label="Docs">
    <div className="prototype-title-bar"><h2>Docs</h2></div>
    <DocsContent href={href} topic={topic} description={description} subheading={subheading} details={details} mainLink={mainLink} linkLabel={linkLabel} />
  </section>;
}

function OverviewSection({ intro, diagram, docs }) {
  const overviewTabStorageKey = 'prototype-sandbox-overview-tab';
  const validTabs = new Set(['intro', 'diagram', 'docs']);
  const [activeTab, setActiveTab] = useState(() => {
    const stored = window.localStorage.getItem(overviewTabStorageKey);
    return validTabs.has(stored) ? stored : 'intro';
  });
  const tabs = [
    { id: 'intro', label: 'Intro' },
    { id: 'diagram', label: 'Diagram' },
    { id: 'docs', label: 'Docs' },
  ];
  function selectTab(id) {
    setActiveTab(id);
    window.localStorage.setItem(overviewTabStorageKey, id);
  }

  return <section className="sandbox-overview prototype-section" aria-label="Overview">
    <div className="prototype-title-bar"><h2>Overview</h2></div>
    <div className="sandbox-overview-tabs" role="tablist" aria-label="Overview sections">
      {tabs.map(tab => <button
        key={tab.id}
        className={activeTab === tab.id ? 'sandbox-overview-tab is-active' : 'sandbox-overview-tab'}
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls={`overview-panel-${tab.id}`}
        id={`overview-tab-${tab.id}`}
        tabIndex={activeTab === tab.id ? 0 : -1}
        onClick={() => selectTab(tab.id)}
        onKeyDown={event => {
          const index = tabs.findIndex(item => item.id === tab.id);
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : -1;
          if (next < 0) return;
          event.preventDefault();
          selectTab(tabs[next].id);
          document.getElementById(`overview-tab-${tabs[next].id}`)?.focus();
        }}
      >{tab.label}</button>)}
    </div>
    <div className="sandbox-overview-panel" role="tabpanel" id={`overview-panel-${activeTab}`} aria-labelledby={`overview-tab-${activeTab}`}>
      {activeTab === 'intro' && <div className="sandbox-overview-intro">{intro}</div>}
      {activeTab === 'diagram' && <DiagramContent code={diagram} />}
      {activeTab === 'docs' && docs}
    </div>
  </section>;
}

function HomeSection() {
  return <section className="sandbox-home prototype-section" aria-label="Docs">
    <div className="prototype-title-bar"><h2>Docs</h2></div>
    <div className="sandbox-home-body">
      <p>This interactive guide is here to help you learn how to use the Arkade protocol with a working wallet and real examples.</p>
      <p>Each demo focuses on one practical operation, so you can inspect the source, run it, and see the result.</p>
      <p>Start with Create Wallet, then move through the demos as you become familiar with the flow.</p>
      <ul className="sandbox-home-list">
        <li>Learn how wallets, addresses, payments, and assets fit together.</li>
        <li>Run the same Arkade SDK operations used by the examples.</li>
        <li>Compare private-wallet and public-address workflows.</li>
      </ul>
      <h3 className="sandbox-home-subheading">Resources</h3>
      <ul className="sandbox-home-list sandbox-home-resources">
        <li><a href={DOCS_URLS.main} target="_blank" rel="noreferrer">Arkade documentation</a></li>
        <li><a href={DOCS_URLS.wallet} target="_blank" rel="noreferrer">Create or restore an Arkade wallet</a></li>
      </ul>
    </div>
  </section>;
}

export function Navigation({ activeDemo, homeActive = false, setupActive = false, onNavigate }) {
  const activeRecord = DEMOS.find(demo => demo.number === activeDemo);
  const sectionStarts = { 'Create Wallet': 'Wallets', 'Send Payment': 'Payments', 'Mint Asset': 'Assets', 'Events': 'Events', 'Conditional Vault': 'Smart Contracts', 'External Wallet': 'External Wallet' };
  const demoGroups = DEMOS.reduce((groups, demo) => {
    const existing = groups.find(group => group[0].subject === demo.subject);
    if (existing) existing.push(demo);
    else groups.push([demo]);
    return groups;
  }, []);
  function demoNavigationLabel(demo, selected = false) {
    const accessLabel = demo.access === 'W' ? 'write' : 'read';
    return <>{demo.title}{demo.access && <span className="sandbox-navigation-access" aria-label={demo.access === 'W' ? 'uses private mnemonic' : 'public or local read'}> {selected ? accessLabel : demo.access}</span>}</>;
  }
  return <nav className="sandbox-navigation prototype-section" aria-label="Prototype Sandbox navigation">
    <div className="prototype-title-bar"><h2>Demos</h2></div>
    <div className="sandbox-navigation-list">
      {homeActive
        ? <button type="button" disabled aria-current="page">Home</button>
        : <a href={HOME_PATH} onClick={event => { event.preventDefault(); onNavigate(HOME_PATH); }}>Home</a>}
      {setupActive
        ? <button type="button" disabled aria-current="page">Setup</button>
        : <a href={SETUP_PATH} onClick={event => { event.preventDefault(); onNavigate(SETUP_PATH); }}>Setup</a>}
      {demoGroups.map(group => {
        const orderedGroup = [...group].sort((left, right) => Number(right.title === 'Public address') - Number(left.title === 'Public address'));
        const [defaultDemo] = orderedGroup;
        const hasVariants = orderedGroup.length > 1 || orderedGroup.some(demo => demo.nested);
        const nestedOnly = orderedGroup.length === 1 && Boolean(defaultDemo.nested);
        const groupActive = activeRecord?.subject === defaultDemo.subject;
        return <div className="sandbox-navigation-group-block" key={defaultDemo.subject}>
          {sectionStarts[defaultDemo.subject] && <div className="sandbox-navigation-section" role="heading" aria-level="3">{sectionStarts[defaultDemo.subject]}</div>}
          <div className={`sandbox-navigation-group${hasVariants ? ' sandbox-navigation-group-variants' : ''}`}>
            {defaultDemo.subject !== 'External Wallet' && (nestedOnly
              ? <div className="sandbox-navigation-group-parent">{defaultDemo.subject}</div>
              : groupActive && !hasVariants
              ? <button type="button" disabled aria-current="page">{demoNavigationLabel(defaultDemo, true)}</button>
              : <a className={groupActive ? 'sandbox-navigation-group-active' : undefined} href={defaultDemo.path} onClick={event => { event.preventDefault(); onNavigate(defaultDemo.path); }}>{hasVariants ? defaultDemo.subject : demoNavigationLabel(defaultDemo)}</a>)}
            {hasVariants && <div className="sandbox-navigation-children">
              {orderedGroup.map(demo => demo.number === activeDemo
                ? <button key={demo.number} type="button" disabled aria-current="page">{demoNavigationLabel(demo, true)}</button>
                : <a key={demo.number} href={demo.path} onClick={event => { event.preventDefault(); onNavigate(demo.path); }}>{demoNavigationLabel(demo)}</a>)}
            </div>}
          </div>
        </div>;
      })}
    </div>
  </nav>;
}

function SetupSection() {
  return <div className="sandbox-setup">
    <DocsSection
      href={DOCS_URLS.wallet}
      linkLabel="Create or restore an Arkade wallet"
    />
    <section className="prototype-section" aria-label="Setup Input">
      <div className="prototype-title-bar"><h2>Setup Input</h2></div>
      <div className="sandbox-setup-fields">
        <div className="sandbox-setup-guidance">
          <p>The demos require at least 2 wallets on your one preferred network.</p>
          <ul className="sandbox-setup-wallet-links">
            <li><a href={walletUrl('signet')} target="_blank" rel="noreferrer">Create wallet for Signet</a></li>
            <li><a href={walletUrl('mutinynet')} target="_blank" rel="noreferrer">Create wallet for Mutinynet</a></li>
          </ul>
          <p>Then fund the Arkade balance in the wallets on your one preferred network. 50000 sats is sufficient.</p>
          <ul className="sandbox-setup-wallet-links">
            <li><a href={faucetUrl('signet')} target="_blank" rel="noreferrer">Fund wallet on Signet</a></li>
            <li><a href={faucetUrl('mutinynet')} target="_blank" rel="noreferrer">Fund wallet on Mutinynet</a></li>
          </ul>
        </div>
        <hr className="sandbox-setup-divider" />
        <div className="sandbox-setup-profiles">
          {NETWORK_IDS.map(profileNetwork => <SetupNetworkProfile key={profileNetwork} network={profileNetwork} />)}
        </div>
      </div>
    </section>
  </div>;
}

function SetupNetworkProfile({ network }) {
  const [values, setValues] = useState(() => demoGetWalletProfile(network));
  const [focusedField, setFocusedField] = useState(null);
  function submit(key, event) {
    event.preventDefault();
    demoSetInput(network, key === 'address1' ? 'wallet-1-address' : 'wallet-2-mnemonic', values[key]);
  }
  const fields = [
    ['address1', 'Wallet 1 Arkade Address'], ['mnemonic2', 'Wallet 2 Mnemonic'],
  ];
  return <section className="sandbox-setup-profile" aria-label={`${NETWORKS[network].label} wallet profile`}>
      <h3>{NETWORKS[network].label}</h3>
      {fields.map(([key, label]) => <form key={key} className="sandbox-setup-field" onSubmit={event => submit(key, event)}>
        <label htmlFor={`${network}-${key}`}>{label}</label>
        <div className="sandbox-setup-control">
          <input
            id={`${network}-${key}`}
            value={key.startsWith('mnemonic') && focusedField !== key ? maskMnemonic(values[key]) : values[key]}
            onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))}
            onFocus={() => setFocusedField(key)}
            onBlur={() => setFocusedField(null)}
            spellCheck="false"
            autoComplete="off"
          />
          <button className="sandbox-action-button" type="submit">Submit</button>
        </div>
      </form>)}
  </section>;
}

function OutputSection({ title, output, elapsedMs, onRecover = undefined, recoverDisabled = true }) {
  const { scope, details } = useDemoOutput();
  const explorerUrl = demoExplorerUrl(scope, details.explorer);
  const explorerLinks = (details.explorers ?? []).map(({ label, target }) => ({ label, url: demoExplorerUrl(scope, target) }));
  const outputText = output ? [`Demo: ${title}`, output].join('\n') : '';
  return <section className="sandbox-output prototype-section" aria-label="Output">
    <div className="prototype-title-bar"><h2>Output</h2></div>
    <div className="sandbox-output-body">
      <div className="sandbox-output-meta">API Call Response Time: {elapsedMs === null ? '—' : `${(elapsedMs / 1000).toFixed(2)} secs`}</div>
      <div className="sandbox-copyable sandbox-output-copyable">
        <textarea className="sandbox-output-field" rows="10" readOnly value={outputText} aria-label="Demo output" />
        <CopyButton value={outputText} label="Copy demo output" />
      </div>
      {(demoSupportsExplorer(scope) || onRecover || explorerLinks.length > 0) && <div className="sandbox-output-actions">
        {demoSupportsExplorer(scope) && explorerLinks.length === 0 && <button type="button" className="sandbox-action-button sandbox-explorer-button" disabled={!explorerUrl} title={explorerUrl ? 'Open the result on its network explorer in a new tab' : 'No explorer result is available yet.'} onClick={() => { if (explorerUrl) window.open(explorerUrl, '_blank', 'noopener,noreferrer'); }}>Open on Explorer</button>}
        {explorerLinks.map(({ label, url }) => <button key={label} type="button" className="sandbox-action-button sandbox-explorer-button" disabled={!url} title={url ? 'Open this asset on its network explorer in a new tab' : 'No explorer result is available yet.'} onClick={() => { if (url) window.open(url, '_blank', 'noopener,noreferrer'); }}>{label}</button>)}
        {onRecover && <button type="button" className="sandbox-action-button" disabled={recoverDisabled} title={recoverDisabled ? 'Requires a verified expired vault and its creator wallet.' : 'Return the expired vault funds to its creator'} onClick={onRecover}>Recover</button>}
      </div>}
    </div>
  </section>;
}

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }
  return <button className={`sandbox-copy-button${copied ? ' sandbox-copy-button-copied' : ''}`} type="button" onClick={copy} aria-label={copied ? `${label} copied` : label} title={copied ? 'Copied' : label} disabled={!value}>
    {copied
      ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M5 16V6a2 2 0 0 1 2-2h10" /></svg>}
  </button>;
}

function SourceFileButton({ sourceId }) {
  return <a className="sandbox-source-button" href={sourceFileUrl(sourceId)} target="_blank" rel="noreferrer" aria-label="Open source file" title="Open source file">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></svg>
  </a>;
}

function useTimedOutput() {
  const { output, setOutput, elapsedMs, setElapsedMs, beginExecution } = useDemoOutput();
  function begin(clearOutput = true) {
    if (clearOutput) beginExecution();
    setElapsedMs(null);
    return performance.now();
  }
  function finish(startedAt) {
    setElapsedMs(Math.round(performance.now() - startedAt));
  }
  return { output, setOutput, elapsedMs, begin, finish };
}

function SourceCodeField({ id, source }) {
  const sourceLines = source.replace(/\r\n?/g, '\n').split('\n');
  const lineNumbers = sourceLines.map((_, index) => index + 1).join('\n');
  const lineNumbersRef = useRef(null);
  function escapeHtml(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function highlightLine(line) {
    const escaped = escapeHtml(line);
    return escaped
      .replace(/(\/\/.*)$/g, '<span class="token-comment">$1</span>')
      .replace(/('(?:[^'\\]|\\.)*'|&quot;(?:[^&]|&(?!quot;))*?&quot;|`(?:[^`\\]|\\.)*`)/g, '<span class="token-string">$1</span>')
      .replace(/\b(import|from|const|await|new|if|throw|return|true|false|null)\b/g, '<span class="token-keyword">$1</span>')
      .replace(/\b(ArkAddress|MnemonicIdentity|Wallet|Boolean|Number|Array|encodeURIComponent|localStorage|fetch|console)\b/g, '<span class="token-type">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');
  }
  return <div className="sandbox-copyable sandbox-code-copyable">
    <div className="sandbox-code-editor" style={{ '--sandbox-source-lines': sourceLines.length, '--sandbox-visible-lines': Math.min(sourceLines.length, 20) }}>
      <pre ref={lineNumbersRef} className="sandbox-code-lines" aria-hidden="true">{lineNumbers}</pre>
      <pre id={id} className="sandbox-code" tabIndex="0" aria-label="Source code" onScroll={event => { if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop; }}>{sourceLines.map((line, index) => <span key={index} className="sandbox-code-line" dangerouslySetInnerHTML={{ __html: highlightLine(line) }} />)}</pre>
    </div>
    <CopyButton value={source} label="Copy source code" />
  </div>;
}

const ASSET_IDS = ['all', ...Array.from({ length: 10 }, (_, index) => String(index).padStart(4, '0'))];

function AssetSelector({ network, value, onChange, includeAll = false, label = 'AssetID', storageKey = 'asset-id' }) {
  const options = includeAll ? ASSET_IDS : ASSET_IDS.slice(1);
  const id = `${network}-${storageKey}`;
  return <label className="sandbox-inline-input" htmlFor={id}>
    <span>{label}</span>
    <select id={id} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => <option key={option} value={option}>{option === 'all' ? 'All' : option}</option>)}
    </select>
  </label>;
}

function flattenInputChildren(children) {
  return Children.toArray(children).flatMap(child => isValidElement(child) && child.type === Fragment
    ? flattenInputChildren(child.props.children)
    : [child]);
}

function inputText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(inputText).join(' ');
  if (isValidElement(node) && node.type === AssetSelector) return node.props.label ?? 'AssetID';
  return isValidElement(node) ? inputText(node.props.children) : '';
}

function containsFormControl(node) {
  if (Array.isArray(node)) return node.some(containsFormControl);
  if (!isValidElement(node)) return false;
  if (node.type === AssetSelector || node.type === 'input' || node.type === 'select' || node.type === 'textarea') return true;
  return containsFormControl(node.props.children);
}

function fieldIsEditable(nodes) {
  return nodes.some(node => {
    if (!isValidElement(node)) return false;
    if (node.type === AssetSelector) return true;
    if (node.type === 'input' || node.type === 'select' || node.type === 'textarea') {
      return !node.props.readOnly && !node.props.disabled;
    }
    return fieldIsEditable(Children.toArray(node.props.children));
  });
}

function SortedDemoInputs({ children }) {
  const nodes = flattenInputChildren(children);
  const fields = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (isValidElement(node) && node.type === 'label' && !containsFormControl(node) && containsFormControl(nodes[index + 1])) {
      fields.push([node, nodes[index + 1]]);
      index += 1;
    } else {
      fields.push([node]);
    }
  }
  fields.sort((left, right) => {
    const editableOrder = Number(fieldIsEditable(left)) - Number(fieldIsEditable(right));
    if (editableOrder !== 0) return editableOrder;
    return inputText(left[0]).trim().localeCompare(inputText(right[0]).trim(), 'en', { sensitivity: 'base' });
  });
  return <>{fields.map((field, index) => <Fragment key={index}>{field}</Fragment>)}</>;
}

function OperationDemo({ demoTitle, intro, diagram, docsHref, docsTopic, docsDescription, docsSubheading, docsDetails, input, sourceId, contractSource, compiledSource, output, elapsedMs, running, onExecute, onRecover = undefined, recoverDisabled = true, actionLabel = 'Execute', loadingText = demoTitle, loadingBody = loadingText }) {
  const [sourceTab, setSourceTab] = useState('demo');
  const showingContract = Boolean(contractSource) && sourceTab === 'contract';
  const showingCompiled = Boolean(compiledSource) && sourceTab === 'compiled';
  const visibleSource = showingCompiled ? compiledSource : showingContract ? contractSource : demoDefinition(sourceId).source;
  const visibleSourceId = showingContract ? `${sourceId}-contract` : sourceId;
  const tabs = ['demo', 'contract', ...(compiledSource ? ['compiled'] : [])];
  function moveSourceTab(event) {
    const index = tabs.indexOf(sourceTab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : -1;
    if (next < 0) return;
    event.preventDefault();
    setSourceTab(tabs[next]);
    document.getElementById(`${sourceId}-tab-${tabs[next]}`)?.focus();
  }
  return <>
    <LoadingPrompt open={running} bodyText={loadingBody} />
    <OverviewSection intro={intro} diagram={diagram} docs={<DocsContent href={docsHref} topic={docsTopic} description={docsDescription} subheading={docsSubheading} details={docsDetails} />} />
    <section className="sandbox-demo-input prototype-section" aria-label="Input">
      <div className="prototype-title-bar"><h2>Input</h2></div>
      <div className="sandbox-demo-input-body sandbox-operation-input"><SortedDemoInputs>{input}</SortedDemoInputs></div>
    </section>
    <section className="sandbox-demo prototype-section" aria-label="Demo">
      <div className="prototype-title-bar"><h2>Demo</h2><SourceFileButton sourceId={sourceId} /></div>
      <div className="sandbox-demo-body">
        {contractSource
          ? <div className="sandbox-source-tabs" role="tablist" aria-label="Source code views" onKeyDown={moveSourceTab}>
            <button id={`${sourceId}-tab-demo`} aria-controls={`${sourceId}-panel`} tabIndex={sourceTab === 'demo' ? 0 : -1} type="button" role="tab" aria-selected={!showingContract && !showingCompiled} className={!showingContract && !showingCompiled ? 'sandbox-source-tab-active' : undefined} onClick={() => setSourceTab('demo')}>Demo</button>
            <button id={`${sourceId}-tab-contract`} aria-controls={`${sourceId}-panel`} tabIndex={sourceTab === 'contract' ? 0 : -1} type="button" role="tab" aria-selected={showingContract} className={showingContract ? 'sandbox-source-tab-active' : undefined} onClick={() => setSourceTab('contract')}>Smart Contract (Tapscript)</button>
            {compiledSource && <button id={`${sourceId}-tab-compiled`} aria-controls={`${sourceId}-panel`} tabIndex={sourceTab === 'compiled' ? 0 : -1} type="button" role="tab" aria-selected={showingCompiled} className={showingCompiled ? 'sandbox-source-tab-active' : undefined} onClick={() => setSourceTab('compiled')}>Smart Contract (Compiled)</button>}
          </div>
          : null}
        <div id={`${sourceId}-panel`} role={contractSource ? 'tabpanel' : undefined} aria-labelledby={contractSource ? `${sourceId}-tab-${sourceTab}` : undefined} tabIndex={contractSource ? 0 : undefined}>
          <label className="sandbox-code-label" htmlFor={visibleSourceId}>{showingCompiled ? 'Smart contract compiled' : showingContract ? 'Smart contract source' : 'Demo source'}</label>
          <SourceCodeField id={visibleSourceId} source={visibleSource} />
        </div>
        <DemoActionButton label={actionLabel} onClick={onExecute} disabled={running} />
      </div>
    </section>
    <OutputSection title={demoTitle} output={output} elapsedMs={elapsedMs} onRecover={onRecover} recoverDisabled={recoverDisabled} />
  </>;
}

function LoadingPrompt({ open, bodyText }) {
  const bodyLines = Array.isArray(bodyText) ? bodyText : [bodyText];
  const [dots, setDots] = useState('.');
  useEffect(() => {
    if (!open) {
      setDots('.');
      return;
    }
    const timer = window.setInterval(() => setDots(previous => previous.length === 3 ? '.' : `${previous}.`), 1000);
    return () => window.clearInterval(timer);
  }, [open]);
  if (!open) return null;
  return <div className="sandbox-loading-backdrop" role="presentation">
    <section className="sandbox-loading-prompt" role="dialog" aria-modal="true" aria-labelledby="sandbox-loading-title" aria-describedby="sandbox-loading-body">
      <h2 id="sandbox-loading-title">Calling {dots}</h2>
      {bodyLines.map((line, index) => <p id={index === 0 ? 'sandbox-loading-body' : undefined} key={`${line}-${index}`}>{line}</p>)}
    </section>
  </div>;
}

function useAssetSelection(network, includeAll = false) {
  const [assetId, setAssetId] = useState(() => {
    const stored = demoGetInput(network, 'asset-id');
    const allowed = includeAll ? ASSET_IDS : ASSET_IDS.slice(1);
    const selected = allowed.includes(stored) ? stored : (includeAll ? 'all' : '0000');
    demoSetInput(network, 'asset-id', selected);
    return selected;
  });
  useEffect(() => {
    const stored = demoGetInput(network, 'asset-id');
    const allowed = includeAll ? ASSET_IDS : ASSET_IDS.slice(1);
    const selected = allowed.includes(stored) ? stored : (includeAll ? 'all' : '0000');
    demoSetInput(network, 'asset-id', selected);
    setAssetId(selected);
  }, [network, includeAll]);
  function changeAssetId(value) {
    demoSetInput(network, 'asset-id', value);
    setAssetId(value);
  }
  return [assetId, changeAssetId];
}

function useVaultSelection(network) {
  const [vaultId, setVaultId] = useState(() => {
    const stored = demoGetInput(network, 'vault-id');
    const selected = ASSET_IDS.slice(1).includes(stored) ? stored : '0000';
    demoSetInput(network, 'vault-id', selected);
    return selected;
  });
  useEffect(() => {
    const stored = demoGetInput(network, 'vault-id');
    const selected = ASSET_IDS.slice(1).includes(stored) ? stored : '0000';
    demoSetInput(network, 'vault-id', selected);
    setVaultId(selected);
  }, [network]);
  function changeVaultId(value) {
    demoSetInput(network, 'vault-id', value);
    setVaultId(value);
  }
  return [vaultId, changeVaultId];
}

function DemoCreateWallet({ network }) {
  const walletProfile = demoGetWalletProfile(network);
  const { output, elapsedMs, running, execute } = useExecutableDemo('create-wallet-source', network);

  return <>
    <LoadingPrompt open={running} bodyText="Create Wallet 2" />
    <OverviewSection intro="Demonstrates creating a wallet from scratch." diagram={DIAGRAMS.createWallet} docs={<DocsContent href={DOCS_URLS.wallet} topic="Create your wallet" />} />
    <section className="sandbox-demo-input prototype-section" aria-label="Input">
      <div className="prototype-title-bar"><h2>Input</h2></div>
      <div className="sandbox-demo-input-body">
        <label htmlFor="demo-wallet-2-mnemonic">Wallet 2 Mnemonic</label>
        <input id="demo-wallet-2-mnemonic" value={maskMnemonic(walletProfile.mnemonic2)} readOnly spellCheck="false" aria-label="Wallet 2 Mnemonic input value" />
      </div>
    </section>
    <section className="sandbox-demo prototype-section" aria-label="Demo">
      <div className="prototype-title-bar"><h2>Demo</h2><SourceFileButton sourceId="create-wallet-source" /></div>
      <div className="sandbox-demo-body">
        <label className="sandbox-code-label" htmlFor="create-wallet-source">Source code</label>
        <SourceCodeField id="create-wallet-source" source={demoDefinition('create-wallet-source').source} />
        <DemoActionButton onClick={() => execute()} disabled={running} />
      </div>
    </section>
    <OutputSection title="Create Wallet" output={output} elapsedMs={elapsedMs} />
  </>;
}

function DemoGetBalancePrivate({ network }) {
  const walletProfile = demoGetWalletProfile(network);
  const { output, elapsedMs, running, execute } = useExecutableDemo('private-balance-source', network);

  return <>
    <LoadingPrompt open={running} bodyText="Get balance for Wallet 2" />
    <OverviewSection intro="Demonstrates checking a wallet’s balance." diagram={DIAGRAMS.privateBalance} docs={<DocsContent href={DOCS_URLS.balance} topic="Checking balances" />} />
    <section className="sandbox-demo-input prototype-section" aria-label="Input">
      <div className="prototype-title-bar"><h2>Input</h2></div>
      <div className="sandbox-demo-input-body">
        <label htmlFor="private-balance-mnemonic">Wallet 2 Mnemonic</label>
        <input id="private-balance-mnemonic" value={maskMnemonic(walletProfile.mnemonic2)} readOnly spellCheck="false" aria-label="Wallet 2 Mnemonic input value" />
      </div>
    </section>
    <section className="sandbox-demo prototype-section" aria-label="Demo">
      <div className="prototype-title-bar"><h2>Demo</h2><SourceFileButton sourceId="private-balance-source" /></div>
      <div className="sandbox-demo-body">
        <label className="sandbox-code-label" htmlFor="private-balance-source">Source code</label>
        <SourceCodeField id="private-balance-source" source={demoDefinition('private-balance-source').source} />
        <DemoActionButton onClick={() => execute()} disabled={running} />
      </div>
    </section>
    <OutputSection title="Private wallet - Get Balance" output={output} elapsedMs={elapsedMs} />
  </>;
}

function DemoGetBalancePublic({ network }) {
  const walletProfile = demoGetWalletProfile(network);
  const { output, elapsedMs, running, execute } = useExecutableDemo('balance-source', network);

  return <>
    <LoadingPrompt open={running} bodyText="Get balance for public address" />
    <OverviewSection intro="Demonstrates checking the balance of a public address." diagram={DIAGRAMS.publicBalance} docs={<DocsContent href={DOCS_URLS.balance} topic="Checking balances" />} />
    <section className="sandbox-demo-input prototype-section" aria-label="Input">
      <div className="prototype-title-bar"><h2>Input</h2></div>
      <div className="sandbox-demo-input-body">
        <label htmlFor="demo-address-1">Wallet 1 Address</label>
        <input id="demo-address-1" value={walletProfile.address1} readOnly spellCheck="false" aria-label="Wallet 1 Address input value" />
      </div>
    </section>
    <section className="sandbox-demo prototype-section" aria-label="Demo">
      <div className="prototype-title-bar"><h2>Demo</h2><SourceFileButton sourceId="balance-source" /></div>
      <div className="sandbox-demo-body">
        <label className="sandbox-code-label" htmlFor="balance-source">Source code</label>
        <SourceCodeField id="balance-source" source={demoDefinition('balance-source').source} />
        <DemoActionButton onClick={() => execute()} disabled={running} />
      </div>
    </section>
    <OutputSection title="Public address - Get Balance" output={output} elapsedMs={elapsedMs} />
  </>;
}

function DemoOnboardBitcoin({ network }) {
  const values = demoGetWalletProfile(network);
  const { output, elapsedMs, running, execute } = useExecutableDemo('onboard-bitcoin-source', network);

  return <OperationDemo demoTitle="Onboard Bitcoin" intro="Demonstrates moving Bitcoin into Arkade." diagram={DIAGRAMS.onboard} loadingText="Onboard Bitcoin" docsHref={DOCS_URLS.ramps} docsTopic="Ramps: onboarding Bitcoin" sourceId="onboard-bitcoin-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
    <label htmlFor="onboard-bitcoin-mnemonic">Wallet 2 Mnemonic</label>
    <input id="onboard-bitcoin-mnemonic" value={maskMnemonic(values.mnemonic2)} readOnly />
  </>} />;
}

function DemoOffboardBitcoin({ network }) {
  const values = demoGetWalletProfile(network);
  const { output, elapsedMs, running, execute } = useExecutableDemo('offboard-bitcoin-source', network);
  const [destination, setDestination] = useState('');

  useEffect(() => {
    let active = true;
    getWallet2BitcoinAddress(network).then(address => {
      if (active) setDestination(address);
    }).catch(() => {
      if (active) setDestination('');
    });
    return () => { active = false; };
  }, [network, values.mnemonic2]);

  return <OperationDemo demoTitle="Offboard Bitcoin" intro="Demonstrates moving Bitcoin from Arkade back on-chain." diagram={DIAGRAMS.offboard} loadingText="Offboard Bitcoin" docsHref={DOCS_URLS.ramps} docsTopic="Ramps: offboarding Bitcoin" sourceId="offboard-bitcoin-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
    <label htmlFor="offboard-bitcoin-mnemonic">Wallet 2 Mnemonic</label>
    <input id="offboard-bitcoin-mnemonic" value={maskMnemonic(values.mnemonic2)} readOnly />
    <label htmlFor="offboard-bitcoin-destination">Bitcoin Destination</label>
    <input id="offboard-bitcoin-destination" value={destination || 'Deriving from Wallet 2'} readOnly />
  </>} />;
}

function DemoSendPayment({ network }) {
  const { output, elapsedMs, running, execute } = useExecutableDemo('send-payment-source', network);
  return <OperationDemo demoTitle="Send Payment" intro="Demonstrates sending a payment to an Arkade address." diagram={DIAGRAMS.sendPayment} loadingText="Send payment" docsHref={DOCS_URLS.sendPayment} docsTopic="Sending payments" sourceId="send-payment-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
    <label htmlFor="send-payment-mnemonic">Wallet 2 Mnemonic</label>
    <input id="send-payment-mnemonic" value={maskMnemonic(demoGetWalletProfile(network).mnemonic2)} readOnly />
    <label htmlFor="send-payment-address">Wallet 1 Address</label>
    <input id="send-payment-address" value={demoGetWalletProfile(network).address1} readOnly />
    <label htmlFor="send-payment-amount">Amount</label>
    <input id="send-payment-amount" value="100 sats" readOnly />
  </>} />;
}

function DemoConditionalVault({ network, action }) {
  const [vaultIdSelection, setVaultIdSelection] = useVaultSelection(network);
  const vaultId = `conditional-vault-${vaultIdSelection}`;
  const { output, setOutput, elapsedMs, setElapsedMs, details, beginExecution } = useDemoOutput();
  const [running, setRunning] = useState(false);
  const contractSource = CONDITIONAL_VAULT_LANGUAGE_SOURCE;
  const [creatorPublicKey, setCreatorPublicKey] = useState('');
  const [compiledSource, setCompiledSource] = useState('// The compiled artifact will be available here after "Execute"');
  useEffect(() => {
    if (action !== 'create') return;
    let active = true;
    setCompiledSource('// The compiled artifact will be available here after "Execute"');
    void demoReadConditionalVaultDescriptor(network, vaultId).then(descriptor => {
      if (active && descriptor) setCompiledSource(conditionalVaultArtifact(descriptor));
    }).catch(() => { /* Execute reports invalid stored data without exposing it in the page. */ });
    return () => { active = false; };
  }, [network, action, vaultId]);
  async function execute(recover = false) {
    if (!recover) beginExecution();
    const startedAt = performance.now();
    setRunning(true); setElapsedMs(0);
    setOutput([`Network: ${network}`, `Vault ID: ${vaultIdSelection}`, 'Status: running', 'Waiting for network verification.'].join('\n'));
    try {
      const result = await demoDefinition(`conditional-vault-${action}-source`).run({ network, recover });
      if (action === 'create' && result.compiledSource) setCompiledSource(result.compiledSource);
      setOutput(result.output, result.details);
    } catch (error) { setOutput([`Error: ${vaultErrorMessage(error)}`, 'Success: false'].join('\n')); }
    finally { setElapsedMs(Math.round(performance.now() - startedAt)); setRunning(false); }
  }
  const values = demoGetWalletProfile(network);
  useEffect(() => {
    let active = true;
    setCreatorPublicKey('');
    if (values.mnemonic2.trim()) {
      try {
        const identity = MnemonicIdentity.fromMnemonic(values.mnemonic2, { isMainnet: false });
        void identity.xOnlyPublicKey().then(key => {
          if (active) setCreatorPublicKey(Array.from(key, byte => byte.toString(16).padStart(2, '0')).join(''));
        }).catch(() => { /* An invalid wallet cannot authorize recovery. */ });
      } catch { /* Keep Recover disabled for an invalid mnemonic. */ }
    }
    return () => { active = false; };
  }, [network, values.mnemonic2]);
  const titles = { create: 'Create Conditional Vault', increment: 'Increment Conditional Vault', claim: 'Claim Conditional Vault', check: 'Check Conditional Vault' };
  const vaultOverview = {
    create: { intro: 'Demonstrates creating a Bitcoin-backed conditional vault.', diagram: DIAGRAMS.vaultCreate },
    increment: { intro: 'Demonstrates advancing a conditional vault state.', diagram: DIAGRAMS.vaultIncrement },
    claim: { intro: 'Demonstrates claiming funds from a completed conditional vault.', diagram: DIAGRAMS.vaultClaim },
    check: { intro: 'Demonstrates checking the verified state of a conditional vault.', diagram: DIAGRAMS.vaultCheck },
  }[action];
  return <><OperationDemo demoTitle={titles[action]} intro={vaultOverview.intro} diagram={vaultOverview.diagram} loadingText={titles[action]} docsHref={DOCS_URLS.contracts} docsTopic="Arkade smart contracts" sourceId={`conditional-vault-${action}-source`}  contractSource={action === 'create' ? contractSource : undefined} compiledSource={action === 'create' ? compiledSource : undefined} output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} onRecover={() => execute(true)} recoverDisabled={running || !details.recoverable || details.vaultId !== vaultIdSelection || !creatorPublicKey || creatorPublicKey !== details.creatorPublicKey} input={<>
    <AssetSelector network={network} value={vaultIdSelection} onChange={setVaultIdSelection} label="Vault ID" storageKey="vault-id" />
    {(action === 'create' || action === 'claim') && <><label htmlFor={`conditional-vault-mnemonic-${action}`}>Wallet 2 Mnemonic</label><input id={`conditional-vault-mnemonic-${action}`} value={maskMnemonic(values.mnemonic2)} readOnly /></>}
    <label htmlFor={`conditional-vault-amount-${action}`}>Vault Amount</label><input id={`conditional-vault-amount-${action}`} value="1000 sats" readOnly />
    <label htmlFor={`conditional-vault-target-${action}`}>Target Progress</label><input id={`conditional-vault-target-${action}`} value="3" readOnly />
  </>} />
    </>;
}

function externalWalletPaymentResult(search) {
  const result = new URLSearchParams(search);
  if (result.get('status') === 'sent') {
    const txid = result.get('txid');
    return [`Wallet result: sent`, ...(txid ? [`Transaction ID: ${txid}`] : []), 'Success: true'].join('\n');
  }
  if (result.has('error')) return [`Wallet result: ${result.get('error')}`, 'Success: false'].join('\n');
  return '';
}

const EXTERNAL_WALLET_MESSAGE_SOURCE = 'bis-external-wallet';

function notifyExternalWalletOpener() {
  if (!window.opener || window.opener === window) return false;
  window.opener.postMessage({ source: EXTERNAL_WALLET_MESSAGE_SOURCE, search: window.location.search }, window.location.origin);
  window.close();
  return true;
}

function isExternalWalletMessage(event) {
  return event.origin === window.location.origin && event.data?.source === EXTERNAL_WALLET_MESSAGE_SOURCE;
}

function DemoExternalWalletPayment({ network }) {
  const [amount, setAmount] = useState('100');
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  const startedAtRef = useRef(null);
  const [callbackResult, setCallbackResult] = useState(() => externalWalletPaymentResult(window.location.search));

  function completeExternalPayment(search) {
    const result = externalWalletPaymentResult(search);
    if (!result) return;
    const params = new URLSearchParams(search);
    setCallbackResult(result);
    setOutput(result, { explorer: params.get('status') === 'sent' ? { network, kind: 'ark-transaction', identifier: params.get('txid') } : undefined });
    if (startedAtRef.current !== null) {
      finish(startedAtRef.current);
      startedAtRef.current = null;
      setRunning(false);
    }
  }

  useEffect(() => {
    const updateResult = () => completeExternalPayment(window.location.search);
    const receiveResult = event => {
      if (isExternalWalletMessage(event)) completeExternalPayment(event.data.search || '');
    };
    window.addEventListener('popstate', updateResult);
    window.addEventListener('message', receiveResult);
    if (callbackResult) completeExternalPayment(window.location.search);
    if (notifyExternalWalletOpener()) return () => {};
    return () => {
      window.removeEventListener('popstate', updateResult);
      window.removeEventListener('message', receiveResult);
    };
  }, []);

  async function openWallet() {
    const startedAt = begin();
    startedAtRef.current = startedAt;
    setRunning(true);
    setOutput('');
    try {
      await demoDefinition('external-wallet-payment-source').run({ network, amount });
  } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
      finish(startedAt);
      startedAtRef.current = null;
      setRunning(false);
    }
  }

  return <OperationDemo demoTitle="Send Payment from External Wallet" intro="Demonstrates sending a payment through an external wallet." diagram={DIAGRAMS.externalSend} loadingText="Get payment recipient" loadingBody={['EXTERNAL WALLET - Send Payment', '(See Wallet In External Window)']} docsHref={DOCS_URLS.externalWallet} docsTopic="Arkade Wallet app links" docsDescription="External Wallet?" docsSubheading="Pros/cons" docsDetails={<div className="sandbox-docs-details"><p>An external wallet is a separate Arkade wallet app that approves or receives the payment through a wallet link.</p><ul><li><strong>Pros:</strong> wallet keys stay outside the prototype.</li><li><strong>Cons:</strong> the popup must be available and the user must approve the handoff.</li></ul><blockquote><p>Everything shown in this prototype sandbox can be done with either an external wallet or an internal wallet.</p></blockquote></div>} sourceId="external-wallet-payment-source" output={output || callbackResult} elapsedMs={elapsedMs} running={running} onExecute={openWallet} actionLabel="Send Payment from External Wallet" input={<>
    <label htmlFor="external-wallet-address">Recipient: Wallet 1 Address</label>
    <input id="external-wallet-address" value={demoGetWalletProfile(network).address1} readOnly spellCheck="false" />
    <label htmlFor="external-wallet-amount">Amount in sats</label>
    <input id="external-wallet-amount" value={amount} onChange={event => setAmount(event.target.value)} inputMode="numeric" spellCheck="false" autoComplete="off" />
  </>} />;
}

function externalWalletAddressResult(search) {
  const result = new URLSearchParams(search);
  if (result.has('error')) return { error: result.get('error') || 'denied' };
  return { address: result.get('address') || '' };
}

function DemoExternalWalletReceivePayment({ network }) {
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  const waitingForWalletRef = useRef(null);
  const [externalAddress, setExternalAddress] = useState(() => externalWalletAddressResult(window.location.search).address);
  const receivedAddress = useRef('');

  async function payExternalWallet(address) {
    const startedAt = begin(false);
    setRunning(true);
    setOutput('');
    try {
      const result = await demoDefinition('external-wallet-receive-source').run({ network, externalAddress: address });
      setOutput(result.output, result.details);
  } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
    } finally {
      finish(startedAt);
      setRunning(false);
    }
  }

  useEffect(() => {
    const handleResult = (search, fromPopup = false) => {
      const result = externalWalletAddressResult(search);
      if (result.error) {
        setOutput([`External wallet result: ${result.error}`, 'Success: false'].join('\n'));
        if (waitingForWalletRef.current !== null) {
          finish(waitingForWalletRef.current);
          waitingForWalletRef.current = null;
          setRunning(false);
        }
        return;
      }
      if (!result.address || receivedAddress.current === result.address) return;
      receivedAddress.current = result.address;
      setExternalAddress(result.address);
      if (!fromPopup) {
        const callback = new URL(window.location.href);
        callback.search = '';
        callback.hash = '';
        window.history.replaceState(window.history.state, '', callback);
      }
      waitingForWalletRef.current = null;
      void payExternalWallet(result.address);
    };
    const receiveResult = event => {
      if (isExternalWalletMessage(event)) handleResult(event.data.search || '', true);
    };
    window.addEventListener('message', receiveResult);
    if (notifyExternalWalletOpener()) return () => {};
    handleResult(window.location.search);
    return () => window.removeEventListener('message', receiveResult);
  }, [network]);

  async function receivePayment() {
    const startedAt = begin();
    waitingForWalletRef.current = startedAt;
    setRunning(true);
    setOutput('');
    try {
      await demoDefinition('external-wallet-receive-source').run({ network });
  } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
      finish(startedAt);
      setRunning(false);
    }
  }

  return <OperationDemo demoTitle="Receive Payment to External Wallet" intro="Demonstrates receiving a payment through an external wallet." diagram={DIAGRAMS.externalReceive} loadingText="Get external wallet address" loadingBody={['EXTERNAL WALLET - Send Payment', '(See Wallet In External Window)']} docsHref={DOCS_URLS.externalWallet} docsTopic="Arkade Wallet app links" docsDescription="External Wallet?" docsSubheading="Pros/cons" docsDetails={<div className="sandbox-docs-details"><p>An external wallet is a separate Arkade wallet app that approves or receives the payment through a wallet link.</p><ul><li><strong>Pros:</strong> wallet keys stay outside the prototype.</li><li><strong>Cons:</strong> the popup must be available and the user must approve the handoff.</li></ul><blockquote><p>Everything shown in this prototype sandbox can be done with either an external wallet or an internal wallet.</p></blockquote></div>} sourceId="external-wallet-receive-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={receivePayment} actionLabel="Receive Payment to External Wallet" input={<>
    <label htmlFor="external-wallet-receive-address">External Wallet Address</label>
    <input id="external-wallet-receive-address" value={externalAddress} readOnly placeholder="Choose an external wallet" spellCheck="false" />
    <label htmlFor="external-wallet-receive-mnemonic">Wallet 2 Mnemonic</label>
    <input id="external-wallet-receive-mnemonic" value={maskMnemonic(demoGetWalletProfile(network).mnemonic2)} readOnly />
    <label htmlFor="external-wallet-receive-amount">Amount</label>
    <input id="external-wallet-receive-amount" value="100 sats" readOnly />
  </>} />;
}

function DemoReceivePayment({ network }) {
  const { output, elapsedMs, running, execute } = useExecutableDemo('receive-payment-source', network);
  return <OperationDemo demoTitle="Receive Payment" intro="Demonstrates checking for a payment sent to an Arkade address." diagram={DIAGRAMS.receivePayment} loadingText="Get payment address" docsHref={DOCS_URLS.receivePayment} docsTopic="Receiving payments" sourceId="receive-payment-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
    <label htmlFor="receive-payment-address">Wallet 1 Address</label>
    <input id="receive-payment-address" value={demoGetWalletProfile(network).address1} readOnly />
  </>} />;
}

function DemoPaymentHistory({ network }) {
  const { output, elapsedMs, running, execute } = useExecutableDemo('payment-history-source', network);
  return <OperationDemo demoTitle="Payment History" intro="Demonstrates reviewing a wallet’s payment history." diagram={DIAGRAMS.paymentHistory} loadingText="Get payment history" docsHref={DOCS_URLS.paymentHistory} docsTopic="Payment history" sourceId="payment-history-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
    <label htmlFor="payment-history-mnemonic">Wallet 2 Mnemonic</label>
    <input id="payment-history-mnemonic" value={maskMnemonic(demoGetWalletProfile(network).mnemonic2)} readOnly />
  </>} />;
}

function DemoMintAsset({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network);
  const { output, elapsedMs, running, execute } = useExecutableDemo('mint-asset-source', network);
  return <OperationDemo demoTitle="Mint Asset" intro="Demonstrates creating a new Arkade asset." diagram={DIAGRAMS.mintAsset} loadingText="Mint asset" docsHref={DOCS_URLS.mintAsset} docsTopic="Issue assets" docsDetails={<div className="sandbox-docs-details"><p>Arkade supports issuing assets with or without a control asset. This demo showcases issuing without a control asset, so the asset has a fixed supply and cannot be reissued later.</p></div>} sourceId="mint-asset-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
    <label htmlFor="mint-asset-mnemonic">Wallet 2 Mnemonic</label>
    <input id="mint-asset-mnemonic" value={maskMnemonic(demoGetWalletProfile(network).mnemonic2)} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} />
  </>} />;
}

function DemoSendAsset({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network);
  const [paymentSats, setPaymentSats] = useState(() => optionalAssetPayment(demoGetInput(network, 'asset-payment-sats')));
  useEffect(() => { setPaymentSats(optionalAssetPayment(demoGetInput(network, 'asset-payment-sats'))); }, [network]);
  const { output, elapsedMs, running, execute } = useExecutableDemo('send-asset-source', network);
  return <OperationDemo demoTitle="Send Asset" intro="Demonstrates sending an Arkade asset to an address." diagram={DIAGRAMS.sendAsset} loadingText="Send asset" docsHref={DOCS_URLS.sendAsset} docsTopic="Send assets" sourceId="send-asset-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
    <label className="sandbox-inline-input" htmlFor="send-asset-payment"><span>Optional Payment Sats:</span>
      <select id="send-asset-payment" aria-describedby="send-asset-payment-help" value={paymentSats} onChange={event => {
        const value = optionalAssetPayment(event.target.value);
        demoSetInput(network, 'asset-payment-sats', value);
        setPaymentSats(value);
      }}>{OPTIONAL_ASSET_PAYMENTS.map(value => <option key={value} value={value}>{value}</option>)}</select>
      <small id="send-asset-payment-help" className="sandbox-asset-payment-help">Extra payment only. The asset also carries the SDK minimum, currently 330 sats. These sats go to Wallet 1, not to fees.</small>
    </label>
    <label htmlFor="send-asset-mnemonic">Wallet 2 Mnemonic</label>
    <input id="send-asset-mnemonic" value={maskMnemonic(demoGetWalletProfile(network).mnemonic2)} readOnly />
    <label htmlFor="send-asset-address">Wallet 1 Address</label>
    <input id="send-asset-address" value={demoGetWalletProfile(network).address1} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} />
  </>} />;
}

function DemoReceiveAsset({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network, true);
  const { output, elapsedMs, running, execute } = useExecutableDemo('receive-asset-source', network);
  return <OperationDemo demoTitle="Receive Asset" intro="Demonstrates checking for assets received at an address." diagram={DIAGRAMS.receiveAsset} loadingText="Get asset balance" docsHref={DOCS_URLS.receiveAsset} docsTopic="Check asset balance" sourceId="receive-asset-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
    <label htmlFor="receive-asset-address">Wallet 1 Address</label>
    <input id="receive-asset-address" value={demoGetWalletProfile(network).address1} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} includeAll />
  </>} />;
}

function DemoAssetHistory({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network, true);
  const { output, elapsedMs, running, execute } = useExecutableDemo('asset-history-source', network);
  return <OperationDemo demoTitle="Asset History - Private Wallet" intro="Demonstrates reviewing asset activity for a wallet." diagram={DIAGRAMS.privateAssetHistory} loadingText="Get asset history for Wallet 2" docsHref={DOCS_URLS.assetHistory} docsTopic="Check asset balance" sourceId="asset-history-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
    <label htmlFor="asset-history-mnemonic">Wallet 2 Mnemonic</label>
    <input id="asset-history-mnemonic" value={maskMnemonic(demoGetWalletProfile(network).mnemonic2)} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} includeAll />
  </>} />;
}

function DemoAssetHistoryPublic({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network, true);
  const { output, elapsedMs, running, execute } = useExecutableDemo('public-asset-history-source', network);
  return <OperationDemo demoTitle="Asset History - Public Address" intro="Demonstrates reviewing asset activity for a public address." diagram={DIAGRAMS.publicAssetHistory} loadingText="Get asset history for public address" docsHref={DOCS_URLS.assetHistory} docsTopic="Check asset balance" sourceId="public-asset-history-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
    <label htmlFor="public-asset-history-address">Wallet 1 Address</label>
    <input id="public-asset-history-address" value={demoGetWalletProfile(network).address1} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} includeAll />
  </>} />;
}

function DemoUpgradeAsset({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network);
  const { output, elapsedMs, running, execute } = useExecutableDemo('asset-upgrade-source', network);
  return <OperationDemo demoTitle="Upgrade Asset" intro="Demonstrates replacing an upgradeable sword with its next immutable level in the same mnemonic-backed wallet. This is an issue-verify-burn sequence, not native reissuance." diagram={DIAGRAMS.assetUpgrade} loadingText="Upgrade asset" docsHref={DOCS_URLS.mintAsset} docsTopic="Issue assets" docsDetails={<div className="sandbox-docs-details"><p>Upgrade reads the source sword metadata, issues the next level with its matching title, level, and icon, verifies that the replacement is owned, then burns the source. Level 1 upgrades to Level 2, and Level 2 upgrades to Level 3. Level 3 is terminal.</p></div>} sourceId="asset-upgrade-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
    <label htmlFor="asset-upgrade-mnemonic">Wallet 2 Mnemonic</label>
    <input id="asset-upgrade-mnemonic" value={maskMnemonic(demoGetWalletProfile(network).mnemonic2)} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} />
  </>} />;
}

function DemoEvents({ network }) {
  const { output, elapsedMs, running, execute } = useExecutableDemo('events-source', network);
  const address = demoGetWalletProfile(network).address1;
  return <OperationDemo demoTitle="Events" intro="Demonstrates listening for Wallet 1 activity in a separate window while using other demos." diagram={DIAGRAMS.events}
    docsHref={DOCS_URLS.receivePayment} docsTopic="Receiving payments and listening for activity"
    docsDetails={<div className="sandbox-docs-details"><p>Keep the popup open and wait for "I'm listening . . ." before trying these demos:</p><ul>
      <li><a href="../demo-4/">Send Payment</a>: Wallet 2 sends 100 sats to Wallet 1.</li>
      <li><a href="../demo-8/">Send Asset</a>: sends an asset to Wallet 1. First use Mint Asset to create it in Wallet 2.</li>
      <li><a href="../demo-12/">Send Payment from External Wallet</a>: approves a payment to Wallet 1 in an external wallet.</li>
    </ul><p>Mint Asset alone affects Wallet 2. Receive and history demos only read existing data. This popup observes the captured public address and network without a mnemonic. Changing Setup does not retarget an open monitor; execute Events again.</p></div>}
    sourceId="events-source" output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} input={<>
      <label htmlFor="events-address">Wallet 1 Address</label><input id="events-address" value={address} readOnly />
      <label htmlFor="events-network">Network</label><input id="events-network" value={NETWORKS[network].label} readOnly />
    </>} />;
}

export function App({ pathname = window.location.pathname }) {
  const [currentPathname, setCurrentPathname] = useState(() => {
    if (isHomePath(pathname)) {
      const firstVisit = !window.localStorage.getItem(LANDING_VISITED_STORAGE_KEY);
      window.localStorage.setItem(LANDING_VISITED_STORAGE_KEY, 'true');
      return firstVisit ? DEMOS[0].path : HOME_PATH;
    }
    window.localStorage.setItem(LANDING_VISITED_STORAGE_KEY, 'true');
    return pathname;
  });
  useEffect(() => {
    if (isHomePath(pathname) && currentPathname !== pathname) window.history.replaceState({}, '', currentPathname);
  }, []);
  useEffect(() => {
    const handlePopState = () => setCurrentPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  function navigate(nextPathname) {
    if (nextPathname === currentPathname) return;
    window.localStorage.setItem(LANDING_VISITED_STORAGE_KEY, 'true');
    window.history.pushState({}, '', nextPathname);
    setCurrentPathname(nextPathname);
  }
  const homeActive = isHomePath(currentPathname);
  const activeDemo = getActiveDemo(currentPathname);
  const setupActive = isSetupPath(currentPathname);
  const activeRecord = DEMOS.find(demo => demo.number === activeDemo);
  const activeTitle = homeActive ? 'Home' : setupActive ? 'Setup' : activeRecord ? (activeRecord.subject === activeRecord.title ? activeRecord.title : `${activeRecord.subject} - ${activeRecord.title}`) : null;
  useEffect(() => {
    document.title = `BIS - Prototype Sandbox${activeTitle ? ` - ${activeTitle}` : ''}`;
  }, [activeTitle]);
  const [network, setNetwork] = useState(() => setupNetworkValue());
  demoGetWalletProfile(network);
  function changeNetwork(nextNetwork) {
    if (nextNetwork === network) return;
    if (!window.confirm(`Switch to ${NETWORKS[nextNetwork].label}? Its separate wallet profile will be used.`)) return;
    window.localStorage.setItem(NETWORK_STORAGE_KEY, nextNetwork);
    setNetwork(nextNetwork);
  }
  return <div className="prototype-page sandbox-shell">
    <header className="spike-header">
      <div className="spike-header-inner">
        <div className="spike-identity"><PrototypeMark /><h1>BIS - Prototype Sandbox{activeTitle ? ` - ${activeTitle}` : ''}</h1></div>
        <label className="network-picker" htmlFor="network"><span>Network</span><select id="network" value={network} onChange={event => changeNetwork(event.target.value)}>{NETWORK_IDS.map(id => <option key={id} value={id}>{NETWORKS[id].label}</option>)}</select></label>
      </div>
    </header>
    <div className="sandbox-workspace">
      <Navigation activeDemo={homeActive || setupActive ? null : activeDemo} homeActive={homeActive} setupActive={setupActive} onNavigate={navigate} />
      <main className="sandbox-main-content">
        <DemoNetworkContext.Provider value={network}>
        <DemoOutputScope.Provider value={`${network}:${activeDemo}`}>
        {homeActive && <HomeSection />}
        {setupActive && <SetupSection />}
        {!homeActive && !setupActive && activeDemo === 1 && <DemoCreateWallet network={network} />}
        {!homeActive && !setupActive && activeDemo === 2 && <DemoGetBalancePrivate network={network} />}
        {!homeActive && !setupActive && activeDemo === 3 && <DemoGetBalancePublic network={network} />}
        {!homeActive && !setupActive && activeDemo === 18 && <DemoOnboardBitcoin network={network} />}
        {!homeActive && !setupActive && activeDemo === 19 && <DemoOffboardBitcoin network={network} />}
        {!homeActive && !setupActive && activeDemo === 4 && <DemoSendPayment network={network} />}
        {!homeActive && !setupActive && activeDemo === 5 && <DemoReceivePayment network={network} />}
        {!homeActive && !setupActive && activeDemo === 6 && <DemoPaymentHistory network={network} />}
        {!homeActive && !setupActive && activeDemo === 7 && <DemoMintAsset network={network} />}
        {!homeActive && !setupActive && activeDemo === 8 && <DemoSendAsset network={network} />}
        {!homeActive && !setupActive && activeDemo === 9 && <DemoReceiveAsset network={network} />}
        {!homeActive && !setupActive && activeDemo === 10 && <DemoAssetHistory network={network} />}
        {!homeActive && !setupActive && activeDemo === 11 && <DemoAssetHistoryPublic network={network} />}
        {!homeActive && !setupActive && activeDemo === 20 && <DemoUpgradeAsset network={network} />}
        {!homeActive && !setupActive && activeDemo === 21 && <DemoEvents network={network} />}
        {!homeActive && !setupActive && activeDemo === 14 && <DemoConditionalVault key={`${network}-create`} network={network} action="create" />}
        {!homeActive && !setupActive && activeDemo === 15 && <DemoConditionalVault key={`${network}-increment`} network={network} action="increment" />}
        {!homeActive && !setupActive && activeDemo === 16 && <DemoConditionalVault key={`${network}-claim`} network={network} action="claim" />}
        {!homeActive && !setupActive && activeDemo === 17 && <DemoConditionalVault key={`${network}-check`} network={network} action="check" />}
        {!homeActive && !setupActive && activeDemo === 12 && <DemoExternalWalletPayment network={network} />}
        {!homeActive && !setupActive && activeDemo === 13 && <DemoExternalWalletReceivePayment network={network} />}
        </DemoOutputScope.Provider>
        </DemoNetworkContext.Provider>
      </main>
    </div>
    <footer className="spike-footer" aria-label="Footer" />
  </div>;
}

