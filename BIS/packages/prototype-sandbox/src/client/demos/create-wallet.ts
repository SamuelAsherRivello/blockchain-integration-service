// Arrange
import { demoResult, demoDisposeWallet, type DemoContext } from '../demo-runtime.ts';
import { demoGetInput } from '../navigation.ts';
import { demoCreateWallet } from '../demo-wallet.ts';

export async function runDemo({ network }: DemoContext) {
  const currentMnemonic = demoGetInput(network, 'wallet-2-mnemonic');
  if (!currentMnemonic.trim())
    throw new Error('Enter Wallet 2 Mnemonic on Setup Input first.');
  let wallet;

  // Act
  try {
    wallet = await demoCreateWallet(network, { mnemonic: currentMnemonic, walletMode: 'auto', refresh: false });
    const address = await wallet.getAddress();

    // Assert
    return demoResult([`Arkade Address: ${address}`, `Success: ${Boolean(address)}`].join('\n'));
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
