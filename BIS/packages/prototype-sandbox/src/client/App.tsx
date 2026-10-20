import { Children, Fragment, isValidElement, useEffect, useRef, useState } from 'react';
import { InMemoryContractRepository, InMemoryWalletRepository, IndexedDBWalletRepository, MnemonicIdentity, OnchainWallet, Ramps, RestArkProvider, Wallet } from '@arkade-os/sdk';
import mermaid from 'mermaid';
import { NETWORKS, NETWORK_IDS } from '../../../prototype-faucet/src/shared/network-config.ts';
import { decodeArkadeAddress, validateArkadeAddress } from '../../../prototype-faucet/src/shared/faucet-core.ts';
import { DEMOS, HOME_PATH, LANDING_VISITED_STORAGE_KEY, NETWORK_STORAGE_KEY, SETUP_PATH, getActiveDemo, isHomePath, isSetupPath, localStorageGetItem, setupNetworkValue, setupWalletProfileValues, walletCallbackUrl, walletConnectUrl, walletPaymentUrl, walletProfileStorageKey, walletUrl } from './navigation.ts';
import { conditionalVaultArtifact, checkConditionalVault, claimConditionalVault, createConditionalVault, incrementConditionalVault, readStoredConditionalVault } from './conditional-vault.ts';
import { LEVEL_ONE_ICON, LEVEL_ONE_TITLE, LEVEL_TWO_TITLE, createAssetUpgradeRequest, executeAssetUpgrade } from './asset-upgrade.ts';
import { ASSET_UPGRADE_SOURCE } from './asset-upgrade-demo-source.ts';
import CONDITIONAL_VAULT_LANGUAGE_SOURCE from '../../../integration/src/client/wallet-layer-arkade/conditional-vault-program.ts?raw';
import { conditionalVaultDemoSource } from './conditional-vault-demo-source.ts';
import { DemoOutputScope, useDemoOutput } from './demo-output.ts';
import { demoExplorerUrl, demoSupportsExplorer, firstArkTransaction } from './demo-explorer.ts';
import {testNetwork} from '../../../integration/src/client/state-layer-core/test-network.ts';
import './style.css';
import '../../../prototype-onboarding/src/client/ui-layer-react/prototype-styles.css';

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

