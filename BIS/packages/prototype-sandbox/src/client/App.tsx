import { useEffect, useRef, useState } from 'react';
import { MnemonicIdentity, RestArkProvider, Wallet } from '@arkade-os/sdk';
import { NETWORKS, NETWORK_IDS } from '../../../prototype-faucet/src/shared/network-config.ts';
import { decodeArkadeAddress, validateArkadeAddress } from '../../../prototype-faucet/src/shared/faucet-core.ts';
import { DEMOS, HOME_PATH, LANDING_VISITED_STORAGE_KEY, NETWORK_STORAGE_KEY, SETUP_PATH, getActiveDemo, isHomePath, isSetupPath, setupNetworkValue, setupWalletProfileValues, walletCallbackUrl, walletConnectUrl, walletPaymentUrl, walletProfileStorageKey, walletUrl } from './navigation.ts';
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
  paymentHistory: 'https://docs.arkadeos.com/wallets/operations/activity-history',
  mintAsset: 'https://docs.arkadeos.com/wallets/operations/assets/issue-assets',
  sendAsset: 'https://docs.arkadeos.com/wallets/operations/assets/send-assets',
  receiveAsset: 'https://docs.arkadeos.com/wallets/operations/assets/check-balance',
  assetHistory: 'https://docs.arkadeos.com/wallets/operations/assets/check-balance',
  externalWallet: 'https://github.com/arkade-os/wallet',
});

function DocsSection({ href, topic, description, subheading, mainLink = false, linkLabel }) {
  return <section className="sandbox-docs prototype-section" aria-label="Docs">
    <div className="prototype-title-bar"><h2>Docs</h2></div>
    <div className="sandbox-docs-body">
      {description && <p className="sandbox-docs-description">{description}</p>}
      {subheading && <h3 className="sandbox-docs-subheading">{subheading}</h3>}
      {linkLabel
        ? <ul className="sandbox-docs-list"><li><a href={href} target="_blank" rel="noreferrer">{linkLabel}</a></li></ul>
        : <ul className="sandbox-docs-list"><li>{mainLink ? <a href={href} target="_blank" rel="noreferrer">See Arkadeos Docs</a> : <>See Arkadeos Docs - <a href={href} target="_blank" rel="noreferrer">{topic}</a></>}</li></ul>}
    </div>
  </section>;
}

