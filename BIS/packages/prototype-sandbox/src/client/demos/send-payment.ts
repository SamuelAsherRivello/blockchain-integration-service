// Arrange
import { demoResult, demoDisposeWallet, type DemoContext } from '../demo-runtime.ts';
import { demoGetInput } from '../navigation.ts';
import { demoCreateWallet } from '../demo-wallet.ts';

export async function runDemo({ network }: DemoContext) {
  const address1 = demoGetInput(network, 'wallet-1-address');

  let wallet;

  // Act
  try {
    wallet = await demoCreateWallet(network);
    const txid = await wallet.send({ address: address1, amount: 100 });

    // Assert
    return demoResult([`Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: txid } });
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
