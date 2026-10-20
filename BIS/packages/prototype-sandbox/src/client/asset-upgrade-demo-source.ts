export const ASSET_UPGRADE_SOURCE = `// Arrange
import { InMemoryContractRepository, IndexedDBWalletRepository, MnemonicIdentity, Wallet } from '@arkade-os/sdk'
import { localStorageGetItem } from './navigation.ts'
import { createAssetUpgradeRequest, executeAssetUpgrade } from './asset-upgrade.ts'
import { NETWORKS } from '../../../prototype-faucet/src/shared/network-config.ts'

const network = localStorageGetItem('network')
const assetLabel = localStorageGetItem('asset-id')
const sourceAssetId = localStorageGetItem('asset-id-' + assetLabel)
const sourceLevel = localStorageGetItem('asset-id-' + assetLabel + '-level') || '1'
const wallet2Mnemonic = localStorageGetItem('wallet-2-mnemonic')
const identity = MnemonicIdentity.fromMnemonic(wallet2Mnemonic, { isMainnet: false })
const wallet = await Wallet.create({
  identity,
  arkServerUrl: NETWORKS[network].operator,
  settlementConfig: false,
  storage: {
    walletRepository: new IndexedDBWalletRepository(),
    contractRepository: new InMemoryContractRepository(),
  },
})
const request = createAssetUpgradeRequest(network, assetLabel, sourceAssetId, sourceLevel)

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
console.log('Source Display Title:', result?.record?.sourceTitle ?? 'Sword Level 1')
console.log('Source Metadata Level:', result?.record?.sourceLevel ?? '1')
console.log('Replacement Asset ID:', result?.record?.replacementAssetId ?? 'unresolved')
console.log('Replacement Display Title:', result?.record?.replacementTitle ?? 'Sword Level 2')
console.log('Replacement Metadata Level:', result?.record?.replacementLevel ?? '2')
console.log('Phase:', result?.record?.phase ?? 'not-started')
if (result?.record?.issueTransactionId) console.log('Issue Transaction ID:', result.record.issueTransactionId)
if (result?.record?.burnTransactionId) console.log('Burn Transaction ID:', result.record.burnTransactionId)
if (error) console.log('Error:', error.message)
if (result?.message) console.log('Recovery:', result.message)
console.log('Success:', success)`;