function HomeSection() {
  return <section className="sandbox-home prototype-section" aria-label="Docs">
    <div className="prototype-title-bar"><h2>Docs</h2></div>
    <div className="sandbox-home-body">
      <p>This interactive guide is here to help you learn how to use the Arkade protocol with a working wallet and real examples.</p>
      <p>Each demo focuses on one practical operation, so you can inspect the source, run it, and see the result.</p>
      <p>Start with Get Wallet, then move through the demos as you become familiar with the flow.</p>
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
  const sectionStarts = { 'Get Wallet': 'Payments', 'Mint Asset': 'Assets', 'External Wallet': 'External Wallet' };
  const demoGroups = DEMOS.reduce((groups, demo) => {
    const existing = groups.find(group => group[0].subject === demo.subject);
    if (existing) existing.push(demo);
    else groups.push([demo]);
    return groups;
  }, []);
  return <nav className="sandbox-navigation prototype-section" aria-label="Prototype Interactive Docs navigation">
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
        const hasVariants = orderedGroup.length > 1;
        const groupActive = activeRecord?.subject === defaultDemo.subject;
        return <div className="sandbox-navigation-group-block" key={defaultDemo.subject}>
          {sectionStarts[defaultDemo.subject] && <div className="sandbox-navigation-section" role="heading" aria-level="3">{sectionStarts[defaultDemo.subject]}</div>}
          <div className={`sandbox-navigation-group${hasVariants ? ' sandbox-navigation-group-variants' : ''}`}>
            {defaultDemo.subject !== 'External Wallet' && (groupActive && !hasVariants
              ? <button type="button" disabled aria-current="page">{defaultDemo.subject}</button>
              : <a className={groupActive ? 'sandbox-navigation-group-active' : undefined} href={defaultDemo.path} onClick={event => { event.preventDefault(); onNavigate(defaultDemo.path); }}>{defaultDemo.subject}</a>)}
            {hasVariants && <div className="sandbox-navigation-children">
              {orderedGroup.map(demo => demo.number === activeDemo
                ? <button key={demo.number} type="button" disabled aria-current="page">{demo.title}</button>
                : <a key={demo.number} href={demo.path} onClick={event => { event.preventDefault(); onNavigate(demo.path); }}>{demo.title}</a>)}
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
    ['address1', 'Wallet 1 Address'], ['mnemonic2', 'Wallet 2 Mnemonic'],
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

const BALANCE_SOURCE = `import { ArkAddress } from '@arkade-os/sdk'

// Arrange
// No wallet or mnemonic is needed for a public address lookup.
const network = document.querySelector('#network').value
const address1 = localStorage.getItem(network + '-wallet-1-address')

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

console.log('Get Balance - Public Address')
console.log('Address:', address1)
console.log('Available:', available + ' sats')
console.log('Total:', total + ' sats')
console.log('VTXOs:', availableVtxos.length)
console.log('Success:', success)`;

const CREATE_WALLET_SOURCE = `import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

// Arrange
const network = document.querySelector('#network').value
const wallet2Mnemonic = localStorage.getItem(network + '-wallet-2-mnemonic')
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
console.log('Get Wallet')
console.log('Arkade Address:', address)
console.log('Success:', success)`;

const PRIVATE_BALANCE_SOURCE = `import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

// Arrange
const network = document.querySelector('#network').value
const wallet2Mnemonic = localStorage.getItem(network + '-wallet-2-mnemonic')
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
console.log('Get Balance - Private Wallet')
console.log('Address:', address)
console.log('Available:', balance.available + ' sats')
console.log('Total:', balance.total + ' sats')
console.log('VTXOs:', vtxos.length)
console.log('Success:', success)`;

const SEND_PAYMENT_SOURCE = `import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

// Arrange
const network = document.querySelector('#network').value
const wallet2Mnemonic = localStorage.getItem(network + '-wallet-2-mnemonic')
const address1 = localStorage.getItem(network + '-wallet-1-address')
const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })
const wallet = await Wallet.create({
  identity,
  arkServerUrl: 'https://' + network + '.arkade.sh',
  settlementConfig: false,
})
await wallet.getVtxos()

// Act
const txid = await wallet.send({
  address: address1,
  amount: 100,
})

// Assert
const success = Boolean(txid)
console.log('Send Payment')
console.log('Transaction ID:', txid)
console.log('Success:', success)`;

const EXTERNAL_WALLET_PAYMENT_SOURCE = `// Send from the external wallet to Wallet 1. No mnemonic or private key enters this demo.
const network = document.querySelector('#network').value
const recipient = localStorage.getItem(network + '-wallet-1-address')
const amountSats = 100

// Arkade addresses belong in BIP21's ark parameter. 100 sats is 0.000001 BTC.
const request = 'bitcoin:?ark=' + encodeURIComponent(recipient) + '&amount=0.000001'
const callback = new URL(window.location.href)
callback.search = ''
callback.hash = ''

// Arkade Wallet shows the selected network and the prefilled Arkade payment.
const wallet = new URL(network === 'signet'
  ? 'https://signet.arkade.money/'
  : 'https://mutinynet.arkade.money/')
wallet.search = new URLSearchParams({
  action: 'send',
  request,
  callback: callback.toString(),
})
window.location.assign(wallet)`;

const EXTERNAL_WALLET_RECEIVE_SOURCE = `// The external wallet shares its Arkade address, then Wallet 2 pays it.
const externalWalletAddress = new URL(window.location.href).searchParams.get('address')
const network = document.querySelector('#network').value
const wallet2Mnemonic = localStorage.getItem(network + '-wallet-2-mnemonic')
const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })
const wallet = await Wallet.create({
  identity,
  arkServerUrl: NETWORKS[network].operator,
  settlementConfig: false,
})

const txid = await wallet.send({ address: externalWalletAddress, amount: 100 })
console.log('Transaction ID:', txid)
console.log('Success:', Boolean(txid))`;

const RECEIVE_PAYMENT_SOURCE = `import { ArkAddress } from '@arkade-os/sdk'

// Arrange
const network = document.querySelector('#network').value
const address1 = localStorage.getItem(network + '-wallet-1-address')
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

console.log('Receive Payment')
console.log('Address:', address1)
console.log('Total:', total + ' sats')
console.log('VTXOs:', vtxos.length)
console.log('Success:', success)`;

const PAYMENT_HISTORY_SOURCE = `import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

// Arrange
const network = document.querySelector('#network').value
const wallet2Mnemonic = localStorage.getItem(network + '-wallet-2-mnemonic')
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
console.log('Payment History')
console.log('Activities:', activities.length)
console.log('Success:', success)
activities.forEach((activity, index) => console.log(\`\${index + 1}:\`, activity.type ?? activity.amount ?? activity.key?.arkTxid ?? 'Activity'))`;

const MINT_ASSET_SOURCE = `import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

// Arrange
const network = document.querySelector('#network').value
const wallet2Mnemonic = localStorage.getItem(network + '-wallet-2-mnemonic')
const assetLabel = localStorage.getItem(network + '-asset-id')
const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })
const wallet = await Wallet.create({
  identity,
  arkServerUrl: 'https://' + network + '.arkade.sh',
  settlementConfig: false,
})
await wallet.getVtxos()

// Act
const { assetId } = await wallet.assetManager.issue({
  amount: 1n,
  metadata: { ticker: assetLabel },
})
localStorage.setItem(network + '-asset-id-' + assetLabel, assetId)

// Assert
const success = Boolean(assetId)
console.log('Mint Asset')
console.log('Asset label:', assetLabel)
console.log('Asset ID:', assetId)
console.log('Success:', success)`;

const SEND_ASSET_SOURCE = `import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

// Arrange
const network = document.querySelector('#network').value
const wallet2Mnemonic = localStorage.getItem(network + '-wallet-2-mnemonic')
const address1 = localStorage.getItem(network + '-wallet-1-address')
const assetLabel = localStorage.getItem(network + '-asset-id')
const assetId = localStorage.getItem(network + '-asset-id-' + assetLabel)
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
console.log('Send Asset')
console.log('Transaction ID:', txid)
console.log('Success:', success)`;

const RECEIVE_ASSET_SOURCE = `import { ArkAddress } from '@arkade-os/sdk'

// Arrange
const network = document.querySelector('#network').value
const address1 = localStorage.getItem(network + '-wallet-1-address')
const assetLabel = localStorage.getItem(network + '-asset-id')
const assetId = assetLabel === 'all' ? 'all' : localStorage.getItem(network + '-asset-id-' + assetLabel)
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

console.log('Receive Asset')
console.log('Address:', address1)
console.log('Asset filter:', assetLabel)
console.log('VTXOs:', matching.length)
console.log('Success:', success)`;

const ASSET_HISTORY_SOURCE = `import { MnemonicIdentity, Wallet } from '@arkade-os/sdk'

// Arrange
const network = document.querySelector('#network').value
const wallet2Mnemonic = localStorage.getItem(network + '-wallet-2-mnemonic')
const assetLabel = localStorage.getItem(network + '-asset-id')
const assetId = assetLabel === 'all' ? 'all' : localStorage.getItem(network + '-asset-id-' + assetLabel)
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
console.log('Asset History - Private Wallet')
console.log('Asset filter:', assetLabel)
console.log('Activities:', matching.length)
console.log('Success:', success)
matching.forEach((activity, index) => console.log(\`\${index + 1}:\`, activity.type ?? activity.assetId ?? activity.amount ?? activity.key?.arkTxid ?? 'Activity'))`;

const PUBLIC_ASSET_HISTORY_SOURCE = `import { ArkAddress } from '@arkade-os/sdk'

// Arrange
const network = document.querySelector('#network').value
const address1 = localStorage.getItem(network + '-wallet-1-address')
const assetLabel = localStorage.getItem(network + '-asset-id')
const assetId = assetLabel === 'all' ? 'all' : localStorage.getItem(network + '-asset-id-' + assetLabel)
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
console.log('Asset History - Public Address')
console.log('Address:', address1)
console.log('Asset filter:', assetLabel)
console.log('VTXOs:', matching.length)
console.log('Success:', success)
matching.forEach((vtxo, index) => console.log(\`\${index + 1}:\`, vtxo.assetId ?? vtxo.amount ?? vtxo.txid ?? 'VTXO'))`;

function addressScript(address) {
  const decoded = decodeArkadeAddress(address);
  return `5120${Array.from(decoded.vtxoTaprootKey, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

function getBaseURL(network, address) {
  return `${NETWORKS[network].operator}/v1/indexer/vtxos?scripts=${encodeURIComponent(addressScript(address))}`;
}

function OutputSection({ title, output, elapsedMs }) {
  return <section className="sandbox-output prototype-section" aria-label="Output">
    <div className="prototype-title-bar"><h2>Output</h2></div>
    <div className="sandbox-output-body">
      <div className="sandbox-output-meta">API Call Response Time: {elapsedMs === null ? '—' : `${(elapsedMs / 1000).toFixed(2)} secs`}</div>
      <textarea className="sandbox-output-field" rows="10" readOnly value={output ? [title, output].join('\n') : ''} aria-label="Demo output" />
    </div>
  </section>;
}

function useTimedOutput() {
  const [output, setOutput] = useState('');
  const [elapsedMs, setElapsedMs] = useState(null);
  function begin() {
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
  return <div className="sandbox-code-editor" style={{ '--sandbox-source-lines': sourceLines.length, '--sandbox-visible-lines': Math.min(sourceLines.length, 20) }}>
    <pre ref={lineNumbersRef} className="sandbox-code-lines" aria-hidden="true">{lineNumbers}</pre>
    <pre id={id} className="sandbox-code" tabIndex="0" aria-label="Source code" onScroll={event => { if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop; }}>{sourceLines.map((line, index) => <span key={index} className="sandbox-code-line" dangerouslySetInnerHTML={{ __html: highlightLine(line) }} />)}</pre>
  </div>;
}

const ASSET_IDS = ['all', ...Array.from({ length: 10 }, (_, index) => String(index).padStart(4, '0'))];

function AssetSelector({ network, value, onChange, includeAll = false }) {
  const options = includeAll ? ASSET_IDS : ASSET_IDS.slice(1);
  const id = `${network}-asset-id`;
  return <label className="sandbox-inline-input" htmlFor={id}>
    <span>Asset ID</span>
    <select id={id} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => <option key={option} value={option}>{option === 'all' ? 'All' : option}</option>)}
    </select>
  </label>;
}

function OperationDemo({ demoTitle, docsHref, docsTopic, input, sourceId, source, output, elapsedMs, running, onExecute, actionLabel = 'Execute', runningLabel = 'Executing…' }) {
  return <>
    <DocsSection href={docsHref} topic={docsTopic} />
    <section className="sandbox-demo-input prototype-section" aria-label="Input">
      <div className="prototype-title-bar"><h2>Input</h2></div>
      <div className="sandbox-demo-input-body sandbox-operation-input">{input}</div>
    </section>
    <section className="sandbox-demo prototype-section" aria-label="Demo">
      <div className="prototype-title-bar"><h2>Demo</h2></div>
      <div className="sandbox-demo-body">
        <label className="sandbox-code-label" htmlFor={sourceId}>Source code</label>
        <SourceCodeField id={sourceId} source={source} />
        <button className="sandbox-action-button" type="button" onClick={onExecute} disabled={running}>{running ? runningLabel : actionLabel}</button>
      </div>
    </section>
    <OutputSection title={demoTitle} output={output} elapsedMs={elapsedMs} />
  </>;
}

function assetSelectionStorageKey(network) {
  return `${network}-asset-id`;
}

function mintedAssetStorageKey(network, assetLabel) {
  return `${network}-asset-id-${assetLabel}`;
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
    <DocsSection href={DOCS_URLS.wallet} topic="Create your wallet" />
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
        <button className="sandbox-action-button" type="button" onClick={execute} disabled={running}>{running ? 'Executing…' : 'Execute'}</button>
      </div>
    </section>
    <OutputSection title="Get Wallet" output={output} elapsedMs={elapsedMs} />
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
      ].join('\n'));
      await wallet.dispose?.();
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
    } finally {
      finish(startedAt);
      setRunning(false);
    }
  }

  return <>
    <DocsSection href={DOCS_URLS.balance} topic="Checking balances" />
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
        <button className="sandbox-action-button" type="button" onClick={execute} disabled={running}>{running ? 'Executing…' : 'Execute'}</button>
      </div>
    </section>
    <OutputSection title="Get Balance - Private Wallet" output={output} elapsedMs={elapsedMs} />
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
      ].join('\n'));
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
    } finally {
      finish(startedAt);
      setRunning(false);
    }
  }

  return <>
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
        <button className="sandbox-action-button" type="button" onClick={execute} disabled={running}>{running ? 'Executing…' : 'Execute'}</button>
      </div>
    </section>
    <OutputSection title="Get Balance - Public Address" output={output} elapsedMs={elapsedMs} />
  </>;
}

async function createDemoWallet(network) {
  const wallet2Mnemonic = setupWalletProfileValues(network).mnemonic2;
  if (!wallet2Mnemonic.trim()) throw new Error('Enter Wallet 2 Mnemonic on Setup Input first.');
  const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false });
  const wallet = await Wallet.create({ identity, arkServerUrl: NETWORKS[network].operator, settlementConfig: false });
  await wallet.getVtxos();
  return wallet;
}

function getMintedAssetId(network, assetLabel) {
  return assetLabel === 'all' ? 'all' : window.localStorage.getItem(mintedAssetStorageKey(network, assetLabel)) || '';
}

function DemoSendPayment({ network }) {
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  async function execute() {
    const startedAt = begin();
    setRunning(true); setOutput('');
    try {
      const wallet = await createDemoWallet(network);
      const address1 = setupWalletProfileValues(network).address1;
      const txid = await wallet.send({ address: address1, amount: 100 });
      setOutput([`Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'));
      await wallet.dispose?.();
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Send Payment" docsHref={DOCS_URLS.sendPayment} docsTopic="Sending payments" sourceId="send-payment-source" source={SEND_PAYMENT_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="send-payment-mnemonic">Wallet 2 Mnemonic</label>
    <input id="send-payment-mnemonic" value={maskMnemonic(setupWalletProfileValues(network).mnemonic2)} readOnly />
    <label htmlFor="send-payment-address">Wallet 1 Address</label>
    <input id="send-payment-address" value={setupWalletProfileValues(network).address1} readOnly />
    <label htmlFor="send-payment-amount">Amount</label>
    <input id="send-payment-amount" value="100 sats" readOnly />
  </>} />;
}

function externalWalletPaymentResult(search) {
  const result = new URLSearchParams(search);
  if (result.get('status') === 'sent') {
    const txid = result.get('txid');
    return [`Wallet result: sent`, ...(txid ? [`Transaction ID: ${txid}`] : []), 'Success: true'].join('\n');
  }
  if (result.has('error')) return [`Wallet result: ${result.get('error')}`, 'Success: false'].join('\n');
  return 'Open Arkade Wallet, review the payment there, then approve or decline it. This page will show the wallet callback after it returns.';
}

function DemoExternalWalletPayment({ network }) {
  const [amount, setAmount] = useState('100');
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  const [callbackResult, setCallbackResult] = useState(() => externalWalletPaymentResult(window.location.search));

  useEffect(() => {
    const updateResult = () => setCallbackResult(externalWalletPaymentResult(window.location.search));
    window.addEventListener('popstate', updateResult);
    return () => window.removeEventListener('popstate', updateResult);
  }, []);

  async function openWallet() {
    const startedAt = begin();
    setRunning(true);
    setOutput('');
    try {
      const address = setupWalletProfileValues(network).address1;
      const provider = new RestArkProvider(NETWORKS[network].operator);
      const info = await provider.getInfo();
      validateArkadeAddress(address, info, network);
      const link = walletPaymentUrl({ network, address, amountSats: amount, callback: walletCallbackUrl(window.location.href) });
      window.location.assign(link);
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
      finish(startedAt);
      setRunning(false);
    }
  }

  return <OperationDemo demoTitle="Send Payment from External Wallet" docsHref={DOCS_URLS.externalWallet} docsTopic="Arkade Wallet app links" sourceId="external-wallet-payment-source" source={EXTERNAL_WALLET_PAYMENT_SOURCE} output={output || callbackResult} elapsedMs={elapsedMs} running={running} onExecute={openWallet} actionLabel="Send Payment from External Wallet" runningLabel="Checking recipient…" input={<>
    <label htmlFor="external-wallet-address">Recipient: Wallet 1 Address</label>
    <input id="external-wallet-address" value={setupWalletProfileValues(network).address1} readOnly spellCheck="false" />
    <label htmlFor="external-wallet-amount">Amount in sats</label>
    <input id="external-wallet-amount" value={amount} onChange={event => setAmount(event.target.value)} inputMode="numeric" spellCheck="false" autoComplete="off" />
  </>} />;
}

function DemoReceivePayment({ network }) {
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
function externalWalletAddressResult(search) {
  const result = new URLSearchParams(search);
  if (result.has('error')) return { error: result.get('error') || 'denied' };
  return { address: result.get('address') || '' };
}

function DemoExternalWalletReceivePayment({ network }) {
  const { output, setOutput, elapsedMs, begin, finish } = useTimedOutput();
  const [running, setRunning] = useState(false);
  const [externalAddress, setExternalAddress] = useState(() => externalWalletAddressResult(window.location.search).address);
  const receivedAddress = useRef('');

  async function payExternalWallet(address) {
    const startedAt = begin();
    setRunning(true);
    setOutput('');
    try {
      const provider = new RestArkProvider(NETWORKS[network].operator);
      const info = await provider.getInfo();
      validateArkadeAddress(address, info, network);
      const wallet = await createDemoWallet(network);
      const txid = await wallet.send({ address, amount: 100 });
      setOutput([`External wallet address: ${address}`, `Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'));
      await wallet.dispose?.();
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
    } finally {
      finish(startedAt);
      setRunning(false);
    }
  }

  useEffect(() => {
    const result = externalWalletAddressResult(window.location.search);
    if (result.error) {
      setOutput([`External wallet result: ${result.error}`, 'Success: false'].join('\n'));
      return;
    }
    if (!result.address || receivedAddress.current === result.address) return;
    receivedAddress.current = result.address;
    setExternalAddress(result.address);
    const callback = new URL(window.location.href);
    callback.search = '';
    callback.hash = '';
    window.history.replaceState(window.history.state, '', callback);
    void payExternalWallet(result.address);
  }, [network]);

  function receivePayment() {
    try {
      window.location.assign(walletConnectUrl({ network, callback: walletCallbackUrl(window.location.href) }));
    } catch (error) {
      setOutput([`Error: ${error.message}`, 'Success: false'].join('\n'));
    }
  }

  return <OperationDemo demoTitle="Receive Payment to External Wallet" docsHref={DOCS_URLS.externalWallet} docsTopic="Arkade Wallet app links" sourceId="external-wallet-receive-source" source={EXTERNAL_WALLET_RECEIVE_SOURCE} output={output || 'Click Receive Payment to External Wallet. Arkade Wallet will share its address, then Wallet 2 sends it 100 sats.'} elapsedMs={elapsedMs} running={running} onExecute={receivePayment} actionLabel="Receive Payment to External Wallet" runningLabel="Waiting for external wallet…" input={<>
    <label htmlFor="external-wallet-receive-address">External Wallet Address</label>
    <input id="external-wallet-receive-address" value={externalAddress} readOnly placeholder="Choose an external wallet" spellCheck="false" />
    <label htmlFor="external-wallet-receive-mnemonic">Wallet 2 Mnemonic</label>
    <input id="external-wallet-receive-mnemonic" value={maskMnemonic(setupWalletProfileValues(network).mnemonic2)} readOnly />
    <label htmlFor="external-wallet-receive-amount">Amount</label>
    <input id="external-wallet-receive-amount" value="100 sats" readOnly />
  </>} />;
}

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
      setOutput([`Address: ${address1}`, `Total: ${total} sats`, `VTXOs: ${vtxos.length}`, `Success: ${response.ok}`].join('\n'));
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Receive Payment" docsHref={DOCS_URLS.receivePayment} docsTopic="Receiving payments" sourceId="receive-payment-source" source={RECEIVE_PAYMENT_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="receive-payment-address">Wallet 1 Address</label>
    <input id="receive-payment-address" value={setupWalletProfileValues(network).address1} readOnly />
  </>} />;
}

function numberedPreviews(items, getValue) {
  return items.map((item, index) => `${index + 1}: ${getValue(item)}`);
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
        `Success: ${Array.isArray(activities)}`,
        ...numberedPreviews(activities, activity => activity.type ?? activity.amount ?? activity.key?.arkTxid ?? 'Activity'),
      ].join('\n'));
      await wallet.dispose?.();
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Payment History" docsHref={DOCS_URLS.paymentHistory} docsTopic="Payment history" sourceId="payment-history-source" source={PAYMENT_HISTORY_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
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
      const wallet = await createDemoWallet(network);
      const result = await wallet.assetManager.issue({ amount: 1n, metadata: { ticker: assetId } });
      window.localStorage.setItem(mintedAssetStorageKey(network, assetId), result.assetId);
      setOutput([`Asset label: ${assetId}`, `Asset ID: ${result.assetId}`, `Success: ${Boolean(result.assetId)}`].join('\n'));
      await wallet.dispose?.();
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Mint Asset" docsHref={DOCS_URLS.mintAsset} docsTopic="Issue assets" sourceId="mint-asset-source" source={MINT_ASSET_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
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
      setOutput([`Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'));
      await wallet.dispose?.();
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Send Asset" docsHref={DOCS_URLS.sendAsset} docsTopic="Send assets" sourceId="send-asset-source" source={SEND_ASSET_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
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
      setOutput([`Address: ${address1}`, `Asset filter: ${assetId}`, `VTXOs: ${matching.length}`, `Success: ${response.ok}`].join('\n'));
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Receive Asset" docsHref={DOCS_URLS.receiveAsset} docsTopic="Check asset balance" sourceId="receive-asset-source" source={RECEIVE_ASSET_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
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
        `Success: ${Array.isArray(activities)}`,
        ...numberedPreviews(matching, activity => activity.type ?? activity.assetId ?? activity.amount ?? activity.key?.arkTxid ?? 'Activity'),
      ].join('\n'));
      await wallet.dispose?.();
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Asset History - Private Wallet" docsHref={DOCS_URLS.assetHistory} docsTopic="Check asset balance" sourceId="asset-history-source" source={ASSET_HISTORY_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
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
        `Success: ${response.ok}`,
        ...numberedPreviews(matching, vtxo => vtxo.assetId ?? vtxo.amount ?? vtxo.txid ?? 'VTXO'),
      ].join('\n'));
    } catch (error) { setOutput([`Error: ${error.message}`, 'Success: false'].join('\n')); } finally { finish(startedAt); setRunning(false); }
  }
  return <OperationDemo demoTitle="Asset History - Public Address" docsHref={DOCS_URLS.assetHistory} docsTopic="Check asset balance" sourceId="public-asset-history-source" source={PUBLIC_ASSET_HISTORY_SOURCE} output={output} elapsedMs={elapsedMs} running={running} onExecute={execute} input={<>
    <label htmlFor="public-asset-history-address">Wallet 1 Address</label>
    <input id="public-asset-history-address" value={setupWalletProfileValues(network).address1} readOnly />
    <AssetSelector network={network} value={assetId} onChange={setAssetId} includeAll />
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
    document.title = `BIS - Prototype Interactive Docs${activeTitle ? ` - ${activeTitle}` : ''}`;
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
        <div className="spike-identity"><PrototypeMark /><h1>BIS - Prototype Interactive Docs{activeTitle ? ` - ${activeTitle}` : ''}</h1></div>
        <label className="network-picker" htmlFor="network"><span>Network</span><select id="network" value={network} onChange={event => changeNetwork(event.target.value)}>{NETWORK_IDS.map(id => <option key={id} value={id}>{NETWORKS[id].label}</option>)}</select></label>
      </div>
    </header>
    <div className="sandbox-workspace">
      <Navigation activeDemo={homeActive || setupActive ? null : activeDemo} homeActive={homeActive} setupActive={setupActive} onNavigate={navigate} />
      <main className="sandbox-main-content">
        {homeActive && <HomeSection />}
        {setupActive && <SetupSection />}
        {!homeActive && !setupActive && activeDemo === 1 && <DemoCreateWallet network={network} />}
        {!homeActive && !setupActive && activeDemo === 2 && <DemoGetBalancePrivate network={network} />}
        {!homeActive && !setupActive && activeDemo === 3 && <DemoGetBalancePublic network={network} />}
        {!homeActive && !setupActive && activeDemo === 4 && <DemoSendPayment network={network} />}
        {!homeActive && !setupActive && activeDemo === 5 && <DemoReceivePayment network={network} />}
        {!homeActive && !setupActive && activeDemo === 6 && <DemoPaymentHistory network={network} />}
        {!homeActive && !setupActive && activeDemo === 7 && <DemoMintAsset network={network} />}
        {!homeActive && !setupActive && activeDemo === 8 && <DemoSendAsset network={network} />}
        {!homeActive && !setupActive && activeDemo === 9 && <DemoReceiveAsset network={network} />}
        {!homeActive && !setupActive && activeDemo === 10 && <DemoAssetHistory network={network} />}
        {!homeActive && !setupActive && activeDemo === 11 && <DemoAssetHistoryPublic network={network} />}
        {!homeActive && !setupActive && activeDemo === 12 && <DemoExternalWalletPayment network={network} />}
      </main>
    </div>
    <footer className="spike-footer" aria-label="Footer" />
        {!homeActive && !setupActive && activeDemo === 13 && <DemoExternalWalletReceivePayment network={network} />}
  </div>;
}

