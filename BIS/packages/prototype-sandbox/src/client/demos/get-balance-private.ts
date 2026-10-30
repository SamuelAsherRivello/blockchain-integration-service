
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoResult,
  demoDisposeWallet,
  type DemoContext,
  demoTransactionDetails,
  demoGetInput,
  demoCreateWallet,
  type DemoHistoryEntry,
} from '../sandbox-shared.ts';
import { MnemonicIdentity } from '@arkade-os/sdk';

export async function runDemo({ network }: DemoContext) {
  const currentMnemonic = demoGetInput(network, 'wallet-2-mnemonic');
  if (!currentMnemonic.trim())
    throw new Error('Enter Wallet 2 Mnemonic on Setup Input first.');
  let wallet;

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  try {
    wallet = await demoCreateWallet(network, { identity: MnemonicIdentity.fromMnemonic(currentMnemonic, { isMainnet: false }), mnemonic: currentMnemonic, walletMode: 'auto', refresh: false });
    const balance = await wallet.getBalance();
    const address = await wallet.getAddress();
    const vtxos: DemoHistoryEntry[] = await wallet.getVtxos();

    //////////////////////////////////////////
    // Assert
    //////////////////////////////////////////
    return demoResult([
      `Address: ${address}`,
      `Available: ${balance.available} sats`,
      `Total: ${balance.total} sats`,
      `VTXOs: ${vtxos.length}`,
      `Success: ${Boolean(balance && address && Array.isArray(vtxos))}`,
    ].join('\n'), demoTransactionDetails(network, vtxos));
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