function DiagramSection({ code, label = 'Diagram' }) {
  return <section className="sandbox-diagram prototype-section" aria-label={label}>
    <div className="prototype-title-bar"><h2>{label}</h2></div>
    <DiagramContent code={code} />
  </section>;
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
  const sectionStarts = { 'Create Wallet': 'Wallets', 'Send Payment': 'Payments', 'Mint Asset': 'Assets', 'Conditional Vault': 'Smart Contracts', 'External Wallet': 'External Wallet' };
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
  const [values, setValues] = useState(() => setupWalletProfileValues(network));
  const [focusedField, setFocusedField] = useState(null);
  function submit(key, event) {
    event.preventDefault();
    const storageKey = key === 'address1' ? walletProfileStorageKey(network, 'wallet-1-address') : walletProfileStorageKey(network, 'wallet-2-mnemonic');
    window.localStorage.setItem(storageKey, values[key]);
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

const BALANCE_SOURCE = `// Arrange
import { ArkAddress } from '@arkade-os/sdk'

const network = localStorageGetItem('network')
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')
const address1 = localStorageGetItem('wallet-1-address')

const bytesToHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
function getBaseURL(network, address) {
  const { vtxoTaprootKey } = ArkAddress.decode(address)
  const script = '5120' + bytesToHex(vtxoTaprootKey)
  return 'https://' + network + '.arkade.sh/v1/indexer/vtxos?scripts=' + encodeURIComponent(script)
}

// Act
const allResponse = await fetch(getBaseURL(network, address1))
const availableResponse = await fetch(getBaseURL(network, address1) + '&spendableOnly=true')
const { vtxos: allVtxos } = await allResponse.json()
const { vtxos: availableVtxos } = await availableResponse.json()
if (!allResponse.ok || !availableResponse.ok) throw new Error('The balance request failed.')

// Assert
const total = allVtxos.reduce((sum, vtxo) => sum + Number(vtxo.amount), 0)
const available = availableVtxos.reduce((sum, vtxo) => sum + Number(vtxo.amount), 0)
const success = allResponse.ok && availableResponse.ok

console.log('Demo: Get Balance - Public Address')
console.log('Address:', address1)
console.log('Available:', available + ' sats')
console.log('Total:', total + ' sats')
console.log('VTXOs:', availableVtxos.length)
console.log('Success:', success)`;

const CREATE_WALLET_SOURCE = `// Arrange
import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

const network = localStorageGetItem('network')
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')

const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })

const wallet = await Wallet.create({
  identity,
  arkServerUrl: 'https://' + network + '.arkade.sh',
  settlementConfig: false,
})

// Act
const address = await wallet.getAddress()

// Assert
const success = Boolean(address)
console.log('Demo: Create Wallet')
console.log('Arkade Address:', address)
console.log('Success:', success)`;

const PRIVATE_BALANCE_SOURCE = `// Arrange
import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

const network = localStorageGetItem('network')
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')

const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })

const wallet = await Wallet.create({
  identity,
  arkServerUrl: 'https://' + network + '.arkade.sh',
  settlementConfig: false,
})

// Act
const balance = await wallet.getBalance()
const address = await wallet.getAddress()
const vtxos = await wallet.getVtxos()

// Assert
const success = Boolean(balance && address && Array.isArray(vtxos))
console.log('Demo: Get Balance - Private Wallet')
console.log('Address:', address)
console.log('Available:', balance.available + ' sats')
console.log('Total:', balance.total + ' sats')
console.log('VTXOs:', vtxos.length)
console.log('Success:', success)`;

const SEND_PAYMENT_SOURCE = `// Arrange
import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

const network = localStorageGetItem('network')
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')
const address1 = localStorageGetItem('wallet-1-address')

const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })
const wallet = await Wallet.create({
  identity,
  arkServerUrl: 'https://' + network + '.arkade.sh',
  settlementConfig: false,
})
const contractManager = await wallet.getContractManager()
await contractManager.refreshVtxos()
await wallet.getVtxos()

// Act
const txid = await wallet.send({
  address: address1,
  amount: 100,
})

// Assert
const success = Boolean(txid)
console.log('Demo: Send Payment')
console.log('Transaction ID:', txid)
console.log('Success:', success)`;

const EXTERNAL_WALLET_PAYMENT_SOURCE = `// Arrange
const network = document.querySelector('#network').value
const recipient = localStorage.getItem(network + '-wallet-1-address')

const amountSats = 100

// Act
const request = 'bitcoin:?ark=' + encodeURIComponent(recipient) + '&amount=0.000001'
const callback = new URL(window.location.href)
callback.search = ''
callback.hash = ''

const wallet = new URL(network === 'signet'
  ? 'https://signet.arkade.money/'
  : 'https://mutinynet.arkade.money/')
wallet.search = new URLSearchParams({
  action: 'send',
  request,
  callback: callback.toString(),
})
window.open(wallet, '_blank', 'popup,width=480,height=840,resizable=yes,scrollbars=yes')

// Assert
console.log('Demo: Send Payment from External Wallet')
console.log('Wallet URL:', wallet.toString())
console.log('Success:', Boolean(wallet))`;

const EXTERNAL_WALLET_RECEIVE_SOURCE = `// Arrange
const network = document.querySelector('#network').value
const wallet2Mnemonic = localStorage.getItem(network + '-wallet-2-mnemonic')

const externalWalletAddress = new URL(window.location.href).searchParams.get('address')
const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })
const wallet = await Wallet.create({
  identity,
  arkServerUrl: NETWORKS[network].operator,
  settlementConfig: false,
})
const contractManager = await wallet.getContractManager()

// Act
await contractManager.refreshVtxos()
await wallet.getVtxos()

const txid = await wallet.send({ address: externalWalletAddress, amount: 100 })

// Assert
console.log('Demo: Receive Payment to External Wallet')
console.log('Transaction ID:', txid)
console.log('Success:', Boolean(txid))`;

const ONBOARD_SOURCE = `// Arrange
import { Ramps } from '@arkade-os/sdk'

const boardingAddress = await wallet.getBoardingAddress()

// Act
const txid = await new Ramps(wallet).onboard()

// Assert
console.log('Demo: Onboard Bitcoin')
console.log('Boarding address:', boardingAddress)
console.log('Onboarding transaction:', txid)
console.log('Success:', Boolean(txid))`;

const OFFBOARD_SOURCE = `// Arrange
import { MnemonicIdentity, OnchainWallet, Ramps } from '@arkade-os/sdk'

const onchainWallet = await OnchainWallet.create(identity, network)
const destination = onchainWallet.address
const { fees } = await wallet.arkProvider.getInfo()

// Act
const txid = await new Ramps(wallet).offboard(destination, fees)

// Assert
console.log('Demo: Offboard Bitcoin')
console.log('Bitcoin destination:', destination)
console.log('Offboarding transaction:', txid)
console.log('Success:', Boolean(txid))`;

const RECEIVE_PAYMENT_SOURCE = `// Arrange
import { ArkAddress } from '@arkade-os/sdk'

const network = localStorageGetItem('network')
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')
const address1 = localStorageGetItem('wallet-1-address')

const { vtxoTaprootKey } = ArkAddress.decode(address1)
const script = '5120' + Array.from(vtxoTaprootKey, byte => byte.toString(16).padStart(2, '0')).join('')
const getBaseURL = (network, script) => 'https://' + network + '.arkade.sh/v1/indexer/vtxos?scripts=' + encodeURIComponent(script)

// Act
const response = await fetch(getBaseURL(network, script) + '&spendableOnly=true')
const { vtxos } = await response.json()
if (!response.ok) throw new Error('The receive payment request failed.')

// Assert
const total = vtxos.reduce((sum, vtxo) => sum + Number(vtxo.amount), 0)
if (vtxos.length === 0) throw new Error('Use Send Payment demo first.')
const success = response.ok

console.log('Demo: Receive Payment')
console.log('Address:', address1)
console.log('Total:', total + ' sats')
console.log('VTXOs:', vtxos.length)
console.log('Success:', success)`;

const PAYMENT_HISTORY_SOURCE = `// Arrange
import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

const network = localStorageGetItem('network')
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')

const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })
const wallet = await Wallet.create({
  identity,
  arkServerUrl: 'https://' + network + '.arkade.sh',
  settlementConfig: false,
})
await wallet.getVtxos()

// Act
const activities = await wallet.getActivityHistory()

// Assert
const success = Array.isArray(activities)
console.log('Demo: Payment History')
console.log('Activities:', activities.length)
activities.forEach((activity, index) => console.log(\`Activity \${index + 1}:\`, activity.type ?? activity.amount ?? activity.key?.arkTxid ?? 'Activity'))
console.log('Success:', success)`;

const MINT_ASSET_SOURCE = `// Arrange
import { InMemoryContractRepository, IndexedDBWalletRepository, MnemonicIdentity, Wallet } from '@arkade-os/sdk'

const network = localStorageGetItem('network')
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')
const assetLabel = localStorageGetItem('asset-id')

const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })
const wallet = await Wallet.create({
  identity,
  arkServerUrl: 'https://' + network + '.arkade.sh',
  settlementConfig: false,
  storage: {
    walletRepository: new IndexedDBWalletRepository(),
    contractRepository: new InMemoryContractRepository(),
  },
})
const contractManager = await wallet.getContractManager()
await contractManager.refreshVtxos()
await wallet.getVtxos()

// Act
const { assetId } = await wallet.assetManager.issue({
  amount: 1n,
  metadata: {
    ticker: assetLabel,
    name: 'Sword Level 1',
    title: 'Sword Level 1',
    level: '1',
    icon: 'https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1/sword-1.png',
    upgradeable: 'true',
    upgradePath: 'sword',
    nextLevel: '2',
  },
})
localStorage.setItem(network + '-asset-id-' + assetLabel, assetId)
localStorage.setItem(network + '-asset-id-' + assetLabel + '-level', '1')

// Assert
const success = Boolean(assetId)
console.log('Demo: Mint Asset')
console.log('Asset label:', assetLabel)
console.log('Asset ID:', assetId)
console.log('Display title: Sword Level 1')
console.log('Metadata level: 1')
console.log('Icon: https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1/sword-1.png')
console.log('Success:', success)`;

const SEND_ASSET_SOURCE = `// Arrange
import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

const network = localStorageGetItem('network')
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')
const address1 = localStorageGetItem('wallet-1-address')
const assetLabel = localStorageGetItem('asset-id')
const assetId = localStorageGetItem('asset-id-' + assetLabel)

const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })
const wallet = await Wallet.create({
  identity,
  arkServerUrl: 'https://' + network + '.arkade.sh',
  settlementConfig: false,
})
await wallet.getVtxos()

if (!assetId) throw new Error('Use Mint Asset demo first.')

// Act
const txid = await wallet.send({
  address: address1,
  assets: [{ assetId, amount: 1n }],
})

// Assert
const success = Boolean(txid)
console.log('Demo: Send Asset')
console.log('Transaction ID:', txid)
console.log('Success:', success)`;

const RECEIVE_ASSET_SOURCE = `// Arrange
import { ArkAddress } from '@arkade-os/sdk'

const network = localStorageGetItem('network')
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')
const address1 = localStorageGetItem('wallet-1-address')
const assetLabel = localStorageGetItem('asset-id')
const assetId = assetLabel === 'all' ? 'all' : localStorageGetItem('asset-id-' + assetLabel)

const { vtxoTaprootKey } = ArkAddress.decode(address1)
const script = '5120' + Array.from(vtxoTaprootKey, byte => byte.toString(16).padStart(2, '0')).join('')
const getBaseURL = (network, script) => 'https://' + network + '.arkade.sh/v1/indexer/vtxos?scripts=' + encodeURIComponent(script)

// Act
const response = await fetch(getBaseURL(network, script) + '&spendableOnly=true')
const { vtxos } = await response.json()
if (!response.ok) throw new Error('The receive asset request failed.')

// Assert
const matching = assetId === 'all' ? vtxos : vtxos.filter(vtxo => vtxo.assetId === assetId)
if (matching.length === 0) throw new Error('Use Send Asset demo first.')
const success = response.ok

console.log('Demo: Receive Asset')
console.log('Address:', address1)
console.log('Asset filter:', assetLabel)
console.log('VTXOs:', matching.length)
console.log('Success:', success)`;

const ASSET_HISTORY_SOURCE = `// Arrange
import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

const network = localStorageGetItem('network')
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')
const assetLabel = localStorageGetItem('asset-id')
const assetId = assetLabel === 'all' ? 'all' : localStorageGetItem('asset-id-' + assetLabel)

const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })
const wallet = await Wallet.create({
  identity,
  arkServerUrl: 'https://' + network + '.arkade.sh',
  settlementConfig: false,
})
await wallet.getVtxos()

// Act
const activities = await wallet.getActivityHistory()
const matching = assetId === 'all' ? activities : activities.filter(activity => activity.assetId === assetId)

// Assert
const success = Array.isArray(activities)
console.log('Demo: Asset History - Private Wallet')
console.log('Asset filter:', assetLabel)
console.log('Activities:', matching.length)
matching.forEach((activity, index) => console.log(\`Activity \${index + 1}:\`, activity.type ?? activity.assetId ?? activity.amount ?? activity.key?.arkTxid ?? 'Activity'))
console.log('Success:', success)`;

const PUBLIC_ASSET_HISTORY_SOURCE = `// Arrange
import { ArkAddress } from '@arkade-os/sdk'

const network = localStorageGetItem('network')
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')
const address1 = localStorageGetItem('wallet-1-address')
const assetLabel = localStorageGetItem('asset-id')
const assetId = assetLabel === 'all' ? 'all' : localStorageGetItem('asset-id-' + assetLabel)

const { vtxoTaprootKey } = ArkAddress.decode(address1)
const script = '5120' + Array.from(vtxoTaprootKey, byte => byte.toString(16).padStart(2, '0')).join('')
const getBaseURL = (network, script) => 'https://' + network + '.arkade.sh/v1/indexer/vtxos?scripts=' + encodeURIComponent(script)

// Act
const response = await fetch(getBaseURL(network, script) + '&spendableOnly=true')
const { vtxos } = await response.json()
if (!response.ok) throw new Error('The asset history request failed.')

// Assert
const matching = assetId === 'all' ? vtxos : vtxos.filter(vtxo => vtxo.assetId === assetId)
const success = response.ok
console.log('Demo: Asset History - Public Address')
console.log('Address:', address1)
console.log('Asset filter:', assetLabel)
console.log('VTXOs:', matching.length)
matching.forEach((vtxo, index) => console.log(\`\${index + 1}:\`, vtxo.assetId ?? vtxo.amount ?? vtxo.txid ?? 'VTXO'))
console.log('Success:', success)`;

function addressScript(address) {
  const decoded = decodeArkadeAddress(address);
  return `5120${Array.from(decoded.vtxoTaprootKey, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

function getBaseURL(network, address) {
  return `${NETWORKS[network].operator}/v1/indexer/vtxos?scripts=${encodeURIComponent(addressScript(address))}`;
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
  const sourceLines = source.split('\n');
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

function AssetSelector({ network, value, onChange, includeAll = false, label = 'Asset ID', storageKey = 'asset-id' }) {
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
  return isValidElement(node) ? inputText(node.props.children) : '';
}

function containsFormControl(node) {
  if (!isValidElement(node)) return false;
  if (node.type === 'input' || node.type === 'select' || node.type === 'textarea') return true;
  return containsFormControl(node.props.children);
}

function fieldIsEditable(nodes) {
  return nodes.some(node => {
    if (!isValidElement(node)) return false;
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
    return inputText(left[0]).trim().localeCompare(inputText(right[0]).trim());
  });
  return <>{fields.map((field, index) => <Fragment key={index}>{field}</Fragment>)}</>;
}

function OperationDemo({ demoTitle, intro, diagram, docsHref, docsTopic, docsDescription, docsSubheading, docsDetails, input, sourceId, source, contractSource, compiledSource, output, elapsedMs, running, onExecute, onRecover = undefined, recoverDisabled = true, actionLabel = 'Execute', loadingText = demoTitle, loadingBody = loadingText }) {
  const [sourceTab, setSourceTab] = useState('demo');
  const showingContract = Boolean(contractSource) && sourceTab === 'contract';
  const showingCompiled = Boolean(compiledSource) && sourceTab === 'compiled';
  const visibleSource = showingCompiled ? compiledSource : showingContract ? contractSource : source;
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
      <div className="prototype-title-bar"><h2>Demo</h2></div>
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
        <button className="sandbox-action-button" type="button" onClick={onExecute} disabled={running}>{actionLabel}</button>
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

function assetSelectionStorageKey(network) {
  return `${network}-asset-id`;
}

function mintedAssetStorageKey(network, assetLabel) {
  return `${network}-asset-id-${assetLabel}`;
}

function vaultSelectionStorageKey(network) {
  return `${network}-vault-id`;
}

function useAssetSelection(network, includeAll = false) {
  const [assetId, setAssetId] = useState(() => {
    const stored = window.localStorage.getItem(assetSelectionStorageKey(network));
    const allowed = includeAll ? ASSET_IDS : ASSET_IDS.slice(1);
    const selected = allowed.includes(stored) ? stored : (includeAll ? 'all' : '0000');
    window.localStorage.setItem(assetSelectionStorageKey(network), selected);
    return selected;
  });
  useEffect(() => {
    const stored = window.localStorage.getItem(assetSelectionStorageKey(network));
    const allowed = includeAll ? ASSET_IDS : ASSET_IDS.slice(1);
    const selected = allowed.includes(stored) ? stored : (includeAll ? 'all' : '0000');
    window.localStorage.setItem(assetSelectionStorageKey(network), selected);
    setAssetId(selected);
  }, [network, includeAll]);
  function changeAssetId(value) {
    window.localStorage.setItem(assetSelectionStorageKey(network), value);
    setAssetId(value);
  }
  return [assetId, changeAssetId];
}

function useVaultSelection(network) {
  const [vaultId, setVaultId] = useState(() => {
    const stored = window.localStorage.getItem(vaultSelectionStorageKey(network));
    const selected = ASSET_IDS.slice(1).includes(stored) ? stored : '0000';
    window.localStorage.setItem(vaultSelectionStorageKey(network), selected);
    return selected;
  });
  useEffect(() => {
    const stored = window.localStorage.getItem(vaultSelectionStorageKey(network));
    const selected = ASSET_IDS.slice(1).includes(stored) ? stored : '0000';
    window.localStorage.setItem(vaultSelectionStorageKey(network), selected);
    setVaultId(selected);
  }, [network]);
  function changeVaultId(value) {
    window.localStorage.setItem(vaultSelectionStorageKey(network), value);
    setVaultId(value);
  }
  return [vaultId, changeVaultId];
}

function DemoCreateWallet({ network }) {
  const walletProfile = setupWalletProfileValues(network);
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);

  async function execute() {
    const currentMnemonic = setupWalletProfileValues(network).mnemonic2;
    if (!currentMnemonic.trim()) {
      setOutput('Enter Wallet 2 Mnemonic on Setup Input first.\nSuccess: false');
      return;
    }
    const startedAt = begin();
    setRunning(true);
    setOutput('');
    try {
      const identity = MnemonicIdentity.fromMnemonic(currentMnemonic, { isMainnet: false });
      const wallet = await Wallet.create({ identity, arkServerUrl: NETWORKS[network].operator, settlementConfig: false });
      const address = await wallet.getAddress();
      setOutput([`Arkade Address: ${address}`, `Success: ${Boolean(address)}`].join('\n'));
      await wallet.dispose?.();
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
    } finally {
      finish(startedAt);
      setRunning(false);
    }
  }

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
      <div className="prototype-title-bar"><h2>Demo</h2></div>
      <div className="sandbox-demo-body">
        <label className="sandbox-code-label" htmlFor="create-wallet-source">Source code</label>
        <SourceCodeField id="create-wallet-source" source={CREATE_WALLET_SOURCE} />
        <button className="sandbox-action-button" type="button" onClick={execute} disabled={running}>Execute</button>
      </div>
    </section>
    <OutputSection title="Create Wallet" output={output} elapsedMs={elapsedMs} />
  </>;
}

function DemoGetBalancePrivate({ network }) {
  const walletProfile = setupWalletProfileValues(network);
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);

  async function execute() {
    const currentMnemonic = setupWalletProfileValues(network).mnemonic2;
    if (!currentMnemonic.trim()) {
      setOutput('Enter Wallet 2 Mnemonic on Setup Input first.\nSuccess: false');
      return;
    }
    const startedAt = begin();
    setRunning(true);
    setOutput('');
    try {
      const identity = MnemonicIdentity.fromMnemonic(currentMnemonic, { isMainnet: false });
      const wallet = await Wallet.create({ identity, arkServerUrl: NETWORKS[network].operator, settlementConfig: false });
      const balance = await wallet.getBalance();
      const address = await wallet.getAddress();
      const vtxos = await wallet.getVtxos();
      setOutput([
        `Address: ${address}`,
        `Available: ${balance.available} sats`,
        `Total: ${balance.total} sats`,
        `VTXOs: ${vtxos.length}`,
        `Success: ${Boolean(balance && address && Array.isArray(vtxos))}`,
      ].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: firstArkTransaction(vtxos) } });
      await wallet.dispose?.();
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
    } finally {
      finish(startedAt);
      setRunning(false);
    }
  }

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
      <div className="prototype-title-bar"><h2>Demo</h2></div>
      <div className="sandbox-demo-body">
        <label className="sandbox-code-label" htmlFor="private-balance-source">Source code</label>
        <SourceCodeField id="private-balance-source" source={PRIVATE_BALANCE_SOURCE} />
        <button className="sandbox-action-button" type="button" onClick={execute} disabled={running}>Execute</button>
      </div>
    </section>
    <OutputSection title="Private wallet - Get Balance" output={output} elapsedMs={elapsedMs} />
  </>;
}

function DemoGetBalancePublic({ network }) {
  const walletProfile = setupWalletProfileValues(network);
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);

  async function execute() {
    const startedAt = begin();
    const currentAddress = setupWalletProfileValues(network).address1;
    setRunning(true);
    setOutput('');
    try {
      const allResponse = await fetch(getBaseURL(network, currentAddress));
      const availableResponse = await fetch(`${getBaseURL(network, currentAddress)}&spendableOnly=true`);
      const allResult = await allResponse.json();
      const availableResult = await availableResponse.json();
      if (!allResponse.ok || !availableResponse.ok) throw new Error(allResult.message || availableResult.message || 'The balance request failed.');
      const allVtxos = allResult.vtxos ?? [];
      const availableVtxos = availableResult.vtxos ?? [];
      const totalSats = allVtxos.reduce((total, vtxo) => total + Number(vtxo.amount ?? 0), 0);
      const availableSats = availableVtxos.reduce((total, vtxo) => total + Number(vtxo.amount ?? 0), 0);
      setOutput([
        `Address: ${currentAddress}`,
        `Available: ${availableSats} sats`,
        `Total: ${totalSats} sats`,
        `VTXOs: ${availableVtxos.length}`,
        `Success: ${allResponse.ok && availableResponse.ok}`,
      ].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: firstArkTransaction(allVtxos) } });
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
    } finally {
      finish(startedAt);
      setRunning(false);
    }
  }

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
      <div className="prototype-title-bar"><h2>Demo</h2></div>
      <div className="sandbox-demo-body">
        <label className="sandbox-code-label" htmlFor="balance-source">Source code</label>
        <SourceCodeField id="balance-source" source={BALANCE_SOURCE} />
        <button className="sandbox-action-button" type="button" onClick={execute} disabled={running}>Execute</button>
      </div>
    </section>
    <OutputSection title="Public address - Get Balance" output={output} elapsedMs={elapsedMs} />
  </>;
}

async function createDemoWallet(network, { isolated = false, signerOnly = false, freshContracts = false } = {}) {
  const wallet2Mnemonic = setupWalletProfileValues(network).mnemonic2;
  if (!wallet2Mnemonic.trim()) throw new Error('Enter Wallet 2 Mnemonic on Setup Input first.');
  const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false });
  const storage = isolated
    ? { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() }
    : freshContracts
      ? { walletRepository: new IndexedDBWalletRepository(), contractRepository: new InMemoryContractRepository() }
      : undefined;
  const wallet = await Wallet.create({
    identity,
    arkServerUrl: NETWORKS[network].operator,
    walletMode: signerOnly ? 'static' : 'hd',
    lookAheadWindow: 20,
    settlementConfig: false,
    ...(storage ? { storage } : {}),
  });
  // Contract Claim/Recover uses only the creator signature. It must not spend
  // the two-minute window discovering unrelated HD addresses and balances.
  if (signerOnly) return wallet;
  const contractManager = await wallet.getContractManager();
  await contractManager.refreshVtxos();
  await wallet.getVtxos();
  return wallet;
}

async function getWallet2BitcoinAddress(network) {
  const wallet2Mnemonic = setupWalletProfileValues(network).mnemonic2;
  if (!wallet2Mnemonic.trim()) throw new Error('Enter Wallet 2 Mnemonic on Setup Input first.');
  const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false });
  const onchainWallet = await OnchainWallet.create(identity, network);
  return onchainWallet.address;
}

async function withFreshDemoWallet(network, operation, options) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const wallet = await createDemoWallet(network, options);
    try {
      return await operation(wallet);
    } catch (error) {
      lastError = error;
      if (!String(error?.message || error).includes('VTXO_NOT_FOUND') || attempt === 1) throw error;
    } finally {
      try { await wallet.dispose?.(); } catch { /* keep the next attempt available */ }
    }
    await new Promise(resolve => window.setTimeout(resolve, 250));
  }
  throw lastError;
}

function getMintedAssetId(network, assetLabel) {
  return assetLabel === 'all' ? 'all' : window.localStorage.getItem(mintedAssetStorageKey(network, assetLabel)) || '';
}

function DemoOnboardBitcoin({ network }) {
  const values = setupWalletProfileValues(network);
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);

  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    let wallet;
    let boardingAddress = '';
    try {
      wallet = await createDemoWallet(network, { isolated: true });
      boardingAddress = await wallet.getBoardingAddress();
      const txid = await new Ramps(wallet).onboard();
      setOutput([`Boarding Address: ${boardingAddress}`, `Onboarding Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'bitcoin-transaction', identifier: txid } });
    } catch (error) {
      setOutput([...(boardingAddress ? [`Boarding Address: ${boardingAddress}`, 'Next: fund this address with testnet BTC, then retry.'] : []), `Error: ${error.message}`, 'Success: false'].join('\n'), { explorer: boardingAddress ? { network, kind: 'bitcoin-address', identifier: boardingAddress } : undefined });
    } finally {
      try { await wallet?.dispose?.(); } catch { /* keep the demo result visible */ }
      finish(startedAt); setRunning(false);
    }
  }

  return <OperationDemo demoTitle="Onboard Bitcoin" intro="Demonstrates moving Bitcoin into Arkade." diagram={DIAGRAMS.onboard} loadingText="Onboard Bitcoin" docsHref={DOCS_URLS.ramps} docsTopic="Ramps: onboarding Bitcoin" sourceId="onboard-bitcoin-source" source={ONBOARD_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="onboard-bitcoin-mnemonic">Wallet 2 Mnemonic</label>
    <input id="onboard-bitcoin-mnemonic" value={maskMnemonic(values.mnemonic2)} readOnly />
  </>} />;
}

