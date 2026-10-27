// Arrange
import { demoResult, demoDisposeWallet, type DemoContext } from '../demo-runtime.ts';
import { OnchainWallet, Ramps } from '@arkade-os/sdk';
import { demoCreateWallet } from '../demo-wallet.ts';

export async function runDemo({ network }: DemoContext) {
  let wallet;

  // Act
  try {
    wallet = await demoCreateWallet(network, { isolated: true });
    const destinationAddress = (await OnchainWallet.create(wallet.identity, network)).address;
    const { fees } = await wallet.arkProvider.getInfo();
    const txid = await new Ramps(wallet).offboard(destinationAddress, fees);

    // Assert
    return demoResult([`Bitcoin Destination: ${destinationAddress}`, `Offboarding Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'bitcoin-transaction', identifier: txid } });
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
