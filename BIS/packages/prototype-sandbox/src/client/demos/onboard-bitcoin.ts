// Arrange
import { demoResult, demoDisposeWallet, demoErrorMessage, type DemoContext } from '../demo-runtime.ts';
import { Ramps } from '@arkade-os/sdk';
import { demoCreateWallet } from '../demo-wallet.ts';

export async function runDemo({ network }: DemoContext) {
  let wallet;
  let boardingAddress = '';

  // Act
  try {
    wallet = await demoCreateWallet(network, { isolated: true });
    boardingAddress = await wallet.getBoardingAddress();
    const { fees } = await wallet.arkProvider.getInfo();
    const txid = await new Ramps(wallet).onboard(fees);

    // Assert
    return demoResult([`Boarding Address: ${boardingAddress}`, `Onboarding Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'bitcoin-transaction', identifier: txid } });
  }
  catch (error) {
    return demoResult([...(boardingAddress ? [`Boarding Address: ${boardingAddress}`, 'Next: fund this address with testnet BTC, then retry.'] : []), `Error: ${demoErrorMessage(error)}`, 'Success: false'].join('\n'), { explorer: boardingAddress ? { network, kind: 'bitcoin-address', identifier: boardingAddress } : undefined });
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