function DemoOffboardBitcoin({ network }) {
  const values = setupWalletProfileValues(network);
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
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

  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    let wallet;
    try {
      wallet = await createDemoWallet(network, { isolated: true });
      const destinationAddress = await getWallet2BitcoinAddress(network);
      const { fees } = await wallet.arkProvider.getInfo();
      const txid = await new Ramps(wallet).offboard(destinationAddress, fees);
      setOutput([`Bitcoin Destination: ${destinationAddress}`, `Offboarding Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'bitcoin-transaction', identifier: txid } });
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
    } finally {
      try { await wallet?.dispose?.(); } catch { /* keep the demo result visible */ }
      finish(startedAt); setRunning(false);
    }
  }

  return <OperationDemo demoTitle="Offboard Bitcoin" intro="Demonstrates moving Bitcoin from Arkade back on-chain." diagram={DIAGRAMS.offboard} loadingText="Offboard Bitcoin" docsHref={DOCS_URLS.ramps} docsTopic="Ramps: offboarding Bitcoin" sourceId="offboard-bitcoin-source" source={OFFBOARD_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="offboard-bitcoin-mnemonic">Wallet 2 Mnemonic</label>
    <input id="offboard-bitcoin-mnemonic" value={maskMnemonic(values.mnemonic2)} readOnly />
    <label htmlFor="offboard-bitcoin-destination">Bitcoin Destination</label>
    <input id="offboard-bitcoin-destination" value={destination || 'Deriving from Wallet 2'} readOnly />
  </>} />;
}

function DemoSendPayment({ network }) {
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    let wallet;
    try {
      wallet = await createDemoWallet(network);
      const address1 = setupWalletProfileValues(network).address1;
      const txid = await wallet.send({ address: address1, amount: 100 });
      setOutput([`Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: txid } });
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
    try { await wallet?.dispose?.(); } catch { /* keep the demo result visible */ }
  }
  return <OperationDemo demoTitle="Send Payment" intro="Demonstrates sending a payment to an Arkade address." diagram={DIAGRAMS.sendPayment} loadingText="Send payment" docsHref={DOCS_URLS.sendPayment} docsTopic="Sending payments" sourceId="send-payment-source" source={SEND_PAYMENT_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="send-payment-mnemonic">Wallet 2 Mnemonic</label>
    <input id="send-payment-mnemonic" value={maskMnemonic(setupWalletProfileValues(network).mnemonic2)} readOnly />
    <label htmlFor="send-payment-address">Wallet 1 Address</label>
    <input id="send-payment-address" value={setupWalletProfileValues(network).address1} readOnly />
    <label htmlFor="send-payment-amount">Amount</label>
    <input id="send-payment-amount" value="100 sats" readOnly />
  </>} />;
}

