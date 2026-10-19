// Display-only integration examples. Execution stays in App.tsx and conditional-vault.ts.
export function conditionalVaultDemoSource(action: 'create' | 'increment' | 'check' | 'claim') {
  const privateWallet = action === 'create' || action === 'claim';
  const title = { create: 'Create', increment: 'Increment', check: 'Check', claim: 'Claim' }[action];
  const helper = `${action}ConditionalVault`;
  const imports = [
    ...(privateWallet ? ["import { MnemonicIdentity, Wallet, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk'", "import { testNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts'"] : []),
    "import { localStorageGetItem, setupWalletProfileValues } from './navigation.ts'",
    `import { ${helper}${action !== 'create' ? ', readStoredConditionalVault' : ''} } from './conditional-vault.ts'`,
  ];
  const walletSetup = privateWallet ? `
const identity = MnemonicIdentity.fromMnemonic(setupWalletProfileValues(network).mnemonic2, { isMainnet: false })
const wallet = await Wallet.create({
  identity,
  arkServerUrl: testNetwork(network).operator,
  walletMode: '${action === 'claim' ? 'static' : 'hd'}',
  lookAheadWindow: 20,
  settlementConfig: false,
  storage: {
    walletRepository: new InMemoryWalletRepository(),
    contractRepository: new InMemoryContractRepository(),
  },
})${action === 'create' ? `
await (await wallet.getContractManager()).refreshVtxos()
await wallet.getVtxos()` : ''}
` : '';
  const call = action === 'create'
    ? 'createConditionalVault(network, wallet, vaultId)'
    : `${helper}(network, ${action === 'claim' ? 'wallet, ' : ''}descriptor)`;
  return `// Arrange
${imports.join('\n')}

const network = localStorageGetItem('network')
const selectedId = localStorageGetItem('vault-id') || '0000'

const vaultId = 'conditional-vault-' + selectedId
${walletSetup}
// Act
let result
let error
try {
${action !== 'create' ? `  const descriptor = await readStoredConditionalVault(network, vaultId)
  if (!descriptor) throw new Error('VaultID ' + selectedId + ' does not exist. Create it first in this browser.')
` : ''}  result = await ${call}
} catch (caught) {
  error = caught
}${privateWallet ? ` finally {
  try { await wallet.dispose() } catch { /* Preserve the operation result. */ }
}` : ''}

// Assert
const inspection = ${action === 'check' ? 'result' : 'result?.inspection'}
const success = !error && ${action === 'check' ? "Boolean(inspection && ['locked', 'claimable', 'claimed', 'recovered', 'expired'].includes(inspection.status))" : "Boolean(result && ['verified', 'already-resolved'].includes(result.outcome))"}
console.log('Demo: ${title} Conditional Vault')
console.log('Network:', network)
console.log('Vault ID:', selectedId)
console.log('Amount: 1000 sats')
console.log('Transaction fee: 0 sats')
${action !== 'check' ? "if (result?.outcome) console.log('Outcome:', result.outcome)\n" : ''}if (inspection) {
  console.log('Progress:', inspection.progress, '/ 3')
  console.log('Status:', inspection.status)
  console.log('Time left:', Math.max(0, inspection.descriptor.deadline - Math.floor(Date.now() / 1000)), 'seconds')
  console.log('Deadline:', new Date(inspection.descriptor.deadline * 1000).toISOString())
  console.log('Funding Transaction ID:', inspection.descriptor.funding.transactionId)
  for (const evidence of inspection.evidence) console.log('Verified Transaction ID:', evidence.transactionId)
}
${action !== 'check' ? "if (result?.reason) console.log('Reason:', result.reason)\n" : ''}if (error) console.log('Error:', 'vault-network-operation-unavailable')
console.log('Success:', success)`;
}
