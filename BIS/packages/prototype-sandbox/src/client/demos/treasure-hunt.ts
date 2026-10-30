//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import { demoCreateWallet } from '../demo-wallet.ts';
import { demoGetInput } from '../navigation.ts';
import { demoDisposeWallet, demoResult, type DemoContext } from '../demo-runtime.ts';
import { demoTreasureSdkAction } from '../treasure-sdk.ts';

export async function runDemo({ network, treasure }: DemoContext) {
  const mnemonic = demoGetInput(network, 'wallet-2-mnemonic');
  if (!mnemonic.trim()) throw new Error('Enter Wallet 2 Mnemonic on Setup Input first.');
  if (!treasure) throw new Error('Open a Treasure Hunt step to run this demo.');
  let wallet;

//////////////////////////////////////////
// Act
//////////////////////////////////////////
  try {
    wallet = await demoCreateWallet(network, { mnemonic, refresh: false });
    const address = await wallet.getAddress();
    const result = await demoTreasureSdkAction(wallet, network, treasure.action);

//////////////////////////////////////////
// Assert
//////////////////////////////////////////
    return demoResult([
      `Network: ${network}`,
      'Signing: Arkade SDK. Browser validation; expiry is enforced by this browser.',
      `Wallet 2 address: ${address}`,
      `Status: ${result.status}`,
      result.message,
      ...(result.contractId ? [`Contract: ${result.contractId}`, `Contract address: ${result.contractAddress}`, `Original deadline: ${new Date(result.expiresAt!).toISOString()}`] : []),
      ...(result.transactionId ? [`Verified Arkade transaction: ${result.transactionId}`] : []),
      `Success: ${result.verified}`,
    ].join('\n'), result.transactionId ? { explorer: { network, kind: 'ark-transaction', identifier: result.transactionId } } : undefined);
  } finally {
    await demoDisposeWallet(wallet);
  }
}