function vaultErrorMessage(error) {
  const message = error instanceof Error ? error.message : '';
  if (/^vault-[a-z-]+$/.test(message) || /^VaultID [0-9]{4} (?:is already taken\.|does not exist\.|has no verified active output\.)/.test(message) || message === 'Wallet2Mnemonic is required.') return message;
  return 'vault-network-operation-unavailable';
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
    let active = true;
    setCompiledSource('// The compiled artifact will be available here after "Execute"');
    if (action === 'create') void readStoredConditionalVault(network, vaultId).then(descriptor => {
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
      const values = setupWalletProfileValues(network);
      let next = action === 'create' && !recover ? null : await readStoredConditionalVault(network, vaultId);
      let result;
      if (action === 'create' && !recover) {
        if (!values.mnemonic2) throw new Error('Wallet2Mnemonic is required.');
        const wallet = await createDemoWallet(network, { isolated: true });
        try {
          const created = await createConditionalVault(network, wallet, vaultId);
          result = created;
          next = created.inspection?.descriptor;
        } finally { try { await wallet.dispose?.(); } catch { /* Preserve the original financial result. */ } }
      } else if (action === 'increment' && recover !== true) {
        if (!next) throw new Error(`VaultID ${vaultIdSelection} does not exist. Create it first in this browser.`);
        result = await incrementConditionalVault(network, next);
      } else if (action === 'claim' || recover === true) {
        if (!values.mnemonic2) throw new Error('Wallet2Mnemonic is required.');
        if (!next) throw new Error(`VaultID ${vaultIdSelection} does not exist.`);
        const wallet = await createDemoWallet(network, { isolated: true, signerOnly: true });
        try {
          result = await claimConditionalVault(network, wallet, next, recover === true);
        } finally { try { await wallet.dispose?.(); } catch { /* Preserve the original financial result. */ } }
      } else {
        if (!next) throw new Error(`VaultID ${vaultIdSelection} does not exist. Create it first in this browser.`);
        result = { inspection: await checkConditionalVault(network, next) };
      }
      const inspected = result.inspection;
      if (inspected) {
        next = inspected.descriptor;
        setCompiledSource(conditionalVaultArtifact(next));
      }
      const success = action === 'check' && !recover ? Boolean(inspected && ['locked','claimable','claimed','recovered','expired'].includes(inspected.status)) : result.outcome === 'verified' || result.outcome === 'already-resolved';
      setOutput([`Network: ${network}`, `Vault ID: ${next?.id ?? vaultIdSelection}`, 'Amount: 1000 sats', 'Transaction fee: 0 sats', ...(result.outcome ? [`Outcome: ${result.outcome}`] : []),
        ...(inspected ? [`Progress: ${inspected.progress ?? 'unknown'} / 3`, `Status: ${inspected.status}`, `Time left: ${Math.max(0, next.deadline - Math.floor(Date.now()/1000))} seconds`, `Deadline: ${new Date(next.deadline*1000).toISOString()}`, `Funding Transaction ID: ${next.funding.transactionId}`, ...inspected.evidence.map(e => `Verified Transaction ID: ${e.transactionId}`)] : []),
        ...(result.reason ? [`Reason: ${result.reason}`] : []), `Success: ${success}`].join('\n'), {
          explorer: inspected && ['locked', 'claimable', 'expired', 'claimed', 'recovered', 'pending'].includes(inspected.status) ? { network, kind: 'ark-transaction', identifier: inspected.evidence.at(-1)?.transactionId ?? next.funding.transactionId } : undefined,
          recoverable: inspected?.status === 'expired' && Boolean(inspected.activeOutput),
          vaultId: vaultIdSelection,
          creatorPublicKey: inspected?.descriptor.creatorPublicKey,
        });
    } catch (error) { setOutput([`Error: ${vaultErrorMessage(error)}`, 'Success: false'].join('\n')); }
    finally { setElapsedMs(Math.round(performance.now() - startedAt)); setRunning(false); }
  }
  const values = setupWalletProfileValues(network);
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
  return <><OperationDemo demoTitle={titles[action]} intro={vaultOverview.intro} diagram={vaultOverview.diagram} loadingText={titles[action]} docsHref={DOCS_URLS.contracts} docsTopic="Arkade smart contracts" sourceId={`conditional-vault-${action}-source`} source={conditionalVaultDemoSource(action)} contractSource={action === 'create' ? contractSource : undefined} compiledSource={action === 'create' ? compiledSource : undefined} output={output} elapsedMs={elapsedMs} running={running} onExecute={() => execute()} onRecover={() => execute(true)} recoverDisabled={running || !details.recoverable || details.vaultId !== vaultIdSelection || !creatorPublicKey || creatorPublicKey !== details.creatorPublicKey} input={<>
    <AssetSelector network={network} value={vaultIdSelection} onChange={setVaultIdSelection} label="Vault ID" storageKey="vault-id" />
    {(action === 'create' || action === 'claim') && <><label htmlFor={`conditional-vault-mnemonic-${action}`}>Wallet 2 Mnemonic</label><input id={`conditional-vault-mnemonic-${action}`} value={maskMnemonic(values.mnemonic2)} readOnly /></>}
    {action === 'check' && <><label htmlFor={`conditional-vault-address-${action}`}>Wallet 1 Public Address (reader only)</label><input id={`conditional-vault-address-${action}`} value={values.address1} readOnly /></>}
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
      const address = setupWalletProfileValues(network).address1;
      const provider = new RestArkProvider(NETWORKS[network].operator);
      const info = await provider.getInfo();
      validateArkadeAddress(address, info, network);
      const link = walletPaymentUrl({ network, address, amountSats: amount, callback: walletCallbackUrl(window.location.href) });
      const popup = window.open(link, '_blank', 'popup,width=480,height=840,resizable=yes,scrollbars=yes');
      if (!popup) {
        window.location.assign(link);
        return;
      }
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
      finish(startedAt);
      startedAtRef.current = null;
      setRunning(false);
    }
  }

  return <OperationDemo demoTitle="Send Payment from External Wallet" intro="Demonstrates sending a payment through an external wallet." diagram={DIAGRAMS.externalSend} loadingText="Get payment recipient" loadingBody={['EXTERNAL WALLET - Send Payment', '(See Wallet In External Window)']} docsHref={DOCS_URLS.externalWallet} docsTopic="Arkade Wallet app links" docsDescription="External Wallet?" docsSubheading="Pros/cons" docsDetails={<div className="sandbox-docs-details"><p>An external wallet is a separate Arkade wallet app that approves or receives the payment through a wallet link.</p><ul><li><strong>Pros:</strong> wallet keys stay outside the prototype.</li><li><strong>Cons:</strong> the popup must be available and the user must approve the handoff.</li></ul><blockquote><p>Everything shown in this prototype sandbox can be done with either an external wallet or an internal wallet.</p></blockquote></div>} sourceId="external-wallet-payment-source" source={EXTERNAL_WALLET_PAYMENT_SOURCE} output={output || callbackResult} elapsedMs={elapsedMs} running={running} onExecute={openWallet} actionLabel="Send Payment from External Wallet" input={<>
    <label htmlFor="external-wallet-address">Recipient: Wallet 1 Address</label>
    <input id="external-wallet-address" value={setupWalletProfileValues(network).address1} readOnly spellCheck="false" />
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
      const provider = new RestArkProvider(NETWORKS[network].operator);
      const info = await provider.getInfo();
      validateArkadeAddress(address, info, network);
      const txid = await withFreshDemoWallet(network, wallet => wallet.send({ address, amount: 100 }));
      setOutput([`External wallet address: ${address}`, `Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: txid } });
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

  function receivePayment() {
    const startedAt = begin();
    waitingForWalletRef.current = startedAt;
    setRunning(true);
    setOutput('');
    try {
      const link = walletConnectUrl({ network, callback: walletCallbackUrl(window.location.href) });
      const popup = window.open(link, '_blank', 'popup,width=480,height=840,resizable=yes,scrollbars=yes');
      if (!popup) {
        window.location.assign(link);
        return;
      }
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
      finish(startedAt);
      setRunning(false);
    }
  }

  return <OperationDemo demoTitle="Receive Payment to External Wallet" intro="Demonstrates receiving a payment through an external wallet." diagram={DIAGRAMS.externalReceive} loadingText="Get external wallet address" loadingBody={['EXTERNAL WALLET - Send Payment', '(See Wallet In External Window)']} docsHref={DOCS_URLS.externalWallet} docsTopic="Arkade Wallet app links" docsDescription="External Wallet?" docsSubheading="Pros/cons" docsDetails={<div className="sandbox-docs-details"><p>An external wallet is a separate Arkade wallet app that approves or receives the payment through a wallet link.</p><ul><li><strong>Pros:</strong> wallet keys stay outside the prototype.</li><li><strong>Cons:</strong> the popup must be available and the user must approve the handoff.</li></ul><blockquote><p>Everything shown in this prototype sandbox can be done with either an external wallet or an internal wallet.</p></blockquote></div>} sourceId="external-wallet-receive-source" source={EXTERNAL_WALLET_RECEIVE_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={receivePayment} actionLabel="Receive Payment to External Wallet" input={<>
    <label htmlFor="external-wallet-receive-address">External Wallet Address</label>
    <input id="external-wallet-receive-address" value={externalAddress} readOnly placeholder="Choose an external wallet" spellCheck="false" />
    <label htmlFor="external-wallet-receive-mnemonic">Wallet 2 Mnemonic</label>
    <input id="external-wallet-receive-mnemonic" value={maskMnemonic(setupWalletProfileValues(network).mnemonic2)} readOnly />
    <label htmlFor="external-wallet-receive-amount">Amount</label>
    <input id="external-wallet-receive-amount" value="100 sats" readOnly />
  </>} />;
}

function DemoReceivePayment({ network }) {
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    try {
      const address1 = setupWalletProfileValues(network).address1;
      const response = await fetch(`${getBaseURL(network, address1)}&spendableOnly=true`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'The receive request failed.');
      const vtxos = result.vtxos ?? [];
      if (vtxos.length === 0) throw new Error('Use Send Payment demo first.');
      const total = vtxos.reduce((sum, vtxo) => sum + Number(vtxo.amount ?? 0), 0);
      setOutput([`Address: ${address1}`, `Total: ${total} sats`, `VTXOs: ${vtxos.length}`, `Success: ${response.ok}`].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: firstArkTransaction(vtxos) } });
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Receive Payment" intro="Demonstrates checking for a payment sent to an Arkade address." diagram={DIAGRAMS.receivePayment} loadingText="Get payment address" docsHref={DOCS_URLS.receivePayment} docsTopic="Receiving payments" sourceId="receive-payment-source" source={RECEIVE_PAYMENT_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="receive-payment-address">Wallet 1 Address</label>
    <input id="receive-payment-address" value={setupWalletProfileValues(network).address1} readOnly />
  </>} />;
}

function numberedPreviews(items, getValue, label = 'Activity') {
  return items.map((item, index) => `${label} ${index + 1}: ${getValue(item)}`);
}

function DemoPaymentHistory({ network }) {
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    try {
      const wallet = await createDemoWallet(network);
      const activities = await wallet.getActivityHistory();
      setOutput([
        `Activities: ${activities.length}`,
        ...numberedPreviews(activities, activity => activity.type ?? activity.amount ?? activity.key?.arkTxid ?? 'Activity'),
        `Success: ${Array.isArray(activities)}`,
      ].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: firstArkTransaction(activities) } });
      await wallet.dispose?.();
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Payment History" intro="Demonstrates reviewing a wallet’s payment history." diagram={DIAGRAMS.paymentHistory} loadingText="Get payment history" docsHref={DOCS_URLS.paymentHistory} docsTopic="Payment history" sourceId="payment-history-source" source={PAYMENT_HISTORY_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="payment-history-mnemonic">Wallet 2 Mnemonic</label>
    <input id="payment-history-mnemonic" value={maskMnemonic(setupWalletProfileValues(network).mnemonic2)} readOnly />
  </>} />;
}

function DemoMintAsset({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network);
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    try {
      const result = await withFreshDemoWallet(network, wallet => wallet.assetManager.issue({ amount: 1n, metadata: { ticker: assetId, name: LEVEL_ONE_TITLE, title: LEVEL_ONE_TITLE, level: '1', icon: LEVEL_ONE_ICON, upgradeable: 'true', upgradePath: 'sword', nextLevel: '2' } }), { freshContracts: true });
      window.localStorage.setItem(mintedAssetStorageKey(network, assetId), result.assetId);
      window.localStorage.setItem(`${mintedAssetStorageKey(network, assetId)}-level`, '1');
      setOutput([`Asset label: ${assetId}`, `Asset ID: ${result.assetId}`, `Display title: ${LEVEL_ONE_TITLE}`, 'Metadata level: 1', `Icon: ${LEVEL_ONE_ICON}`, `Success: ${Boolean(result.assetId)}`].join('\n'), { explorer: { network, kind: 'asset', identifier: result.assetId } });
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Mint Asset" intro="Demonstrates creating a new Arkade asset." diagram={DIAGRAMS.mintAsset} loadingText="Mint asset" docsHref={DOCS_URLS.mintAsset} docsTopic="Issue assets" docsDetails={<div className="sandbox-docs-details"><p>Arkade supports issuing assets with or without a control asset. This demo showcases issuing without a control asset, so the asset has a fixed supply and cannot be reissued later.</p></div>} sourceId="mint-asset-source" source={MINT_ASSET_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="mint-asset-mnemonic">Wallet 2 Mnemonic</label>
    <input id="mint-asset-mnemonic" value={maskMnemonic(setupWalletProfileValues(network).mnemonic2)} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} />
  </>} />;
}

function DemoSendAsset({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network);
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    try {
      const wallet = await createDemoWallet(network);
      const address1 = setupWalletProfileValues(network).address1;
      const actualAssetId = getMintedAssetId(network, assetId);
      if (!actualAssetId) throw new Error('Use Mint Asset demo first.');
      const txid = await wallet.send({ address: address1, assets: [{ assetId: actualAssetId, amount: 1n }] });
      setOutput([`Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: txid } });
      await wallet.dispose?.();
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Send Asset" intro="Demonstrates sending an Arkade asset to an address." diagram={DIAGRAMS.sendAsset} loadingText="Send asset" docsHref={DOCS_URLS.sendAsset} docsTopic="Send assets" sourceId="send-asset-source" source={SEND_ASSET_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="send-asset-mnemonic">Wallet 2 Mnemonic</label>
    <input id="send-asset-mnemonic" value={maskMnemonic(setupWalletProfileValues(network).mnemonic2)} readOnly />
    <label htmlFor="send-asset-address">Wallet 1 Address</label>
    <input id="send-asset-address" value={setupWalletProfileValues(network).address1} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} />
  </>} />;
}

