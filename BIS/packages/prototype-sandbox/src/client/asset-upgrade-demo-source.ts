export const ASSET_UPGRADE_SOURCE = `// Arrange
import { localStorageGetItem } from './navigation.ts'
import { createAssetUpgradeRequest, executeAssetUpgrade } from './asset-upgrade.ts'

const network = localStorageGetItem('network')
const assetLabel = localStorageGetItem('asset-id')
const sourceAssetId = localStorageGetItem('asset-id-' + assetLabel)
const wallet = await createDemoWallet(network)
const request = createAssetUpgradeRequest(network, assetLabel, sourceAssetId)

// Act
let result
let error
try {
  if (!sourceAssetId) throw new Error('Use Mint Asset demo first.')
  result = await executeAssetUpgrade({ wallet, request })
} catch (caught) {
  error = caught
}
await wallet.dispose?.()

// Assert
const success = !error && result?.status === 'complete'
console.log('Demo: Upgrade Asset')
console.log('Source Asset ID:', sourceAssetId)
console.log('Replacement Asset ID:', result?.record?.replacementAssetId ?? 'unresolved')
console.log('Phase:', result?.record?.phase ?? 'not-started')
if (result?.record?.issueTransactionId) console.log('Issue Transaction ID:', result.record.issueTransactionId)
if (result?.record?.burnTransactionId) console.log('Burn Transaction ID:', result.record.burnTransactionId)
if (error) console.log('Error:', error.message)
if (result?.message) console.log('Recovery:', result.message)
console.log('Success:', success)`;