function DemoReceiveAsset({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network, true);
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    try {
      const address1 = setupWalletProfileValues(network).address1;
      const response = await fetch(`${getBaseURL(network, address1)}&spendableOnly=true`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'The receive request failed.');
      const vtxos = result.vtxos ?? [];
      const actualAssetId = getMintedAssetId(network, assetId);
      const matching = assetId === 'all' ? vtxos : vtxos.filter(vtxo => vtxo.assetId === actualAssetId);
      if (matching.length === 0) throw new Error('Use Send Asset demo first.');
      setOutput([`Address: ${address1}`, `Asset filter: ${assetId}`, `VTXOs: ${matching.length}`, `Success: ${response.ok}`].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: firstArkTransaction(matching) } });
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Receive Asset" intro="Demonstrates checking for assets received at an address." diagram={DIAGRAMS.receiveAsset} loadingText="Get asset balance" docsHref={DOCS_URLS.receiveAsset} docsTopic="Check asset balance" sourceId="receive-asset-source" source={RECEIVE_ASSET_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="receive-asset-address">Wallet 1 Address</label>
    <input id="receive-asset-address" value={setupWalletProfileValues(network).address1} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} includeAll />
  </>} />;
}

function DemoAssetHistory({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network, true);
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    try {
      const wallet = await createDemoWallet(network);
      const activities = await wallet.getActivityHistory();
      const actualAssetId = getMintedAssetId(network, assetId);
      const matching = assetId === 'all' ? activities : activities.filter(activity => activity.assetId === actualAssetId);
      setOutput([
        `Asset filter: ${assetId}`,
        `Activities: ${matching.length}`,
        ...numberedPreviews(matching, activity => activity.type ?? activity.assetId ?? activity.amount ?? activity.key?.arkTxid ?? 'Activity'),
        `Success: ${Array.isArray(activities)}`,
      ].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: firstArkTransaction(matching) } });
      await wallet.dispose?.();
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Asset History - Private Wallet" intro="Demonstrates reviewing asset activity for a wallet." diagram={DIAGRAMS.privateAssetHistory} loadingText="Get asset history for Wallet 2" docsHref={DOCS_URLS.assetHistory} docsTopic="Check asset balance" sourceId="asset-history-source" source={ASSET_HISTORY_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="asset-history-mnemonic">Wallet 2 Mnemonic</label>
    <input id="asset-history-mnemonic" value={maskMnemonic(setupWalletProfileValues(network).mnemonic2)} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} includeAll />
  </>} />;
}

function DemoAssetHistoryPublic({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network, true);
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    try {
      const address1 = setupWalletProfileValues(network).address1;
      const response = await fetch(`${getBaseURL(network, address1)}&spendableOnly=true`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'The asset history request failed.');
      const vtxos = result.vtxos ?? [];
      const actualAssetId = getMintedAssetId(network, assetId);
      const matching = assetId === 'all' ? vtxos : vtxos.filter(vtxo => vtxo.assetId === actualAssetId);
      setOutput([
        `Address: ${address1}`,
        `Asset filter: ${assetId}`,
        `VTXOs: ${matching.length}`,
        ...numberedPreviews(matching, vtxo => vtxo.assetId ?? vtxo.amount ?? vtxo.txid ?? 'VTXO', 'VTXO'),
        `Success: ${response.ok}`,
      ].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: firstArkTransaction(matching) } });
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Asset History - Public Address" intro="Demonstrates reviewing asset activity for a public address." diagram={DIAGRAMS.publicAssetHistory} loadingText="Get asset history for public address" docsHref={DOCS_URLS.assetHistory} docsTopic="Check asset balance" sourceId="public-asset-history-source" source={PUBLIC_ASSET_HISTORY_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="public-asset-history-address">Wallet 1 Address</label>
    <input id="public-asset-history-address" value={setupWalletProfileValues(network).address1} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} includeAll />
  </>} />;
}

function DemoUpgradeAsset({ network }) {
  const [assetId, setAssetId] = useAssetSelection(network);
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    let wallet;
    try {
      const sourceAssetId = getMintedAssetId(network, assetId);
      if (!sourceAssetId) throw new Error('Use Mint Asset demo first so this wallet owns the level-one source asset.');
      const sourceLevel = window.localStorage.getItem(`${mintedAssetStorageKey(network, assetId)}-level`) || '1';
      wallet = await createDemoWallet(network, { freshContracts: true });
      const result = await executeAssetUpgrade({ wallet, request: createAssetUpgradeRequest(network, assetId, sourceAssetId, sourceLevel) });
      const record = result.record;
      setOutput([
        `Source Asset ID: ${record.sourceAssetId}`,
        `Source Display Title: ${record.sourceTitle ?? LEVEL_ONE_TITLE}`,
        `Source Metadata Level: ${record.sourceLevel ?? '1'}`,
        `Replacement Asset ID: ${record.replacementAssetId ?? 'unresolved'}`,
        `Replacement Display Title: ${record.replacementTitle ?? LEVEL_TWO_TITLE}`,
        `Replacement Metadata Level: ${record.replacementLevel ?? '2'}`,
        `Phase: ${record.phase}`,
        ...(record.issueTransactionId ? [`Issue Transaction ID: ${record.issueTransactionId}`] : []),
        ...(record.burnTransactionId ? [`Burn Transaction ID: ${record.burnTransactionId}`] : []),
        ...(result.message ? [`Recovery: ${result.message}`] : []),
        `Success: ${result.status === 'complete'}`,
      ].join('\n'), result.status === 'complete' && record.replacementAssetId ? {
        explorers: [
          { label: 'Open On Explorer (Previous Item)', target: { network, kind: 'asset', identifier: record.sourceAssetId } },
          { label: 'Open On Explorer (Current Item)', target: { network, kind: 'asset', identifier: record.replacementAssetId } },
        ],
      } : record.burnTransactionId ? { explorer: { network, kind: 'ark-transaction', identifier: record.burnTransactionId } } : undefined);
      if (result.status === 'complete' && record.replacementAssetId) {
        window.localStorage.setItem(mintedAssetStorageKey(network, assetId), record.replacementAssetId);
        window.localStorage.setItem(`${mintedAssetStorageKey(network, assetId)}-level`, record.replacementLevel ?? '2');
      }
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
    } finally {
      try { await wallet?.dispose?.(); } catch { /* keep the demo result visible */ }
      finish(startedAt); setRunning(false);
    }
  }
  return <OperationDemo demoTitle="Upgrade Asset" intro="Demonstrates replacing an upgradeable sword with its next immutable level in the same mnemonic-backed wallet. This is an issue-verify-burn sequence, not native reissuance." diagram={DIAGRAMS.assetUpgrade} loadingText="Upgrade asset" docsHref={DOCS_URLS.mintAsset} docsTopic="Issue assets" docsDetails={<div className="sandbox-docs-details"><p>Upgrade reads the source sword metadata, issues the next level with its matching title, level, and icon, verifies that the replacement is owned, then burns the source. Level 1 upgrades to Level 2, and Level 2 upgrades to Level 3. Level 3 is terminal.</p></div>} sourceId="asset-upgrade-source" source={ASSET_UPGRADE_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="asset-upgrade-mnemonic">Wallet 2 Mnemonic</label>
    <input id="asset-upgrade-mnemonic" value={maskMnemonic(setupWalletProfileValues(network).mnemonic2)} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} />
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
  setupWalletProfileValues(network);
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
        {!homeActive && !setupActive && activeDemo === 14 && <DemoConditionalVault key={`${network}-create`} network={network} action="create" />}
        {!homeActive && !setupActive && activeDemo === 15 && <DemoConditionalVault key={`${network}-increment`} network={network} action="increment" />}
        {!homeActive && !setupActive && activeDemo === 16 && <DemoConditionalVault key={`${network}-claim`} network={network} action="claim" />}
        {!homeActive && !setupActive && activeDemo === 17 && <DemoConditionalVault key={`${network}-check`} network={network} action="check" />}
        {!homeActive && !setupActive && activeDemo === 12 && <DemoExternalWalletPayment network={network} />}
        {!homeActive && !setupActive && activeDemo === 13 && <DemoExternalWalletReceivePayment network={network} />}
        </DemoOutputScope.Provider>
      </main>
    </div>
    <footer className="spike-footer" aria-label="Footer" />
  </div>;
}


